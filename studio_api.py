"""Local HTTP boundary for research, jobs, evidence, production and results."""
import csv
import io
import json
import threading
from urllib.parse import parse_qs, urlparse
from studio_jobs import Engine
from studio_store import Conflict, text

_ENGINES={}
_LOCK=threading.Lock()

def engine(host):
    key=str(host.DATA.resolve())
    with _LOCK:
        if key not in _ENGINES:_ENGINES[key]=Engine(host)
        return _ENGINES[key]

def start(host):
    engine(host).start()

def stop(host):
    engine(host).close()

def get(host,handler):
    try:
        parsed=urlparse(handler.path);path=parsed.path
        params=parse_qs(parsed.query)
        arg=lambda k,d="":params.get(k,[d])[0]
        e=engine(host);s=e.store;workspace=arg("workspace","default")
        if path=="/api/studio/bootstrap":
            s.legacy_import()
            result={"research":s.research(),"jobs":e.jobs(),"queue_paused":s.setting("queue_paused",False),"model":s.setting("model",{"enabled":False}),"version":host.APP_VERSION}
        elif path=="/api/studio/library":result={"posts":s.posts(workspace,text(arg("q"),200),arg("collection"))}
        elif path=="/api/studio/post":
            post=s.get_post(arg("id"));result={"post":post,"asset":s.asset(post["asset_id"]),"snapshots":s.snapshots(post["id"]),"semantic":s.semantics(post["asset_id"])}
        elif path=="/api/studio/jobs":result={"jobs":e.jobs(),"paused":s.setting("queue_paused",False)}
        elif path=="/api/studio/patterns":result=s.patterns(workspace,arg("window","24h"),arg("definition","instagram_views"))
        elif path=="/api/studio/plans":result={"plans":s.documents(workspace)}
        elif path=="/api/studio/results":result={"experiments":s.experiments(workspace)}
        elif path=="/api/studio/models":result=dict(e.models.status(),configured=s.setting("model",{"enabled":False}))
        elif path=="/api/studio/export":
            posts=s.posts(workspace)
            result={"version":host.APP_VERSION,"research":s.require_workspace(workspace),"posts":posts,"snapshots":{p["id"]:s.snapshots(p["id"]) for p in posts},"plans":s.documents(workspace),"experiments":s.experiments(workspace),"limits":"Metadata and user-supplied observations only. Source videos are not embedded."}
        else:return handler.send(404,{"error":"Studio route not found"})
        return handler.send(200,result)
    except Conflict as exc:return handler.send(409,{"error":str(exc)})
    except (ValueError,KeyError,TypeError) as exc:return handler.send(400,{"error":str(exc) if isinstance(exc,ValueError) else "Invalid request"})
    except OSError:return handler.send(500,{"error":"The local library could not be read. No remote source was substituted."})

def csv_import(store,data,kind):
    workspace=data.get("workspace","default");store.require_workspace(workspace)
    raw=text(data.get("csv",""),2_000_000,True).lstrip("\ufeff")
    reader=csv.DictReader(io.StringIO(raw),strict=True)
    if not reader.fieldnames or not ({"post_id","title"} & set(reader.fieldnames)):raise ValueError("CSV requires post_id or an exact unique title.")
    posts=store.posts(workspace);results=[]
    for i,row in enumerate(reader,2):
        if i>5001:raise ValueError("CSV exceeds 5,000 rows.")
        matches=[p for p in posts if (p["id"]==row["post_id"] if row.get("post_id") else p["title"].casefold()==row.get("title","").strip().casefold())]
        if len(matches)!=1:
            results.append({"row":i,"status":"skipped","reason":"Unknown or ambiguous post identity"});continue
        post=matches[0]
        try:
            if kind=="metadata":
                update=store.get_post(post["id"])
                for key in ("creator","cohort","source_url","published_at","distribution","collection","platform","format"):
                    if row.get(key):update[key]=row[key].strip()
                store.update_post(update)
            else:
                metrics={}
                for key in ("views","likes","saves","shares","comments","engaged_views","conversions","average_watch_seconds","retention_3s_pct","completion_pct"):
                    if row.get(key):metrics[key]=float(row[key].replace(",",""))
                store.add_snapshot({"post_id":post["id"],"window":row.get("window") or data.get("window"),"definition":row.get("definition") or data.get("definition"),"observed_at":row.get("observed_at"),"source":row.get("source") or data.get("source",""),"metrics":metrics})
            results.append({"row":i,"status":"imported","post_id":post["id"]})
        except (ValueError,TypeError) as exc:results.append({"row":i,"status":"rejected","reason":str(exc)})
    return {"imported":sum(x["status"]=="imported" for x in results),"rows":results,"note":"Rows are committed individually; rejected rows are not replaced with guessed values."}

def post(host,handler,path,content_type,raw):
    try:
        e=engine(host);s=e.store
        if path=="/api/studio/import":
            if "multipart/form-data" not in content_type:return handler.send(415,{"error":"Expected multipart form"})
            return handler.send(202,e.import_video(host.parse_multipart(content_type,raw)))
        if "application/json" not in content_type:return handler.send(415,{"error":"Expected application/json"})
        if len(raw)>2_100_000:return handler.send(413,{"error":"Studio JSON exceeds its limit"})
        data=json.loads(raw)
        if not isinstance(data,dict):raise ValueError("Expected an object.")
        if path=="/api/studio/research":result=s.create_research(data)
        elif path=="/api/studio/link":result=s.add_post(data.get("asset_id"),data.get("workspace","default"),data.get("metadata",{}))
        elif path=="/api/studio/metadata":result=s.update_post(data)
        elif path=="/api/studio/snapshot":result=s.add_snapshot(data)
        elif path=="/api/studio/queue":result=e.control(data)
        elif path=="/api/studio/configure":result=e.configure(data)
        elif path=="/api/studio/semantic":result=e.enqueue_semantic(data.get("post_id"))
        elif path=="/api/studio/apply-semantic":result=e.apply_semantics(data)
        elif path=="/api/studio/plan":result=s.create_plan(data)
        elif path=="/api/studio/save-plan":result=s.save_document(data)
        elif path=="/api/studio/review":result=s.review_draft(data.get("plan_id"),data.get("post_id"))
        elif path=="/api/studio/experiment":result=s.create_experiment(data)
        elif path=="/api/studio/update-experiment":result=s.update_experiment(data)
        elif path in ("/api/studio/import-snapshots","/api/studio/import-metadata"):result=csv_import(s,data,"metadata" if path.endswith("metadata") else "snapshots")
        elif path=="/api/studio/enrich-plan":
            config=e.model_config();plan=s.get_document(data.get("plan_id"))
            result=e.enqueue({"kind":"enrich_plan","plan_id":plan["id"],"revision":plan["revision"],"model_digest":config["digest"],"title":"Refine: "+plan["brief"]["topic"]})
        else:return handler.send(404,{"error":"Studio route not found"})
        return handler.send(200,result)
    except Conflict as exc:return handler.send(409,{"error":str(exc)})
    except (ValueError,KeyError,TypeError,csv.Error) as exc:return handler.send(400,{"error":str(exc) if isinstance(exc,(ValueError,csv.Error)) else "Invalid request"})
    except OSError:return handler.send(503,{"error":"A local file or model service is unavailable. No cloud fallback was used."})
