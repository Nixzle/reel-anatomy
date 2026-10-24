"""Package the unified app using already-installed dependencies and cached model files."""
import ast
import hashlib
import importlib.metadata as metadata
import json
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'standalone/RELEASE_TARGET.json').read_text())['candidate']
record=root/'.local'/('desktop-'+version);record.mkdir(parents=True,exist_ok=True)
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip():raise SystemExit('Package only a clean reviewed source commit.')
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
build=json.loads((root/'phone-dist/BUILD.json').read_text())
assert build['source_commit']==commit and not build['source_dirty'] and build['version']==version
assert (root/'models/base.en/model.bin').is_file(),'Reuse the existing model; this builder downloads nothing.'
args=[sys.executable,'-m','PyInstaller','--noconfirm','--onedir','--name','ReelAnatomyStudio',
      '--add-data','phone-dist;phone-dist','--add-data','models/base.en;models/base.en',
      '--add-data','standalone/timed_captions.py;standalone','--collect-all','faster_whisper',
      '--collect-all','ctranslate2','--collect-all','av','desktop_studio.py']
with (record/'build.log').open('w',encoding='utf-8') as log:p=subprocess.run(args,cwd=root,stdout=log,stderr=subprocess.STDOUT,timeout=600)
if p.returncode:raise SystemExit('Build failed; inspect '+str(record/'build.log'))
dist=root/'dist/ReelAnatomyStudio';licenses=dist/'licenses';licenses.mkdir(exist_ok=True)
for name in ('LICENSE','THIRD_PARTY_NOTICES.md'):shutil.copy2(root/name,dist/name)
shutil.copy2(root/'standalone/DESKTOP_COMPLETION.md',dist/'README.md')
for distribution in metadata.distributions():
    for item in distribution.files or []:
        if any(term in item.name.upper() for term in ('LICENSE','NOTICE','COPYING')):
            path=Path(distribution.locate_file(item))
            if path.is_file() and path.stat().st_size<2_000_000:
                safe=distribution.metadata['Name']+'-'+str(item).replace('/','_').replace('\\','_')
                shutil.copy2(path,licenses/safe)
for path in (root/'third_party').glob('*'):
    if path.is_file():shutil.copy2(path,licenses/path.name)
manifest={'version':version,'source_commit':commit,'web_build':build['build'],'python':sys.version,'dependencies':{d.metadata['Name']:d.version for d in metadata.distributions()},
          'model':{'name':'Systran/faster-whisper-base.en','files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'models/base.en').iterdir() if p.is_file()}},
          'network_processing':False,'scope':'New desktop bundle; previous Windows releases and user data are unchanged.'}
(dist/'BUILD_INFO.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
archive=root/'dist'/('ReelAnatomyStudio-Windows-'+version+'.zip')
if archive.exists():raise SystemExit('Archive already exists. Reconcile its identity; this builder does not replace it.')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
    for path in dist.rglob('*'):
        if path.is_file():z.write(path,Path('ReelAnatomyStudio')/path.relative_to(dist))
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
with archive.open('rb') as handle:sha=hashlib.file_digest(handle,'sha256').hexdigest()
receipt={'file':archive.name,'bytes':archive.stat().st_size,'sha256':sha,'source_commit':commit,'web_build':build['build'],'packaged_acceptance':'pending: execute and test the actual downloaded asset before publishing'}
(record/'package.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt),flush=True)
