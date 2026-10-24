"""Build an auditable portable package without publishing or replacing releases."""
import ast
import hashlib
import importlib.metadata as metadata
import json
import platform
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

root=Path(__file__).resolve().parents[1]
version=next(ast.literal_eval(n.value) for n in ast.parse((root/"app.py").read_text(encoding="utf-8")).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=="APP_VERSION" for t in n.targets))
receipt=root/(".local/release-"+version)
receipt.mkdir(parents=True,exist_ok=True)

def call(args,name):
    with (receipt/(name+".log")).open("w",encoding="utf-8") as log:
        result=subprocess.run(args,cwd=root,stdout=log,stderr=subprocess.STDOUT,timeout=600)
    if result.returncode:
        raise RuntimeError(name+" failed; see retained log")
    print("PASS "+name,flush=True)

assert not subprocess.check_output(["git","status","--porcelain"],cwd=root,text=True).strip(),"Commit the reviewed source before packaging. The build must match a clean commit."
sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()
tracked=subprocess.check_output(["git","ls-files"],cwd=root,text=True).splitlines()
manifest={"version":version,"source_commit":sha,"python":platform.python_version(),
          "model":{"name":"Systran/faster-whisper-base.en","revision":"3d3d5dee26484f91867d81cb899cfcf72b96be6c"},
          "source_sha256":{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in tracked if (root/name).is_file()},
          "dependencies":{d.metadata["Name"]:d.version for d in metadata.distributions()}}
call([sys.executable,"-m","PyInstaller","--noconfirm","--onedir","--name","ReelAnatomy",
      "--add-data","web;web","--add-data","models/base.en;models/base.en",
      "--collect-all","faster_whisper","--collect-all","ctranslate2","--collect-all","imageio_ffmpeg","--hidden-import","studio_api","--hidden-import","studio_jobs","--hidden-import","studio_store","--hidden-import","mobile_bridge","app.py"],"build")
dist=root/"dist/ReelAnatomy"
for name in ("README.md","LICENSE","THIRD_PARTY_NOTICES.md","MOBILE.md"):
    shutil.copy2(root/name,dist/name)
notices=dist/"licenses";notices.mkdir(exist_ok=True)
for d in metadata.distributions():
    for file in d.files or []:
        if any(x in file.name.upper() for x in ("LICENSE","COPYING","NOTICE")):
            src=Path(d.locate_file(file))
            if src.is_file() and src.stat().st_size < 2_000_000:
                target=notices/(d.metadata["Name"]+"-"+str(file).replace("/","_").replace("\\","_"))
                shutil.copy2(src,target)
for file in (root/"third_party").glob("*"):
    if file.is_file():shutil.copy2(file,notices/file.name)
(dist/"BUILD_INFO.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
call([sys.executable,"scripts/smoke_release.py",str(dist/"ReelAnatomy.exe"),"--output",str(receipt/"packaged-smoke.json")],"packaged-smoke")
archive=root/"dist"/"ReelAnatomy-Windows-x64.zip"
with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED,compresslevel=5) as z:
    for file in dist.rglob("*"):
        if file.is_file():z.write(file,Path("ReelAnatomy")/file.relative_to(dist))
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
checksum=hashlib.file_digest(archive.open("rb"),"sha256").hexdigest()
(root/"dist/SHA256SUMS.txt").write_text(checksum+"  "+archive.name+"\n",encoding="utf-8")
(receipt/"package.json").write_text(json.dumps({"version":version,"source_commit":sha,"sha256":checksum,"bytes":archive.stat().st_size,"smoke_passed":True},indent=2),encoding="utf-8")
print(json.dumps({"version":version,"source_commit":sha,"sha256":checksum,"bytes":archive.stat().st_size}),flush=True)
