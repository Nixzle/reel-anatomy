"""Release-readiness contracts; fixtures are not human or campaign acceptance."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'standalone'))
import research_engine as research
import factory_engine as factory
import release_services as release
from studio_store import Store
sys.path.insert(0,str(Path(__file__).resolve().parent/'scripts'))
from check_release_gate import assess

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.store=Store(self.root);research.setup(self.store);factory.setup(self.store)
    def tearDown(self):self.temp.cleanup()
    def source(self,**overrides):
        return {'title':'Synthetic page','content':'This is a source page, not a verified conclusion.','kind':'paper','level':'excerpt','reviewed':False,'provenance':'Synthetic PDF SHA-256 '+'a'*64+' page 1','tags':['pdf','document-'+'a'*32,'page-1'],**overrides}
    def test_document_import_keeps_page_identity(self):
        result=release.import_document(self.store,{'document_hash':'a'*64,'sources':[self.source()]});self.assertEqual(result['created'],1)
        self.assertFalse(result['sources'][0]['reviewed'])
    def test_invalid_later_page_does_not_leave_partial_import(self):
        with self.assertRaises(ValueError):release.import_document(self.store,{'document_hash':'a'*64,'sources':[self.source(),self.source(title='',content='bad')]})
        self.assertEqual(research.summary(self.store,'default')['sources'],0)
    def test_document_cannot_self_certify_review(self):
        with self.assertRaises(ValueError):release.import_document(self.store,{'document_hash':'a'*64,'sources':[self.source(reviewed=True)]})
    def test_document_hash_mismatch_rejected(self):
        with self.assertRaises(ValueError):release.import_document(self.store,{'document_hash':'b'*64,'sources':[self.source()]})
    def test_duplicate_document_page_reuses_citation(self):
        data={'document_hash':'a'*64,'sources':[self.source()]};a=release.import_document(self.store,data);b=release.import_document(self.store,data)
        self.assertEqual(b['duplicates'],1);self.assertEqual(a['sources'][0]['citation'],b['sources'][0]['citation'])
    def campaign(self):
        plan=self.store.create_plan({'topic':'Synthetic production','audience':'Test audience','goal':'Shares','promise':'Inspect the fixture','method':'Show the fixture.','proof':'No performance is established.','footage':'Own generated test','cta':'Inspect.','duration':10})
        campaign=factory.create(self.store,{'plan_id':plan['id'],'claim_ids':[]})
        package=factory.make_package(self.store,{'id':campaign['id'],'key':'A','mode':'draft'})
        receipt=factory.receipt(self.store,{'id':campaign['id'],'key':'A','mode':'draft','content_hash':package['audit']['content_hash'],'evidence_hash':package['audit']['evidence_hash'],'file_sha256':'c'*64,'bytes':2000,'mime':'video/mp4'})
        return campaign,package,receipt
    def save_asset(self,a):
        (self.root/(a['id']+'.json')).write_text(json.dumps(a));return a
    def test_actual_export_registers_as_draft_without_metrics(self):
        c,p,r=self.campaign();out=release.register_render(self.store,{'campaign_id':c['id'],'receipt_id':r['id'],'sha256':'c'*64,'package':p},self.save_asset)
        post=self.store.get_post(out['post_id']);a=self.store.asset(out['asset_id']);self.assertEqual(post['collection'],'draft');self.assertFalse(post['rights_confirmed']);self.assertEqual(a['metrics'],{});self.assertEqual(a['timing_method'],'authored-factory-timeline-v1');self.assertIn('not ASR',a['transcript_source'])
    def test_registering_same_export_is_idempotent(self):
        c,p,r=self.campaign();d={'campaign_id':c['id'],'receipt_id':r['id'],'sha256':'c'*64,'package':p};a=release.register_render(self.store,d,self.save_asset);b=release.register_render(self.store,d,self.save_asset);self.assertEqual(a['post_id'],b['post_id']);self.assertTrue(b['duplicate']);self.assertEqual(len(self.store.posts('default')),1)
    def test_unknown_render_hash_cannot_register(self):
        c,p,r=self.campaign()
        with self.assertRaises(ValueError):release.register_render(self.store,{'campaign_id':c['id'],'receipt_id':r['id'],'sha256':'d'*64,'package':p},self.save_asset)
    def test_render_from_another_workspace_rejected(self):
        c,p,r=self.campaign();workspace=self.store.create_research({'title':'Other'})['id']
        with self.assertRaises(ValueError):release.register_render(self.store,{'workspace':workspace,'campaign_id':c['id'],'receipt_id':r['id'],'sha256':'c'*64,'package':p},self.save_asset)


class GateTests(unittest.TestCase):
    def ledger(self):return json.loads((Path(__file__).resolve().parent/'standalone/RELEASE_TARGET.json').read_text())
    def test_candidate_preserves_open_gates(self):
        result=assess(self.ledger());self.assertTrue(result['passed']);self.assertFalse(result['stable_qualified']);self.assertIn('model',result['open_gates'])
    def test_stable_promotion_with_open_requirements_fails(self):
        self.assertFalse(assess(self.ledger(),stable=True)['passed'])
    def test_deleting_a_required_gate_does_not_improve_status(self):
        data=self.ledger();data['gates']=data['gates'][:-1]
        with self.assertRaises(ValueError):assess(data)
    def test_relabelling_a_candidate_as_stable_fails(self):
        data=self.ledger();data['candidate']='1.0.0';data['stable_qualified']=True
        with self.assertRaises(ValueError):assess(data)
    def test_checked_without_evidence_fails(self):
        data=self.ledger();data['gates'][0]['status']='checked';data['gates'][0].pop('evidence',None)
        with self.assertRaises(ValueError):assess(data)

if __name__=='__main__':unittest.main(verbosity=2)
