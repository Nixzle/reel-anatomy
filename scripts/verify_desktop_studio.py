"""Verify an extracted desktop binary without system Python/FFmpeg or an external model cache."""
import argparse
import hashlib
import json
import os
import socket
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('executable',type=Path);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
exe=args.executable.resolve(strict=True);root=Path(__file__).resolve().parents[1];checks=[]
def checked(name,detail=True):checks.append({'name':name,'detail':detail});print('PASS',name,flush=True)
with tempfile.TemporaryDirectory(prefix='reel-desktop-verify-') as temporary:
    tmp=Path(temporary)
    with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env=dict(os.environ,PATH=str(Path(os.environ.get('SystemRoot','C:/Windows'))/'System32'),HF_HOME=str(tmp/'empty-hf'),HUGGINGFACE_HUB_CACHE=str(tmp/'empty-cache'),HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1')
    log=(tmp/'desktop.log').open('wb');process=subprocess.Popen([str(exe),'--port',str(port),'--no-browser'],cwd=exe.parent,env=env,stdout=log,stderr=log)
    base=f'http://127.0.0.1:{port}'
    def fetch(path,data=None,token=None,mime=None):
        headers={}
        if token:headers['X-Reel-Token']=token
        if mime:headers['Content-Type']=mime
        with urllib.request.urlopen(urllib.request.Request(base+path,data=data,headers=headers),timeout=20) as response:return response.read()
    try:
        health=None
        for _ in range(90):
            if process.poll() is not None:raise RuntimeError('Packaged host exited before becoming ready.')
            try:health=json.loads(fetch('/api/companion/health'));break
            except OSError:time.sleep(.3)
        assert health and health['app']=='reel-anatomy-desktop' and health['speech'] and not health['network_processing']
        checked('packaged host runs using its own runtime and model with an empty external cache')
        build=json.loads(fetch('/BUILD.json'));metadata=json.loads((exe.parent/'BUILD_INFO.json').read_text())
        assert build['source_commit']==metadata['source_commit'] and build['version']==metadata['version'] and build['source_dirty'] is False
        checked('binary identity agrees with the exact clean web build',{'version':build['version'],'source_commit':build['source_commit'],'build':build['build']})
        for name,expected in build['files'].items():assert hashlib.sha256(fetch('/'+name)).hexdigest()==expected,name
        checked('every bundled web manifest asset matches its recorded hash',len(build['files']))
        assert not any(p.suffix.lower() in ('.ttf','.otf','.woff','.woff2') for p in exe.parent.rglob('*') if p.is_file())
        checked('portable bundle contains no redistributed font files')
        body=(root/'tests/fixtures/speech.wav').read_bytes();created=json.loads(fetch('/api/companion/jobs',body,health['token'],'audio/wav'))
        result=None
        for _ in range(360):
            state=json.loads(fetch('/api/companion/jobs/'+created['id'],token=health['token']))
            if state['status']=='failed':raise RuntimeError(state['error'])
            if state['status']=='complete':result=state['result'];break
            time.sleep(.5)
        assert result and result['audio_sha256']==hashlib.sha256(body).hexdigest()
        words=' '.join(w['word'] for w in result['words']).lower()
        assert 'stop making this mistake' in words and 'watch this quick example' in words
        assert len(result['cues'])==2 and result['cues'][1]['start']-result['cues'][0]['end']>.5
        checked('actual packaged speech inference recognises the fixture and preserves its pause',{'word_count':len(result['words']),'cues':result['cues'],'audio_sha256':result['audio_sha256']})
        assert not (tmp/'empty-cache').exists() or not list((tmp/'empty-cache').rglob('model*'))
        checked('inference required no cached external model or model download')
        report={'passed':True,'checks':checks,'executable_sha256':hashlib.sha256(exe.read_bytes()).hexdigest(),'scope':'Generated English speech fixture on the same Windows host; not physical iPhone or general semantic-model validation.'}
        args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2));print(json.dumps({'passed':True,'checks':len(checks)}),flush=True)
    finally:
        process.terminate()
        try:process.wait(timeout=10)
        except subprocess.TimeoutExpired:process.kill();process.wait(timeout=10)
        log.close()
