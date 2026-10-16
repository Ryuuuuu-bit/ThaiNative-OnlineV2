"""Preserve PNG sources and prepare resized encoder inputs + alpha-exact WebP fallbacks."""
from pathlib import Path
from PIL import Image
import json,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'public';SRC=ROOT/'art/texture-sources';STAGE=ROOT.parent/'.codex-run/texture-inputs'
SRC.mkdir(exist_ok=True);STAGE.mkdir(parents=True,exist_ok=True)
# Archive originals non-destructively before the shipping tree is repacked.
for p in (PUBLIC/'assets').rglob('*.png'):
    if 'brand' in p.parts:continue
    dest=SRC/p.relative_to(PUBLIC/'assets');dest.parent.mkdir(parents=True,exist_ok=True)
    if not dest.exists():shutil.copy2(p,dest)
manifest=json.loads((PUBLIC/'assets/env-painted/manifest.json').read_text())
original=SRC/'env-painted/manifest-original.json'
if not original.exists():original.write_text(json.dumps(manifest,indent=2))
manifest=json.loads(original.read_text())
atlas=Image.open(SRC/'env-painted/env-1-v1.png').convert('RGBA');near=atlas.copy();far=Image.new('RGBA',atlas.size)
for a in manifest['assets']:
    distant=a['name'] in ['arch','pillar-fluted','pillar-square','stone-circle']
    x,y,w,h=a['rect'];box=(x,y,x+w,y+h)
    if distant:far.paste(atlas.crop(box),(x,y));near.paste((0,0,0,0),box)
    a['atlas']='env-far-v2.png' if distant else 'env-near-v2.png'
near.save(SRC/'env-painted/env-near-v2.png');far.save(SRC/'env-painted/env-far-v2.png')
manifest['atlases']=[{'file':f'env-{name}-v2.png','size':[2048,2048]} for name in ['near','far']]
(PUBLIC/'assets/env-painted/manifest.json').write_text(json.dumps(manifest,indent=2))
entries={}
def pack(p,logical,mode='uastc',mips=False,cpu=False,mask=False):
    im=Image.open(p).convert('RGBA');w,h=im.size;scale=min(1,2048/max(w,h));size=(max(4,round(w*scale/4)*4),max(4,round(h*scale/4)*4))
    # Atelier uses these sheets as full-size CPU frame sources, never GPU textures or play boot assets.
    if '/preview/' in logical:size=(w,h)
    if logical.endswith('tile-water-v2.png'):size=(512,512)
    if im.size!=size:im=im.resize(size,Image.Resampling.LANCZOS)
    stage=STAGE/logical.removeprefix('/assets/');stage.parent.mkdir(parents=True,exist_ok=True);im.save(stage)
    dest=PUBLIC/logical.lstrip('/');dest.parent.mkdir(parents=True,exist_ok=True)
    webp=dest.with_suffix('.webp');im.save(webp,'WEBP',quality=88 if mode=='uastc' else 86,method=6,exact=True)
    hit=None
    if mask:
        # Alpha is lossless at the SAME dimensions; compressed GPU textures cannot be sampled by Canvas2D.
        alpha=Image.new('RGBA',im.size,(255,255,255,0));alpha.putalpha(im.getchannel('A'));hit=dest.with_name(dest.stem+'-hit.webp');alpha.save(hit,'WEBP',lossless=True,method=6,exact=True)
    entries[logical]={'webp':'/'+webp.relative_to(PUBLIC).as_posix(),'ktx2':None if cpu else '/'+dest.with_suffix('.ktx2').relative_to(PUBLIC).as_posix(),'source':p.relative_to(ROOT).as_posix(),'input':str(stage),'size':list(size),'originalSize':[w,h],'mode':mode,'mips':mips,'hitMask':'/'+hit.relative_to(PUBLIC).as_posix() if hit else None,'cpu':cpu}
for p in (SRC/'hero-painted').glob('*.png'):pack(p,'/assets/hero-painted/'+p.name,cpu=p.name=='portrait-v1.png')
for p in (ROOT/'art/hero-skills').glob('hero-skill-*-v1.png'):pack(p,'/assets/hero-skills/'+p.name)
for p in (SRC/'hero-painted/preview').glob('*.png'):pack(p,'/assets/hero-painted/preview/'+p.name,cpu=True)
for p in (SRC/'monsters-painted').glob('*.png'):
    if '-glow-' not in p.name:pack(p,'/assets/monsters-painted/'+p.name,mask=True)
for name in ['env-near-v2.png','env-far-v2.png','tile-grass-v1.png','tile-dirt-v1.png','tile-stone-v1.png','tile-water-v2.png','tile-transition-v1.png']:
    pack(SRC/'env-painted'/name,'/assets/env-painted/'+name,mode='uastc' if name in ['env-near-v2.png','tile-water-v2.png'] else 'etc1s',mips=name.startswith('tile-') and 'transition' not in name,cpu='transition' in name)
entries['/assets/meadow-grass.png']=entries['/assets/env-painted/tile-grass-v1.png']
for p in (SRC/'ui-painted').glob('*.png'):pack(p,'/assets/ui-painted/'+p.name,cpu=True)
(STAGE/'manifest.json').write_text(json.dumps(entries,indent=2))
print(f'Prepared {len(entries)} texture entries; original PNGs preserved in {SRC}')
