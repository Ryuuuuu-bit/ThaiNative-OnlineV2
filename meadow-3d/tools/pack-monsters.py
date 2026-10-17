"""Pack connected painted jelly figures, associated fragments and fixed ground anchors.
Preserves airborne source offsets and uses one coordinate scale per species.
"""
from pathlib import Path
import sys
if '--forest' in sys.argv:
 import pack_forest_monsters
 pack_forest_monsters.pack()
 raise SystemExit(0)
from statistics import median
from PIL import Image,ImageDraw
import json,numpy as np
from painted_components import figures,components
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/painted-monsters';OUT=ROOT/'public/assets/monsters-painted';OUT.mkdir(parents=True,exist_ok=True)
DIRS=['SE','SW','NE','NW'];definitions=json.loads((ART/'motions.json').read_text())
report={'clippingWarnings':[],'sources':{},'frameBounds':{},'deathChecks':{}}
manifest={'version':1,'directions':DIRS,'species':{},'phase2':{'hueShift':-.045,'saturation':1.32,'value':.81,'glowMask':'warm-gold pixels, alpha weighted; shader uses equivalent threshold without extra texture fetch','expressionOverlay':'king-phase2-face-v1.png','backViewsHaveNoExpressionOverlay':True}}
def face_region(frame,bounds,direction):
 a=np.array(frame);dark=(a[:,:,0]<100)&(a[:,:,1]<85)&(a[:,:,2]<95)&(a[:,:,3]>100);a[:,:,3]=dark*255
 bx,by,right,bottom=bounds;bw=right-bx;bh=bottom-by;eyes=[]
 for part in components(Image.fromarray(a),min_pixels=12):
  x,y,r,b=part['bbox'];cx=(x+r)/2;cy=(y+b)/2
  if bw*.025<r-x<bw*.23 and bh*.035<b-y<bh*.20 and by+bh*.43<cy<by+bh*.83 and (bx+bw*.45<cx<right-bw*.04 if direction=='SE' else bx+bw*.04<cx<bx+bw*.60):eyes.append((x,y,r,b))
 eyes=sorted(eyes,key=lambda r:r[3]-r[1],reverse=True)[:2]
 if len(eyes)<2:return None
 x=min(r[0] for r in eyes);y=min(r[1] for r in eyes);r=max(r[2] for r in eyes);b=max(r[3] for r in eyes)
 fw=(r-x)*1.65;fh=fw*.75;return[(x+r)/2-fw/2,(y+b)/2-fh/2+5,fw,fh]
all_sources={}
for species,defs in definitions.items():
 source_size=256 if species=='slime' else 512
 for source in sorted({d['source'] for d in defs.values()}):
  for direction in DIRS:
   path=ART/f'{source}-{direction}-v1.png';im=Image.open(path).convert('RGBA')
   if im.size!=(source_size*6,source_size*2):raise ValueError(f'{path}: wrong canvas size')
   groups=figures(im);all_sources[source,direction]=groups
   report['sources'][f'{source}-{direction}']={'size':im.size,'alphaExtrema':im.getchannel('A').getextrema(),'figures':len(groups),'componentsPerFigure':[g['components'] for g in groups]}
 cell_w,cell_h=(384,256) if species=='slime' else(768,512);baseline=cell_h*15//16
 idle_source=defs['idle']['source'];reference=median(all_sources[idle_source,d][1]['image'].height for d in DIRS)
 # The preserved hero guard is approximately 2.76 world units tall in-game.
 body_world=2.76*(.6 if species=='slime' else 2.5)
 entry={'cellSize':[cell_w,cell_h],'baseline':baseline,'anchor':[.5,1-baseline/cell_h],'referenceHeightPixels':reference,'bodyWorldHeight':body_world,'quadWorldSize':[body_world*cell_w/reference,body_world*cell_h/reference],'motions':{}}
 for motion,definition in defs.items():
  count=len(definition['indices']);atlas=Image.new('RGBA',(cell_w*count,cell_h*4));glow=Image.new('L',atlas.size)
  rows=[]
  for row,direction in enumerate(DIRS):
   frames=[];details=[]
   for col,index in enumerate(definition['indices']):
    group=all_sources[definition['source'],direction][index];im=group['image'];bbox=group['bbox'];source_row=index//6;source_col=index%6
    x=round(cell_w/2+bbox[0]-source_col*source_size-source_size/2);y=bbox[1]-source_row*source_size
    if x<3 or y<3 or x+im.width>cell_w-3 or y+im.height>cell_h-3:
     report['clippingWarnings'].append(f'{species}-{motion}-{direction}-{col+1}: {(x,y,im.width,im.height)}')
    frame=Image.new('RGBA',(cell_w,cell_h));frame.alpha_composite(im,(x,y));bounds=frame.getchannel('A').point(lambda a:255 if a>12 else 0).getbbox()
    atlas.alpha_composite(frame,(col*cell_w,row*cell_h));frames.append(frame)
    rgb=np.asarray(frame);a=rgb[:,:,3];gold=(rgb[:,:,0]>85)&(rgb[:,:,1]>55)&(rgb[:,:,0]>rgb[:,:,1]*1.04)&(rgb[:,:,1]>rgb[:,:,2]*1.25)
    glow.paste(Image.fromarray((gold*a).astype(np.uint8)),(col*cell_w,row*cell_h))
    yy,xx=np.nonzero(a>32);bottom=int(yy.max());band=xx[yy>=bottom-im.height*.15]
    # Face patch is placed in the visible front-side facial region; no overlays on back rows.
    face=None
    if species=='king' and direction in ['SE','SW']:
     face=face_region(frame,bounds,direction)
    details.append({'bounds':bounds,'groundContact':[float(np.median(band)) if len(band) else cell_w/2,bottom+1],'sourceFrame':index+1,'faceRect':face})
   rows.append(details);report['frameBounds'][f'{species}-{motion}-{direction}']=[f['bounds'] for f in details]
   preview=Image.new('RGB',(cell_w*count,cell_h+24),'#d7d3c3');draw=ImageDraw.Draw(preview)
   for i,frame in enumerate(frames):preview.paste(frame,(i*cell_w,24),frame);draw.text((i*cell_w+8,6),f'{species} {motion} {direction} {i+1}',fill='#324235')
   preview_dir=ART/'previews';preview_dir.mkdir(exist_ok=True);preview.save(preview_dir/f'{species}-{motion}-{direction}.jpg',quality=88)
   if motion=='death':
    tops=[d['bounds'][1] for d in details];widths=[d['bounds'][2]-d['bounds'][0] for d in details]
    report['deathChecks'][f'{species}-{direction}']={'finalLowest':tops[-1]>=max(tops),'finalWide':widths[-1]>=max(widths)*.9,'tops':tops,'widths':widths}
  file=f'{species}-{motion}-v1.png';atlas.save(OUT/file,optimize=True)
  if species=='king':glow.save(OUT/f'king-{motion}-glow-v1.png',optimize=True)
  entry['motions'][motion]={'file':file,'columns':count,'rows':4,'frames':count,'duration':definition['duration'],'frameDurations':definition['frameDurations'],'loop':definition['loop'],'holdLast':not definition['loop'],'directions':rows}
  if species=='king':entry['motions'][motion]['glowMask']=f'king-{motion}-glow-v1.png'
 manifest['species'][species]=entry
if (ART/'king-phase2-face.png').exists():
 original=Image.open(ART/'king-phase2-face.png').convert('RGBA');patches=figures(original,columns=2,rows=1)
 overlay=Image.new('RGBA',(512,192))
 for i,p in enumerate(patches):
  image=p['image'];w,h=image.size
  # Retain the generated angry facial patch, trimming the surrounding oval skin.
  image=image.crop((round(w*(.43 if i==0 else .04)),round(h*.28),round(w*(.87 if i==0 else .48)),round(h*.83)))
  image=image.resize((248,184),Image.Resampling.LANCZOS)
  yy,xx=np.indices((184,248));feather=np.clip(np.minimum.reduce([xx,247-xx,yy,183-yy])/16,0,1)
  image.putalpha(Image.fromarray((np.asarray(image.getchannel('A'))*feather).astype(np.uint8)))
  overlay.alpha_composite(image,(i*256+4,4))
 overlay.save(OUT/'king-phase2-face-v1.png',optimize=True)
if report['clippingWarnings']:raise ValueError(report['clippingWarnings'])
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
# Generated timing data keeps the sim and renderer aligned with the packed frames.
runtime={sp:{m:{'frames':len(d['indices']),'duration':d['duration'],'frameDurations':d['frameDurations'],'loop':d['loop']} for m,d in defs.items()} for sp,defs in definitions.items()}
(ROOT/'src/monster-motion-data.ts').write_text('// Generated by tools/pack-monsters.py from art/painted-monsters/motions.json.\nexport const MONSTER_MOTIONS = '+json.dumps(runtime,indent=2)+' as const;\n',encoding='utf-8')
report.update({'speciesCount':2,'motionAtlasCount':sum(len(s['motions']) for s in manifest['species'].values()),'frameCount':sum(sum(m['frames']*4 for m in s['motions'].values()) for s in manifest['species'].values()),'phase2FullFrameCopies':0,'cells':{k:v['cellSize'] for k,v in manifest['species'].items()}})
(ART/'packing-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['motionAtlasCount','frameCount','clippingWarnings','phase2FullFrameCopies']}))

# A complete rebuild also includes the forest when its accepted sources exist.
# --forest above is the non-destructive incremental route used for this art pass.
if (ROOT/'art/painted-forest/wolf-NE-back-v2-generated.png').exists():
 import pack_forest_monsters
 pack_forest_monsters.pack()

