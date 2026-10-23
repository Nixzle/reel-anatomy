"""Reel Factory CLI: inspect or render explicit local production packages.
No network, model downloads, automatic publishing or shell commands.
Uses existing Pillow and FFmpeg. It installs nothing.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT),str(ROOT/'standalone')]
from factory_engine import verify_package

def caption_cues(scenes):
    cues=[]
    for scene in scenes:
        groups=[];group=[]
        for word in scene['spoken'].split():
            if group and (len(' '.join(group+[word]))>66 or len(group)>=11):groups.append(' '.join(group));group=[]
            group.append(word)
        if group:groups.append(' '.join(group))
        total=sum(len(x.split()) for x in groups) or 1;at=scene['start']
        for i,line in enumerate(groups):
            end=scene['end'] if i==len(groups)-1 else at+(scene['end']-scene['start'])*len(line.split())/total
            cues.append({'start':at,'end':end,'text':line});at=end
    return cues

def timestamp(seconds,ass=False):
    ms=round(seconds*1000);hours=ms//3600000;minutes=ms//60000%60;sec=ms//1000%60
    return f'{hours}:{minutes:02}:{sec:02}.{ms%1000//10:02}' if ass else f'{hours:02}:{minutes:02}:{sec:02},{ms%1000:03}'

def captions(package,output):
    cues=caption_cues(package['variant']['scenes'])
    (output/'captions.srt').write_text('\n'.join(f"{i+1}\n{timestamp(c['start'])} --> {timestamp(c['end'])}\n{c['text']}\n" for i,c in enumerate(cues)),encoding='utf-8')
    header="""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,52,&H00FFFFFF,&H00FFFFFF,&H00201816,&H00201816,0,0,0,0,100,100,0,0,3,12,0,2,105,105,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    def safe(s):return s.replace('\\','\\\\').replace('{',r'\{').replace('}',r'\}').replace('\r',' ').replace('\n',r'\N')
    body='\n'.join(f"Dialogue: 0,{timestamp(c['start'],True)},{timestamp(c['end'],True)},Caption,,0,0,0,,{safe(c['text'])}" for c in cues)
    (output/'captions.ass').write_text(header+body,encoding='utf-8')

def sha(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()

def local_assets(package,folder):
    wanted={x['media']['sha256']:x['media'] for x in package['variant']['scenes'] if x.get('media')}
    audio=package['variant'].get('narration')
    if audio:wanted[audio['sha256']]=audio
    if not wanted:return {}
    if folder is None:raise ValueError('This package needs media. Supply --assets-dir with the exact reviewed local files.')
    folder=folder.resolve(strict=True)
    candidates=[p for p in folder.iterdir() if p.is_file() and p.stat().st_size<=100*1024*1024]
    if len(candidates)>100:raise ValueError('Use a dedicated asset folder with at most 100 files.')
    found={}
    for p in candidates:
        if p.is_symlink() or not p.resolve().is_relative_to(folder):continue
        key=sha(p)
        if key in wanted:found[key]=p
    missing=[meta['name'] for key,meta in wanted.items() if key not in found]
    if missing:raise ValueError('Missing hash-matched media: '+', '.join(missing))
    return found

def font(size,serif=False):
    from PIL import ImageFont
    names=['C:/Windows/Fonts/georgia.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'] if serif else ['C:/Windows/Fonts/arial.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
    for name in names:
        if Path(name).is_file():return ImageFont.truetype(name,size)
    return ImageFont.load_default(size=size)

def wrapped(draw,text,face,width):
    lines=[];line=''
    for word in text.split():
        if draw.textlength(word,font=face)>width:
            if line:lines.append(line);line=''
            part=''
            for ch in word:
                if draw.textlength(part+ch,font=face)>width:lines.append(part);part=''
                part+=ch
            line=part;continue
        candidate=(line+' '+word).strip()
        if line and draw.textlength(candidate,font=face)>width:lines.append(line);line=word
        else:line=candidate
    if line:lines.append(line)
    return lines

def overlay(package,scene,output,width):
    from PIL import Image,ImageDraw
    height=round(width*16/9);has_media=bool(scene.get('media'))
    image=Image.new('RGBA',(1080,1920),(0,0,0,0) if has_media else '#eeeae1');draw=ImageDraw.Draw(image)
    if has_media:draw.rectangle((45,145,1035,495),fill=(20,22,20,205))
    else:
        draw.rectangle((48,145,1032,1735),outline='#c1baac',width=2);draw.rectangle((84,245,184,250),fill='#aa492c')
        draw.text((1000,1010),f"{scene['index']+1:02}",font=font(290,True),fill='#ddd7cb',anchor='ra')
    content=scene['on_screen'] or scene['role'];size=76 if has_media else 105;max_height=245 if has_media else 670
    while size>=22:
        face=font(size,not has_media);lines=wrapped(draw,content,face,910 if has_media else 900)
        if len(lines)*size*1.22<=max_height:break
        size-=2
    if size<22:raise ValueError('On-screen text does not fit. Shorten it before rendering.')
    for i,line in enumerate(lines):draw.text((85,200+i*size*1.22) if has_media else (84,330+i*size*1.22),line,font=face,fill='#faf8f1' if has_media else '#282924')
    draw.text((84,76),'REEL ANATOMY / '+package['variant']['key'],font=font(26),fill='#ffffff' if has_media else '#4c4a42')
    refs=[]
    for identity in scene['claim_ids']:
        c=next(x for x in package['evidence']['claims'] if x['id']==identity);refs.extend(x['citation'] for x in c['links'])
    draw.text((84,1660),' · '.join(dict.fromkeys(refs))[:80],font=font(23),fill='#ffffff' if has_media else '#696355')
    if package['mode']!='reviewed':draw.rectangle((650,70,1000,130),fill='#922c1d');draw.text((665,87),'DRAFT / REVIEW REQUIRED',font=font(23),fill='white')
    image.resize((width,height)).save(output)

def render(package,assets_dir,output,width=720):
    verify_package(package)
    ff=shutil.which('ffmpeg');probe=shutil.which('ffprobe')
    if not ff or not probe:raise ValueError('FFmpeg and ffprobe are required. No installer was run.')
    if output.exists():raise ValueError('Output directory already exists. Choose a new directory; existing work is never overwritten.')
    assets=local_assets(package,assets_dir);output.mkdir(parents=True);work=output/'_work';work.mkdir()
    captions(package,output);(output/'production-package.json').write_text(json.dumps(package,indent=2,ensure_ascii=False),encoding='utf-8')
    logs=[];height=round(width*16/9)
    def call(args,name):
        bounded=[]
        for arg in args:
            if arg=='-i':bounded.extend(['-protocol_whitelist','file,pipe'])
            bounded.append(arg)
        p=subprocess.run([ff,'-hide_banner','-nostdin','-loglevel','warning',*bounded],cwd=output,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=240)
        logs.append({'step':name,'exit':p.returncode,'stderr':p.stderr});(output/'render-log.json').write_text(json.dumps(logs,indent=2))
        if p.returncode:raise RuntimeError(name+' failed; inspect render-log.json. No complete output is claimed.')
    parts=[]
    for scene in package['variant']['scenes']:
        index=scene['index'];frame=work/f'overlay-{index}.png';overlay(package,scene,frame,width);part=work/f'part-{index}.mp4';length=scene['end']-scene['start'];media=scene.get('media')
        if media:
            source=assets[media['sha256']];copied=work/f'source-{index}{source.suffix}';shutil.copy2(source,copied)
            inputs=['-loop','1','-framerate','30','-i',str(copied)] if media['type'].startswith('image/') else ['-ss',str(scene['clip_in']),'-i',str(copied)]
            inputs+=['-loop','1','-framerate','30','-i',str(frame)]
            fit=f'scale={width}:{height}:force_original_aspect_ratio='+('decrease' if scene['fit']=='contain' else 'increase')
            fit+=f',pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=0xeeeae1' if scene['fit']=='contain' else f',crop={width}:{height}'
            filters=f'[0:v]{fit},setsar=1,fps=30[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]'
            args=inputs+['-filter_complex',filters,'-map','[v]','-an']
        else:args=['-loop','1','-framerate','30','-i',str(frame),'-an','-vf','format=yuv420p']
        call(args+['-t',str(length),'-c:v','libx264','-preset','veryfast','-crf','20','-threads','2','-filter_threads','2','-r','30','-pix_fmt','yuv420p',str(part)],f'shot-{index}')
        parts.append(part)
    concat=work/'shots.txt';concat.write_text(''.join("file '"+p.name+"'\n" for p in parts),encoding='utf-8')
    joined=work/'joined.mp4';call(['-f','concat','-safe','1','-i',str(concat),'-c','copy',str(joined)],'join-shots')
    final=output/f"reel-{package['variant']['key']}-{package['mode']}.mp4"
    args=['-i',str(joined)];narration=package['variant'].get('narration')
    if narration:
        source=assets[narration['sha256']];audio=work/('narration'+source.suffix);shutil.copy2(source,audio);args+=['-i',str(audio),'-map','0:v:0','-map','1:a:0','-c:a','aac','-b:a','192k']
    else:args+=['-an']
    call(args+['-vf','ass=captions.ass','-t',str(package['duration']),'-c:v','libx264','-preset','veryfast','-crf','20','-threads','2','-filter_threads','2','-pix_fmt','yuv420p','-movflags','+faststart',str(final)],'caption-and-audio')
    p=subprocess.run([probe,'-v','error','-show_streams','-show_format','-of','json',str(final)],capture_output=True,text=True,timeout=30)
    if p.returncode:raise RuntimeError('Output probe failed.')
    media=json.loads(p.stdout);video=next(s for s in media['streams'] if s['codec_type']=='video')
    if video['width']!=width or video['height']!=height or abs(float(media['format']['duration'])-package['duration'])>.3:raise RuntimeError('Rendered dimensions or duration did not match the manifest.')
    if narration and not any(s['codec_type']=='audio' for s in media['streams']):raise RuntimeError('Expected narration track is missing.')
    receipt={'version':'0.6.0-factory','file':final.name,'sha256':sha(final),'bytes':final.stat().st_size,'mode':package['mode'],'package_hash':package['package_hash'],
             'width':width,'height':height,'duration':float(media['format']['duration']),'audio':bool(narration),'status':'Rendered and probed locally; not published.',
             'source_validity':'Evidence is checked against this frozen package. The app must recheck live source revisions before future exports.'}
    (output/'RENDER_RECEIPT.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8');(output/'post-caption.txt').write_text(package['variant']['caption'],encoding='utf-8')
    (output/'sources.json').write_text(json.dumps(package['evidence'],indent=2,ensure_ascii=False),encoding='utf-8')
    (output/'test-card.json').write_text(json.dumps({k:package['variant'][k] for k in ('key','name','hypothesis','primary_metric','window')},indent=2),encoding='utf-8')
    return receipt

def main():
    parser=argparse.ArgumentParser(description='Sanctum Reel Factory: local, source-bound assembly. No virality guarantees.')
    parser.add_argument('action',choices=('doctor','inspect','render','batch'));parser.add_argument('package',nargs='?',type=Path)
    parser.add_argument('--assets-dir',type=Path);parser.add_argument('--output',type=Path);parser.add_argument('--width',type=int,choices=(720,1080),default=720)
    args=parser.parse_args()
    if args.action=='doctor':
        import importlib.util
        print(json.dumps({'tool':'reel-factory','version':'0.6.0','ffmpeg':bool(shutil.which('ffmpeg')),'ffprobe':bool(shutil.which('ffprobe')),'pillow':bool(importlib.util.find_spec('PIL')),'network':False,'publishes':False,'guaranteed_virality':False},indent=2));return
    if not args.package or args.package.stat().st_size>25*1024*1024:raise ValueError('Provide a production package of at most 25 MB.')
    value=json.loads(args.package.read_text(encoding='utf-8'))
    if args.action=='inspect':print(json.dumps(verify_package(value),indent=2));return
    if not args.output:raise ValueError('--output is required and must be a new directory.')
    if args.action=='render':print(json.dumps(render(value,args.assets_dir,args.output.resolve(),args.width),indent=2));return
    if value.get('format')!='reel-factory-batch' or not isinstance(value.get('packages'),list) or not 1<=len(value['packages'])<=3:raise ValueError('Batch expects one to three explicit Reel Factory packages.')
    for p in value['packages']:verify_package(p)
    if args.output.exists():raise ValueError('Batch output already exists. Use a new directory.')
    args.output.mkdir(parents=True)
    results=[render(p,args.assets_dir,(args.output/f"{i+1}-{p['variant']['key']}").resolve(),args.width) for i,p in enumerate(value['packages'])]
    print(json.dumps(results,indent=2))

if __name__=='__main__':
    try:main()
    except Exception as error:print(json.dumps({'ok':False,'error':str(error)},ensure_ascii=False),file=sys.stderr);raise SystemExit(1)
