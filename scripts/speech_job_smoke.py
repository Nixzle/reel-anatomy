"""Exercise actual local speech-job cancellation and absence of remote processing."""
import argparse,json,time,urllib.request,urllib.error
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=18938);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
base='http://127.0.0.1:'+str(args.port)
def request(path,data=None,token=None,mime='application/json'):
    headers={'Content-Type':mime}
    if token:headers['X-Reel-Token']=token
    with urllib.request.urlopen(urllib.request.Request(base+path,data=data,headers=headers),timeout=15) as r:return json.load(r)
health=request('/api/companion/health');assert health['speech'] and not health['network_processing'];token=health['token']
body=Path('tests/fixtures/speech.wav').read_bytes();created=request('/api/companion/jobs',body,token,'audio/wav');cancel=request('/api/companion/jobs/'+created['id']+'/cancel',b'{}',token)
assert cancel['status']=='cancelled'
for _ in range(50):
    state=request('/api/companion/jobs/'+created['id'],token=token)
    if state['status']=='cancelled':break
    time.sleep(.1)
assert state['status']=='cancelled' and 'result' not in state
# Retain redacted receipt, never the running session token.
result={'passed':True,'speech':'bundled English model available','cancelled_job_has_no_completed_transcript':True,'network_processing':False}
args.output.write_text(json.dumps(result,indent=2));print(json.dumps(result))
