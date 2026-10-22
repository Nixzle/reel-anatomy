"""Exercise the packaged executable with an empty cache and no system FFmpeg."""
import argparse
import json
import os
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path


def run(executable, output):
    checks=[]
    def ok(name):
        checks.append(name)
        print("PASS " + name, flush=True)
    root=Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory(prefix="ReelAnatomy-release-") as directory:
        tmp=Path(directory)
        env=dict(os.environ, REEL_ANATOMY_HOME=str(tmp/"data"), REEL_ANATOMY_PORT="18869",
                 REEL_ANATOMY_NO_BROWSER="1", HF_HOME=str(tmp/"empty-hf"), HF_HUB_OFFLINE="1",
                 TRANSFORMERS_OFFLINE="1", PYTHONPATH="", PATH=os.environ.get("SystemRoot","C:/Windows")+"/System32")
        log=(tmp/"app.log").open("w",encoding="utf-8")
        process=subprocess.Popen([str(executable)],env=env,cwd=tmp,stdout=log,stderr=subprocess.STDOUT)
        base="http://127.0.0.1:18869"
        def get(path):
            with urllib.request.urlopen(base+path,timeout=90) as r:
                return json.load(r)
        try:
            health=None
            for _ in range(100):
                try:
                    health=get("/api/health")
                    break
                except (OSError,ValueError):
                    if process.poll() is not None: raise RuntimeError("Executable exited early")
                    time.sleep(.2)
            assert health and health["version"]=="0.1.1" and health["speech"] and health["ffmpeg"],health
            ok("portable startup without Python, system FFmpeg or cached models on PATH")
            ff=next((executable.parent/"_internal/imageio_ffmpeg/binaries").glob("ffmpeg*.exe"))
            video=tmp/"synthetic.mp4"
            result=subprocess.run([str(ff),"-hide_banner","-loglevel","error","-f","lavfi","-i","color=black:s=320x180:r=25:d=2","-f","lavfi","-i","color=white:s=320x180:r=25:d=2","-i",str(root/"tests/fixtures/speech.wav"),"-filter_complex","[0:v][1:v]concat=n=2:v=1:a=0[out]","-map","[out]","-map","2:a","-c:v","libx264","-threads","2","-pix_fmt","yuv420p","-c:a","aac","-shortest","-y",str(video)],capture_output=True,timeout=30)
            assert result.returncode==0,result.stderr
            boundary="REEL_ANATOMY_SMOKE"
            body=(("--"+boundary+'\r\nContent-Disposition: form-data; name="video"; filename="synthetic.mp4"\r\n\r\n').encode()+video.read_bytes()+('\r\n--'+boundary+'--\r\n').encode())
            req=urllib.request.Request(base+"/api/analyze",data=body,headers={"Content-Type":"multipart/form-data; boundary="+boundary})
            with urllib.request.urlopen(req,timeout=120) as response: project=json.load(response)
            text=" ".join(x["text"] for x in project["segments"]).lower()
            assert "stop making this mistake" in text and "watch this quick example" in text,project
            assert project["transcript_source"]=="local speech model"
            ok("actual offline speech decoded and transcribed")
            assert len(project["shots"])==2 and abs(project["shots"][1]["start"]-2)<.1,project
            assert project["notices"]==[],project["notices"]
            ok("real two-shot boundary detected with no hidden fallback warnings")
            with urllib.request.urlopen(base+"/thumb/"+project["id"]+"/0",timeout=30) as response:
                assert response.read().startswith(b"\xff\xd8")
            ok("thumbnail rendered using the bundled media engine")
            req=urllib.request.Request(base+project["media"],headers={"Range":"bytes=0-9"})
            with urllib.request.urlopen(req,timeout=30) as response:
                assert response.status==206 and len(response.read())==10
            ok("partial-range video playback")
            assert not list((tmp/"empty-hf").rglob("*.bin")),"unexpected model download"
            ok("empty external model cache remained empty")
            Path(output).write_text(json.dumps({"passed":True,"version":health["version"],"checks":checks},indent=2),encoding="utf-8")
        finally:
            process.terminate()
            try: process.wait(timeout=10)
            except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
            log.close()
            Path(str(output)+".log").write_text((tmp/"app.log").read_text(encoding="utf-8"),encoding="utf-8")

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("executable",type=Path);p.add_argument("--output",default=".local/packaged-smoke.json")
    a=p.parse_args();run(a.executable.resolve(),a.output)
