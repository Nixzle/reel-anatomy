"""Fetch the pinned public application runtime; no model weights or installers."""
import hashlib,json,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[1]
cache=root/'.local/standalone-v040/runtime';cache.mkdir(parents=True,exist_ok=True)
base='https://cdn.jsdelivr.net/pyodide/v0.29.3/full/'
pins=json.loads((root/'standalone/RUNTIME_PINS.json').read_text(encoding='utf-8'))
for item in pins:
    name=item['name']
    if Path(name).name!=name:raise ValueError('Invalid runtime file name')
    target=cache/name
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==item['sha256']:continue
    with urllib.request.urlopen(base+name,timeout=90) as response:data=response.read(20_000_000)
    if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']:raise ValueError('Runtime pin mismatch: '+name)
    target.write_bytes(data)
    print('VERIFIED',name,len(data))
print('Pinned runtime ready. No system package or model was installed.')
