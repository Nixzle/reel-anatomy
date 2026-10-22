"""Prepare only public app shell files. No library, tokens or private state."""
from pathlib import Path
import shutil,json,hashlib
root=Path(__file__).resolve().parents[1];out=root/'mobile-dist'
out.mkdir(exist_ok=True)
for item in out.iterdir():
 if item.is_dir():shutil.rmtree(item)
 else:item.unlink()
(out/'web').mkdir(parents=True,exist_ok=True)
for name in ('style.css','app.js','studio.css','studio.js','mobile.css','mobile.js'):
 shutil.copy2(root/'web'/name,out/'web'/name)
for name in ('manifest.webmanifest','sw.js'):shutil.copy2(root/'web'/name,out/name)
shutil.copytree(root/'web/icons',out/'icons')
html=(root/'web/index.html').read_text(encoding='utf-8').replace('<head>','<head>\n  <meta name="reel-hosted" content="1">',1)
(out/'index.html').write_text(html,encoding='utf-8')
files={str(p.relative_to(out)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
(root/'.local/mobile-v030').mkdir(parents=True,exist_ok=True)
(root/'.local/mobile-v030/public-build.json').write_text(json.dumps(files,indent=2),encoding='utf-8')
print('Public shell built:',len(files),'files; no data or credentials included.')
