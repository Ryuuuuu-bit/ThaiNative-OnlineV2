"""Normalize generated canvas dimensions only; never synthesize or warp poses."""
from pathlib import Path
from PIL import Image
import json
from statistics import median
from painted_components import figures
ART=Path(__file__).resolve().parents[1]/'art/painted-monsters'
report={}
for pattern,size in [('slime-??-generated.png',(1536,512)),('king-*-??-generated.png',(3072,1024))]:
 for path in ART.glob(pattern):
  im=Image.open(path).convert('RGBA');old=im.size
  im=im.resize(size,Image.Resampling.LANCZOS)
  groups=figures(im);cw,ch=size[0]//6,size[1]//2
  factor=.82 if path.name.startswith('slime-') else .82
  factor=min(factor,(cw-24)/max(p['image'].width for p in groups),(ch-40)/max(p['image'].height for p in groups))
  normalized=Image.new('RGBA',size)
  for row in range(2):
   ground=median(groups[row*6+i]['bbox'][3]-row*ch for i in ([0,1,2,3,5] if row==0 else range(6)))
   for col in range(6):
    part=groups[row*6+col];image=part['image'];w,h=round(image.width*factor),round(image.height*factor)
    x=round(cw/2-part['anchorX']*factor);y=round((ch-16 if ch==256 else ch-32)-(ground-(part['bbox'][1]-row*ch))*factor)
    if x<3 or x+w>cw-3: x=(cw-w)//2
    normalized.alpha_composite(image.resize((w,h),Image.Resampling.LANCZOS),(col*cw+x,row*ch+y))
  im=normalized
  out=path.with_name(path.name.replace('-generated.png','-v1.png'));im.save(out)
  cells=[];w,h=size[0]//6,size[1]//2
  for i in range(12):
   cell=im.crop((i%6*w,i//6*h,i%6*w+w,i//6*h+h));a=cell.getchannel('A');bbox=a.point(lambda x:255 if x>20 else 0).getbbox()
   if not bbox:raise ValueError(f'{out.name} slot{i+1} empty')
   cells.append({'bounds':bbox,'edgeInk':bbox[0]<2 or bbox[1]<2 or bbox[2]>w-2 or bbox[3]>h-2})
  report[out.name]={'generatedSize':old,'canvasSize':size,'alphaExtrema':im.getchannel('A').getextrema(),'cells':cells}
(ART/'source-canvas-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'sheets':len(report),'edgeWarnings':[(n,i+1) for n,s in report.items() for i,c in enumerate(s['cells']) if c['edgeInk']]}))
