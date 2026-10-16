"""Package alpha artwork, using one scale for all motion frames and a torso anchor.

Only deterministic extraction/resampling/atlas layout is performed here. The
poses themselves are imagegen artwork; this script does not draw or warp limbs.
"""
from pathlib import Path
from collections import deque
from statistics import median
from PIL import Image, ImageFilter, ImageDraw
import json, subprocess, sys
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/painted-hero'
OUT=ROOT/'public/assets/hero-painted'
DIRS=['SE','SW','NE','NW']

def components(image):
    w,h=image.size
    raw=bytearray(image.getchannel('A').point(lambda x:255 if x>12 else 0).tobytes())
    found=[]
    for origin in range(w*h):
        if not raw[origin]: continue
        raw[origin]=0; todo=[origin]; pixels=[];x0=w;y0=h;x1=y1=0
        while todo:
            i=todo.pop();pixels.append(i);y,x=divmod(i,w)
            x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
            for nxt in ((i-1 if x else -1),(i+1 if x<w-1 else -1),i-w,i+w):
                if 0<=nxt<w*h and raw[nxt]:raw[nxt]=0;todo.append(nxt)
        if len(pixels)<1000:continue
        bbox=(x0,y0,x1+1,y1+1)
        # Mask isolates nearby crossing weapons without erasing antialiased edges.
        mask=Image.new('L',(w,h));buf=np.zeros(w*h,dtype=np.uint8);buf[pixels]=255
        mask=Image.fromarray(buf.reshape(h,w)).filter(ImageFilter.MaxFilter(5))
        crop=image.crop(bbox)
        alpha=np.minimum(np.asarray(crop.getchannel('A')),np.asarray(mask.crop(bbox)))
        crop.putalpha(Image.fromarray(alpha))
        found.append({'image':crop,'bbox':bbox,'center':((x0+x1)/2,(y0+y1)/2)})
    return found

def anchor(image):
    a=np.asarray(image.getchannel('A'))>32;h,w=a.shape
    # Torso / hip band: sword tips and wide arm swings must not shift the pivot.
    thick=Image.fromarray(a.astype(np.uint8)*255).filter(ImageFilter.MinFilter(7))
    b=np.asarray(thick)>0
    band=b[int(h*.40):int(h*.65)]
    weights=band.sum(axis=0);total=weights.sum()
    if not total:return w/2
    return int(np.searchsorted(np.cumsum(weights),total/2))

rows={}
all_images=[]
report={'directions':DIRS,'frameSize':[384,256],'baseline':240,'sources':{},'frames':{}}
for direction in DIRS:
    path=ART/f'motion-{direction}-v1.png'
    source=Image.open(path).convert('RGBA')
    parts=components(source)
    if len(parts)!=12:raise ValueError(f'{direction}: expected 12 connected figures, found {len(parts)}')
    top=sorted([c for c in parts if c['center'][1]<source.height/2],key=lambda c:c['center'][0])
    bottom=sorted([c for c in parts if c['center'][1]>=source.height/2],key=lambda c:c['center'][0])
    if len(top)!=6 or len(bottom)!=6:raise ValueError('Invalid row layout')
    rows[direction]={'run':[c['image'] for c in top],'attack':[c['image'] for c in bottom]}
    report['sources'][direction]={'file':str(path.relative_to(ROOT)),'size':source.size,'bounds':[c['bbox'] for c in top+bottom]}

replacement=Image.open(ART/'run-SE-v3.png').convert('RGBA')
parts=sorted(components(replacement),key=lambda c:c['center'][0])
if len(parts)!=6:raise ValueError('SE replacement must contain six figures')
# One uniform resampling factor for the entire replacement strip, never per-frame.
factor=median(im.height for im in rows['SE']['run'])/median(c['image'].height for c in parts)
rows['SE']['run']=[c['image'].resize((round(c['image'].width*factor),round(c['image'].height*factor)),Image.Resampling.LANCZOS) for c in parts]
report['sources']['SE']['runOverride']='art/painted-hero/run-SE-v3.png'
report['sources']['SE']['runStripScale']=factor
orders={'SE':[0,1,2,3,4,5],'SW':[0,1,4,2,5,3],'NE':[2,1,4,0,3,5],'NW':[0,1,4,2,5,3]}
for direction in DIRS:
    rows[direction]['run']=[rows[direction]['run'][i] for i in orders[direction]]
    report['sources'][direction]['runFrameOrder']=[i+1 for i in orders[direction]]
    all_images.extend(rows[direction]['run']+rows[direction]['attack'])

# Global shared scale: preserve motion proportions, allow headroom for raised swords.
scale=min(226/max(im.height for im in all_images),236/max(im.width for im in all_images))
report['motionSharedScale']=scale

def normalized(image,s=scale,mult=1):
    canvas=Image.new('RGBA',(384*mult,256*mult))
    s*=mult
    width,height=round(image.width*s),round(image.height*s)
    resized=image.resize((width,height),Image.Resampling.LANCZOS)
    x=round(192*mult-anchor(image)*s);y=240*mult-height
    if x<3*mult or x+width>381*mult:
        # Preserve the torso anchor; flag any art requiring more lateral room.
        report.setdefault('edgeWarnings',[]).append([x,y,width,height])
    canvas.alpha_composite(resized,(x,y))
    return canvas

for motion in ['idle','run','attack']:
    atlas=Image.new('RGBA',(1536,256) if motion=='idle' else (2304,1024))
    hd=Image.new('RGBA',(atlas.width*2,atlas.height*2))
    for row,direction in enumerate(DIRS):
        if motion=='idle':
            seed=Image.open(ART/f'seed-{direction}.png').convert('RGBA');bbox=seed.getchannel('A').getbbox();seed=seed.crop(bbox)
            idle_scale=median(im.height for d in DIRS for im in rows[d]['run'])*scale/seed.height
            frames=[normalized(seed,idle_scale)]
            hd_frames=[normalized(seed,idle_scale,2)]
        else:
            frames=[normalized(im) for im in rows[direction][motion]]
            hd_frames=[normalized(im,scale,2) for im in rows[direction][motion]]
        frame_dir=ART/'frames'/motion/direction;frame_dir.mkdir(parents=True,exist_ok=True)
        for col,frame in enumerate(frames):
            frame.save(frame_dir/f'{col+1:02}.png')
            atlas.alpha_composite(frame,((row*384 if motion=='idle' else col*384),(0 if motion=='idle' else row*256)))
            hd.alpha_composite(hd_frames[col],((row*768 if motion=='idle' else col*768),(0 if motion=='idle' else row*512)))
        report['frames'][f'{motion}-{direction}']=[im.getchannel('A').getbbox() for im in frames]
        if motion=='run':
            contacts=[]
            for idx in [0,3]:
                a=np.asarray(frames[idx].getchannel('A'))
                ys,xs=np.nonzero(a>32);lowest=ys.max();bottom_x=float(np.median(xs[ys>=lowest-2]))
                contacts.append({'frame':idx+1,'lowestX':bottom_x,'side':'left' if bottom_x<192 else 'right'})
            report.setdefault('runContactChecks',{})[direction]=contacts
            if contacts[0]['side']==contacts[1]['side']:raise ValueError(f'{direction} contact feet do not alternate: {contacts}')
    atlas.save(OUT/f'hero-{motion}-v1.png',optimize=True)
    (OUT/'preview').mkdir(exist_ok=True)
    hd.save(OUT/'preview'/f'hero-{motion}-v1.png',optimize=True)

# Additional painted actions use the SAME legacy scale. Do not let new poses
# change the byte-identical idle/run/attack atlases above.
new_motions=['spin','cast','hit','dodge','death']
report['motionCells']={m:[384,256] for m in ['idle','run','attack']+new_motions}
report['reactionLayout']='Separate three-column hero-hit-v1.png and hero-dodge-v1.png atlases'
report['dedicatedSourceChecks']={}
for direction in DIRS:
    for source_kind,groups in [('skills',[('spin',0,6),('cast',6,12)]),('react',[('hit',0,3),('dodge',3,6),('death',6,12)])]:
        path=ART/f'{source_kind}-{direction}-v1.png'
        source=Image.open(path).convert('RGBA')
        if source.size!=(1536,512):raise ValueError(f'{path}: expected 1536x512')
        parts=components(source)
        top=sorted([c for c in parts if c['center'][1]<256],key=lambda c:c['center'][0])
        bottom=sorted([c for c in parts if c['center'][1]>=256],key=lambda c:c['center'][0])
        if len(parts)!=12 or len(top)!=6 or len(bottom)!=6:raise ValueError(f'{path}: expected 12 connected figures in 2x6 layout, found {len(top)}+{len(bottom)}')
        ordered=top+bottom
        slot_checks=[]
        for i,part in enumerate(ordered):
            x0,y0,x1,y1=part['bbox'];cx=i%6*256;cy=i//6*256
            safe=cx+2<=x0 and x1<=cx+254 and cy+2<=y0 and y1<=cy+254
            slot_checks.append(safe)
            if not safe:raise ValueError(f'{path} slot {i+1} crosses its boundary')
        report['dedicatedSourceChecks'][f'{source_kind}-{direction}']={'figures':len(parts),'safeSlots':slot_checks,'alphaExtrema':source.getchannel('A').getextrema(),'bounds':[c['bbox'] for c in ordered]}
        for motion,start,end in groups:rows[direction][motion]=[c['image'] for c in ordered[start:end]]
# Canonical new canvases use 256px cells; legacy sources used a larger canvas.
# Convert once into the legacy source coordinate scale using the guard drawing.
source_to_legacy=median(im.height for d in DIRS for im in rows[d]['run'])/median(rows[d]['spin'][0].height for d in DIRS)
new_scale=scale*source_to_legacy
report['dedicatedSourceToLegacyScale']=source_to_legacy
report['dedicatedSharedScale']=new_scale
for motion in new_motions:
    count=3 if motion in ['hit','dodge'] else 6
    # Death can be wide; retain the same physical pixel scale in the renderer.
    cell_width=512 if motion=='death' else 384
    report['motionCells'][motion]=[cell_width,256]
    atlas=Image.new('RGBA',(cell_width*count,1024))
    hd=Image.new('RGBA',(cell_width*count*2,2048))
    for row,direction in enumerate(DIRS):
        frames=[]
        for col,im in enumerate(rows[direction][motion]):
            w,h=round(im.width*new_scale),round(im.height*new_scale)
            x=round(cell_width/2-anchor(im)*new_scale);y=240-h
            if x<3 or x+w>cell_width-3 or y<3:raise ValueError(f'{motion}-{direction}-{col+1} cropped: {(x,y,w,h)}')
            frame=Image.new('RGBA',(cell_width,256));frame.alpha_composite(im.resize((w,h),Image.Resampling.LANCZOS),(x,y));frames.append(frame)
            frame_dir=ART/'frames'/motion/direction;frame_dir.mkdir(parents=True,exist_ok=True);frame.save(frame_dir/f'{col+1:02}.png')
            atlas.alpha_composite(frame,(col*cell_width,row*256))
            hd.alpha_composite(im.resize((round(im.width*new_scale*2),round(im.height*new_scale*2)),Image.Resampling.LANCZOS),(round((cell_width/2-anchor(im)*new_scale)*2)+col*cell_width*2,480-round(im.height*new_scale*2)+row*512))
        bounds=[im.getchannel('A').getbbox() for im in frames]
        report['frames'][f'{motion}-{direction}']=bounds
        if motion=='death':
            lowest=bounds[-1][1]>=max(b[1] for b in bounds)
            widest=(bounds[-1][2]-bounds[-1][0])>=max(b[2]-b[0] for b in bounds)
            report.setdefault('deathContactChecks',{})[direction]={'lastFrameLowestTop':lowest,'lastFrameWidest':widest,'tops':[b[1] for b in bounds]}
            if not lowest or not widest:raise ValueError(f'{direction}: death frame6 must be lowest and widest')
    atlas.save(OUT/f'hero-{motion}-v1.png',optimize=True)
    hd.save(OUT/'preview'/f'hero-{motion}-v1.png',optimize=True)

(ART/'packing-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
helper=Path('C:/Users/panup/.codex/plugins/cache/openai-curated-remote/game-studio/0.1.2/scripts/render_sprite_preview_sheet.py')
for motion in ['run','attack']+new_motions:
    for direction in DIRS:
        subprocess.run([sys.executable,str(helper),'--frames-dir',str(ART/'frames'/motion/direction),'--out',str(ART/f'preview-{motion}-{direction}.png'),'--columns','6'],check=True)
print(json.dumps({'scale':scale,'warnings':report.get('edgeWarnings',[]),'atlases':[str(p.relative_to(ROOT)) for p in OUT.glob('*.png')]}))
