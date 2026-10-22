"""Release regressions with synthetic data; not evidence of social performance."""
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock
import test_studio as fixtures
import studio_store as st

class ProductionRegressions(unittest.TestCase):
    def setUp(self):
        self.f=fixtures.StoreTests();self.f.setUp();self.s=self.f.s
    def tearDown(self):self.f.tearDown()
    def test_valid_retention_remains_observed_not_inferred(self):
        self.assertEqual(st.counts({'retention_3s_pct':45.25,'average_watch_seconds':2.3}),{'retention_3s_pct':45.25,'average_watch_seconds':2.3})
        self.assertEqual(st.counts({'views':10}),{'views':10})
    def test_invalid_retention_cannot_enter_snapshots(self):
        for n in (-1,101,float('nan'),True,'50'):
            with self.subTest(n=n),self.assertRaises(ValueError):st.counts({'retention_3s_pct':n})
    def test_selected_pattern_is_a_saved_hypothesis(self):
        source=self.f.plan()['brief'];p=self.s.create_plan(dict(source,workspace='default',pattern_key='early_demo',pattern_window='72h',pattern_definition='instagram_views'))
        self.assertIn('pattern_basis',p);self.assertEqual(p['pattern_basis']['feature']['key'],'early_demo')
        self.assertEqual(p['pattern_basis']['feature']['status'],'insufficient matched evidence')
        self.assertTrue(any('insufficient' in x for x in p['limits']))
        self.assertEqual(p['beats'][3]['spoken'],source['proof'])
    def test_supported_pattern_keeps_counterexamples(self):
        self.f.seed_cohort();source=self.f.plan()['brief']
        p=self.s.create_plan(dict(source,workspace='default',pattern_key='early_demo',pattern_window='72h',pattern_definition='instagram_views'))
        f=p['pattern_basis']['feature'];self.assertTrue(f['support']);self.assertTrue(f['counterexamples']);self.assertEqual(f['status'],'exploratory association')
        self.assertIn('not a proven effect',p['hypothesis'])
    def test_no_comparison_across_disjoint_creator_feature_groups(self):
        base=datetime.now(timezone.utc)-timedelta(days=60)
        for creator in range(2):
            for n in range(7):
                p=self.f.post(creator*20+n+1,creator='Synthetic '+str(creator),demo=creator==0,published_at=(base+timedelta(days=n)).isoformat())
                self.f.snapshot(p,100 if creator==0 else 20)
        f=next(x for x in self.s.patterns('default','72h','instagram_views')['features'] if x['key']=='early_demo')
        self.assertEqual(f['with_n'],0);self.assertEqual(f['without_n'],0);self.assertIsNone(f['difference']);self.assertEqual(f['unmatched_feature_posts'],8)
    def test_malformed_pattern_key_rejected(self):
        with self.assertRaises(ValueError):self.s.create_plan(dict(self.f.plan()['brief'],pattern_key='guaranteed_viral'))
    def test_overlong_script_is_flagged_not_squeezed(self):
        b=self.f.plan()['brief'];b['proof']='Word '*200;b['duration']=10
        p=self.s.create_plan(b);self.assertGreater(p['script_density_wpm'],190);self.assertTrue(any('Rehearse' in x for x in p['limits']))
    def test_descriptive_outcome_uses_only_earlier_own_timed_posts(self):
        base=datetime.now(timezone.utc)-timedelta(days=30)
        for i in range(3):
            p=self.f.post(i+1,collection='own',published_at=(base+timedelta(days=i)).isoformat())
            self.s.add_snapshot({'post_id':p['id'],'window':'72h','definition':'instagram_views','observed_at':(st.moment(p['published_at'])+timedelta(hours=72)).isoformat(),'source':'Synthetic unit test','metrics':{'views':100,'saves':2}})
        own=self.f.post(9,collection='own',published_at=(base+timedelta(days=10)).isoformat())
        self.s.add_snapshot({'post_id':own['id'],'window':'72h','definition':'instagram_views','observed_at':(st.moment(own['published_at'])+timedelta(hours=72)).isoformat(),'source':'Synthetic unit test','metrics':{'views':100,'saves':5}})
        o=self.s.outcome({'post_id':own['id'],'primary_metric':'saves per view'});self.assertEqual(o['value'],5);self.assertEqual(o['baseline_n'],3);self.assertEqual(o['baseline_median'],2);self.assertEqual(o['difference'],3);self.assertEqual(o['relative'],2.5);self.assertIn('not a causal',o['note'])
    def test_missing_primary_metric_is_unknown(self):
        p=self.f.post(collection='own');self.f.snapshot(p)
        o=self.s.outcome({'post_id':p['id'],'primary_metric':'saves per view'});self.assertIsNone(o['value']);self.assertIsNone(o['baseline_median'])
    def test_lifetime_observation_is_not_timed_outcome(self):
        p=self.f.post(collection='own');self.s.add_snapshot({'post_id':p['id'],'window':'lifetime','definition':'instagram_views','source':'Synthetic','metrics':{'views':1000}})
        o=self.s.outcome({'post_id':p['id'],'primary_metric':'views at 72 hours'});self.assertIsNone(o['value'])
    def test_primary_outcome_does_not_silently_change_window(self):
        p=self.f.post(collection='own')
        observed=st.moment(p['published_at'])+timedelta(hours=24)
        self.s.add_snapshot({'post_id':p['id'],'window':'24h','definition':'instagram_views','observed_at':observed.isoformat(),'source':'Synthetic','metrics':{'views':50}})
        self.assertIsNone(self.s.outcome({'post_id':p['id'],'primary_metric':'views at 72 hours','window':'72h'})['value'])
        self.assertEqual(self.s.outcome({'post_id':p['id'],'primary_metric':'views','window':'24h'})['value'],50)

    def test_invalid_model_index_never_applies(self):
        f=fixtures.EngineTests();f.setUp()
        try:
            p,payload=f.semantic_fixture();f.e.models.chat.return_value['segments'][0]['labels']=['guaranteed viral']
            with self.assertRaises(ValueError):f.e.do_semantic('fixture',payload)
            self.assertIsNone(f.s.semantics(p['asset_id']))
        finally:f.tearDown()

if __name__=='__main__':unittest.main(verbosity=2)
