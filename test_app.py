"""Deterministic unit and local HTTP integration tests; no paid services."""
import http.client
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path

_tmp = tempfile.TemporaryDirectory(prefix="reel-anatomy-test-")
os.environ["REEL_ANATOMY_HOME"] = _tmp.name
os.environ["REEL_ANATOMY_NO_BROWSER"] = "1"
import app

class EngineTests(unittest.TestCase):
    def test_timed_srt(self):
        s = "1\n00:00:00,000 --> 00:00:03,000\nWhy does this work?\n\n2\n00:00:03,000 --> 00:00:05,000\nLook at this."
        pieces, estimated = app.parse_captions(s, 5)
        self.assertFalse(estimated)
        self.assertEqual(len(pieces), 2)
        self.assertEqual(pieces[0], (0.,3.,"Why does this work?"))
    def test_plain_text_marks_estimated(self):
        pieces, estimated=app.parse_captions("This is an opening. This explains the idea.",10)
        self.assertTrue(estimated)
        self.assertEqual(len(pieces),2)
        self.assertEqual(round(pieces[-1][1]),10)
    def test_labels_are_suggestions(self):
        self.assertEqual(app.classify("Follow for more",20,21,30)[0],"CTA")
        self.assertEqual(app.classify("Why does everyone ignore this?",0,3,30)[0],"Hook")
        self.assertEqual(app.classify("Here is how it works",10,13,30)[0],"Demonstration")
        self.assertNotEqual(app.classify("Every video wins",18,21,30)[0],"Hook")
    def test_id_validation(self):
        with self.assertRaises(ValueError):app.project_path("../secret")
    def test_storage_roundtrip(self):
        p={"id":"c"*32,"title":"Synthetic", "segments":[],"shots":[],"metrics":{}}
        app.save_project(p)
        self.assertEqual(app.load_project("c"*32)["title"],"Synthetic")
    def test_multipart_decode(self):
        data=b"--test\r\nContent-Disposition: form-data; name=\"transcript\"\r\n\r\nhello\r\n--test--\r\n"
        self.assertEqual(app.parse_multipart("multipart/form-data; boundary=test",data)["transcript"][1],b"hello")

class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv=app.ThreadingHTTPServer(("127.0.0.1",0),app.Handler)
        cls.thread=threading.Thread(target=cls.srv.serve_forever,daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown();cls.srv.server_close();cls.thread.join(timeout=5)
    def fetch(self,path,method="GET",data=None,headers=None):
        conn=http.client.HTTPConnection("127.0.0.1",self.srv.server_port,timeout=30)
        conn.request(method,path,body=data,headers=headers or {})
        res=conn.getresponse();body=res.read();status=res.status;headers=dict(res.getheaders());conn.close()
        return status,body,headers
    def test_static(self):
        for uri, content in [("/","Reel Anatomy"),("/web/style.css","--paper"),("/web/app.js","renderTimeline")]:
            status,body,_=self.fetch(uri)
            self.assertEqual(status,200)
            self.assertIn(content,body.decode("utf-8"))
    def test_health_and_list(self):
        status,body,_=self.fetch("/api/health")
        self.assertEqual(status,200)
        self.assertTrue(json.loads(body)["local_only"])
        status,body,_=self.fetch("/api/projects")
        self.assertEqual(status,200)
    def test_origin_guard(self):
        status,body,_=self.fetch("/api/save","POST",b"{}",{"Content-Length":"2","Content-Type":"application/json","Origin":"https://evil.example"})
        self.assertEqual(status,403)
    def test_save_updates_roles(self):
        p={"id":"d"*32,"title":"Demo","media":"/media/"+"d"*32,"duration":5,
           "segments":[{"start":0,"end":2,"text":"Why do this?","role":"Hook","edited":False}],
           "shots":[],"metrics":{}}
        app.save_project(p)
        p["segments"][0]["text"]="A reviewed sentence."
        status,body,_=self.fetch("/api/save","POST",json.dumps(p).encode(),{"Content-Type":"application/json"})
        self.assertEqual(status,200)
        self.assertEqual(app.load_project("d"*32)["segments"][0]["text"],"A reviewed sentence.")
    def test_synthetic_video_upload_and_media_range(self):
        ff=app.media_bin("ffmpeg")
        if not ff:self.skipTest("FFmpeg not installed")
        video=Path(_tmp.name)/"test-input.mp4"
        p=app.command([ff,"-loglevel","error","-f","lavfi","-i","color=c=black:s=320x180:d=2",
                       "-c:v","mpeg4","-y",str(video)],timeout=20)
        self.assertEqual(p.returncode,0,p.stderr)
        vid=video.read_bytes(); sep="----RA-TEST-BOUNDARY-117"
        transcript="1\n00:00:00,000 --> 00:00:01,500\nWhy is this here?"
        parts=[]
        for key,value,filename in [("video",vid,"test-input.mp4"),("transcript",transcript.encode(),None)]:
            cd='Content-Disposition: form-data; name="'+key+'"'
            if filename:cd+='; filename="'+filename+'"'
            parts.append(("--"+sep+"\r\n"+cd+"\r\n\r\n").encode()+value+b"\r\n")
        body=b"".join(parts)+("--"+sep+"--\r\n").encode()
        status,data,_=self.fetch("/api/analyze","POST",body,{"Content-Type":"multipart/form-data; boundary="+sep})
        self.assertEqual(status,200,data[:200])
        result=json.loads(data)
        self.assertGreater(result["duration"],1)
        self.assertEqual(result["segments"][0]["role"],"Hook")
        self.assertTrue(result["shots"])
        status,media,headers=self.fetch(result["media"],headers={"Range":"bytes=0-9"})
        self.assertEqual(status,206)
        self.assertEqual(len(media),10)
        self.assertEqual(headers.get("Content-Range").split("/")[0],"bytes 0-9")

if __name__=="__main__":unittest.main(verbosity=2)
