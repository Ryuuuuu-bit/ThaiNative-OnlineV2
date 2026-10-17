"""Forest atlas packer: connected alpha extraction, fixed world scale, transparent gutters.
Does not change meadow assets. All imagery comes from the saved imagegen sheets.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json
from painted_components import figures
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/painted-forest';OUT=ROOT/'public/assets/env-forest';ARCHIVE=ROOT/'art/texture-sources/env-forest'
OUT.mkdir(exist_ok=True,parents=True);ARCHIVE.mkdir(exist_ok=True,parents=True)
names=['pine','oak','silver','hollow','arch','bedroll','log-seat','campfire','lantern','stone-ring','fern','mushrooms','fallen-log','rock','spores','reeds']
targets=[('h',6),('h',5.5),('h',5),('h',5),('w',4.4),('w',1.8),('w',2.4),('w',1.4),('h',2.7),('w',8),('w',1.25),('h',.9),('w',2.8),('w',1.5),('h',1),('w',1.8)]
groups=figures(Image.open(ART/'props-generated.png').convert('RGBA'),4,4)
utility=figures(Image.open(ART/'utility-generated.png').convert('RGBA'),2,2)
items=[];report={'clippingWarnings':[],'sourcePixelsPerWorldUnit':113,'runtimeDownsample':.5,'sources':{}}
for name,(axis,world),part in zip(names,targets,groups):
 im=part['image'];bbox=part['bbox'];w,h=im.size;scale=world/(w if axis=='w' else h);ww,wh=w*scale,h*scale
 a=np.array(im.getchannel('A'));yy,xx=np.nonzero(a>32);low=xx[yy>=yy.max()-h*.08];anchor=(float(np.median(low))+.5)/w
 size=(max(4,round(ww*56.5)),max(4,round(wh*56.5)));packed=im.resize(size,Image.Resampling.LANCZOS)
 entry={'name':name,'image':packed,'worldSize':[ww,wh],'sourcePixelSize':[round(ww*113),round(wh*113)],'anchor':[anchor,1],'source':f'art/painted-forest/props-generated.png#figure{names.index(name)+1}'}
 if name in names[:4]:entry['trunkWidth']=float(np.quantile(low,.95)-np.quantile(low,.05))*scale
 items.append(entry);report['sources'][name]={'sheetBounds':bbox,'pixelSize':size,'worldSize':[ww,wh],'alphaExtrema':im.getchannel('A').getextrema()}
for name,part,world in [('signpost',utility[2],1.8),('lilies',utility[3],1.6)]:
 im=part['image'];w,h=im.size;scale=world/h;size=(round(w*scale*56.5),round(h*scale*56.5));items.append({'name':name,'image':im.resize(size,Image.Resampling.LANCZOS),'worldSize':[w*scale,h*scale],'sourcePixelSize':[size[0]*2,size[1]*2],'anchor':[.5,1],'source':f'art/painted-forest/utility-generated.png#{name}'})
 if name=='signpost':
  sign=im.copy();sign.thumbnail((128,192),Image.Resampling.LANCZOS);padded=Image.new('RGBA',(128,192));padded.alpha_composite(sign,((128-sign.width)//2,192-sign.height));padded.save(ARCHIVE/'signpost-v1.png',optimize=True)
canvas=Image.new('RGBA',(2048,2048));x=y=8;rowh=0;assets=[]
for item in sorted(items,key=lambda a:a['image'].height,reverse=True):
 im=item.pop('image');w,h=im.size
 if x+w+8>2048:x=8;y+=rowh+16;rowh=0
 if y+h+8>2048:raise ValueError('Forest atlas budget exceeded')
 canvas.alpha_composite(im,(x,y));item.update({'atlas':'forest-props-v1.png','pixelSize':[w,h],'rect':[x,y,w,h],'uvRect':[x/2048,1-(y+h)/2048,w/2048,h/2048]});assets.append(item);x+=w+16;rowh=max(rowh,h)
canvas.save(ARCHIVE/'forest-props-v1.png',optimize=True)
surface=Image.open(ART/'surfaces-generated.png').convert('RGB');tiles={}
for i,name in enumerate(['moss','path','litter','water']):
 w,h=surface.size;tile=surface.crop((i%2*w//2,i//2*h//2,(i%2+1)*w//2,(i//2+1)*h//2)).resize((512,512),Image.Resampling.LANCZOS)
 file=f'tile-{name}-v1.png';tile.save(ARCHIVE/file,optimize=True);tiles[name]={'file':file,'size':[512,512]}
for name,part,size in [('brush-path',utility[0],(512,512)),('mist-card',utility[1],(512,256))]:
 im=part['image'];im.thumbnail((size[0]-32,size[1]-32),Image.Resampling.LANCZOS);padded=Image.new('RGBA',size);padded.alpha_composite(im,((size[0]-im.width)//2,(size[1]-im.height)//2));padded.save(ARCHIVE/f'{name}-v1.png',optimize=True)
manifest={'version':1,'sourcePixelsPerWorldUnit':113,'runtimeDownsample':.5,'atlases':[{'file':'forest-props-v1.png','size':[2048,2048]}],'assets':assets,'tiles':tiles,'brush':'brush-path-v1.png','mist':'mist-card-v1.png'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
proof=Image.new('RGB',(1200,((len(assets)+5)//6)*200),'#526761');d=ImageDraw.Draw(proof)
for i,a in enumerate(assets):
 xx,yy,w,h=a['rect'];im=canvas.crop((xx,yy,xx+w,yy+h));im.thumbnail((184,166),Image.Resampling.LANCZOS);proof.paste(im,(i%6*200+(200-im.width)//2,i//6*200+5),im);d.text((i%6*200+8,i//6*200+175),a['name'],fill='#fff0cd')
proof.save(ART/'preview-environment.jpg',quality=93)
report.update({'assetCount':len(assets),'atlasCount':1,'atlasSize':[2048,2048],'tileCount':4,'brushCount':2})
(ART/'environment-packing-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['assetCount','atlasCount','tileCount','clippingWarnings']}))
