"""Narration timing and local-host safety regressions. No downloads or cloud requests."""
import copy
import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'standalone'))
import timed_captions as t
import factory_engine as factory
import test_factory as fixtures
import desktop_studio as desktop

class CaptionTests(unittest.TestCase):
    def test_srt_preserves_leading_and_internal_silence(self):
        cues=t.parse_subtitles('1\n00:00:01,000 --> 00:00:02,000\nFirst.\n\n2\n00:00:05,000 --> 00:00:06,000\nSecond.',10)
        self.assertEqual(cues[0]['start'],1);self.assertEqual(cues[1]['start'],5)
    def test_plain_text_is_not_alignment(self):
        with self.assertRaises(ValueError):t.parse_subtitles('Words without timing.',10)
    def test_overlaps_and_out_of_bounds_rejected(self):
        for cues in [[{'start':0,'end':4,'text':'A'},{'start':3,'end':5,'text':'B'}],[{'start':0,'end':11,'text':'A'}]]:
            with self.assertRaises(ValueError):t.validate_cues(cues,10)
    def test_nonfinite_boolean_rejected(self):
        for n in (True,float('nan'),float('inf')):
            with self.assertRaises(ValueError):t.validate_cues([{'start':n,'end':2,'text':'A'}],10)
    def test_words_split_at_pause_not_planned_shot(self):
        cues=t.cues_from_words([{'start':1,'end':1.5,'word':'First'},{'start':1.5,'end':2,'word':'sentence.'},{'start':5,'end':5.8,'word':'Next.'}],10)
        self.assertEqual(len(cues),2);self.assertEqual(cues[1]['start'],5)
    def test_no_words_does_not_create_fake_captions(self):
        with self.assertRaises(ValueError):t.cues_from_words([],10)
    def test_script_fingerprint_survives_js_numbers(self):
        self.assertEqual(t.script_fingerprint([{'start':0,'end':2,'spoken':'Text'}]),t.script_fingerprint([{'start':0.0,'end':2.0,'spoken':'Text'}]))
    def test_vtt_and_plain_markup(self):
        cues=t.parse_subtitles('WEBVTT\n\n00:01.000 --> 00:02.000\n<i>Hello</i>',10);self.assertEqual(cues[0]['text'],'Hello')
    def test_invalid_clock_rejected(self):
        with self.assertRaises(ValueError):t.parse_subtitles('1\n00:99:00,000 --> 00:99:02,000\nBad',10000)

class TrackTests(unittest.TestCase):
    setUp=fixtures.FactoryTests.setUp
    tearDown=fixtures.FactoryTests.tearDown
    ready=fixtures.FactoryTests.ready
    approved=fixtures.FactoryTests.approved
    package=fixtures.FactoryTests.package
    def add_audio(self):
        self.ready();v=self.c['variants'][0];v['narration']={'sha256':'a'*64,'name':'speech.wav','type':'audio/wav','bytes':100,'duration':10,'rights':'owned'};v['silent_intentional']=False
        self.c=factory.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v})
    def attach(self):
        self.add_audio();self.c=factory.save_captions(self.s,{'id':self.c['id'],'key':'A','revision':self.c['revision'],'narration_sha256':'a'*64,'subtitles':'1\n00:00:02,000 --> 00:00:03,000\n'+' '.join(b['spoken'] for b in self.c['variants'][0]['scenes'])});return self.c
    def test_track_records_audio_and_script(self):
        self.attach();track=self.c['variants'][0]['timed_captions'];self.assertEqual(track['cues'][0]['start'],2);self.assertEqual(track['narration_sha256'],'a'*64)
    def test_changed_script_blocks_render_until_rebound(self):
        self.attach();v=self.c['variants'][0];v['scenes'][0]['spoken']='Different script';self.c=factory.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v})
        with self.assertRaisesRegex(ValueError,'script'):self.package()
    def test_changed_narration_blocks_draft_as_well_as_reviewed(self):
        self.attach();v=self.c['variants'][0];v['narration']['sha256']='b'*64;self.c=factory.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v})
        with self.assertRaisesRegex(ValueError,'narration'):self.package()
    def test_incoming_track_cannot_bind_unrelated_narration(self):
        self.add_audio()
        with self.assertRaises(ValueError):factory.save_captions(self.s,{'id':self.c['id'],'key':'A','revision':self.c['revision'],'narration_sha256':'b'*64,'subtitles':'1\n00:00:01,000 --> 00:00:02,000\nX'})
    def test_caption_changes_clear_approval(self):
        self.attach();self.c=factory.approve(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','reviewer':'AUTOMATED FIXTURE','checks':{k:True for k in factory.ATTESTATIONS}})
        self.c=factory.save_captions(self.s,{'id':self.c['id'],'key':'A','revision':self.c['revision'],'clear':True});self.assertIsNone(self.c['variants'][0]['approval'])
    def test_clear_track_after_narration_removed(self):
        self.attach();v=self.c['variants'][0];v['narration']=None;v['silent_intentional']=True
        self.c=factory.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v})
        self.c=factory.save_captions(self.s,{'id':self.c['id'],'key':'A','revision':self.c['revision'],'clear':True})
        self.assertIsNone(self.c['variants'][0]['timed_captions']);self.package()
    def test_backup_keeps_timing_but_clears_approval(self):
        self.attach();factory.import_bundle(self.s,factory.bundle(self.s));self.assertEqual(factory.get(self.s,self.c['id'])['variants'][0]['timed_captions']['cues'][0]['start'],2)
    def test_changed_caption_words_block_human_review(self):
        self.attach();self.c=factory.save_captions(self.s,{'id':self.c['id'],'key':'A','revision':self.c['revision'],'narration_sha256':'a'*64,'subtitles':'1\n00:00:01,000 --> 00:00:02,000\nUnsupported new assertion.'})
        self.assertTrue(any('wording differs' in x for x in self.c['audits']['A']['blockers']))
    def test_caption_guarantee_is_not_hidden_outside_script(self):
        self.attach();self.c=factory.save_captions(self.s,{'id':self.c['id'],'key':'A','revision':self.c['revision'],'narration_sha256':'a'*64,'subtitles':'1\n00:00:01,000 --> 00:00:02,000\nWe guarantee one million views.'})
        self.assertTrue(any('guarantee' in x for x in self.c['audits']['A']['blockers']))
    def test_native_subtitles_use_narration_track(self):
        self.attach();p=self.package();sys.path.insert(0,str(Path(__file__).parent/'scripts'));import reel_factory
        with tempfile.TemporaryDirectory() as tmp:
            reel_factory.captions(p,Path(tmp));s=(Path(tmp)/'captions.srt').read_text();self.assertIn('00:00:02,000',s);self.assertEqual(s.count('-->'),1)
    def test_tampered_track_rejected_even_if_package_rehashed(self):
        self.attach();p=self.package();p['variant']['timed_captions']['cues'][0]['end']=99;p.pop('package_hash');p['package_hash']=factory.digest(p)
        with self.assertRaises(ValueError):factory.verify_package(p)

class BoundedAudioTests(unittest.TestCase):
    def test_actual_fixture_decodes_inside_bound(self):
        data=(Path(__file__).parent/'tests/fixtures/speech.wav').read_bytes()
        samples=desktop.decode_bounded_audio(data,10)
        self.assertGreater(len(samples),16000);self.assertLess(len(samples),160000)
    def test_small_limit_rejects_before_full_decode(self):
        data=(Path(__file__).parent/'tests/fixtures/speech.wav').read_bytes()
        with self.assertRaisesRegex(ValueError,'exceeds'):desktop.decode_bounded_audio(data,1)


class DesktopHostTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=desktop.ThreadingHTTPServer(('127.0.0.1',0),desktop.Handler);cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join(3)
    def request(self,path='/',method='GET',body=None,headers=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=5);conn.request(method,path,body=body,headers=headers or {});r=conn.getresponse();value=r.read();code=r.status;conn.close();return code,value
    def test_loopback_health_has_no_private_paths(self):
        code,body=self.request('/api/companion/health');self.assertEqual(code,200);data=json.loads(body);self.assertEqual(data['app'],'reel-anatomy-desktop');self.assertFalse(data['network_processing']);self.assertNotIn('Users',body.decode())
    def test_host_rebinding_rejected(self):
        self.assertEqual(self.request('/api/companion/health',headers={'Host':'attacker.example'})[0],403)
    def test_null_and_cross_site_origins_rejected(self):
        for origin in ('null','https://attacker.example'):
            self.assertEqual(self.request('/api/companion/health',headers={'Origin':origin})[0],403)
    def test_transcription_requires_session_token(self):
        self.assertEqual(self.request('/api/companion/jobs','POST',b'abc',{'Content-Type':'audio/wav'})[0],403)
    def test_arbitrary_command_and_url_routes_absent(self):
        code,_=self.request('/api/companion/execute','POST',b'{}',{'X-Reel-Token':desktop.TOKEN,'Content-Type':'application/json'});self.assertEqual(code,404)
    def test_path_traversal_does_not_reach_source(self):
        self.assertEqual(self.request('/%2e%2e/desktop_studio.py')[0],404)
    def test_empty_and_overlong_bodies_rejected(self):
        self.assertEqual(self.request('/api/companion/jobs','POST',b'',{'X-Reel-Token':desktop.TOKEN})[0],413)
    def test_reject_unsupported_content_before_upload(self):
        self.assertEqual(self.request('/api/companion/jobs','POST',b'{}',{'X-Reel-Token':desktop.TOKEN,'Content-Type':'text/html'})[0],415)

if __name__=='__main__':unittest.main(verbosity=2)
