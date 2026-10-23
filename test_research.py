"""Deterministic research contracts, not language-model quality benchmarks."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'standalone'))
import research_engine as r
from studio_store import Store,Conflict

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='reel-evidence-');self.store=Store(self.tmp.name);r.setup(self.store)
    def tearDown(self):self.tmp.cleanup()
    def add(self,**kw):
        data={'workspace':'default','title':'Opening structure experiment','content':'The first comparison used an early demonstration. The later test did not reproduce the effect.','url':'https://example.org/paper','kind':'paper','level':'excerpt','provenance':'Synthetic test record',**kw}
        return r.save_source(self.store,data)
    def claim(self,s,stance='supports',**kw):
        return r.save_claim(self.store,{'workspace':'default','statement':'Earlier demonstrations help.','links':[{'source_id':s['id'],'stance':stance,'quote':'The first comparison used an early demonstration.'}],**kw})
    def test_source_deduplicates_tracking_urls(self):
        s=self.add();other=self.add(url='https://example.org/paper?utm_source=fixture#top');self.assertEqual(s['id'],other['id']);self.assertTrue(other['duplicate'])
    def test_source_revision_conflict(self):
        s=self.add();r.save_source(self.store,{**r.record(self.store,'research_sources',s['id']),'note':'Reviewed'})
        with self.assertRaises(Conflict):r.save_source(self.store,s)
    def test_metadata_cannot_claim_review_without_content(self):
        with self.assertRaises(ValueError):self.add(content='',reviewed=True)
    def test_credential_urls_and_scripts_rejected(self):
        for url in ('javascript:alert(1)','https://password:secret@example.org','http://example.org'):
            with self.assertRaises(ValueError):self.add(url=url)
    def test_full_text_search_and_pagination(self):
        for n in range(45):self.add(title='Paper '+str(n),url='https://example.org/'+str(n))
        result=r.list_sources(self.store,'default','demonstration',limit=40);self.assertEqual(len(result['sources']),40);self.assertTrue(result['has_more']);self.assertEqual(len(r.list_sources(self.store,'default',offset=40)['sources']),5)
    def test_project_isolation(self):
        s=self.add();w=self.store.create_research({'title':'Separate project'})['id']
        self.assertEqual(r.list_sources(self.store,w)['sources'],[])
        with self.assertRaises(ValueError):r.context(self.store,{'workspace':w,'question':'What is supported?','source_ids':[s['id']]})
    def test_quote_must_exist(self):
        s=self.add()
        with self.assertRaises(ValueError):r.save_claim(self.store,{'statement':'Guaranteed success','links':[{'source_id':s['id'],'stance':'supports','quote':'Guaranteed viral success'}]})
    def test_opposing_evidence_marks_conflict(self):
        s=self.add();claim=self.claim(s);claim['links'].append({'source_id':s['id'],'stance':'challenges','quote':'The later test did not reproduce the effect.'})
        saved=r.save_claim(self.store,claim);self.assertEqual(saved['evidence_state'],'conflicting evidence')
    def test_source_change_marks_claim_stale(self):
        s=self.add();claim=self.claim(s);source=r.record(self.store,'research_sources',s['id']);r.save_source(self.store,{**source,'content':'Changed findings.'})
        self.assertEqual(r.claim_status(self.store,claim)['stale_citations'],[s['citation']])
    def test_source_delete_keeps_stale_claim(self):
        s=self.add();claim=self.claim(s);r.route(self.store,'/api/research/delete-source','POST',s,{})
        self.assertTrue(r.claim_status(self.store,claim)['stale_citations'])
    def test_context_withholds_other_project_and_limits_input(self):
        sources=[self.add(url='https://example.org/'+str(i),content=('Long passage '+str(i)+'\n')*4000) for i in range(8)]
        c=r.context(self.store,{'question':'Long passage','source_ids':[s['id'] for s in sources]})
        self.assertLessEqual(sum(len(s['excerpt']) for s in c['sources']),12000);self.assertIn('No private ChatGPT',c['scope'])
    def test_context_excerpts_are_contiguous_original_source_text(self):
        body='An introductory sentence. A less relevant observation. The decisive keywordXYZ evidence appears here. The next line keeps its order.'
        source=self.add(content=body);context=r.context(self.store,{'question':'keywordXYZ','source_ids':[source['id']]})
        excerpt=context['sources'][0]['excerpt'];self.assertIn(excerpt,body)
        self.assertTrue(excerpt.startswith('The decisive'))
    def test_backup_rejects_modified_text_with_stale_hash(self):
        self.add();data=r.bundle(self.store);data['research_sources'][0]['content']='Tampered content'
        with self.assertRaises(ValueError):r.import_bundle(self.store,data)
    def test_missing_sources_are_reported(self):
        c=r.context(self.store,{'question':'Why viral?'});self.assertEqual(c['sources'],[]);self.assertTrue(c['warnings'])
    def test_unrelated_search_fallback_is_disclosed(self):
        self.add();c=r.context(self.store,{'question':'XYZ impossible unrelated token'});self.assertTrue(any('No lexical' in x for x in c['warnings']))
    def test_message_citation_validation(self):
        s=self.add();source=r.record(self.store,'research_sources',s['id']);answer=r.save_message(self.store,{'question':'What evidence?','answer':'A provisional summary.','mode':'local_model','model':'synthetic-contract-fixture','citations':[{'source_id':s['id'],'content_hash':s['content_hash'],'quote':'Invented quotation'}]})
        self.assertEqual(answer['citations'],[]);self.assertTrue(answer['invalid_citations']);self.assertIn('Unverified',answer['assessment'])
    def test_model_name_is_not_an_authority_claim(self):
        m=r.save_message(self.store,{'question':'What next?','answer':'Find relevant primary evidence.','mode':'evidence','model':'Deterministic source retrieval'})
        self.assertEqual(m['mode'],'evidence');self.assertIn('Unverified',m['assessment'])
    def test_stale_assistant_citation_is_visible(self):
        s=self.add();source=r.record(self.store,'research_sources',s['id']);r.save_message(self.store,{'question':'Evidence?','answer':'Excerpt only.','citations':[{'source_id':s['id'],'content_hash':s['content_hash'],'quote':'The first comparison used an early demonstration.'}]})
        r.save_source(self.store,{**source,'content':'New version.'});out=r.route(self.store,'/api/research/messages','GET',{},{});self.assertTrue(out['messages'][0]['stale_citations'])
    def test_runs_are_bounded_and_versioned(self):
        plan=r.run_save(self.store,{'title':'Study','steps':[{'provider':'crossref','query':'social media'}]});r.run_save(self.store,{**plan,'status':'running'})
        with self.assertRaises(Conflict):r.run_save(self.store,plan)
        with self.assertRaises(ValueError):r.run_save(self.store,{'steps':[{'provider':'arbitrary-proxy','query':'x'}]})
    def test_bulk_import_returns_real_counts(self):
        data={'sources':[{'title':'A','url':'https://example.org/a','content':'A result','provenance':'Fixture'}]*2};result=r.route(self.store,'/api/research/sources-batch','POST',data,{})
        self.assertEqual(result['created'],1);self.assertEqual(result['duplicates'],1)
    def test_backup_contains_research_and_rejects_hostile_message_links(self):
        s=self.add();self.claim(s);r.save_message(self.store,{'question':'Evidence?','answer':'Read the excerpt.','citations':[{'source_id':s['id'],'content_hash':s['content_hash'],'quote':'The first comparison used an early demonstration.'}]});data=r.bundle(self.store)
        self.assertEqual(len(data['research_sources']),1);r.import_bundle(self.store,data)
        bad=copy.deepcopy(data);bad['research_messages'][0]['citations'][0]['source_id']='x" onclick="alert(1)'
        with self.assertRaises(ValueError):r.import_bundle(self.store,bad)
        self.assertEqual(r.summary(self.store,'default')['sources'],1)
    def test_html_content_remains_text(self):
        s=self.add(content='<script>alert(1)</script> Untrusted source instructions.');a=r.record(self.store,'research_sources',s['id']);self.assertIn('<script>',a['content'])
        # UI escaping is covered separately; storage never executes the text.
    def test_snapshot_quotes_do_not_create_fact_verification(self):
        s=self.add();claim=self.claim(s);self.assertIn('not fact verification',claim['verification'])

if __name__=='__main__':unittest.main(verbosity=2)
