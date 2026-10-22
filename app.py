"""Reel Anatomy: a local-first video, transcript, and edit-timeline workbench."""
from __future__ import annotations
import csv
import io
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import uuid
import webbrowser
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
DATA = Path(os.environ.get("REEL_ANATOMY_HOME", Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "ReelAnatomy"))
DATA.mkdir(parents=True, exist_ok=True)
MAX_BYTES = 220 * 1024 * 1024
LOCK = threading.RLock()
TAGS = ("Hook", "Problem", "Context", "Explanation", "Demonstration", "Proof", "Payoff", "Objection", "CTA", "Other")

def media_bin(name):
    found = shutil.which(name)
    if found: return found
    try:
        import imageio_ffmpeg
        if name == "ffmpeg": return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError: pass
    return None

def command(args, timeout=150):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)

def duration_seconds(path):
    probe = media_bin("ffprobe")
    if probe:
        p = command([probe, "-v", "error", "-show_entries", "format=duration", "-of", "default=nokey=1:noprint_wrappers=1", str(path)], 30)
        if p.returncode == 0:
            try: return round(float(p.stdout.strip()), 3)
            except ValueError: pass
    ff = media_bin("ffmpeg")
    if ff:
        p = command([ff, "-hide_banner", "-i", str(path), "-f", "null", "-"], 30)
        m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", p.stderr)
        if m: return round(3600 * int(m[1]) + 60 * int(m[2]) + float(m[3]), 3)
    return 0

def shot_boundaries(path, duration):
    ff = media_bin("ffmpeg")
    if not ff or duration <= 0: return [], "FFmpeg unavailable or video duration unknown."
    # FFmpeg is a scene-change estimator. It cannot identify camera angles or intent.
    try:
        proc = command([ff, "-hide_banner", "-nostdin", "-i", str(path), "-vf",
                        "select=gt(scene\\,0.30),showinfo", "-an", "-vsync", "vfr", "-f", "null", "-"], 150)
        cuts = [float(x) for x in re.findall(r"pts_time:([\d.]+)", proc.stderr)]
        cuts = [x for x in cuts if 0.35 < x < duration - 0.35]
        edges = [0.0] + sorted(set(round(x, 2) for x in cuts))[:199] + [duration]
        shots = [{"index": i, "start": round(a, 2), "end": round(b, 2), "kind": "Detected shot", "note": "", "confidence": "estimated"}
                 for i, (a, b) in enumerate(zip(edges, edges[1:])) if b > a]
        if not shots: shots = [{"index": 0, "start": 0.0, "end": duration, "kind": "Single interval", "note": "", "confidence": "estimated"}]
        return shots, "" if proc.returncode == 0 else "FFmpeg reported warnings; inspect the shot timeline."
    except (OSError, subprocess.TimeoutExpired):
        return [], "Scene detection failed or timed out. Transcription may still work."

def stamp(value):
    parts = value.strip().replace(",", ".").split(":")
    if len(parts) == 3: return int(parts[0])*3600 + int(parts[1])*60 + float(parts[2])
    if len(parts) == 2: return int(parts[0])*60 + float(parts[1])
    raise ValueError("not a timestamp")

def classify(text, start, end, duration):
    t = text.lower().strip()
    if not t: return "Other", "Empty caption"
    if re.search(r"\b(follow|subscribe|comment|save this|share this|click|download|link in|try it|dm me)\b", t):
        return "CTA", "Contains an explicit request to act"
    if re.search(r"\b(but what if|you might think|you may ask|however|some people say)\b", t):
        return "Objection", "Introduces a counterpoint"
    if re.search(r"\b(here.s how|here is how|watch this|look at|i.ll show|for example|let me show)\b", t):
        return "Demonstration", "Signals a concrete example"
    if re.search(r"\b(results?|increased|decreased|data|tested|evidence|proof|before and after)\b", t):
        return "Proof", "Mentions a claim or evidence; verify independently"
    if re.search(r"\b(problem|struggling|mistake|wrong|losing|doesn.t work|stop doing)\b", t):
        return "Problem", "Frames a difficulty or mistake"
    if re.search(r"\b(that.s why|so now|finally|the answer|the result)\b", t):
        return "Payoff", "Signals a conclusion"
    if start <= min(4.5, duration * .22) and ("?" in text or re.search(r"\b(never|secret|why|how|most people|nobody)\b", t)):
        return "Hook", "Early question or curiosity framing"
    if re.search(r"\b(because|means that|first|second|step|you need to)\b", t):
        return "Explanation", "Explains a reason or step"
    if start <= min(4.5, duration * .22):
        return "Hook", "Appears in the opening interval; review manually"
    return "Context", "Additional narrative context"

def parse_captions(raw, duration):
    raw = (raw or "").replace("\ufeff", "").strip()
    if not raw: return [], False
    chunks = re.split(r"\n\s*\n", raw.replace("\r\n", "\n"))
    timed = []
    pattern = re.compile(r"(\d\d?:\d\d:\d\d[,.]\d+|\d\d?:\d\d[,.]\d+)\s*-->\s*(\d\d?:\d\d:\d\d[,.]\d+|\d\d?:\d\d[,.]\d+)")
    for chunk in chunks:
        lines = chunk.strip().splitlines()
        idx = next((i for i, x in enumerate(lines) if pattern.search(x)), -1)
        if idx < 0: continue
        mt = pattern.search(lines[idx])
        text = re.sub(r"<[^>]+>", "", " ".join(lines[idx + 1:])).strip()
        if text: timed.append((stamp(mt[1]), stamp(mt[2]), text))
    if timed: return timed, False
    raw = re.sub(r"^WEBVTT\s*", "", raw, flags=re.I)
    pieces = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", raw) if s.strip()]
    total = max(duration, len(pieces) * 3.0)
    weights = [max(3, len(x.split())) for x in pieces]
    denom = sum(weights) or 1
    t = 0.0
    for piece, w in zip(pieces, weights):
        end = t + total * w / denom
        timed.append((round(t, 2), round(end, 2), piece))
        t = end
    return timed, True

def transcribe(path):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return [], "Local speech recognition is not installed. Supply SRT/VTT or a transcript, or install the optional speech package."
    try:
        bundled = ROOT / "models" / "base.en"
        model_name = str(bundled) if bundled.is_dir() else os.environ.get("REEL_ANATOMY_MODEL", "base.en")
        model = WhisperModel(model_name, device="cpu", compute_type="int8", local_files_only=True)
        segments, _ = model.transcribe(str(path), language="en", vad_filter=True, word_timestamps=True, beam_size=3)
        out = []
        for seg in segments:
            words = getattr(seg, "words", None) or []
            if not words:
                out.append((float(seg.start), float(seg.end), seg.text.strip()))
                continue
            group = []
            start = None
            for word in words:
                if start is None: start = float(word.start)
                group.append(word.word)
                if re.search(r"[.!?]\s*$", word.word):
                    out.append((start, float(word.end), "".join(group).strip()))
                    group, start = [], None
            if group:
                out.append((start or float(seg.start), float(words[-1].end), "".join(group).strip()))
        return out, ""
    except Exception as exc:
        # Do not expose paths, key material or low-level library exceptions to a recipient.
        return [], "Local speech recognition could not load a cached model. Import a transcript, or install/download a model."

def project_path(project_id):
    if not re.fullmatch(r"[a-f0-9]{32}", project_id): raise ValueError("invalid ID")
    return DATA / (project_id + ".json")

def save_project(project):
    with LOCK:
        dest = project_path(project["id"])
        tmp = dest.with_suffix(".tmp")
        tmp.write_text(json.dumps(project, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(dest)

def load_project(project_id):
    return json.loads(project_path(project_id).read_text(encoding="utf-8"))

def analyse(video_path, title, raw_transcript, metrics):
    duration = duration_seconds(video_path)
    shots, shot_warning = shot_boundaries(video_path, duration)
    transcript, estimated = parse_captions(raw_transcript, duration)
    transcribe_warning = ""
    if not transcript:
        transcript, transcribe_warning = transcribe(video_path)
    segments = []
    for i, (a, b, phrase) in enumerate(transcript):
        tag, why = classify(phrase, a, b, max(duration, b))
        segments.append({"index": i, "start": round(a, 2), "end": round(b, 2),
                         "text": phrase, "role": tag, "reason": why, "edited": False})
    pid = video_path.stem
    notice = [x for x in (shot_warning, transcribe_warning) if x]
    if estimated: notice.append("Text-only timestamps are proportional estimates, not speech alignment.")
    project = {"id": pid, "title": title, "media": "/media/" + pid, "duration": duration, "shots": shots,
               "segments": segments, "metrics": metrics, "notices": notice,
               "transcript_source": "imported" if raw_transcript else ("local speech model" if segments else "none"),
               "version": 1}
    save_project(project)
    return project

def parse_multipart(content_type, data):
    parsed = BytesParser(policy=default).parsebytes(b"Content-Type: " + content_type.encode("utf-8") +
                                                     b"\r\nMIME-Version: 1.0\r\n\r\n" + data)
    fields = {}
    for part in parsed.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if name: fields[name] = (part.get_filename(), part.get_payload(decode=True) or b"")
    return fields

class Handler(BaseHTTPRequestHandler):
    server_version = "ReelAnatomy/1"
    def log_message(self, fmt, *args):
        pass
    def send(self, status, body, mime="application/json", extra=None):
        data = body if isinstance(body, bytes) else (json.dumps(body).encode("utf-8") if mime == "application/json" else str(body).encode("utf-8"))
        self.send_response(status)
        self.send_header("Content-Type", mime + ("; charset=utf-8" if mime.startswith("text/") or mime == "application/json" else ""))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self' blob: data:; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'")
        self.send_header("Content-Length", str(len(data)))
        for k,v in (extra or {}).items(): self.send_header(k,v)
        self.end_headers()
        self.wfile.write(data)
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            return self.send(200, (ROOT/"web"/"index.html").read_bytes(), "text/html")
        if path in ("/web/style.css", "/web/app.js"):
            name = path.rsplit("/", 1)[-1]
            mime = "text/css" if name.endswith(".css") else "application/javascript"
            return self.send(200, (ROOT/"web"/name).read_bytes(), mime)
        if path == "/api/health":
            return self.send(200, {"ok": True, "ffmpeg": bool(media_bin("ffmpeg")), "speech": self.speech_status(), "local_only": True})
        if path == "/api/projects":
            projects = []
            for f in DATA.glob("*.json"):
                try:
                    p = json.loads(f.read_text(encoding="utf-8"))
                    projects.append({"id": p["id"], "title": p["title"], "duration": p["duration"], "segments": len(p["segments"]), "shots": len(p["shots"])})
                except (KeyError, ValueError, OSError): continue
            return self.send(200, sorted(projects, key=lambda x:x["title"]))
        if path.startswith("/api/project/"):
            try: return self.send(200, load_project(path.rsplit("/", 1)[1]))
            except (ValueError, FileNotFoundError): return self.send(404, {"error":"Not found"})
        if path.startswith("/media/"):
            return self.serve_media(path.rsplit("/", 1)[1])
        if path.startswith("/thumb/"):
            bits = path.split("/")
            if len(bits) == 4: return self.serve_thumb(bits[2],bits[3])
        return self.send(404, {"error":"Not found"})
    def speech_status(self):
        try:
            from faster_whisper import WhisperModel
            return True
        except ImportError: return False
    def serve_media(self,pid):
        try:
            base = project_path(pid)
            video = next((p for p in DATA.glob(pid+".*") if p.suffix.lower() in (".mp4",".mov",".webm",".m4v")), None)
            if not video: raise FileNotFoundError()
            size = video.stat().st_size
            r = self.headers.get("Range", "")
            m = re.fullmatch(r"bytes=(\d+)-(\d*)", r)
            a, b = (int(m[1]), min(int(m[2]) if m[2] else size-1, size-1)) if m else (0,size-1)
            if a >= size or b < a: return self.send(416, {"error":"Invalid range"})
            self.send_response(206 if m else 200)
            self.send_header("Content-Type", {".mp4":"video/mp4",".mov":"video/quicktime",".webm":"video/webm",".m4v":"video/mp4"}.get(video.suffix.lower(),"application/octet-stream"))
            self.send_header("Accept-Ranges","bytes")
            self.send_header("Content-Length", str(b-a+1))
            if m: self.send_header("Content-Range",f"bytes {a}-{b}/{size}")
            self.end_headers()
            with video.open("rb") as f:
                f.seek(a); remaining=b-a+1
                while remaining:
                    chunk=f.read(min(1024*1024,remaining))
                    if not chunk: break
                    self.wfile.write(chunk);remaining -= len(chunk)
        except (ValueError,FileNotFoundError): self.send(404,{"error":"Video not found"})
        except (ConnectionAbortedError,BrokenPipeError,ConnectionResetError): pass
    def serve_thumb(self,pid,index):
        try:
            pr=load_project(pid)
            i=int(index)
            shot=pr["shots"][i]
            if i < 0 or i >= len(pr["shots"]): raise ValueError()
            folder=DATA/"thumbs"; folder.mkdir(exist_ok=True)
            out=folder/(pid+"-"+str(i)+".jpg")
            if not out.exists():
                vid=next(p for p in DATA.glob(pid+".*") if p.suffix.lower() in (".mp4",".mov",".webm",".m4v"))
                ff=media_bin("ffmpeg")
                if not ff: raise FileNotFoundError()
                p=command([ff,"-hide_banner","-loglevel","error","-ss",str(shot["start"]+.15),"-i",str(vid),"-frames:v","1","-vf","scale=360:-2","-y",str(out)],20)
                if not out.is_file(): raise FileNotFoundError()
            self.send(200,out.read_bytes(),"image/jpeg")
        except (ValueError,IndexError,KeyError,FileNotFoundError,StopIteration): self.send(404,{"error":"Thumbnail unavailable"})
    def do_POST(self):
        path=urlparse(self.path).path
        origin=self.headers.get("Origin","")
        length=int(self.headers.get("Content-Length","0") or 0)
        if origin and origin not in ("http://127.0.0.1:"+str(self.server.server_port),"http://localhost:"+str(self.server.server_port)):
            if 0 < length <= MAX_BYTES: self.rfile.read(length)
            return self.send(403,{"error":"Origin rejected"})
        if length<=0 or length>MAX_BYTES: return self.send(413,{"error":"Request too large or empty"})
        content_type=self.headers.get("Content-Type","")
        raw=self.rfile.read(length)
        if path == "/api/analyze":
            if "multipart/form-data" not in content_type: return self.send(415,{"error":"Expected multipart form"})
            try:
                fields=parse_multipart(content_type,raw)
                filename, video=fields.get("video",(None,b""))
                if not filename or not video: return self.send(400,{"error":"Choose a video file"})
                suffix=Path(filename).suffix.lower()
                if suffix not in (".mp4",".mov",".webm",".m4v"): return self.send(400,{"error":"Supported: MP4, MOV, WEBM, M4V"})
                pid=uuid.uuid4().hex
                destination=DATA/(pid+suffix)
                destination.write_bytes(video)
                transcript=fields.get("transcript",(None,b""))[1].decode("utf-8","replace")
                metrics=fields.get("metrics",(None,b"{}"))[1].decode("utf-8","replace")
                try: metrics=json.loads(metrics)
                except ValueError: metrics={}
                name=Path(filename).stem[:120]
                result=analyse(destination,name,transcript,metrics)
                return self.send(200,result)
            except (OSError,ValueError,subprocess.SubprocessError):
                return self.send(500,{"error":"Unable to analyse this file. Try an MP4 and a supplied transcript."})
        if path == "/api/save":
            try:
                incoming=json.loads(raw.decode("utf-8"))
                pid=incoming["id"];current=load_project(pid)
                if not isinstance(incoming["segments"],list) or not isinstance(incoming["shots"],list): raise ValueError()
                segments=incoming["segments"];shots=incoming["shots"]
                if len(segments)>5000 or len(shots)>1000: raise ValueError()
                for seg in segments:
                    if seg["role"] not in TAGS or not isinstance(seg["text"],str): raise ValueError()
                    if float(seg["start"])<0 or float(seg["end"])<float(seg["start"]): raise ValueError()
                    seg["text"]=seg["text"][:4000]
                current["segments"]=segments; current["shots"]=shots
                if isinstance(incoming.get("metrics"),dict): current["metrics"]=incoming["metrics"]
                save_project(current)
                return self.send(200,{"ok":True})
            except (ValueError,KeyError,TypeError,FileNotFoundError): return self.send(400,{"error":"Invalid save request"})
        return self.send(404,{"error":"Not found"})

def main():
    port=int(os.environ.get("REEL_ANATOMY_PORT","8765"))
    srv=ThreadingHTTPServer(("127.0.0.1",port),Handler)
    url="http://127.0.0.1:"+str(port)
    print("Reel Anatomy running at "+url,flush=True)
    if os.environ.get("REEL_ANATOMY_NO_BROWSER")!="1":
        threading.Timer(1,lambda:webbrowser.open(url)).start()
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
    finally: srv.server_close()
if __name__ == "__main__": main()
