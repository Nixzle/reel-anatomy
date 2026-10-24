"""Creative Lab contracts, using synthetic text/analytics only."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent/'standalone'))
import creative_lab as lab
from studio_store import Store,Conflict

class CreativeLabTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.s=Store(self.root);lab.setup(self.s)
    def tearDown(self):self.tmp.cleanup()
    def signal(self,**kw):return {'text':'How do I edit on a phone?','theme':'Phone editing','signal_kind':'question','source_url':'https://example.org/video','provenance':'Synthetic comment fixture',**kw}
    def import_signal(self,**kw):return lab.import_signals(self.s,{'signals':[self.signal(**kw)],'permission_confirmed':True})
    def plan(self,**kw):return lab.create_plan(self.s,{'topic':'Phone editing','audience':'Creators','goal':'Shares','promise':'Compare the actual before and after edit','proof':'A demonstration, not performance proof.','method':'Show how to open the timeline and compare the final result with the original recording.','cta':'Try one change.','footage':'Own test footage','duration':30,**kw})
    def asset(self,collection='reference'):
        a={'id':'a'*32,'title':'Synthetic reference','revision':1,'duration':30,'segments':[{'start':0,'end':10,'text':'Show how to open the timeline and compare the final result with the original recording.','role':'Demonstration'},{'start':10,'end':30,'text':'Compare what actually changed.','role':'Proof'}],'shots':[],'metrics':{}}
        (self.root/(a['id']+'.json')).write_text(json.dumps(a));return a,self.s.add_post(a['id'],'default',{'title':a['title'],'rights_confirmed':True,'collection':collection})
    def audit(self,p,**kw):return lab.audit_plan(self.s,{'plan_id':p['id'],'plan_revision':p['revision'],**kw})
    def series(self,**kw):
        a,p=self.asset('own');return lab.import_retention(self.s,{'post_id':p['id'],'permission_confirmed':True,'points':[{'seconds':0,'retention_percent':100},{'seconds':10,'retention_percent':60},{'seconds':30,'retention_percent':72}],'observed_at':'2026-10-24T01:00:00Z','source':'Synthetic analytics fixture',**kw})
    def test_default_profile_never_claims_training(self):self.assertEqual(lab.profile(self.s,'default')['revision'],0)
    def test_profile_requires_correct_revision(self):
        p=lab.save_profile(self.s,{'revision':0,'voice':'Direct','avoid':'guaranteed win'})
        self.assertEqual(p['revision'],1)
        with self.assertRaises(Conflict):lab.save_profile(self.s,{'revision':0})
    def test_example_requires_permission(self):
        with self.assertRaises(ValueError):lab.save_profile(self.s,{'revision':0,'example':'My example'})
    def test_audience_permission_required(self):
        with self.assertRaises(ValueError):lab.import_signals(self.s,{'signals':[self.signal()]})
    def test_csv_duplicates_do_not_inflate_counts(self):
        result=lab.import_signals(self.s,{'signals':[self.signal(),self.signal()], 'permission_confirmed':True});self.assertEqual(result['created'],1);self.assertEqual(result['duplicates'],1)
        self.assertEqual(self.import_signal()['created'],0)
    def test_identifiers_and_extra_author_fields_not_stored(self):
        lab.import_signals(self.s,{'signals':[dict(self.signal(text='Ask @person or mail@example.com or +61 400 111 222'),author='PRIVATE AUTHOR',user_id='SECRET')],'permission_confirmed':True})
        body=json.dumps(lab.rows(self.s,'default','signal'));self.assertNotIn('@person',body);self.assertNotIn('mail@example.com',body);self.assertNotIn('PRIVATE AUTHOR',body);self.assertNotIn('SECRET',body)
    def test_bad_later_row_leaves_batch_unmodified(self):
        with self.assertRaises(ValueError):lab.import_signals(self.s,{'signals':[self.signal(),self.signal(text='')],'permission_confirmed':True})
        self.assertEqual(lab.rows(self.s,'default','signal'),[])
    def test_distinct_sources_not_counted_as_distinct_people(self):
        self.import_signal();self.import_signal(source_url='https://example.org/other');g=lab.signal_report(self.s,'default')['groups'][0];self.assertEqual(g['unique_texts'],1);self.assertEqual(g['observations'],2)
    def test_audience_scope_isolated(self):
        self.import_signal();w=self.s.create_research({'title':'Other'})['id'];self.assertEqual(lab.signal_report(self.s,w)['total'],0)
    def test_voice_and_audience_basis_frozen_with_brief(self):
        lab.save_profile(self.s,{'revision':0,'voice':'Specific and calm','audience':'My viewers','cta':'Test it'})
        self.import_signal();sig=lab.rows(self.s,'default','signal')[0];p=self.plan(lab_signal_ids=[sig['id']]);self.assertEqual(p['creative_basis']['profile_revision'],1);self.assertEqual(p['creative_basis']['audience_observations'][0]['id'],sig['id'])
    def test_other_project_signal_rejected_before_plan_creation(self):
        self.import_signal();sig=lab.rows(self.s,'default','signal')[0];w=self.s.create_research({'title':'Other'})['id']
        with self.assertRaises(ValueError):self.plan(workspace=w,lab_signal_ids=[sig['id']])
        self.assertEqual(self.s.documents(w),[])
    def test_review_does_not_read_snapshots(self):
        self.asset();p=self.plan();self.s.snapshots=lambda *_:self.fail('Metrics entered creative review');r=self.audit(p);self.assertTrue(r['overlaps']);self.assertIn('metric-blind',r['method'])
    def test_duplicate_reference_asset_only_scanned_once(self):
        a,p=self.asset();self.s.add_post(a['id'],'default',{'title':'Second record','rights_confirmed':True});r=self.audit(self.plan());self.assertEqual(r['references_checked'],1)
    def test_own_posts_not_accused_of_reference_copying(self):
        self.asset('own');r=self.audit(self.plan());self.assertEqual(r['overlaps'],[])
    def test_avoid_phrases_checked_with_word_boundaries(self):
        lab.save_profile(self.s,{'revision':0,'avoid':'win'});p=self.plan(method='A window is not a promise to win.');r=self.audit(p);self.assertEqual(len([i for i in r['issues'] if i['code']=='voice_phrase']),1)
    def test_missing_payoff_mapping_not_certified(self):
        r=self.audit(self.plan());self.assertTrue(any(i['code']=='payoff_unmapped' for i in r['issues']))
    def test_late_payoff_disclosed_as_timing_rule(self):
        r=self.audit(self.plan(),payoff_beat=4);self.assertTrue(any(i['code']=='late_payoff' for i in r['issues']))
    def test_bad_payoff_index_rejected(self):
        with self.assertRaises(ValueError):self.audit(self.plan(),payoff_beat=True)
    def test_changed_profile_stales_old_reviews(self):
        self.audit(self.plan());lab.save_profile(self.s,{'revision':0,'voice':'New voice'});self.assertTrue(lab.reviews(self.s,'default')[0]['stale'])
    def test_changed_reference_text_stales_review(self):
        a,_=self.asset();self.audit(self.plan());a['segments'][0]['text']='Changed reference';(self.root/(a['id']+'.json')).write_text(json.dumps(a));self.assertTrue(lab.reviews(self.s,'default')[0]['stale'])
    def test_review_of_old_script_revision_rejected(self):
        p=self.plan();self.s.save_document(p)
        with self.assertRaises(Conflict):self.audit(p)
    def test_retention_points_preserve_replay_above_hundred(self):
        r=self.series(points=[{'seconds':0,'retention_percent':110},{'seconds':10,'retention_percent':120}]);self.assertEqual(r['points'][1]['retention_percent'],120)
    def test_unknown_sample_stays_unknown(self):self.assertIsNone(self.series()['sample_size'])
    def test_retention_counts_do_not_become_percentages(self):
        with self.assertRaises(ValueError):self.series(definition='view_count')
    def test_retention_duplicate_time_and_nan_rejected(self):
        for points in [[{'seconds':1,'retention_percent':90},{'seconds':1,'retention_percent':70}],[{'seconds':0,'retention_percent':100},{'seconds':10,'retention_percent':float('nan')}]]:
            with self.assertRaises(ValueError):lab.clean_points(points,30)
    def test_retention_identical_reimport_is_idempotent(self):
        a=self.series();b=self.series();self.assertEqual(a['id'],b['id']);self.assertTrue(b['duplicate'])
    def test_retention_drop_links_exact_transcript_interval(self):
        r=self.series();d=lab.retention_detail(self.s,{'id':r['id'],'workspace':'default'});drop=d['largest_drops'][0];self.assertEqual(drop['delta_points'],-40);self.assertEqual(drop['end'],10);self.assertEqual(len(drop['segments']),1);self.assertIn('Cause', 'Cause unknown')
    def test_lab_backup_restores_all_kinds(self):
        lab.save_profile(self.s,{'revision':0,'audience':'Creators'});self.import_signal();self.audit(self.plan());self.series();values=lab.bundle(self.s);lab.import_bundle(self.s,values);self.assertEqual(len(lab.bundle(self.s)),4)
    def test_malicious_restored_beat_rejected_before_mutation(self):
        self.audit(self.plan());values=lab.bundle(self.s);bad=copy.deepcopy(values);bad[0]['issues'][0]['beat_index']='0" onclick="alert(1)'
        with self.assertRaises(ValueError):lab.import_bundle(self.s,bad)
        self.assertEqual(lab.bundle(self.s),values)
    def test_empty_old_backup_clears_lab_extension_only(self):
        self.import_signal();lab.import_bundle(self.s,None);self.assertEqual(lab.bundle(self.s),[])

if __name__=='__main__':unittest.main(verbosity=2)
