"""Durable research library. No platform scraping or invented performance data."""
from __future__ import annotations
import contextlib
import hashlib
import json
import math
import re
import sqlite3
import statistics
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

WINDOWS = ("24h", "72h", "7d", "lifetime")
DEFINITIONS = ("instagram_views", "youtube_views", "youtube_engaged_views", "tiktok_views", "manual_views")
COLLECTIONS = ("reference", "own", "draft")
PLATFORMS = ("instagram", "youtube", "tiktok", "other")
FEATURES = {"opening_question": "Question in the first five seconds", "early_demo": "Demonstration starts within five seconds", "early_proof": "Proof label within five seconds", "cta": "Call to action present", "frequent_cuts": "At least twelve estimated cuts per minute"}

def now():
    return datetime.now(timezone.utc).isoformat()

def uid():
    return uuid.uuid4().hex

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()

def text(value, limit=500, required=False):
    if not isinstance(value, str):
        raise ValueError("Expected text.")
    result = value.strip()
    if len(result) > limit or (required and not result):
        raise ValueError("Text is missing or too long.")
    return result

def moment(value):
    value = text(value, 64, True)
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("Use a timestamp with a timezone.")
    return dt.astimezone(timezone.utc)

def counts(value):
    if not isinstance(value, dict):
        raise ValueError("Metrics must be an object.")
    out = {}
    for key in ("views", "likes", "saves", "shares", "comments", "engaged_views", "conversions"):
        n = value.get(key)
        if n is None:
            continue
        if isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or n < 0 or int(n) != n or n > 9_007_199_254_740_991:
            raise ValueError("Metrics must be nonnegative finite integers.")
        out[key] = int(n)
    for key, ceiling in (("average_watch_seconds", 86400), ("retention_3s_pct", 100), ("completion_pct", 100)):
        n = value.get(key)
        if n is None:
            continue
        if isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or n < 0 or n > ceiling:
            raise ValueError("Watch-time values must be finite and retention percentages must be between 0 and 100.")
        out[key] = round(float(n), 4)
    return out

class Conflict(ValueError):
    pass

class Store:
    def __init__(self, root):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "studio.sqlite3"
        self.lock = threading.RLock()
        with self.db() as c:
            c.execute("PRAGMA journal_mode=WAL")
            c.executescript("""
                CREATE TABLE IF NOT EXISTS research(id TEXT PRIMARY KEY, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, workspace TEXT NOT NULL, body TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS post_workspace ON posts(workspace);
                CREATE INDEX IF NOT EXISTS post_asset ON posts(asset_id);
                CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY, post_id TEXT NOT NULL, window TEXT NOT NULL, definition TEXT NOT NULL, observed_at TEXT NOT NULL, body TEXT NOT NULL);
                CREATE INDEX IF NOT EXISTS snapshot_post ON snapshots(post_id,window,definition,observed_at);
                CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, workspace TEXT NOT NULL, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS experiments(id TEXT PRIMARY KEY, workspace TEXT NOT NULL, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, status TEXT NOT NULL, payload TEXT NOT NULL, stage TEXT NOT NULL, error TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS assets(cache_key TEXT PRIMARY KEY, asset_id TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS semantic(asset_id TEXT PRIMARY KEY, cache_key TEXT NOT NULL, body TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
                PRAGMA user_version=2;
            """)
            if not c.execute("SELECT 1 FROM research LIMIT 1").fetchone():
                doc = {"id": "default", "title": "My research", "audience": "", "topic": "", "objective": "Learn and test", "platform": "instagram", "created_at": now(), "revision": 1}
                c.execute("INSERT INTO research VALUES (?,?)", (doc["id"], json.dumps(doc)))

    @contextlib.contextmanager
    def db(self):
        connection = sqlite3.connect(self.path, timeout=15)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout=15000")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def research(self):
        with self.db() as c:
            return [json.loads(r[0]) for r in c.execute("SELECT body FROM research ORDER BY rowid")]

    def require_workspace(self, workspace):
        if not isinstance(workspace, str):
            raise ValueError("Select a research project.")
        with self.db() as c:
            row = c.execute("SELECT body FROM research WHERE id=?", (workspace,)).fetchone()
        if not row:
            raise ValueError("Research project not found.")
        return json.loads(row[0])

    def create_research(self, data):
        platform = data.get("platform", "instagram")
        if platform not in PLATFORMS:
            raise ValueError("Unsupported platform.")
        doc = {"id": uid(), "title": text(data.get("title", ""), 120, True), "audience": text(data.get("audience", "")), "topic": text(data.get("topic", "")), "objective": text(data.get("objective", "")), "platform": platform, "created_at": now(), "revision": 1}
        with self.db() as c:
            c.execute("INSERT INTO research VALUES (?,?)", (doc["id"], json.dumps(doc)))
        return doc

    def asset(self, asset_id):
        if not isinstance(asset_id, str) or not re.fullmatch(r"[a-f0-9]{32}", asset_id):
            raise ValueError("Invalid asset identity.")
        return json.loads((self.root / (asset_id + ".json")).read_text(encoding="utf-8"))

    def clean_meta(self, data):
        out = {k: text(data.get(k, ""), n) for k,n in (("title",120),("creator",100),("cohort",120),("source_url",1000))}
        if out["source_url"]:
            url = urlparse(out["source_url"])
            if url.scheme != "https" or not url.netloc or url.username or url.password:
                raise ValueError("Source links must be credential-free HTTPS URLs.")
        for key, choices, default in (("collection",COLLECTIONS,"reference"),("platform",PLATFORMS,"instagram"),("format",("reel","short","video","carousel","text"),"reel"),("distribution",("organic","paid","unknown"),"unknown")):
            out[key] = data.get(key, default)
            if out[key] not in choices:
                raise ValueError("Invalid " + key)
        out["rights_confirmed"] = data.get("rights_confirmed") is True
        out["published_at"] = moment(data["published_at"]).isoformat() if data.get("published_at") else None
        return out

    def add_post(self, asset_id, workspace, metadata):
        self.require_workspace(workspace)
        asset = self.asset(asset_id)
        meta = self.clean_meta(metadata)
        meta["title"] = meta["title"] or asset["title"]
        identity = digest([asset_id, workspace, meta["source_url"], meta["creator"], meta["published_at"], meta["collection"], meta["platform"], meta["format"], meta["title"]])[:32]
        with self.lock, self.db() as c:
            row = c.execute("SELECT body FROM posts WHERE id=?", (identity,)).fetchone()
            if row:
                return json.loads(row[0])
            post = dict(meta, id=identity, asset_id=asset_id, workspace=workspace, created_at=now(), revision=1)
            c.execute("INSERT INTO posts VALUES (?,?,?,?)", (identity,asset_id,workspace,json.dumps(post)))
        return post

    def legacy_import(self):
        # Existing analyses remain untouched and retain unknown permissions/metadata.
        with self.db() as c:
            known = {r[0] for r in c.execute("SELECT asset_id FROM posts")}
            known.update(json.loads(r[0]).get("asset_id") for r in c.execute("SELECT payload FROM jobs"))
        for p in self.root.glob("*.json"):
            if p.stem in known or not re.fullmatch(r"[a-f0-9]{32}",p.stem):
                continue
            try:
                asset = self.asset(p.stem)
                if "segments" in asset and "shots" in asset:
                    self.add_post(p.stem, "default", {"title":asset.get("title",p.stem)})
            except (OSError,ValueError,KeyError):
                continue

    def get_post(self, post_id):
        with self.db() as c:
            row = c.execute("SELECT body FROM posts WHERE id=?",(post_id,)).fetchone()
        if not row:
            raise ValueError("Post not found.")
        return json.loads(row[0])

    def update_post(self, data):
        with self.lock, self.db() as c:
            row = c.execute("SELECT body FROM posts WHERE id=?",(data.get("id"),)).fetchone()
            if not row:
                raise ValueError("Post not found.")
            old = json.loads(row[0])
            if data.get("revision") != old["revision"]:
                raise Conflict("Metadata changed in another tab. Reload before saving.")
            old.update(self.clean_meta(data));old["revision"] += 1
            c.execute("UPDATE posts SET body=? WHERE id=?",(json.dumps(old),old["id"]))
        return old

    def posts(self, workspace, query="", collection=""):
        self.require_workspace(workspace)
        with self.db() as c:
            rows = [json.loads(r[0]) for r in c.execute("SELECT body FROM posts WHERE workspace=? ORDER BY rowid DESC",(workspace,))]
        out=[]
        for p in rows:
            if collection and p["collection"] != collection:
                continue
            try:
                a=self.asset(p["asset_id"])
            except (ValueError,OSError):
                continue
            searchable=" ".join([p["title"],p["creator"],p["cohort"]]+[s.get("text","") for s in a.get("segments",[])])
            if query and query.casefold() not in searchable.casefold():
                continue
            out.append(dict(p,duration=a.get("duration",0),segment_count=len(a.get("segments",[])),shot_count=len(a.get("shots",[]))))
        return out

    def snapshots(self, post_id):
        self.get_post(post_id)
        with self.db() as c:
            return [json.loads(r[0]) for r in c.execute("SELECT body FROM snapshots WHERE post_id=? ORDER BY observed_at DESC,rowid DESC",(post_id,))]

    def add_snapshot(self, data):
        post=self.get_post(data.get("post_id"))
        window=data.get("window");definition=data.get("definition")
        if window not in WINDOWS or definition not in DEFINITIONS:
            raise ValueError("Select a supported observation window and view definition.")
        if definition != "manual_views" and not definition.startswith(post["platform"]+"_"):
            raise ValueError("Metric definition does not match this post's platform.")
        captured=moment(data.get("observed_at") or now())
        if (captured-datetime.now(timezone.utc)).total_seconds()>300:
            raise ValueError("An observation cannot be in the future.")
        published=post.get("published_at")
        if window != "lifetime":
            if not published:
                raise ValueError("Add the publication time before recording a timed snapshot.")
            age=(captured-moment(published)).total_seconds()/3600
            target={"24h":24,"72h":72,"7d":168}[window]
            if abs(age-target)>({"24h":6,"72h":12,"7d":24}[window]):
                raise ValueError("Capture time does not match the claimed post-age window.")
        elif published and captured < moment(published):
            raise ValueError("Capture time precedes publication.")
        metrics=counts(data.get("metrics",{}))
        if not metrics:
            raise ValueError("Supply at least one observed metric.")
        source=text(data.get("source",""),500,True)
        doc={"post_id":post["id"],"window":window,"definition":definition,"observed_at":captured.isoformat(),"metrics":metrics,"source":source,"entered_at":now(),"verified":False,"publication_at":post.get("published_at"),"platform":post["platform"]}
        doc["id"]=digest({k:v for k,v in doc.items() if k!="entered_at"})[:32]
        with self.db() as c:
            c.execute("INSERT OR IGNORE INTO snapshots VALUES (?,?,?,?,?,?)",(doc["id"],post["id"],window,definition,doc["observed_at"],json.dumps(doc)))
        return doc

    def setting(self,key,default=None):
        with self.db() as c:
            row=c.execute("SELECT value FROM settings WHERE key=?",(key,)).fetchone()
        return json.loads(row[0]) if row else default

    def set_setting(self,key,value):
        with self.db() as c:
            c.execute("INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",(key,json.dumps(value)))

    def semantics(self,asset_id):
        with self.db() as c:
            row=c.execute("SELECT body FROM semantic WHERE asset_id=?",(asset_id,)).fetchone()
        return json.loads(row[0]) if row else None

    def features(self,asset):
        speech=asset.get("segments",[]);shots=asset.get("shots",[]);duration=asset.get("duration",0)
        return {"opening_question":any("?" in s.get("text","") for s in speech if s.get("start",0)<5) if speech else None,
                "early_demo":any("Demonstration" in set(s.get("roles",[])+[s.get("role","")]) and s.get("start",0)<5 for s in speech) if speech else None,
                "early_proof":any("Proof" in set(s.get("roles",[])+[s.get("role","")]) and s.get("start",0)<5 for s in speech) if speech else None,
                "cta":any("CTA" in set(s.get("roles",[])+[s.get("role","")]) for s in speech) if speech else None,
                "frequent_cuts":(len(shots)-1)/duration*60 >= 12 if shots and duration else None}

    def patterns(self, workspace, window="24h", definition="instagram_views"):
        if window not in WINDOWS or definition not in DEFINITIONS:
            raise ValueError("Invalid comparison window or metric definition.")
        posts=self.posts(workspace)
        excluded={}
        def exclude(reason):
            excluded[reason]=excluded.get(reason,0)+1
        candidates=[]
        metric="engaged_views" if definition=="youtube_engaged_views" else "views"
        for post in posts:
            if post["collection"]=="draft":
                exclude("unpublished drafts");continue
            if post["distribution"]!="organic":
                exclude("paid or unknown distribution");continue
            if not post["creator"] or not post.get("published_at"):
                exclude("creator or publication time missing");continue
            snap=next((s for s in self.snapshots(post["id"]) if s["window"]==window and s["definition"]==definition),None)
            if not snap or metric not in snap["metrics"]:
                exclude("matching metric snapshot missing");continue
            if snap.get("publication_at")!=post["published_at"] or snap.get("platform")!=post["platform"]:
                exclude("publication metadata changed since observation");continue
            a=self.asset(post["asset_id"])
            duration=a.get("duration",0)
            duration_band="0-15" if duration<15 else "15-30" if duration<30 else "30-60" if duration<60 else "60+"
            candidates.append(dict(post,views=snap["metrics"][metric],features=self.features(a),group=(post["platform"],post["format"],post["cohort"],duration_band,a.get("timing_method","imported")),snapshot_id=snap["id"]))
        eligible=[]
        if window!="lifetime":
            for post in candidates:
                baseline=[p["views"] for p in candidates if p["creator"].casefold()==post["creator"].casefold() and p["group"]==post["group"] and p["published_at"]<post["published_at"]]
                if len(baseline)<3 or statistics.median(baseline)<=0:
                    exclude("fewer than three earlier matched creator posts or zero baseline");continue
                eligible.append(dict(post,relative_views=post["views"]/statistics.median(baseline),baseline_n=len(baseline)))
        else:
            for _ in candidates:exclude("lifetime counts are not age-matched")
        features=[]
        import random
        for key,label in FEATURES.items():
            yes=[p for p in eligible if p["features"][key] is True]
            no=[p for p in eligible if p["features"][key] is False]
            # Compare only creator/cohort strata containing both feature states.
            # Normalising views alone does not remove topic or creator confounding.
            stratum=lambda p:(p["creator"].casefold(),p["group"])
            shared={stratum(p) for p in yes}&{stratum(p) for p in no}
            unmatched=len(yes)+len(no)
            yes=[p for p in yes if stratum(p) in shared]
            no=[p for p in no if stratum(p) in shared]
            unmatched-=len(yes)+len(no)
            creator_ids=sorted({p["creator"].casefold() for p in yes+no})
            yn=statistics.median(p["relative_views"] for p in yes) if yes else None
            nn=statistics.median(p["relative_views"] for p in no) if no else None
            interval=None
            if min(len(yes),len(no))>=3 and len(creator_ids)>=3:
                rng=random.Random(digest([key,[p["id"] for p in yes+no]]));deltas=[]
                for _ in range(300):
                    sample=rng.choices(creator_ids,k=len(creator_ids))
                    a=[p["relative_views"] for creator in sample for p in yes if p["creator"].casefold()==creator]
                    b=[p["relative_views"] for creator in sample for p in no if p["creator"].casefold()==creator]
                    if a and b:deltas.append(statistics.median(a)-statistics.median(b))
                if len(deltas)>=100:
                    deltas.sort();interval=[round(deltas[int(.025*(len(deltas)-1))],3),round(deltas[int(.975*(len(deltas)-1))],3)]
            def ref(p):
                return {"post_id":p["id"],"asset_id":p["asset_id"],"title":p["title"],"creator":p["creator"],"relative_views":round(p["relative_views"],3),"source_url":p["source_url"],"snapshot_id":p["snapshot_id"]}
            support=[ref(p) for p in sorted(yes,key=lambda p:p["relative_views"],reverse=True) if p["relative_views"]>1][:3]
            counter=[ref(p) for p in sorted(yes,key=lambda p:p["relative_views"]) if p["relative_views"]<=1][:3]
            holdout=None
            ordered=sorted(yes+no,key=lambda p:p["published_at"])
            if len(ordered)>=12:
                split=int(len(ordered)*.75);partitions=[]
                for portion in (ordered[:split],ordered[split:]):
                    a=[p["relative_views"] for p in portion if p["features"][key]]
                    b=[p["relative_views"] for p in portion if not p["features"][key]]
                    partitions.append(statistics.median(a)-statistics.median(b) if a and b else None)
                holdout={"older_n":split,"later_n":len(ordered)-split,"older_difference":partitions[0],"later_difference":partitions[1],"note":"Fixed-feature temporal diagnostic, not a validated predictor."}
            features.append({"key":key,"label":label,"with_n":len(yes),"without_n":len(no),"creator_n":len(creator_ids),"unmatched_feature_posts":unmatched,"with_median":yn,"without_median":nn,"difference":round(yn-nn,3) if yn is not None and nn is not None else None,"cluster_bootstrap_95":interval,"status":"exploratory association" if interval else "insufficient matched evidence","support":support,"counterexamples":counter,"temporal_check":holdout})
        return {"total_posts":len(posts),"matched_posts":len(eligible),"creator_n":len({p["creator"].casefold() for p in eligible}),"window":window,"definition":definition,"excluded":excluded,"features":features,"limits":["No causal conclusions or virality probabilities.","Comparisons use creator/platform/format/cohort/duration strata with both feature states, at the same observation window; many confounders remain.","Relative views use at least three earlier matched posts from the same creator.","Bootstrap intervals resample creators; sparse data and selective sampling remain limitations.","Narrative features use editable labels, including unreviewed rules. Confirm labels before trusting comparisons.","Include ordinary and unsuccessful posts, not only selected winners."]}

    def documents(self, workspace):
        self.require_workspace(workspace)
        with self.db() as c:
            return [json.loads(r[0]) for r in c.execute("SELECT body FROM documents WHERE workspace=? ORDER BY rowid DESC",(workspace,))]

    def get_document(self, identity):
        with self.db() as c:
            row=c.execute("SELECT body FROM documents WHERE id=?",(identity,)).fetchone()
        if not row:raise ValueError("Production brief not found.")
        return json.loads(row[0])

    def create_plan(self, data):
        workspace=data.get("workspace","default");research=self.require_workspace(workspace)
        brief={k:text(data.get(k,""),n,required) for k,n,required in (("topic",250,True),("audience",500,True),("goal",120,True),("promise",500,True),("proof",1500,True),("method",800,True),("cta",300,True),("footage",800,True),("tone",120,False))}
        duration=data.get("duration",30)
        if isinstance(duration,bool) or not isinstance(duration,(int,float)) or not math.isfinite(duration) or not 10<=duration<=120:
            raise ValueError("Choose a duration from 10 to 120 seconds.")
        brief["duration"]=duration
        terms=set(re.findall(r"\w+",brief["topic"].casefold()+" "+brief["audience"].casefold()))-{ "the","a","and","to","for","of","in" }
        ranked=[]
        for post in self.posts(workspace):
            if post["collection"]=="draft":continue
            a=self.asset(post["asset_id"])
            words=set(re.findall(r"\w+",(post["title"]+" "+post["cohort"]+" "+" ".join(s["text"] for s in a.get("segments",[]))).casefold()))
            score=len(terms & words)/max(1,len(terms))
            if score>0:
                ranked.append((score,post,a))
        ranked.sort(key=lambda row:(-row[0],row[1]["id"]))
        refs=[]
        for score,post,a in ranked[:6]:
            refs.append({"post_id":post["id"],"asset_id":post["asset_id"],"title":post["title"],"source_url":post["source_url"],"relevance":round(score,3),"role_sequence":[s["role"] for s in a.get("segments",[])[:12]],"features":self.features(a),"evidence_class":"relevant example, not proof of effectiveness"})
        topic=brief["topic"].rstrip(".!?");promise=brief["promise"].rstrip(".!?")
        openings=[{"name":"Result first","spoken":promise+". Here is the demonstration.","visual":"Show the actual outcome using your footage before introducing yourself.","hypothesis":"An earlier visible payoff may improve early retention; test against our baseline."},
                  {"name":"Question first","spoken":"What would it take to "+promise[:1].lower()+promise[1:]+"? Let me show you.","visual":"Frame the subject clearly, then move to the demonstration.","hypothesis":"A question may make the intended problem clearer; do not assume it improves views."},
                  {"name":"Process first","spoken":"Here is how I approach "+topic[:1].lower()+topic[1:]+". I will show you each step.","visual":"Show the starting state and your hands or screen, not a generic title card.","hypothesis":"Showing the process may increase saves when the audience needs a repeatable method."}]
        fractions=[0,.12,.28,.68,.88,1]
        roles=["Hook","Context","Demonstration","Proof","CTA"]
        spoken=[openings[0]["spoken"],"This is for "+brief["audience"].rstrip(".")+".",brief["method"],brief["proof"],brief["cta"]]
        visual=[openings[0]["visual"],"Show the starting point and the relevant problem.","Demonstrate using: "+brief["footage"],"Show only evidence supporting the supplied claim. Mark anything not verified.","Return to the result with one readable next action."]
        beats=[{"start":round(fractions[i]*duration,1),"end":round(fractions[i+1]*duration,1),"role":roles[i],"spoken":spoken[i],"visual":visual[i],"on_screen":(promise if i==0 else roles[i]),"basis":"user brief + transparent planning template"} for i in range(5)]
        doc={"id":uid(),"workspace":workspace,"revision":1,"created_at":now(),"brief":brief,"openings":openings,"beats":beats,"references":refs,"engine":"structured planner (not learned AI)","hypothesis":openings[0]["hypothesis"],"primary_metric":"3-second retention percentage" if "retention" in brief["goal"].lower() else "shares per view" if "share" in brief["goal"].lower() else "saves per view" if "save" in brief["goal"].lower() else "qualified conversions" if any(x in brief["goal"].lower() for x in ("conversion","install","signup","sign-up","qualified")) else "views at 72 hours", "checklist":["Verify every factual claim in the supplied proof.","Film the result, starting state and demonstration.","Keep captions readable on a small screen.","Use your own footage and wording; references inform structure only.","Choose one opening and record the hypothesis before publication."],"history":[],"limits":["Timing is a filming plan, not predicted retention.","References are relevant examples; selection does not establish that they caused performance.","Proof is supplied by the user and is not independently verified."]}
        pattern_key=data.get("pattern_key", "")
        if pattern_key:
            if pattern_key not in FEATURES:
                raise ValueError("Unknown pattern hypothesis.")
            evidence=self.patterns(workspace,data.get("pattern_window","72h"),data.get("pattern_definition","instagram_views"))
            feature=next(x for x in evidence["features"] if x["key"]==pattern_key)
            doc["pattern_basis"]={"selected_at":now(),"window":evidence["window"],"definition":evidence["definition"],"feature":feature,"limits":evidence["limits"]}
            changes={
                "opening_question":("Start with a concrete question instead of the result.",1),
                "early_demo":("Move the demonstration into the first five seconds instead of delaying it.",0),
                "early_proof":("Show genuine proof in the first five seconds instead of making the audience wait.",0),
                "cta":("End with one explicit action instead of leaving the next step unclear.",0),
                "frequent_cuts":("Try more purposeful visual changes; preserve enough time to understand each shot.",0)}
            action,index=changes[pattern_key]
            doc["suggested_change"]=action
            doc["hypothesis"]="Test whether this change improves "+doc["primary_metric"]+" against our earlier comparable posts: "+action+" This is a hypothesis, not a proven effect."
            doc["beats"][0].update(spoken=openings[index]["spoken"],visual=openings[index]["visual"])
            if pattern_key=="early_demo":
                doc["beats"][0]["visual"]="Begin the real demonstration immediately using: "+brief["footage"]
            elif pattern_key=="early_proof":
                doc["beats"][0]["visual"]="Open with the actual evidence for: "+brief["proof"]
            elif pattern_key=="frequent_cuts":
                doc["beats"][2]["visual"]+=" Plan meaningful cutaways between steps; speed is not the objective."
            for b in doc["beats"]:
                b["basis"]="user brief + selected exploratory pattern hypothesis"
            if feature["status"]=="insufficient matched evidence":
                doc["limits"].append("The selected pattern has insufficient matched evidence. This is a creative test idea, not a data-supported recommendation.")
            else:
                doc["limits"].append("The selected association was observed in this library, not established as a cause. Supporting posts and counterexamples are retained in pattern_basis.")
        words=sum(len(b["spoken"].split()) for b in doc["beats"])
        doc["script_density_wpm"]=round(words*60/duration)
        if doc["script_density_wpm"]>190:
            doc["limits"].append("The supplied script exceeds 190 words per planned minute. Rehearse and shorten it or extend the plan; this is a pacing flag, not a performance prediction.")
        with self.db() as c:c.execute("INSERT INTO documents VALUES (?,?,?)",(doc["id"],workspace,json.dumps(doc)))
        return doc

    def save_document(self, incoming):
        with self.lock, self.db() as c:
            row=c.execute("SELECT body FROM documents WHERE id=?",(incoming.get("id"),)).fetchone()
            if not row:raise ValueError("Production brief not found.")
            old=json.loads(row[0])
            if incoming.get("revision")!=old["revision"]:raise Conflict("Brief changed in another tab. Reload it.")
            beats=incoming.get("beats")
            if not isinstance(beats,list) or not 1<=len(beats)<=30:raise ValueError("Invalid shot list.")
            clean=[];last=0
            for item in beats:
                start=item.get("start");end=item.get("end")
                if any(isinstance(x,bool) or not isinstance(x,(float,int)) or not math.isfinite(x) for x in (start,end)) or start<last or end<=start or end>old["brief"]["duration"]:
                    raise ValueError("Invalid filming timeline.")
                clean.append({"start":start,"end":end,**{k:text(item.get(k,""),2000) for k in ("role","spoken","visual","on_screen")},"basis":"user edited"});last=end
            old["history"].append({"revision":old["revision"],"beats":old["beats"],"hypothesis":old["hypothesis"],"saved_at":now()})
            old["history"]=old["history"][-100:]
            old["beats"]=clean;old["hypothesis"]=text(incoming.get("hypothesis",old["hypothesis"]),1000,True)
            old["revision"]+=1
            c.execute("UPDATE documents SET body=? WHERE id=?",(json.dumps(old),old["id"]))
        return old

    def review_draft(self, plan_id, post_id):
        plan=self.get_document(plan_id);post=self.get_post(post_id)
        if plan["workspace"]!=post["workspace"]:raise ValueError("Select a draft in the same research project.")
        a=self.asset(post["asset_id"]);speech=sorted(a.get("segments",[]),key=lambda s:s["start"]);duration=a.get("duration",0)
        observations=[]
        def add(kind,message,at=None):observations.append({"kind":kind,"message":message,"at":at,"asset_id":a["id"]})
        add("measured","Actual length: %.1fs; planned length: %.1fs." % (duration,plan["brief"]["duration"]))
        if speech:
            first=speech[0]["start"];add("measured","First transcribed speech starts at %.2fs." % first,first)
            words=sum(len(s["text"].split()) for s in speech)
            add("measured","Transcript density: %.0f words per minute across the whole video." % (60*words/max(duration,1)))
            demo=next((s for s in speech if s["role"]=="Demonstration"),None)
            if demo:add("label-based","First demonstration label is at %.2fs. Review whether the image demonstrates the claim." % demo["start"],demo["start"])
            else:add("suggestion","No demonstration label exists. Inspect the footage before deciding whether one is missing.")
            planned_demo=next((b for b in plan["beats"] if b["role"]=="Demonstration"),None)
            if demo and planned_demo:
                add("label-based","The demonstration label is %.2fs %s than the planned demonstration beat. This compares labels, not verified visual content." % (abs(demo["start"]-planned_demo["start"]),"later" if demo["start"]>planned_demo["start"] else "earlier"),demo["start"])
            if not any(s["role"]=="CTA" for s in speech):add("suggestion","No call-to-action label was found. Check that your chosen next action is visible or spoken.")
            if first>2:add("suggestion","Inspect the first two seconds: there is no transcribed speech, but the visual opening may still be intentional.",0)
        else:add("unavailable","No transcript is available; speech and promise alignment cannot be assessed.")
        add("review required","Check the actual first frame, evidence, captions and promise manually. No prediction of views or retention is made.",0)
        sem=self.semantics(a["id"])
        return {"plan_id":plan_id,"post_id":post_id,"plan_revision":plan["revision"],"asset_revision":a.get("revision",0),"observations":observations,"semantic_available":bool(sem),"limits":["Role-based checks are not verified visual understanding.","A different edit is a hypothesis, not a promised uplift."]}

    def experiments(self, workspace):
        self.require_workspace(workspace)
        with self.db() as c:rows=[json.loads(r[0]) for r in c.execute("SELECT body FROM experiments WHERE workspace=? ORDER BY rowid DESC",(workspace,))]
        for row in rows:
            row["snapshots"]=self.snapshots(row["post_id"])
            row["outcome"]=self.outcome(row)
        return rows

    def outcome(self, experiment):
        """Descriptive outcome only; no post-hoc success threshold or causal verdict."""
        post=self.get_post(experiment["post_id"])
        primary=experiment["primary_metric"].casefold()
        metric=("retention_3s_pct" if "retention" in primary else "conversions" if any(x in primary for x in ("conversion","signup","install")) else "saves" if "save" in primary else "shares" if "share" in primary else "views")
        ratio=metric in ("saves","shares") and ("view" in primary or "rate" in primary)
        unit="%" if ratio or metric.endswith("_pct") else "count"
        def value(snapshot):
            m=snapshot["metrics"]
            if metric not in m:return None
            if ratio:return m[metric]/m["views"]*100 if m.get("views",0)>0 else None
            return m[metric]
        window=experiment.get("window","72h")
        candidates=[x for x in self.snapshots(post["id"]) if x.get("publication_at")==post.get("published_at") and x.get("platform")==post["platform"] and x["window"]==window and value(x) is not None]
        result={"metric":metric,"unit":unit,"value":None,"baseline_n":0,"baseline_median":None,"difference":None,"relative":None,"note":"No matching timed observation for the primary metric. Missing is not zero."}
        if not candidates:return result
        selected=candidates[0];actual=value(selected)
        result.update(value=actual,window=selected["window"],definition=selected["definition"],snapshot_id=selected["id"])
        baseline=[];baseline_ids=[]
        for prior in self.posts(post["workspace"]):
            if prior["id"]==post["id"] or prior["collection"]!="own" or prior["distribution"]!="organic":continue
            if not post["creator"] or any(prior[k].casefold()!=post[k].casefold() for k in ("creator","cohort","platform","format")):continue
            if not prior.get("published_at") or not post.get("published_at") or prior["published_at"]>=post["published_at"]:continue
            observation=next((x for x in self.snapshots(prior["id"]) if x["window"]==selected["window"] and x["definition"]==selected["definition"] and x.get("publication_at")==prior["published_at"] and x.get("platform")==prior["platform"] and value(x) is not None),None)
            if observation:baseline.append(value(observation));baseline_ids.append(observation["id"])
        result.update(baseline_n=len(baseline),baseline_snapshot_ids=baseline_ids)
        if len(baseline)<3 or post["distribution"]!="organic":
            result["note"]="Recorded outcome; at least three earlier comparable organic posts are required for a baseline."
            return result
        median=statistics.median(baseline)
        result.update(baseline_median=median,difference=actual-median,relative=actual/median if median>0 else None,note="Descriptive comparison with earlier own posts. Distribution and other confounders remain; this is not a causal uplift or randomised A/B result.")
        return result

    def create_experiment(self, data):
        plan=self.get_document(data.get("plan_id"));post=self.get_post(data.get("post_id"))
        if post["workspace"]!=plan["workspace"] or post["collection"] not in ("own","draft"):
            raise ValueError("Experiments require our own post or draft in the same project.")
        window=data.get("window","72h")
        if window not in ("24h","72h","7d"):raise ValueError("Choose a prospective observation window.")
        doc={"window":window,"id":uid(),"workspace":plan["workspace"],"plan_id":plan["id"],"plan_revision":plan["revision"],"post_id":post["id"],"created_at":now(),"hypothesis":text(data.get("hypothesis",plan["hypothesis"]),1000,True),"primary_metric":text(data.get("primary_metric",plan["primary_metric"]),200,True),"change":text(data.get("change",""),1000,True),"status":"planned","revision":1,"frozen_plan":{"beats":plan["beats"],"brief":plan["brief"]},"assessment":None,"history":[]}
        with self.db() as c:c.execute("INSERT INTO experiments VALUES (?,?,?)",(doc["id"],doc["workspace"],json.dumps(doc)))
        return doc

    def update_experiment(self, data):
        with self.lock, self.db() as c:
            row=c.execute("SELECT body FROM experiments WHERE id=?",(data.get("id"),)).fetchone()
            if not row:raise ValueError("Experiment not found.")
            doc=json.loads(row[0])
            if doc["revision"]!=data.get("revision"):raise Conflict("Experiment changed. Reload before saving.")
            status=data.get("status")
            transitions={"planned":{"published"},"published":{"reviewed"},"reviewed":{"reviewed"}}
            if status not in transitions[doc["status"]]:raise ValueError("Invalid experiment state transition.")
            prior={"status":doc["status"],"revision":doc["revision"],"assessment":doc.get("assessment"),"at":now()}
            if status=="published":
                post=self.get_post(doc["post_id"])
                if post["collection"]!="own" or not post.get("published_at"):raise ValueError("Mark the post as our own and enter its publication time first.")
                if moment(post["published_at"]) > datetime.now(timezone.utc):raise ValueError("Publication time cannot be in the future.")
                if moment(post["published_at"]) < moment(doc["created_at"]):raise ValueError("This hypothesis was recorded after publication; create a prospective experiment instead.")
                doc["published_at"]=post["published_at"]
            if status=="reviewed":
                if not self.snapshots(doc["post_id"]):raise ValueError("Record at least one real performance snapshot before reviewing.")
                doc["assessment"]=text(data.get("assessment",""),4000,True)
            doc["history"].append(prior)
            doc["status"]=status;doc["revision"]+=1
            c.execute("UPDATE experiments SET body=? WHERE id=?",(json.dumps(doc),doc["id"]))
        return doc
