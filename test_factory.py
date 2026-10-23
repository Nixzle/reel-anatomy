"""Factory state and review tests. Human attestations below are test fixtures only."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'standalone'))
import factory_engine as f
import research_engine as r
from studio_store import Store,Conflict,digest

class FactoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.s=Store(self.tmp.name);r.setup(self.s);f.setup(self.s)
        self.source=r.save_source(self.s,{'title':'Synthetic study','content':'The test compared two openings. Results are not a guarantee.','url':'https://example.org/test','provenance':'Generated test fixture','kind':'paper','level':'excerpt','reviewed':True})
        self.claim=r.save_claim(self.s,{'statement':'The test compared two openings.','links':[{'source_id':self.source['id'],'stance':'supports','quote':'The test compared two openings.'}]})
        self.plan=self.s.create_plan({'topic':'Test the opening','audience':'Creators','goal':'Shares','promise':'Compare two openings','method':'Show both openings.','proof':'The test compared two openings.','footage':'Our footage','cta':'Test one change.','duration':10})
        self.c=f.create(self.s,{'plan_id':self.plan['id'],'claim_ids':[self.claim['id']]})
    def tearDown(self):self.tmp.cleanup()
    def ready(self):
        v=copy.deepcopy(self.c['variants'][0])
        for b in v['scenes']:b.update(card=True,nature='instruction',spoken='Compare both.',on_screen='Compare both.')
        v['scenes'][3].update(nature='assertion',spoken='The test compared two openings.',claim_ids=[self.claim['id']])
        v['silent_intentional']=True
        self.c=f.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v});return self.c
    def approved(self):
        self.ready();self.c=f.approve(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','reviewer':'AUTOMATED FIXTURE, not human acceptance','checks':{k:True for k in f.ATTESTATIONS}});return self.c
    def package(self,mode='draft'):return f.make_package(self.s,{'id':self.c['id'],'key':'A','mode':mode})
    def test_three_variants_reuse_without_mutating_plan(self):
        self.assertEqual(len(self.c['variants']),3);self.assertEqual(self.s.get_document(self.plan['id']),self.plan)
    def test_default_is_unreviewed_and_blocked(self):
        self.assertFalse(self.c['audits']['A']['reviewed']);self.assertTrue(self.c['audits']['A']['blockers'])
        with self.assertRaises(ValueError):self.package('reviewed')
    def test_draft_export_never_inherits_review(self):
        self.approved();p=self.package();self.assertEqual(p['mode'],'draft');self.assertIsNone(p['approval'])
    def test_ready_still_requires_all_attestations(self):
        self.ready();self.assertTrue(self.c['audits']['A']['ready_for_review'])
        with self.assertRaises(ValueError):f.approve(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','reviewer':'test','checks':{}})
    def test_reviewed_package_verifies_exact_state(self):
        self.approved();p=self.package('reviewed');self.assertTrue(f.verify_package(p)['reviewed'])
    def test_edit_clears_approval(self):
        self.approved();v=copy.deepcopy(self.c['variants'][0]);v['caption']='Changed caption.'
        self.c=f.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v});self.assertIsNone(self.c['variants'][0]['approval'])
    def test_old_revision_cannot_overwrite(self):
        original=copy.deepcopy(self.c);self.ready()
        with self.assertRaises(Conflict):f.save_variant(self.s,{'id':original['id'],'revision':original['revision'],'key':'A','variant':original['variants'][0]})
    def test_new_source_revision_invalidates_review(self):
        self.approved();source=r.record(self.s,'research_sources',self.source['id']);r.save_source(self.s,{**source,'note':'New review note'})
        with self.assertRaises(ValueError):self.package('reviewed')
    def test_evidence_refresh_clears_all_approvals(self):
        self.approved();self.c=f.refresh_evidence(self.s,{'id':self.c['id'],'revision':self.c['revision']});self.assertTrue(all(v['approval'] is None for v in self.c['variants']))
    def test_cross_workspace_claim_is_rejected(self):
        other=self.s.create_research({'title':'Other'})
        with self.assertRaises(ValueError):f.capture_evidence(self.s,other['id'],[self.claim['id']])
    def test_metadata_not_enough_for_reviewed_assertion(self):
        source=r.record(self.s,'research_sources',self.source['id']);r.save_source(self.s,{**source,'level':'metadata'})
        self.ready();self.assertFalse(f.with_audits(self.s,f.get(self.s,self.c['id']))['audits']['A']['ready_for_review'])
    def test_unreviewed_support_blocks_final(self):
        source=r.record(self.s,'research_sources',self.source['id']);r.save_source(self.s,{**source,'reviewed':False});self.c=f.refresh_evidence(self.s,{'id':self.c['id'],'revision':self.c['revision']});self.ready();self.assertTrue(any('unreviewed' in x for x in self.c['audits']['A']['blockers']))
    def test_opposition_requires_visible_limitation(self):
        claim=r.record(self.s,'research_claims',self.claim['id']);claim['links'].append({'source_id':self.source['id'],'stance':'challenges','quote':'Results are not a guarantee.'});r.save_claim(self.s,claim)
        self.c=f.refresh_evidence(self.s,{'id':self.c['id'],'revision':self.c['revision']});self.ready();self.assertTrue(any('opposing' in x for x in self.c['audits']['A']['blockers']))
        v=self.c['variants'][0];v['scenes'][3]['limitation']='Results are not a guarantee.';v['scenes'][3]['spoken']+=' Results are not a guarantee.';self.c=f.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v});self.assertFalse(any('opposing' in x for x in self.c['audits']['A']['blockers']))
    def test_guaranteed_viral_marketing_is_blocked(self):
        self.ready();v=self.c['variants'][0];v['caption']='We guarantee one million views.';self.c=f.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v});self.assertTrue(any('guarantee' in x for x in self.c['audits']['A']['blockers']))
    def test_no_guarantee_statement_is_not_blocked(self):
        self.ready();v=self.c['variants'][0];v['caption']='No one can promise virality. Test your opening.';self.c=f.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v});self.assertFalse(any('guarantee' in x for x in self.c['audits']['A']['blockers']))
    def test_asset_and_audio_rights_checked(self):
        self.ready();v=self.c['variants'][0];v['scenes'][0]['media']={'sha256':'a'*64,'name':'fixture.mp4','type':'video/mp4','bytes':100,'duration':1,'rights':'unconfirmed'};self.c=f.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v});b=self.c['audits']['A']['blockers'];self.assertTrue(any('rights' in x for x in b));self.assertTrue(any('shorter' in x for x in b))
    def test_narration_duration_checked(self):
        self.ready();v=self.c['variants'][0];v['narration']={'sha256':'a'*64,'name':'test.wav','type':'audio/wav','bytes':100,'duration':2,'rights':'owned'};self.c=f.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v});self.assertTrue(any('Narration length' in x for x in self.c['audits']['A']['blockers']))
    def test_timeline_overlap_rejected(self):
        v=self.c['variants'][0];v['scenes'][1]['start']=0
        with self.assertRaises(ValueError):f.save_variant(self.s,{'id':self.c['id'],'revision':self.c['revision'],'key':'A','variant':v})
    def test_javascript_json_number_roundtrip_preserves_package_integrity(self):
        self.approved();p=self.package('reviewed')
        def js_numbers(value):
            if isinstance(value,float) and value.is_integer():return int(value)
            if isinstance(value,dict):return {k:js_numbers(v) for k,v in value.items()}
            if isinstance(value,list):return [js_numbers(v) for v in value]
            return value
        transferred=json.loads(json.dumps(js_numbers(p)))
        self.assertTrue(f.verify_package(transferred)['reviewed'])
    def test_normalised_number_fingerprint_is_stable(self):
        self.assertEqual(f.digest({'start':0.0,'end':10.0}),f.digest({'start':0,'end':10}))
    def test_package_tampering_detected(self):
        p=self.package();p['variant']['scenes'][0]['spoken']='Tampered'
        with self.assertRaises(ValueError):f.verify_package(p)
    def test_package_shot_and_variant_path_injection_rejected(self):
        for where in ('key','index'):
            p=self.package()
            if where=='key':p['variant']['key']='../../escape'
            else:p['variant']['scenes'][0]['index']='../../escape'
            p.pop('package_hash');p['package_hash']=f.digest(p)
            with self.assertRaises(ValueError):f.verify_package(p)
    def test_svg_active_asset_rejected(self):
        with self.assertRaises(ValueError):f.clean_media({'sha256':'a'*64,'name':'bad.svg','type':'image/svg+xml','bytes':120,'duration':0})
    def test_backup_requires_new_approval(self):
        self.approved();data=f.bundle(self.s);f.import_bundle(self.s,data);restored=f.get(self.s,self.c['id']);self.assertIsNone(restored['variants'][0]['approval'])
    def test_receipt_requires_exact_fingerprints(self):
        self.ready();p=self.package()
        with self.assertRaises(Conflict):f.receipt(self.s,{'id':self.c['id'],'key':'A','mode':'draft','content_hash':'wrong','evidence_hash':p['audit']['evidence_hash'],'file_sha256':'a'*64,'bytes':2000,'mime':'video/mp4'})
    def test_receipt_is_not_publication(self):
        self.ready();p=self.package();r=f.receipt(self.s,{'id':self.c['id'],'key':'A','mode':'draft','content_hash':p['audit']['content_hash'],'evidence_hash':p['audit']['evidence_hash'],'file_sha256':'a'*64,'bytes':2000,'mime':'video/mp4'});self.assertIn('not published',r['status'])

if __name__=='__main__':unittest.main(verbosity=2)
