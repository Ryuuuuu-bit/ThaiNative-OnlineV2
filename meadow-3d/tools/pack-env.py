"""Trim painted environment sources, retain alpha, anchor, and shelf-pack at 0.5x.
Pixel sizes are normalized once per asset type to source-world scale 113px/unit.
No illustrative content is synthesized by this packer.
"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
import json
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/painted-env';OUT=ROOT/'public/assets/env-painted';OUT.mkdir(parents=True,exist_ok=True)
PPU=113;DOWNSAMPLE=.5;SIZE=2048;PAD=8
# Target source dimensions establish physical sizes among heterogeneous sheet props.
groups={
'foliage':[('bush-round','h',120),('bush-flowering','h',110),('fern-wide','h',100),('fern-upright','h',110),('grass-1','h',50),('grass-2','h',55)],
'flowers':[('flowers-white','h',45),('flowers-yellow','h',45),('flowers-lavender','h',60),('flowers-pink','h',50),('grass-3','h',55),('reeds-1','h',120)],
'rocks':[('boulder-round','h',125),('boulder-tall','h',155),('boulder-flat','h',85),('rock-cluster','w',190),('fallen-log','w',250),('stump','h',100)],
'camp':[('tent','h',250),('campfire','w',125),('bench','w',220),('signpost','h',160),('fence-post','h',125),('fence-span','w',280)],
'ruins-pond':[('pillar-square','h',240),('pillar-fluted','h',270),('arch','w',550),('stone-circle','w',712),('reeds-2','h',135),('reeds-3','h',105)]}
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

items=[];report={'sourcePixelsPerWorldUnit':PPU,'runtimeDownsample':DOWNSAMPLE,'sources':{},'warnings':[]}
def trim(im):
 a=im.getchannel('A');bbox=a.point(lambda x:255 if x>8 else 0).getbbox()
 if not bbox:raise ValueError('Empty asset')
 return im.crop(bbox),bbox
def add(name,im,axis,target,source):
 im,bbox=trim(im);factor=target/(im.width if axis=='w' else im.height)
 sw,sh=round(im.width*factor),round(im.height*factor)
 normalized=im.resize((sw,sh),Image.Resampling.LANCZOS)
 pixels=np.asarray(normalized.getchannel('A'));ys,xs=np.nonzero(pixels>24);bottom=int(ys.max())
 band=(pixels>24)&(np.indices(pixels.shape)[0]>=bottom-sh*.15)
 anchor_x=float(np.median(np.nonzero(band)[1]))+.5;anchor_y=bottom+1
 runtime=normalized.resize((max(1,round(sw*DOWNSAMPLE)),max(1,round(sh*DOWNSAMPLE))),Image.Resampling.LANCZOS)
 item={'name':name,'image':runtime,'sourcePixelSize':[sw,sh],'worldSize':[sw/PPU,sh/PPU],'anchor':[anchor_x/sw,anchor_y/sh],'source':source,'flat':name in ['stone-circle','bridge']}
 items.append(item);report['sources'][name]={'file':source,'trimBounds':bbox,'originalAlphaExtrema':im.getchannel('A').getextrema(),'normalizeScale':factor,'sourcePixelSize':[sw,sh]}
for name in ['tree-round','tree-tall','tree-leaning','tree-flowering']:
 add(name,Image.open(ART/f'{name}.png').convert('RGBA'),'h',700,f'art/painted-env/{name}.png')
for sheet,defs in groups.items():
 im=Image.open(ART/f'{sheet}.png').convert('RGBA');parts=components(im)
 top=sorted([c for c in parts if c['center'][1]<im.height/2],key=lambda c:c['center'][0])
 bottom=sorted([c for c in parts if c['center'][1]>=im.height/2],key=lambda c:c['center'][0])
 if len(top)!=3 or len(bottom)!=3:raise ValueError(f'{sheet}: expected six separated figures, found {len(top)}+{len(bottom)}')
 for i,((name,axis,target),part) in enumerate(zip(defs,top+bottom)):
  x0,y0,x1,y1=part['bbox']
  if x0<2 or y0<2 or x1>im.width-2 or y1>im.height-2:raise ValueError(f'{name}: source artwork reaches outer canvas boundary')
  add(name,part['image'],axis,target,f'art/painted-env/{sheet}.png#figure{i+1}')
  report['sources'][name]['sheetBounds']=part['bbox']
add('bridge',Image.open(ART/'bridge.png').convert('RGBA'),'w',780,'art/painted-env/bridge.png')
atlases=[];assets=[];canvas=Image.new('RGBA',(SIZE,SIZE));x=y=PAD;row_h=0
def save_atlas():
 name=f'env-{len(atlases)+1}-v1.png';canvas.save(OUT/name,optimize=True);atlases.append({'file':name,'size':[SIZE,SIZE]})
for item in sorted(items,key=lambda i:i['image'].height,reverse=True):
 im=item.pop('image');w,h=im.size
 if x+w+PAD>SIZE:x=PAD;y+=row_h+PAD*2;row_h=0
 if y+h+PAD>SIZE:save_atlas();canvas=Image.new('RGBA',(SIZE,SIZE));x=y=PAD;row_h=0
 atlas_name=f'env-{len(atlases)+1}-v1.png';canvas.alpha_composite(im,(x,y))
 # Keep an 8px transparent gutter for atlas sampling.
 item.update({'atlas':atlas_name,'pixelSize':[w,h],'rect':[x,y,w,h],'uvRect':[x/SIZE,1-(y+h)/SIZE,w/SIZE,h/SIZE]})
 assets.append(item);x+=w+PAD*2;row_h=max(row_h,h)
save_atlas()
tiles={}
for name in ['grass','dirt','transition','water','stone']:
 im=Image.open(ART/f'tile-{name}.png').convert('RGBA').resize((1024,1024),Image.Resampling.LANCZOS)
 if name!='transition':im=im.convert('RGB')
 im.save(OUT/f'tile-{name}-v1.png',optimize=True);tiles[name]={'file':f'tile-{name}-v1.png','size':[1024,1024],'transparent':name=='transition'}
 if name=='grass':im.save(ROOT/'public/assets/meadow-grass.png',optimize=True)
manifest={'version':1,'sourcePixelsPerWorldUnit':PPU,'runtimeDownsample':DOWNSAMPLE,'atlases':atlases,'assets':assets,'tiles':tiles}
from world_scale import apply_world_scale
apply_world_scale(manifest, 'env-painted')
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
report.update({'assetCount':len(assets),'tileCount':len(tiles),'atlasCount':len(atlases),'atlases':atlases})
(ART/'packing-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
# HD originals/contact preview remain in art/, outside Vite public/.
preview=Image.new('RGB',(1400,((len(items)+6)//7)*210),'#d7d5c7')
from PIL import ImageDraw
for i,item in enumerate(assets):
 atlas=Image.open(OUT/item['atlas']);xx,yy,w,h=item['rect'];im=atlas.crop((xx,yy,xx+w,yy+h));im.thumbnail((180,175),Image.Resampling.LANCZOS)
 px=(i%7)*200+(200-im.width)//2;py=(i//7)*210+5;preview.paste(im,(px,py),im);ImageDraw.Draw(preview).text((i%7*200+8,i//7*210+185),item['name'],fill='#354534')
preview.save(ART/'preview-all.png')
print(json.dumps({k:report[k] for k in ['assetCount','tileCount','atlasCount','warnings']}))
