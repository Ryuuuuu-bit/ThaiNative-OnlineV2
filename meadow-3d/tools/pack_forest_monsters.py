"""Pack the original forest sheets without rebuilding or overwriting older jelly art.
Run via pack-monsters.py --forest. Only alpha-preserving crop/scale/placement is used.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import json,numpy as np
from painted_components import components

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/painted-forest'; OUT=ROOT/'public/assets/monsters-painted'
ARCHIVE=ROOT/'art/texture-sources/monsters-painted'
DIRS=['SE','SW','NE','NW']

def pack():
 OUT.mkdir(exist_ok=True,parents=True);ARCHIVE.mkdir(exist_ok=True,parents=True)
 preview=ART/'previews';preview.mkdir(exist_ok=True)
 defs=json.loads((ROOT/'art/painted-monsters/motions.json').read_text())
 regular=defs['slime'];definitions={}
 for sp,windup in [('shroom',.6),('wolf',.4),('wisp',.7),('stump',.8)]:
  definitions[sp]=json.loads(json.dumps(regular))
  for d in definitions[sp].values():d['source']=sp
  d=definitions[sp]['attack'];d['frameDurations']=[windup,.18,.17];d['duration']=round(windup+.35,2)
 definitions['warden']=json.loads(json.dumps(defs['king']))
 for d in definitions['warden'].values():d['source']=d['source'].replace('king','warden')
 (ART/'motions.json').write_text(json.dumps(definitions,indent=2)+'\n')
 manifest=json.loads((OUT/'manifest.json').read_text());manifest['version']=2
 report={'clippingWarnings':[],'sources':{},'frameBounds':{},'deathChecks':{},'phase2FullFrameCopies':0}
 for sp,motions in definitions.items():
  size=512 if sp=='warden' else 256;cw,ch=(size*3//2,size);baseline=size*15//16
  sources={};maxw=maxh=1
  for source in sorted({m['source'] for m in motions.values()}):
   for direction in DIRS:
    source_direction='SE' if direction=='SW' else 'NE' if direction=='NW' else direction
    rear=source_direction=='NE' and sp in ['wolf','warden']
    path=ART/(f'{source}-NE-back-v2-generated.png' if rear else f'{source}-{source_direction}-generated.png');raw=Image.open(path).convert('RGBA')
    # The generation contract is 6 square columns by 2 rows (3:1).
    if abs(raw.width/raw.height-3)>.12:raise ValueError(f'{path}: expected 3:1 sheet, got {raw.size}')
    im=raw.resize((size*6,size*2),Image.Resampling.LANCZOS);frames=[]
    for n in range(12):
     slot=im.crop((n%6*size,n//6*size,n%6*size+size,n//6*size+size))
     if direction in ['SW','NW']:slot=ImageOps.mirror(slot)
     # Ignore separator/gutter pixels and disconnected single-pixel generation
     # noise, retaining substantive detached mist, lanterns and spore fragments.
     alpha=np.array(slot.getchannel('A'));alpha[:3]=0;alpha[-3:]=0;alpha[:,:3]=0;alpha[:,-3:]=0;slot.putalpha(Image.fromarray(alpha))
     clean=Image.new('RGBA',slot.size);parts=components(slot,min_pixels=24)
     if not parts:raise ValueError(f'{path}: empty slot {n}')
     main=max(parts,key=lambda p:np.count_nonzero(np.asarray(p['image'].getchannel('A'))>32));mx,my,mr,mb=main['bbox'];margin=size*.18
     for part in parts:
      x,y,right,bottom=part['bbox']
      # Reject fragments from an adjoining row. Related mist/lantern pieces near
      # the main figure remain, including detached antlers beside a death mound.
      if right>=mx-margin and x<=mr+margin and bottom>=my-margin and y<=mb+margin:clean.alpha_composite(part['image'],(x,y))
     slot=clean
     bbox=slot.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
     if not bbox:raise ValueError(f'{path}: empty slot {n}')
     maxw=max(maxw,bbox[2]-bbox[0]);maxh=max(maxh,bbox[3]-bbox[1]);frames.append((slot,bbox))
    sources[source,direction]=frames;report['sources'][f'{source}-{direction}']={'file':path.relative_to(ROOT).as_posix(),'mirroredAtPacking':direction in ['SW','NW'],'generatedSize':raw.size,'alphaExtrema':raw.getchannel('A').getextrema()}
  # One scale for EVERY motion and direction of a species. Idle bottom determines
  # the source ground plane; airborne offsets remain intact.
  factor=min((size-36)/maxw,(size-40)/maxh,1)
  canonical={}
  for (source,direction),frames in sources.items():
   reference_source=motions['idle']['source'];idle=sources[reference_source,direction]
   ground=float(np.median([idle[n][1][3] for n in range(3)]))
   normalized=Image.new('RGBA',(size*6,size*2));normframes=[]
   for n,(slot,bbox) in enumerate(frames):
    crop=slot.crop(bbox);crop=crop.resize((max(1,round(crop.width*factor)),max(1,round(crop.height*factor))),Image.Resampling.LANCZOS)
    x=round(size/2+(bbox[0]-size/2)*factor)
    lift=round(size*.2) if sp=='wisp' else 0
    if sp=='wisp' and n>=9:lift=round(size*.2*(11-n)/2)
    if sp!='warden' and n==4:lift+=max(0,round((ground-bbox[3])*factor))
    y=baseline-lift-crop.height
    # Generation can shift a death mound's baseline; keep its bottom on the ground
    # without changing its scale. This never modifies the character drawing.
    if y+crop.height>size-8:y=size-8-crop.height
    if y<8:y=8
    frame=Image.new('RGBA',(size,size));frame.alpha_composite(crop,(x,y));normframes.append(frame);normalized.alpha_composite(frame,(n%6*size,n//6*size))
   canonical[source,direction]=normframes;normalized.save(ART/f'{source}-{direction}-v1.png',optimize=True)
  ref=float(np.median([canonical[motions['idle']['source'],d][1].getchannel('A').getbbox()[3]-canonical[motions['idle']['source'],d][1].getchannel('A').getbbox()[1] for d in DIRS]))
  body=2.76*(2.5 if sp=='warden' else 1.2 if sp=='stump' else 1)
  entry={'cellSize':[cw,ch],'baseline':baseline,'anchor':[.5,.0625],'referenceHeightPixels':ref,'bodyWorldHeight':body,'quadWorldSize':[body*cw/ref,body*ch/ref],'motions':{}}
  for motion,d in motions.items():
   count=len(d['indices']);atlas=Image.new('RGBA',(cw*count,ch*4));glow=Image.new('L',atlas.size);rows=[]
   for row,direction in enumerate(DIRS):
    proof=Image.new('RGB',(cw*count,ch+24),'#526761');draw=ImageDraw.Draw(proof);details=[]
    for col,index in enumerate(d['indices']):
     frame=Image.new('RGBA',(cw,ch));frame.alpha_composite(canonical[d['source'],direction][index],((cw-size)//2,0))
     bbox=frame.getchannel('A').point(lambda a:255 if a>12 else 0).getbbox()
     if bbox[0]<3 or bbox[1]<3 or bbox[2]>cw-3 or bbox[3]>ch-3:report['clippingWarnings'].append(f'{sp}-{motion}-{direction}-{col}')
     atlas.alpha_composite(frame,(col*cw,row*ch));proof.paste(frame,(col*cw,24),frame);draw.text((col*cw+8,6),f'{sp} {motion} {direction} {col+1}',fill='#fff0cd')
     a=np.asarray(frame);yy,xx=np.nonzero(a[:,:,3]>32);bottom=int(yy.max());band=xx[yy>bottom-ch*.12]
     details.append({'bounds':bbox,'groundContact':[float(np.median(band)),bottom+1],'sourceFrame':index+1,'faceRect':None})
     if sp=='warden':
      rgb=a[:,:,:3].astype(float);warm=(rgb[:,:,0]>100)&(rgb[:,:,0]>rgb[:,:,1]*1.04)&(rgb[:,:,1]>rgb[:,:,2]*1.25);glow.paste(Image.fromarray((warm*a[:,:,3]).astype('uint8')),(col*cw,row*ch))
    rows.append(details);report['frameBounds'][f'{sp}-{motion}-{direction}']=[f['bounds'] for f in details]
    proof.save(preview/f'{sp}-{motion}-{direction}.jpg',quality=88)
    if motion=='death':report['deathChecks'][f'{sp}-{direction}']={'tops':[f['bounds'][1] for f in details],'widths':[f['bounds'][2]-f['bounds'][0] for f in details],'holdFrame':count-1}
   file=f'{sp}-{motion}-v1.png';atlas.save(ARCHIVE/file,optimize=True)
   # PNGs are staging inputs only; pack-forest-textures.py makes the shipping variants.
   entry['motions'][motion]={'file':file,'columns':count,'rows':4,'frames':count,'duration':d['duration'],'frameDurations':d['frameDurations'],'loop':d['loop'],'holdLast':not d['loop'],'directions':rows}
   if sp=='warden':
    mask=f'warden-{motion}-glow-v1.png';glow.save(ARCHIVE/mask,optimize=True);entry['motions'][motion]['glowMask']=mask
  manifest['species'][sp]=entry
 if report['clippingWarnings']:raise ValueError(report['clippingWarnings'])
 raw=Image.open(ART/'bolt-generated.png').convert('RGBA');bolt=Image.new('RGBA',(512,128))
 for i in range(4):
  slot=raw.crop((round(i*raw.width/4),0,round((i+1)*raw.width/4),raw.height));bbox=slot.getchannel('A').point(lambda a:255 if a>12 else 0).getbbox()
  if not bbox:raise ValueError('Empty wisp bolt frame')
  im=slot.crop(bbox);im.thumbnail((108,108),Image.Resampling.LANCZOS);bolt.alpha_composite(im,(i*128+(128-im.width)//2,(128-im.height)//2))
 bolt.save(ARCHIVE/'wisp-bolt-v1.png',optimize=True)
 manifest['projectiles']={'bolt':{'file':'wisp-bolt-v1.png','cellSize':[128,128],'columns':4,'rows':1,'frames':4,'duration':1/3,'loop':True}}
 manifest['forestPhase2']={'species':'warden','overlay':'pale bark cracks and amber lantern shader glow','expressionOverlay':None,'fullFrameCopies':0}
 (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 runtime={sp:{m:{k:d[k] for k in ['frames','duration','frameDurations','loop']} for m,d in entry['motions'].items()} for sp,entry in manifest['species'].items()}
 (ROOT/'src/monster-motion-data.ts').write_text('// Generated by tools/pack-monsters.py (including --forest).\nexport const MONSTER_MOTIONS = '+json.dumps(runtime,indent=2)+' as const;\n')
 report.update({'speciesCount':5,'motionAtlasCount':sum(len(s['motions']) for sp,s in manifest['species'].items() if sp in definitions),'frameCount':sum(m['frames']*4 for sp,s in manifest['species'].items() if sp in definitions for m in s['motions'].values()),'cells':{sp:manifest['species'][sp]['cellSize'] for sp in definitions}})
 (ART/'monster-packing-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['speciesCount','motionAtlasCount','frameCount','clippingWarnings']}))

if __name__=='__main__':pack()
