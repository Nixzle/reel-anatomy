"""Release regressions: real scene changes, validation, unknown data and speech."""
import http.client
import json
import math
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import test_app
import app

class DataTests(unittest.TestCase):
    def test_unknown_metrics_stay_unknown(self):
        self.assertEqual(app.validate_metrics({"views": 100, "likes": None}), {"views":100,"likes":None})
    def test_metrics_reject_invalid_values(self):
        for value in [-1, 1.2, "10", True, float("nan"), float("inf")]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                app.validate_metrics({"views":value})
    def test_metrics_reject_nonobject(self):
        with self.assertRaises(ValueError): app.validate_metrics([])
    def test_timestamps_are_finite_numbers(self):
        for value in [float("nan"), float("inf"), "0 onmouseover=x", -1]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                app.validate_intervals([{"start":value,"end":2,"role":"Hook","text":"test"}],5,True)
    def test_shots_are_validated(self):
        with self.assertRaises(ValueError):
            app.validate_intervals([{"start":0,"end":100,"kind":"bad"}],5,False)
    def test_plain_text_stays_within_video(self):
        segments,estimated=app.parse_captions("One. Two. Three.",1.5)
        self.assertTrue(estimated)
        self.assertAlmostEqual(segments[-1][1],1.5)
    def test_backwards_captions_rejected(self):
        with self.assertRaises(ValueError):
            app.parse_captions("1\n00:00:04,000 --> 00:00:01,000\nBad.",5)
    def test_detector_failure_does_not_invent_a_shot(self):
        import subprocess
        with patch.object(app,"media_bin",return_value="fake"), patch.object(app,"command",return_value=subprocess.CompletedProcess([],1,"","failed")):
            shots,warning=app.shot_boundaries(Path("fake.mp4"),5)
        self.assertEqual(shots,[])
        self.assertIn("failed",warning)

class MediaTests(unittest.TestCase):
    def test_real_cut_with_bundled_and_system_ffmpeg(self):
        bundled=app.media_bin("ffmpeg")
        self.assertTrue(bundled,"Release test requires FFmpeg; do not silently skip")
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"two-shots.mp4"
            result=app.command([bundled,"-loglevel","error","-f","lavfi","-i","color=black:s=320x180:r=25:d=2", "-f","lavfi","-i","color=white:s=320x180:r=25:d=2", "-filter_complex","[0:v][1:v]concat=n=2:v=1:a=0[out]", "-map","[out]","-c:v","libx264","-threads","2","-pix_fmt","yuv420p","-y",str(path)],30)
            self.assertEqual(result.returncode,0,result.stderr)
            engines=list(dict.fromkeys(filter(None,[bundled,shutil.which("ffmpeg")])))
            for engine in engines:
                with self.subTest(engine=engine), patch.object(app,"media_bin",return_value=engine):
                    shots,warning=app.shot_boundaries(path,4)
                    self.assertEqual(warning,"")
                    self.assertEqual(len(shots),2)
                    self.assertAlmostEqual(shots[1]["start"],2,places=1)
    def test_actual_speech_not_just_import(self):
        output,warning=app.transcribe(Path(__file__).parent/"tests/fixtures/speech.wav")
        self.assertEqual(warning,"")
        text=" ".join(x[2] for x in output).lower()
        self.assertIn("stop making this mistake",text)
        self.assertIn("watch this quick example",text)

class HttpRegressionTests(test_app.HttpTests):
    def test_foreign_host_rejected(self):
        status,_,_=self.fetch("/api/projects",headers={"Host":"evil.example"})
        self.assertEqual(status,403)
    def test_cross_site_read_rejected(self):
        status,_,_=self.fetch("/api/projects",headers={"Sec-Fetch-Site":"cross-site"})
        self.assertEqual(status,403)
    def test_stale_revision_rejected(self):
        p={"id":"e"*32,"title":"Revision test","duration":5,"revision":1,"segments":[],"shots":[],"metrics":{}}
        app.save_project(p)
        body=json.dumps(p).encode()
        status,data,_=self.fetch("/api/save","POST",body,{"Content-Type":"application/json"})
        self.assertEqual(status,200)
        self.assertEqual(json.loads(data)["revision"],2)
        status,_,_=self.fetch("/api/save","POST",body,{"Content-Type":"application/json"})
        self.assertEqual(status,409)

if __name__=="__main__":unittest.main(verbosity=2)
