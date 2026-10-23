"""Reject stable promotion while original acceptance gates remain open."""
import argparse
import json
import re
from pathlib import Path

REQUIRED={'documents','recovery','production','model','iphone','platforms','sync','outcomes'}

def assess(value,stable=False):
    gates=value.get('gates')
    if not isinstance(gates,list) or {g.get('id') for g in gates}!=REQUIRED:
        raise ValueError('The original acceptance ledger is incomplete or has unexpected identities.')
    if len(gates)!=len(REQUIRED):raise ValueError('Duplicate acceptance gate.')
    allowed={'open','pending_verification','checked'}
    for gate in gates:
        if gate.get('status') not in allowed or not gate.get('acceptance') or not gate.get('title'):
            raise ValueError('Gate must retain status, objective and explicit acceptance.')
        if gate['status']=='checked' and not gate.get('evidence'):
            raise ValueError('Checked gate lacks a retrievable evidence reference: '+gate['id'])
    open_gates=[g['id'] for g in gates if g['status']!='checked']
    candidate=value.get('candidate','')
    if not re.fullmatch(r'1\.0\.0(?:-rc\.[1-9][0-9]*)?',candidate):raise ValueError('Unexpected release identity.')
    if open_gates and (candidate=='1.0.0' or value.get('stable_qualified') is True):raise ValueError('Stable identity contradicts open acceptance gates.')
    if not open_gates and value.get('stable_qualified') is not True:raise ValueError('Stable qualification still needs explicit recorded acceptance.')
    return {'candidate':candidate,'stable_qualified':not open_gates and value.get('stable_qualified') is True,'open_gates':open_gates,'mode':'stable' if stable else 'candidate','passed':not open_gates if stable else '-rc.' in candidate or not open_gates}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--target',type=Path,default=Path(__file__).resolve().parents[1]/'standalone/RELEASE_TARGET.json');parser.add_argument('--stable',action='store_true');args=parser.parse_args()
    result=assess(json.loads(args.target.read_text(encoding='utf-8')),args.stable)
    print(json.dumps(result,indent=2));raise SystemExit(0 if result['passed'] else 2)

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,json.JSONDecodeError) as e:print(json.dumps({'passed':False,'error':str(e)}));raise SystemExit(1)
