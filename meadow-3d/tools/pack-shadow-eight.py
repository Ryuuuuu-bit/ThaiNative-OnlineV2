"""Pack whole AutoSprite poses into four motion atlases per look; never transform limbs."""
import hashlib
import json
import runpy
from pathlib import Path
from statistics import median
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'output/shadow-clipping-repair-20261023/selected'
OUTPUT = ROOT / 'meadow-3d/public/assets/hero-shadow-8dir-v1'
LOOKS = ['male-iron', 'male-bow', 'female-iron', 'female-bow']
MOTIONS = ['idle', 'walk', 'attack', 'cast']
DIRECTIONS = {'SE':'southeast', 'SW':'southwest', 'NE':'northeast', 'NW':'northwest', 'S':'down', 'E':'right', 'N':'up', 'W':'left'}
SOURCE_CELL = 384
POSE_SIZE = 240
GUTTER = 8
SIZE = POSE_SIZE + GUTTER*2
SCALE = POSE_SIZE / SOURCE_CELL

def frames_of(path):
    source = Image.open(path).convert('RGBA')
    assert source.size == (SOURCE_CELL*4,SOURCE_CELL*4), path
    frames = [source.crop((i%4*SOURCE_CELL,i//4*SOURCE_CELL,(i%4+1)*SOURCE_CELL,(i//4+1)*SOURCE_CELL)) for i in range(16)]
    for i, frame in enumerate(frames):
        bbox = frame.getchannel('A').point(lambda a:255 if a>128 else 0).getbbox()
        assert bbox and 0 < bbox[0] and 0 < bbox[1] and bbox[2] < SOURCE_CELL and bbox[3] < SOURCE_CELL, (path,i,'empty or clipped source')
    return frames

def calibration(frames):
    # Use the dense central silhouette, excluding raised blades/bow tips from body height.
    a = frames[0].getchannel('A')
    top = next(y for y in range(64,320) if sum(a.getpixel((x,y)) > 128 for x in range(152,232)) >= 12)
    feet = []
    for frame in frames:
        alpha = frame.getchannel('A')
        feet.append(max(y for y in range(192,352) if sum(alpha.getpixel((x,y)) > 128 for x in range(112,272)) >= 5))
    ground = round(median(feet))
    assert ground > top + 90, (top, ground)
    return {'x':SOURCE_CELL/2*SCALE+GUTTER, 'y':ground*SCALE+GUTTER, 'height':(ground-top)*SCALE}

def main():
    records=json.loads((SOURCE/'sheets.json').read_text())
    indexed={(s['look'],s['action'],s['kind'].split('_')[-1]):s for s in records}
    assert len(indexed)==128, f'Expected 128 directional clips, got {len(indexed)}'
    # Reject damaged source poses before replacing any runtime files; padding cannot restore limbs.
    for (look,motion,provider),s in indexed.items():
        assert (s['frameCount'],s['frameWidth'],s['frameHeight'],s['columns'])==(16,256,256,4)
        path=SOURCE/f'{look}-{motion}-{provider}.png'
        assert s['reviewedHash']==hashlib.sha256(path.read_bytes()).hexdigest(), (path,'source repair review missing or stale')
        frames_of(path)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    manifest={'version':1,'looks':{}}
    validation=[]
    for look in LOOKS:
        manifest['looks'][look]={}
        overview=Image.new('RGB',(8*SIZE,4*(SIZE+18)),'#536557')
        draw=ImageDraw.Draw(overview)
        for mi,motion in enumerate(MOTIONS):
            atlas=Image.new('RGBA',(16*SIZE,8*SIZE))
            anchors={}
            for row,(direction,provider) in enumerate(DIRECTIONS.items()):
                s=indexed[look,motion,provider]
                path=SOURCE/f'{look}-{motion}-{provider}.png'
                frames=frames_of(path)
                anchors[direction]=calibration(frames)
                for i,frame in enumerate(frames):
                    atlas.paste(frame.resize((POSE_SIZE,POSE_SIZE),Image.Resampling.LANCZOS),(i*SIZE+GUTTER,row*SIZE+GUTTER))
                first=frames[0].resize((POSE_SIZE,POSE_SIZE),Image.Resampling.LANCZOS)
                overview.paste(first,(row*SIZE+GUTTER,mi*(SIZE+18)+18+GUTTER),first)
                draw.text((row*SIZE+4,mi*(SIZE+18)),f'{motion} {direction}',fill='white')
                validation.append({'look':look,'motion':motion,'direction':direction,'sheetId':s['id'],'sourceHash':hashlib.sha256(path.read_bytes()).hexdigest(),'edgeFrames':[],'gutter':GUTTER,'anchor':anchors[direction]})
            name=f'{look}-{motion}-{hashlib.sha256(atlas.tobytes()).hexdigest()[:10]}.webp'
            atlas.save(OUTPUT/name,'WEBP',quality=93,method=4)
            manifest['looks'][look][motion]={'url':'/assets/hero-shadow-8dir-v1/'+name,'size':SIZE,'frames':16,'seconds':{'idle':2,'walk':1,'attack':1.5,'cast':1.6}[motion],'anchors':anchors}
        overview.save(SOURCE/f'{look}-all-directions.jpg',quality=90)
    runpy.run_path(str(Path(__file__).with_name('pack-shadow-reactions.py')))['append_reactions'](manifest,validation)
    (OUTPUT/'validation.json').write_text(json.dumps(validation,indent=2))
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
    (SOURCE/'provenance.json').write_text(json.dumps([{k:v for k,v in s.items() if not k.endswith('Url')} for s in records],indent=2))
    print(json.dumps({'clips':len(validation),'frames':sum(c['frames']*8 for look in manifest['looks'].values() for c in look.values()),'bytes':sum((OUTPUT/Path(c['url']).name).stat().st_size for look in manifest['looks'].values() for c in look.values()),'edgeClips':[{k:v for k,v in r.items() if k in ['look','motion','direction','edgeFrames']} for r in validation if r['edgeFrames']]}))

if __name__=='__main__':main()
