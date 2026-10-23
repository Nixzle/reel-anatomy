import csv,io,json
from studio_store import text
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