"""Bounded caption tracks shared by browser worker, desktop speech and native renderer."""
from __future__ import annotations
import math
import re
import hashlib
import json

METHODS = ('imported-subtitles', 'local-whisper-words', 'manual-timing')
MAX_CUES = 600

def script_fingerprint(scenes):
    # Fixed decimal strings preserve this binding through JavaScript JSON transfer.
    body=[[format(float(s['start']),'.3f'),format(float(s['end']),'.3f'),s['spoken']] for s in scenes]
    return hashlib.sha256(json.dumps(body,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

def finite(value, label):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value):
        raise ValueError('Invalid '+label+'.')
    return float(value)

def validate_cues(cues, duration):
    duration=finite(duration,'caption duration')
    if not isinstance(cues,list) or not 1<=len(cues)<=MAX_CUES:
        raise ValueError('Use one to 600 timed caption cues.')
    result=[];last=0.0
    for cue in cues:
        if not isinstance(cue,dict):raise ValueError('Invalid caption cue.')
        start=round(finite(cue.get('start'),'caption start'),3)
        end=round(finite(cue.get('end'),'caption end'),3)
        words=cue.get('text')
        if start<0 or start<last-.0001 or end-start<.02 or end>duration+.0001:
            raise ValueError('Caption cues must be ordered, non-overlapping and inside the video duration.')
        if not isinstance(words,str) or not words.strip() or len(words)>180 or '\x00' in words:
            raise ValueError('Each caption needs 1–180 characters.')
        result.append({'start':start,'end':end,'text':' '.join(words.split())})
        last=end
    return result

def subtitle_stamp(value):
    value=value.replace(',','.');parts=value.split(':')
    if len(parts) not in (2,3):raise ValueError('Invalid subtitle timestamp.')
    try:
        h=int(parts[0]) if len(parts)==3 else 0;m=int(parts[-2]);s=float(parts[-1])
    except ValueError:raise ValueError('Invalid subtitle timestamp.')
    if h<0 or not 0<=m<60 or not math.isfinite(s) or not 0<=s<60:raise ValueError('Invalid subtitle clock.')
    return h*3600+m*60+s

def parse_subtitles(value,duration):
    if not isinstance(value,str) or len(value)>200000:raise ValueError('Subtitle import exceeds 200,000 characters.')
    blocks=re.split(r'\n\s*\n',value.lstrip('\ufeff').replace('\r\n','\n').strip());out=[]
    pattern=re.compile(r'^(\d{1,3}:\d{2}:\d{2}[.,]\d{1,3}|\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,3}:\d{2}:\d{2}[.,]\d{1,3}|\d{2}:\d{2}[.,]\d{1,3})(?:\s+.*)?$')
    for block in blocks:
        lines=block.splitlines()
        if not lines or lines[0].startswith(('WEBVTT','NOTE','STYLE','REGION')):continue
        i=next((i for i,line in enumerate(lines) if '-->' in line),None)
        if i is None:raise ValueError('Only timestamped SRT/VTT is accepted here; plain text is not speech alignment.')
        match=pattern.fullmatch(lines[i].strip())
        if not match:raise ValueError('Malformed subtitle timing.')
        text=re.sub(r'<[^>]*>','',' '.join(lines[i+1:])).strip()
        out.append({'start':subtitle_stamp(match[1]),'end':subtitle_stamp(match[2]),'text':text})
    return validate_cues(out,duration)

def cues_from_words(words,duration):
    if not isinstance(words,list) or len(words)>12000:raise ValueError('Invalid word timing list.')
    cues=[];group=[];previous=0.0
    def flush():
        if group:
            cues.append({'start':group[0]['start'],'end':group[-1]['end'],'text':' '.join(x['text'] for x in group)});group.clear()
    for item in words:
        start=round(finite(item.get('start'),'word start'),3);end=round(finite(item.get('end'),'word end'),3)
        phrase=item.get('word',item.get('text',''))
        if not isinstance(phrase,str) or len(phrase)>180:raise ValueError('Invalid recognised word.')
        phrase=phrase.strip()
        if not phrase or end<=start:continue
        if start<previous-.02 or start<0 or end>duration+.05:raise ValueError('Speech model returned invalid word timing.')
        start=max(start,previous);end=min(end,duration)
        if end-start<.02:continue
        if group and (start-group[-1]['end']>.55 or end-group[0]['start']>3.5 or len(group)>=8 or len(' '.join(x['text'] for x in group)+' '+phrase)>66):flush()
        group.append({'start':start,'end':end,'text':phrase});previous=end
        if re.search(r'[.!?]$',phrase):flush()
    flush()
    return validate_cues(cues,duration)

def clean_track(value,duration):
    if value is None:return None
    if not isinstance(value,dict) or value.get('method') not in METHODS:raise ValueError('Invalid caption timing method.')
    for key in ('narration_sha256','script_hash'):
        if not isinstance(value.get(key),str) or not re.fullmatch(r'[a-f0-9]{64}',value[key]):raise ValueError('Caption track lacks its '+key+' binding.')
    provenance=value.get('provenance','')
    if not isinstance(provenance,str) or not provenance.strip() or len(provenance)>800:raise ValueError('Caption provenance is required.')
    return {'schema':1,'method':value['method'],'narration_sha256':value['narration_sha256'],'script_hash':value['script_hash'],
            'provenance':provenance,'cues':validate_cues(value.get('cues'),duration)}

def check_track(value,duration,narration,scenes):
    track=clean_track(value,duration)
    if track is None:return []
    errors=[]
    if not narration or track['narration_sha256']!=narration['sha256']:errors.append('Timed captions belong to different narration. Regenerate or reimport captions for this audio.')
    if track['script_hash']!=script_fingerprint(scenes):errors.append('The script or shot timing changed after these captions. Recheck and explicitly rebind the timed captions.')
    return errors

def stamp(seconds):
    ms=round(seconds*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

def srt(cues):
    return '\n'.join(f"{i+1}\n{stamp(c['start'])} --> {stamp(c['end'])}\n{c['text']}\n" for i,c in enumerate(cues))
