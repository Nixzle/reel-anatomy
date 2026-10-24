"""Deterministic phone relay validation. No public service or private media used."""
import base64,hashlib,json,sqlite3,tempfile,threading,types,unittest
from pathlib import Path
from unittest.mock import Mock,patch
import mobile_bridge as mb

class MobileTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  self.host=types.SimpleNamespace(DATA=self.root,MAX_VIDEO_BYTES=200*1024*1024)
  self.b=mb.Bridge(self.host,19890)
 def tearDown(self):self.b.close();self.tmp.cleanup()
 def test_narrow_allowlist(self):
  for m,p in [('GET','/api/projects'),('GET','/api/studio/library?workspace=default'),('POST','/api/studio/save-plan'),('POST','/api/mobile/upload/start')]:self.assertTrue(mb.allowed(m,p),p)
  for m,p in [('POST','/api/mobile/pair'),('GET','https://evil.test/api/health'),('GET','//evil.test/api/health'),('POST','/api/studio/configure'),('DELETE','/api/projects'),('GET','/api/project/../../secret')]:self.assertFalse(mb.allowed(m,p),p)
 def test_no_credentials_in_status(self):
  self.b.config={'enabled':False,'url':'https://example.test','secret':'a'*64};self.assertNotIn('a'*64,json.dumps(self.b.status()))
 def test_duplicate_write_reuses_receipt(self):
  self.b.execute=Mock(return_value=self.b.response(200,{'ok':True}));self.b.request=Mock()
  request={'id':'12345678-1234-1234-1234-123456789abc','method':'POST','path':'/api/save','body':base64.b64encode(b'{}').decode(),'headers':{}}
  self.b.handle(request);self.b.handle(request);self.assertEqual(self.b.execute.call_count,1)
 def test_unknown_write_is_not_replayed(self):
  self.b.execute=Mock(side_effect=OSError('synthetic'));self.b.request=Mock()
  request={'id':'22345678-1234-1234-1234-123456789abc','method':'POST','path':'/api/save','body':'e30=','headers':{}}
  self.b.handle(request);self.b.handle(request);self.assertEqual(self.b.execute.call_count,1);self.assertEqual(self.b.request.call_args.args[1]['status'],409)
 def test_mutated_request_id_rejected(self):
  self.b.execute=Mock(return_value=self.b.response(200,{'ok':True}));self.b.request=Mock()
  request={'id':'32345678-1234-1234-1234-123456789abc','method':'POST','path':'/api/save','body':'e30=','headers':{}}
  self.b.handle(request);self.b.handle(dict(request,body='e10='));self.assertEqual(self.b.execute.call_count,1);self.assertEqual(self.b.request.call_args.args[1]['status'],409)
 def start_upload(self):
  self.engine=Mock();self.engine.import_video.return_value={'id':'job-fixture','status':'queued'}
  self.patch=patch('studio_api.engine',return_value=self.engine);self.patch.start();self.addCleanup(self.patch.stop)
  data={'filename':'fixture.mp4','size':6,'metadata':{'rights_confirmed':True},'transcript':''}
  return self.b.upload('/api/mobile/upload/start','POST',json.dumps(data).encode())
 def test_chunks_reconcile_and_reject_conflicts(self):
  doc=self.start_upload();url='/api/mobile/upload/chunk/'+doc['id']+'?offset=0';self.b.upload(url,'POST',b'abc');self.b.upload(url,'POST',b'abc')
  with self.assertRaises(ValueError):self.b.upload(url,'POST',b'xyz')
  self.assertEqual((self.root/'mobile_uploads'/(doc['id']+'.part')).read_bytes(),b'abc')
 def test_incomplete_finish_rejected(self):
  doc=self.start_upload()
  with self.assertRaises(ValueError):self.b.upload('/api/mobile/upload/finish/'+doc['id'],'POST',b'{}')
  self.engine.import_video.assert_not_called()
 def test_finish_is_idempotent_and_queues_once(self):
  doc=self.start_upload();self.b.upload('/api/mobile/upload/chunk/'+doc['id']+'?offset=0','POST',b'abcdef')
  url='/api/mobile/upload/finish/'+doc['id'];a=self.b.upload(url,'POST',b'{}');b=self.b.upload(url,'POST',b'{}');self.assertEqual(a,b);self.engine.import_video.assert_called_once()
 def test_upload_requires_rights(self):
  with self.assertRaises(ValueError):self.b.upload('/api/mobile/upload/start','POST',json.dumps({'filename':'a.mp4','size':4,'metadata':{}}).encode())
 def test_device_disable_revokes_before_claim(self):
  self.b.config={'enabled':True,'url':'https://example.test','secret':'a'*64};self.b.request=Mock(side_effect=OSError('offline'))
  with self.assertRaises(OSError):self.b.disable()
  self.assertTrue(self.b.config['enabled'])
 def test_serviceworker_excludes_private_routes(self):
  s=(Path(__file__).parent/'web/sw.js').read_text();self.assertIn('api|bridge|media|thumb',s);self.assertNotIn("cache.put('/api",s)

if __name__=='__main__':unittest.main(verbosity=2)
