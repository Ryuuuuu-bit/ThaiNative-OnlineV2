"""Encode only new forest textures; preserve every older shipping asset and entry.
KTX2 matches the existing meadow UASTC/sRGB convention. Alpha-exact CPU masks
support sprite picking and the path brush. Source filenames stay logical IDs.
"""
from pathlib import Path
from PIL import Image
import json,hashlib,subprocess,os
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'public';SRC=ROOT/'art/texture-sources';STAGE=ROOT.parent/'.codex-run/forest-texture-inputs'
STAGE.mkdir(parents=True,exist_ok=True)
MANIFEST=PUBLIC/'texture-manifest.json';manifest=json.loads(MANIFEST.read_text())
encoder=Path(os.environ.get('TOKTX',ROOT.parent/'.codex-run/ktx-tools/extracted/bin/toktx.exe'))
if not encoder.is_file():raise RuntimeError('The existing Khronos toktx encoder is required')
new=[]
paths=list((SRC/'env-forest').glob('*.png'))
for sp in ['shroom','wolf','wisp','stump','warden']:
 paths.extend(p for p in (SRC/'monsters-painted').glob(f'{sp}-*-v1.png') if '-glow-' not in p.name)
bolt=SRC/'monsters-painted/wisp-bolt-v1.png'
if bolt.exists() and bolt not in paths:paths.append(bolt)
def encode(p):
 logical='/assets/'+p.relative_to(SRC).as_posix();folder=PUBLIC/'assets'/p.relative_to(SRC).parent;folder.mkdir(parents=True,exist_ok=True)
 im=Image.open(p).convert('RGBA');w,h=im.size;scale=min(1,2048/max(w,h));size=(max(4,round(w*scale/4)*4),max(4,round(h*scale/4)*4))
 if im.size!=size:im=im.resize(size,Image.Resampling.LANCZOS)
 stage=STAGE/(p.stem+'.png');im.save(stage)
 cpu=p.stem=='brush-path-v1';mips=p.stem.startswith('tile-');is_sprite=p.parent.name=='monsters-painted'
 entry={'webp':None,'ktx2':None,'hitMask':None,'source':p.relative_to(ROOT).as_posix(),'size':list(size),'originalSize':[w,h],'mode':'uastc','mips':mips,'cpu':cpu}
 webp=STAGE/(p.stem+'.webp');im.save(webp,'WEBP',quality=90,method=6,exact=True)
 def ship(path,key):
  data=path.read_bytes();h=hashlib.sha256(data).hexdigest()[:10];file=f'{path.stem}-{h}{path.suffix}';(folder/file).write_bytes(data);entry[key]='/'+(folder/file).relative_to(PUBLIC).as_posix()
 ship(webp,'webp')
 if is_sprite:
  mask=Image.new('RGBA',im.size,(255,255,255,0));mask.putalpha(im.getchannel('A'));path=STAGE/(p.stem+'-hit.webp');mask.save(path,'WEBP',lossless=True,method=6,exact=True);ship(path,'hitMask')
 if not cpu:
  out=STAGE/(p.stem+'-'+hashlib.sha256(stage.read_bytes()).hexdigest()[:10]+'.ktx2');args=[str(encoder),'--t2','--encode','uastc','--assign_oetf','srgb','--lower_left_maps_to_s0t0','--threads','1','--uastc_quality','3','--uastc_rdo_l','0.5','--zcmp','18']
  if mips:args+=['--genmipmap']
  if not out.exists():subprocess.run(args+[str(out),str(stage)],check=True,capture_output=True)
  ship(out,'ktx2')
 return logical,entry
with ThreadPoolExecutor(max_workers=3) as pool:
 for logical,entry in pool.map(encode,paths):
  manifest[logical]=entry;new.append({'logical':logical,**entry});print(logical,flush=True)
MANIFEST.write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT.parent/'.codex-run/forest-texture-report.json').write_text(json.dumps({'count':len(new),'entries':new},indent=2)+'\n')
