"""Existing alpha-component/shared-scale pipeline for imagegen skill motions.
No limb drawing, pose synthesis, mirroring or nonuniform warping.
"""
from pathlib import Path
from statistics import median
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import json, subprocess, hashlib
from painted_components import components
ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/hero-skills';OUT=ROOT/'public/assets/hero-skills'
OUT.mkdir(parents=True,exist_ok=True)
COUNTS={'slash':6,'whirlwind':8,'dash_strike':5,'earth_break':9,'provoke':5,'endure':5}
manifest=json.loads((ROOT/'public/texture-manifest.json').read_text())
report={'frameSize':[384,256],'baseline':240,'directions':['SE','SW','NE','NW'],'motions':{},'sourceEdgeWarnings':[]}
sheet=Image.new('RGB',(12*144,24*116),(44,52,47));draw=ImageDraw.Draw(sheet)
def anchor(im):
 a=np.asarray(im.getchannel('A'))>32;h,w=a.shape
 thick=np.asarray(Image.fromarray(a.astype(np.uint8)*255).filter(ImageFilter.MinFilter(7)))>0
 weights=thick[int(h*.4):int(h*.65)].sum(axis=0)
 return float(np.searchsorted(np.cumsum(weights),weights.sum()/2)) if weights.sum() else w/2
for motion,count in COUNTS.items():
 source=ART/f'{motion}-source-v2.png'
 if not source.exists():source=ART/f'{motion}-source-v1.png'
 im=Image.open(source).convert('RGBA');cw=im.width/count;ch=im.height/4
 groups=[[] for _ in range(count*4)]
 parts=components(im,800)
 centers=[median(p['center'][1] for p in parts if p['image'].height<ch*1.5 and min(3,int(p['center'][1]/ch))==r) for r in range(4)]
 cuts=[0]+[round((centers[r]+centers[r+1])/2) for r in range(3)]+[im.height]
 for part in parts:
  x0,y0,x1,y1=part['bbox']
  # A sword touching the next row is split only at the atlas boundary.
  pieces=[part]
  if y1-y0>ch*1.5:
   pieces=[]
   for row in range(4):
    lo=max(y0,cuts[row]);hi=min(y1,cuts[row+1])
    if hi<=lo:continue
    crop=part['image'].crop((0,lo-y0,x1-x0,hi-y0));box=crop.getbbox()
    if box and np.count_nonzero(np.asarray(crop.getchannel('A'))>32)>100:
     pieces.append({'image':crop,'bbox':(x0,lo,x1,hi),'center':((x0+x1)/2,(lo+hi)/2)})
  for piece in pieces:
   col=min(count-1,int(piece['center'][0]/cw));row=min(3,int(piece['center'][1]/ch));groups[row*count+col].append(piece)
 frames=[];bounds=[]
 for i,parts in enumerate(groups):
  if not parts:raise ValueError(f'{motion} missing source figure {i}')
  x0=min(p['bbox'][0] for p in parts);y0=min(p['bbox'][1] for p in parts);x1=max(p['bbox'][2] for p in parts);y1=max(p['bbox'][3] for p in parts)
  crop=Image.new('RGBA',(x1-x0,y1-y0))
  for p in parts:crop.alpha_composite(p['image'],(p['bbox'][0]-x0,p['bbox'][1]-y0))
  frames.append(crop);bounds.append([x0,y0,x1,y1])
  if x0==0 or y0==0 or x1==im.width or y1==im.height:report['sourceEdgeWarnings'].append({'motion':motion,'direction':report['directions'][i//count],'frame':i%count+1,'bounds':[x0,y0,x1,y1]})
 # Shared per-sheet scale uses the upright recovery as anatomical reference.
 guard=median(frames[row*count+count-1].height for row in range(4))
 scale=min(168/guard,232/max(f.height for f in frames),300/max(f.width for f in frames))
 atlas=Image.new('RGBA',(384*count,1024))
 for i,f in enumerate(frames):
  row,col=divmod(i,count);w,h=round(f.width*scale),round(f.height*scale)
  cell=Image.new('RGBA',(384,256));cell.alpha_composite(f.resize((w,h),Image.Resampling.LANCZOS),(round(192-anchor(f)*scale),240-h))
  dest=ART/'frames'/motion/report['directions'][row];dest.mkdir(parents=True,exist_ok=True);cell.save(dest/f'{col+1:02}.png')
  atlas.alpha_composite(cell,(col*384,row*256))
  strip=list(COUNTS).index(motion)*4+row
  thumb=cell.resize((144,96),Image.Resampling.LANCZOS);sheet.paste(thumb,(144*(col+3),strip*116+20),thumb)
 for row,direction in enumerate(report['directions']):
  strip=list(COUNTS).index(motion)*4+row
  draw.text((4,strip*116+3),f'{motion} / {direction}',fill=(240,226,198))
  for col,old in enumerate(['idle','run','attack']):
   oldim=Image.open(ROOT/f'art/texture-sources/hero-painted/hero-{old}-v1.png').convert('RGBA')
   crop=oldim.crop((row*384,0,(row+1)*384,256)) if old=='idle' else oldim.crop((3*384,row*256,4*384,(row+1)*256))
   thumb=crop.resize((144,96),Image.Resampling.LANCZOS);sheet.paste(thumb,(col*144,strip*116+20),thumb)
 name=f'hero-skill-{motion}-v1';path=ART/(name+'.png');atlas.save(path,optimize=True)
 factor=min(1,2048/atlas.width);size=tuple(max(4,round(n*factor/4)*4) for n in atlas.size)
 gpu=atlas.resize(size,Image.Resampling.LANCZOS);stage=ART/(name+'-packed.png');gpu.save(stage)
 webp=OUT/(name+'.webp');ktx=OUT/(name+'.ktx2');gpu.save(webp,'WEBP',quality=88,method=6,exact=True)
 encoder=ROOT.parent/'.codex-run/ktx-tools/extracted/bin/toktx.exe'
 subprocess.run([str(encoder),'--t2','--encode','uastc','--assign_oetf','srgb','--lower_left_maps_to_s0t0','--threads','1','--uastc_quality','3','--uastc_rdo_l','0.5','--zcmp','18',str(ktx),str(stage)],check=True)
 entry={'source':path.relative_to(ROOT).as_posix(),'size':list(size),'originalSize':list(atlas.size),'mode':'uastc','mips':False,'cpu':False,'hitMask':None}
 sizes={}
 for kind,file in [('webp',webp),('ktx2',ktx)]:
  data=file.read_bytes();hashed=file.with_name(name+'-'+hashlib.sha256(data).hexdigest()[:10]+file.suffix);hashed.write_bytes(data);file.unlink();entry[kind]='/'+hashed.relative_to(ROOT/'public').as_posix();sizes[kind]=len(data)
 manifest[f'/assets/hero-skills/{name}.png']=entry
 report['motions'][motion]={'frames':count,'directions':4,'source':source.name,'scale':scale,'size':list(size),'bytes':sizes,'sourceBounds':bounds}
 print(motion,json.dumps(sizes),flush=True)
(ROOT/'public/texture-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ART/'packing-report.json').write_text(json.dumps(report,indent=2)+'\n')
sheet.save(ROOT.parent/'.codex-run/motions-sheet.jpg',quality=93)
