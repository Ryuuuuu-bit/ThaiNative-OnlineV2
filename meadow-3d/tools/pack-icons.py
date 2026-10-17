"""Trim six generated slot emblems and pack proportional alpha-preserving UI strips."""
from pathlib import Path
import sys
if '--forest' in sys.argv:
 from pack_forest_icons import pack
 pack()
 raise SystemExit(0)
from PIL import Image,ImageDraw
import json

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/painted-ui';OUT=ROOT/'public/assets/ui-painted'
OUT.mkdir(parents=True,exist_ok=True)
source=Image.open(ART/'skill-icons-generated.png').convert('RGBA')
if source.size!=(1536,1024):raise ValueError('Expected 3 columns × 2 rows of 512px slots')
names=['attack','spin','meteor','dash','potion','spare']
thai=['โจมตี','ฟันพายุ','ดาวตก','พุ่งหลบ','ยา','ว่าง']
manifest={'version':1,'source':'skill-icons-sheet-v1.png','sourceSize':list(source.size),'layout':[3,2],'sizes':{},'icons':[]}
report={'alphaThresholdForTrim':16,'sourceSize':list(source.size),'hdSlotMargin':24,'icons':[],'clippingWarnings':[]}
hd=Image.new('RGBA',source.size)
figures=[]
for i,name in enumerate(names):
 x=(i%3)*512;y=(i//3)*512;slot=source.crop((x,y,x+512,y+512))
 bounds=slot.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
 if bounds is None:raise ValueError(f'Empty icon: {name}')
 figures.append(slot.crop(bounds))
 hd_icon=figures[-1].copy();hd_icon.thumbnail((464,464),Image.Resampling.LANCZOS)
 hd.alpha_composite(hd_icon,(x+(512-hd_icon.width)//2,y+(512-hd_icon.height)//2))
 manifest['icons'].append({'name':name,'label':thai[i],'index':i,'sourceSlot':[x,y,512,512],'sourceTrim':list(bounds),'anchor':[.5,.5]})
 report['icons'].append({'name':name,'sourceBounds':list(bounds),'packed':{}})
hd.save(ART/'skill-icons-sheet-v1.png',optimize=True)
for size in [128,64]:
 strip=Image.new('RGBA',(size*6,size));margin=round(size*.047)
 for i,figure in enumerate(figures):
  image=figure.copy();image.thumbnail((size-margin*2,size-margin*2),Image.Resampling.LANCZOS)
  x=(size-image.width)//2;y=(size-image.height)//2
  strip.alpha_composite(image,(i*size+x,y))
  bounds=[x,y,x+image.width,y+image.height]
  report['icons'][i]['packed'][str(size)]={'bounds':bounds,'size':list(image.size)}
  if min(x,y,size-bounds[2],size-bounds[3])<margin:report['clippingWarnings'].append(f'{names[i]} {size}')
 file='skill-icons-v1.png' if size==128 else 'skill-icons-64-v1.png'
 strip.save(OUT/file,optimize=True)
 manifest['sizes'][str(size)]={'file':file,'size':size,'cellSize':[size,size],'stripSize':[size*6,size],'columns':6,'rows':1}
 # Opaque, actual-size proof on the HUD palette.
 proof=Image.new('RGB',(size*6,size+20),'#294a42');proof.paste(strip,(0,20),strip)
 draw=ImageDraw.Draw(proof)
 for i,name in enumerate(names):draw.text((i*size+3,3),name,fill='#e6d2a5')
 proof.save(ART/f'preview-icons-{size}.jpg',quality=94)
proof=Image.new('RGB',(56*6,76),'#294a42');draw=ImageDraw.Draw(proof)
for i,figure in enumerate(figures):
 image=figure.copy();image.thumbnail((50,50),Image.Resampling.LANCZOS);proof.paste(image,(i*56+(56-image.width)//2,20+(56-image.height)//2),image);draw.text((i*56+2,4),names[i],fill='#e6d2a5')
proof.save(ART/'preview-icons-56.jpg',quality=94)
if report['clippingWarnings']:raise ValueError(report['clippingWarnings'])
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False),encoding='utf-8')
(ART/'packing-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'icons':len(names),'sizes':[128,64],'clippingWarnings':report['clippingWarnings']}))

if (ROOT/'art/painted-forest/items-generated.png').exists():
 from pack_forest_icons import pack
 pack()
