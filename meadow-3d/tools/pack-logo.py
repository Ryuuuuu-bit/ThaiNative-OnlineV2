"""Technical alpha-preserving resize/composite of built-in imagegen artwork. Pillow required."""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter
import base64, io, json
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'art/painted-brand'; OUT=ROOT/'public/assets/brand'; OUT.mkdir(parents=True,exist_ok=True)
def trimmed(path):
    im=Image.open(path).convert('RGBA'); return im.crop(im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox())
for letter in 'abc':
    p=SRC/f'logo-option-{letter}.png'; im=Image.open(p).convert('RGBA')
    im.resize((2048,1024),Image.Resampling.LANCZOS).save(SRC/f'logo-direction-{letter}-2048.png')
logo=trimmed(SRC/'logo-option-a.png')
for width,name in [(1200,'logo-v1.png'),(2400,'logo-v1@2x.png'),(512,'logo-v1-512.webp')]:
    logo.resize((width,round(logo.height*width/logo.width)),Image.Resampling.LANCZOS).save(OUT/name)
mark=trimmed(SRC/'mark-source.png')
icon=Image.new('RGBA',(512,512)); stamp=ImageOps.contain(mark,(440,440),Image.Resampling.LANCZOS);icon.alpha_composite(stamp,((512-stamp.width)//2,(512-stamp.height)//2));icon.save(OUT/'logo-mark-v1.png')
for size,name in [(180,'apple-touch-icon.png'),(192,'icon-192.png'),(512,'icon-512.png')]:
    bg=Image.new('RGBA',(512,512),'#182b28');bg.alpha_composite(icon);bg.convert('RGB').resize((size,size),Image.Resampling.LANCZOS).save(OUT/name)
icon.save(OUT/'favicon.ico',sizes=[(16,16),(32,32),(48,48)])
paint=Image.open(SRC/'loading-source.png').convert('RGB')
for width in [1920,1280,768]:
    ImageOps.fit(paint,(width,round(width*9/16)),method=Image.Resampling.LANCZOS).save(OUT/f'loading-dusk-{width}-v1.jpg',quality=80,optimize=True)
tiny=ImageOps.fit(paint,(32,18)).filter(ImageFilter.GaussianBlur(1));buf=io.BytesIO();tiny.save(buf,format='JPEG',quality=30)
(SRC/'placeholder.txt').write_text('data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode())
og=ImageOps.fit(Image.open(ROOT/'public/assets/web/meadow-dawn-1600-v1.jpg').convert('RGBA'),(1200,630))
shade=Image.new('RGBA',og.size,(10,28,25,85));og.alpha_composite(shade);stamp=ImageOps.contain(logo,(720,360),Image.Resampling.LANCZOS);og.alpha_composite(stamp,((1200-stamp.width)//2,90));og.convert('RGB').save(OUT/'og-image-v1.jpg',quality=85,optimize=True)
(ROOT/'public/site.webmanifest').write_text(json.dumps({'name':'ThaiNative Online','short_name':'ThaiNative','start_url':'/','display':'standalone','theme_color':'#182b28','background_color':'#182b28','icons':[{'src':f'/assets/brand/icon-{s}.png','sizes':f'{s}x{s}','type':'image/png','purpose':'any'} for s in [192,512]]},indent=2))
