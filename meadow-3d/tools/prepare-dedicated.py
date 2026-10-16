"""Technical canvas normalization only: isolate generated figures and place on 2x6 alpha canvas.
No pose synthesis, repainting, limb warping, or per-frame scaling.
"""
from pathlib import Path
from PIL import Image
from statistics import median
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tools/pack-painted.py')}
s=(ROOT/'tools/pack-painted.py').read_text(encoding='utf-8')
exec(s[:s.index('rows={}')],ns)
ART=ROOT/'art/painted-hero'
items={}
for kind in ['skills','react']:
 for direction in ['SE','SW','NE','NW']:
  path=ART/f'{kind}-{direction}-generated.png'
  im=Image.open(path).convert('RGBA').resize((1536,512),Image.Resampling.LANCZOS)
  parts=ns['components'](im)
  top=sorted([c for c in parts if c['center'][1]<256],key=lambda c:c['center'][0])
  bottom=sorted([c for c in parts if c['center'][1]>=256],key=lambda c:c['center'][0])
  if len(top)!=6 or len(bottom)!=6:raise ValueError(f'{path}: {len(top)}+{len(bottom)} figures')
  items[kind,direction]=top+bottom
# A single scale for all eight sheets. Standing guard is approximately 204 px.
guards=[v[0]['image'].height for (kind,d),v in items.items() if kind=='skills']
scale=min(204/median(guards),232/max(p['image'].height for v in items.values() for p in v),238/max(p['image'].width for v in items.values() for p in v))
for (kind,direction),parts in items.items():
 canvas=Image.new('RGBA',(1536,512))
 for i,part in enumerate(parts):
  im=part['image'];w,h=round(im.width*scale),round(im.height*scale)
  x=round(128-ns['anchor'](im)*scale)
  if x<3 or x+w>253:x=(256-w)//2
  canvas.alpha_composite(im.resize((w,h),Image.Resampling.LANCZOS),(i%6*256+x,i//6*256+240-h))
 canvas.save(ART/f'{kind}-{direction}-v1.png')
print({'sourceCanvasSharedScale':scale,'sheets':len(items)})
