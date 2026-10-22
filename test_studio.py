"""Synthetic data/transport fixtures; these tests do not benchmark a real semantic model."""
import copy
import json
import tempfile
import threading
import time
import types
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch
import studio_store as st
from studio_jobs import Engine, LocalModels

class StoreTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="reel-studio-test-");self.root=Path(self.temp.name);self.s=st.Store(self.root)
    def tearDown(self):self.temp.cleanup()
    def asset(self,number=1,demo=False):
        identity=("%032x"%number)
        a={"id":identity,"title":"Software example "+str(number),"duration":20,"media":"/media/"+identity,"revision":1,"segments":[{"index":0,"start":0,"end":3,"text":"How does this software help?","role":"Demonstration" if demo else "Hook","reason":"Synthetic fixture","edited":False},{"index":1,"start":5,"end":9,"text":"Try this example.","role":"CTA","reason":"Synthetic fixture","edited":False}],"shots":[{"index":0,"start":0,"end":20,"kind":"Detected shot"}],"metrics":{"views":987654321}}
        (self.root/(identity+".json")).write_text(json.dumps(a),encoding="utf-8");return a
    def post(self,n=1,**kw):
        a=self.asset(n,kw.pop("demo",False));meta={"title":a["title"],"creator":"Creator A","platform":"instagram","cohort":"software","distribution":"organic","collection":"reference","rights_confirmed":True,"published_at":(datetime.now(timezone.utc)-timedelta(days=15)).isoformat(),**kw}
        return self.s.add_post(a["id"],"default",meta)
    def snapshot(self,p,views=100,window="72h"):
        return self.s.add_snapshot({"post_id":p["id"],"window":window,"definition":"instagram_views","observed_at":(st.moment(p["published_at"])+timedelta(hours=72)).isoformat(),"source":"Synthetic test observation","metrics":{"views":views}})
    def plan(self):
        return self.s.create_plan({"workspace":"default","topic":"Software demonstration","audience":"Creators","goal":"Saves","promise":"Compare examples clearly","proof":"The recording shows two sample clips.","method":"Open the timeline and compare the two openings.","footage":"My screen recording","cta":"Save this checklist.","tone":"Practical","duration":30})
    def test_duplicate_publication_identity_and_distinct_platforms(self):
        p=self.post();a=self.s.add_post(p["asset_id"],"default",p);self.assertEqual(p["id"],a["id"])
        self.assertNotEqual(p["id"],self.s.add_post(p["asset_id"],"default",dict(p,platform="youtube"))["id"])
    def test_workspace_isolation(self):
        p=self.post();other=self.s.create_research({"title":"Other audience"});self.assertEqual(self.s.posts(other["id"]),[])
    def test_metadata_conflict(self):
        p=self.post();self.s.update_post(dict(p,creator="Updated"))
        with self.assertRaises(st.Conflict):self.s.update_post(p)
    def test_source_url_cannot_contain_credentials_or_script(self):
        for link in ("javascript:alert(1)","https://secret:password@example.org"):
            with self.assertRaises(ValueError):self.s.clean_meta({"source_url":link})
    def test_append_only_idempotent_snapshot(self):
        p=self.post();self.snapshot(p);self.snapshot(p);self.assertEqual(len(self.s.snapshots(p["id"])),1)
        self.snapshot(p,200);self.assertEqual(len(self.s.snapshots(p["id"])),2)
    def test_missing_counts_remain_missing(self):
        p=self.post();snap=self.snapshot(p);self.assertNotIn("shares",snap["metrics"])
    def test_timed_window_cannot_be_mislabelled(self):
        p=self.post()
        with self.assertRaises(ValueError):self.snapshot(p,window="24h")
    def test_invalid_metric_values(self):
        for value in (-1,float("nan"),True,2.5):
            with self.assertRaises(ValueError):st.counts({"views":value})
    def test_metric_definitions_are_not_mixed(self):
        p=self.post()
        with self.assertRaises(ValueError):self.s.add_snapshot({"post_id":p["id"],"window":"lifetime","definition":"youtube_views","metrics":{"views":1},"source":"Synthetic"})
    def test_sparse_data_has_no_viral_claim(self):
        p=self.post();self.snapshot(p);out=self.s.patterns("default","72h","instagram_views")
        self.assertEqual(out["matched_posts"],0);self.assertTrue(all(x["difference"] is None for x in out["features"]))
    def seed_cohort(self):
        base=datetime.now(timezone.utc)-timedelta(days=60)
        for creator in range(4):
            for i in range(9):
                demo=i>=3 and i%2==0
                p=self.post(creator*20+i+1,creator="Creator "+str(creator),demo=demo,published_at=(base+timedelta(days=i,seconds=creator)).isoformat())
                self.snapshot(p,50 if i==8 and creator==0 else 250 if demo else 100)
    def test_comparison_includes_baselines_and_counterexamples(self):
        self.seed_cohort();out=self.s.patterns("default","72h","instagram_views")
        self.assertEqual(out["matched_posts"],24)
        demo=next(x for x in out["features"] if x["key"]=="early_demo")
        self.assertGreater(demo["with_n"],0);self.assertGreater(demo["without_n"],0);self.assertTrue(demo["counterexamples"]);self.assertIsNotNone(demo["cluster_bootstrap_95"]);self.assertIsNotNone(demo["temporal_check"])
    def test_lifetime_counts_do_not_become_age_matched(self):
        self.seed_cohort();self.assertEqual(self.s.patterns("default","lifetime","instagram_views")["matched_posts"],0)
    def test_changed_publication_provenance_is_excluded(self):
        p=self.post();self.snapshot(p);self.s.update_post(dict(p,published_at=(st.moment(p["published_at"])+timedelta(days=2)).isoformat()))
        self.assertEqual(self.s.patterns("default","72h","instagram_views")["excluded"]["publication metadata changed since observation"],1)
    def test_plan_retrieves_structure_and_preserves_user_proof(self):
        self.post();p=self.plan();self.assertTrue(p["references"]);self.assertEqual(p["beats"][3]["spoken"],p["brief"]["proof"]);self.assertEqual(len(p["openings"]),3);self.assertIn("not learned AI",p["engine"])
    def test_plan_revision_history_and_conflict(self):
        p=self.plan();new=copy.deepcopy(p);new["beats"][0]["spoken"]="An original edit.";saved=self.s.save_document(new)
        self.assertEqual(saved["history"][0]["beats"][0]["spoken"],p["beats"][0]["spoken"])
        with self.assertRaises(st.Conflict):self.s.save_document(p)
    def test_rough_cut_review_links_real_timestamps(self):
        p=self.post(collection="draft");plan=self.plan();result=self.s.review_draft(plan["id"],p["id"])
        self.assertTrue(any(o["at"]==0 for o in result["observations"]));self.assertFalse(result["semantic_available"])
    def test_experiment_freezes_plan_and_retains_outcome_history(self):
        p=self.post(collection="draft");plan=self.plan();exp=self.s.create_experiment({"plan_id":plan["id"],"post_id":p["id"],"change":"Show the result before explaining."})
        with self.assertRaises(ValueError):self.s.update_experiment(dict(exp,status="published"))
        p=self.s.update_post(dict(p,collection="own",published_at=st.now()));exp=self.s.update_experiment(dict(exp,status="published"))
        self.s.add_snapshot({"post_id":p["id"],"window":"lifetime","definition":"instagram_views","source":"Synthetic","metrics":{"views":10}})
        exp=self.s.update_experiment(dict(exp,status="reviewed",assessment="First observation."));exp=self.s.update_experiment(dict(exp,status="reviewed",assessment="Second observation."))
        self.assertEqual(exp["history"][-1]["assessment"],"First observation.")
        plan["beats"][0]["spoken"]="Later changed script";self.s.save_document(plan)
        self.assertNotEqual(exp["frozen_plan"]["beats"][0]["spoken"],"Later changed script")

class EngineTests(StoreTests):
    def setUp(self):
        super().setUp();self.calls=0
        def analyse(path,title,transcript,metrics):
            self.calls+=1;a=self.asset(100+self.calls);old=self.root/(a["id"]+".json");old.unlink();a.update(id=path.stem,title=title,media="/media/"+path.stem);self.save(a);return a
        self.host=types.SimpleNamespace(DATA=self.root,APP_VERSION="test",MAX_VIDEO_BYTES=200*1024*1024,ANALYSIS_LOCK=threading.Lock(),LOCK=threading.RLock(),TAGS=("Hook","Problem","Context","Explanation","Demonstration","Proof","Payoff","Objection","CTA","Other"),analyse=analyse,save_project=self.save)
        self.e=Engine(self.host)
    def save(self,a):(self.root/(a["id"]+".json")).write_text(json.dumps(a),encoding="utf-8")
    def tearDown(self):self.e.close();super().tearDown()
    def wait(self,identity):
        for _ in range(100):
            j=next(x for x in self.e.jobs() if x["id"]==identity)
            if j["status"] in ("complete","failed"):return j
            time.sleep(.03)
        self.fail("Queue did not complete fixture")
    def fields(self,title):return {"video":(title,b"synthetic bytes: not real media"),"metadata":(None,json.dumps({"rights_confirmed":True,"workspace":"default","collection":"reference"}).encode())}
    def test_queue_reuses_analysis_without_merging_publications(self):
        j1=self.wait(self.e.import_video(self.fields("first.mp4"))["id"]);j2=self.wait(self.e.import_video(self.fields("second.mp4"))["id"])
        self.assertEqual(j1["status"],"complete",j1);self.assertEqual(j2["status"],"complete",j2);self.assertEqual(self.calls,1);self.assertTrue(j2["result"]["reused_analysis"]);self.assertNotEqual(j1["result"]["post_id"],j2["result"]["post_id"])
    def test_paused_queue_persists_and_resumes(self):
        self.e.store.set_setting("queue_paused",True);job=self.e.import_video(self.fields("paused.mp4"));time.sleep(.1);self.assertEqual(self.e.jobs()[0]["status"],"queued")
        self.e.close();self.e=Engine(self.host);self.e.start();self.assertTrue(self.e.store.setting("queue_paused"));self.e.control({"action":"resume_all"});self.assertEqual(self.wait(job["id"])["status"],"complete")
    def test_single_worker_owner_is_enforced(self):
        self.e.start();other=Engine(self.host)
        with self.assertRaises(st.Conflict):other.start()
        other.close()
    def test_processing_rights_are_explicit(self):
        f=self.fields("a.mp4");f["metadata"]=(None,b"{}")
        with self.assertRaises(ValueError):self.e.import_video(f)
    def test_disabled_model_never_calls_provider(self):
        p=self.post();self.e.models.inspect=Mock()
        with self.assertRaises(ValueError):self.e.enqueue_semantic(p["id"])
        self.e.models.inspect.assert_not_called()
    def semantic_fixture(self):
        p=self.post();digest="a"*64;self.e.store.set_setting("model",{"enabled":True,"model":"fixture-local","digest":digest,"capabilities":["completion"]});self.e.models.inspect=Mock(return_value={"digest":digest})
        self.e.models.chat=Mock(return_value={"segments":[{"index":0,"labels":["Hook","Problem"],"reason":"Synthetic response","confidence":"low"},{"index":1,"labels":["CTA"],"reason":"Synthetic response","confidence":"low"}],"frames":[],"summary":"Synthetic model contract fixture, not a real inference.","unknowns":[]})
        return p,{"asset_id":p["asset_id"],"model_digest":digest,"post_id":p["id"]}
    def test_model_contract_hides_metrics_and_reuses_validated_result(self):
        p,payload=self.semantic_fixture();r=self.e.do_semantic("fixture",payload);self.assertFalse(r["cached"])
        self.assertNotIn("987654321",self.e.models.chat.call_args.args[1]);self.e.models.chat.reset_mock();r=self.e.do_semantic("fixture",payload);self.assertTrue(r["cached"]);self.e.models.chat.assert_not_called()
    def test_invalid_semantic_evidence_is_rejected(self):
        p,payload=self.semantic_fixture();self.e.models.chat.return_value["segments"][0]["index"]=999
        with self.assertRaises(ValueError):self.e.do_semantic("fixture",payload)
        self.assertIsNone(self.e.store.semantics(p["asset_id"]))
    def test_model_suggestions_require_application_and_preserve_multiple_roles(self):
        p,payload=self.semantic_fixture();self.e.do_semantic("fixture",payload)
        self.assertEqual(self.s.asset(p["asset_id"])["segments"][0]["role"],"Hook")
        result=self.e.apply_semantics({"post_id":p["id"],"indices":[0]});a=self.s.asset(p["asset_id"]);self.assertEqual(result["applied"],1);self.assertEqual(a["segments"][0]["roles"],["Hook","Problem"]);self.assertFalse(a["segments"][0]["edited"])
    def test_interrupted_running_job_is_paused_not_replayed(self):
        payload={"kind":"semantic","title":"Interrupted unit fixture"}
        with self.e.store.db() as c:c.execute("INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?)",("interrupted","running",json.dumps(payload),"Old stage","",None,st.now(),st.now()))
        self.e.start();self.assertEqual(self.e.jobs()[0]["status"],"paused")
    def test_declared_cloud_model_is_rejected(self):
        model=LocalModels();model.status=Mock(return_value={"models":[{"name":"test","digest":"a"*64,"size":1}]});model.request=Mock(return_value={"remote_host":"https://example.org"})
        with self.assertRaises(ValueError):model.inspect("test")

if __name__=="__main__":unittest.main(verbosity=2)
