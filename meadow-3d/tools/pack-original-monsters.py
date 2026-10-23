"""Build replacement monster atlases from reviewed, traceable curated Sprite-Gen frames.

No retired artwork is an input. Runtime files are staged before the old public
directories are archived. Regional colour grades preserve alpha and pose geometry.
"""
from pathlib import Path
from PIL import Image,ImageOps
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/monster-origin-rebuild-20261021/runtime'
ART=ROOT/'meadow-3d/art/monster-origin-rebuild-v1'
REBUILD=ROOT/'output/monster-origin-rebuild-20261021'
EXPANSION=ROOT/'output/monster-expansion-20261021'
ART.mkdir(parents=True,exist_ok=True)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
# species: source, displayed height before the renderer's existing scale, palette, wind-up.
BASE={
 'slime':('ripple_jelly',1.2/.72,'rose',.45),
 'king':('ripple_regent',6.9,'rose',.5),
 'shroom':('bud_shroom',1.5/.72,'mist',.6),
 'wolf':('bramble_wolf',1.7/.85,'natural',.4),
 'wisp':('seed_lantern',1.3/.7,'natural',.7),
 'stump':('grove_crown',2.3,'moss',.8),
 'warden':('grove_crown',6.9,'mistwood',.5),
}
HUNTING={
 'ruin_shroom':('bud_shroom',1.5,'stone',.55),
 'relic_hound':('bramble_wolf',1.8,'stone',.4),
 'relic_wisp':('seed_lantern',1.5,'rune',.7),
 'ruin_guard':('grove_crown',2.3,'moss',.75),
 'relic_warden':('grove_crown',4.5,'rune',.5),
 'crag_slime':('pebble_puff',1.55,'natural',.45),
 'crag_wolf':('bramble_wolf',1.85,'amber',.4),
 'dust_wisp':('seed_lantern',1.4,'amber',.7),
 'crag_guard':('grove_crown',2.4,'stone',.75),
 'crag_titan':('moon_titan',4.5,'amber',.5),
}
def folder(source):
 retained=ART/'sources'/source
 if (retained/'run/curated').exists():return retained
 return (REBUILD if source in ['ripple_jelly','ripple_regent','bramble_wolf','seed_lantern'] else EXPANSION)/source
def grade(image,palette):
 # Deterministic shipping colour grades, never a replacement for motion generation.
 if palette in ['natural','rose']:return image
 alpha=image.getchannel('A');rgb=image.convert('RGB');gray=ImageOps.grayscale(rgb)
 low,high={'mist':('#34344c','#e3d5ed'),'moss':('#1d3331','#b8c6a0'),'mistwood':('#243a43','#b6d2be'),'stone':('#343b43','#d2d1c4'),'rune':('#313751','#c6c6eb'),'amber':('#393731','#e2bb7e')}[palette]
 mapped=ImageOps.colorize(gray,low,high).convert('RGBA')
 # Keep texture and subtle source colour rather than replacing them with flat paint.
 mapped=Image.blend(image.convert('RGBA'),mapped,.65 if palette in ['mist','moss','mistwood'] else .5)
 mapped.putalpha(alpha);return mapped
motions=[('idle','idle',1.8,True),('hop','move',.6,True),('attack','attack',1.3,False),('hit','hit',.18,False),('death','death',1.8,False)]
receipt={'date':'2026-10-21','status':'reviewed-replacement','externalBaseImageReferences':[],'scope':'Monster atlases, projectile and portrait derivatives. Other game assets are outside this audit.','sources':{},'files':[],'variants':[],'note':'Traceable generation and visual review are not a legal clearance opinion.'}
for group,definitions in [('monsters-painted',BASE),('monsters-hunting',HUNTING)]:
 dest=OUT/group;dest.mkdir(parents=True,exist_ok=True)
 manifest={'version':3,'originRevision':'original-rebuild-v1','directions':['SE','SW','NE','NW'],'species':{}}
 for species,(source,height,palette,windup) in definitions.items():
  src=folder(source);qa=json.loads((src/'motion-qa.json').read_text(encoding='utf-8'));assert qa['accepted'],source
  inspect=json.loads((src/'run/sprite-inspect.report.json').read_text(encoding='utf-8'));assert inspect['ok'],source
  report=json.loads((src/'base-report.json').read_text(encoding='utf-8'));assert report['provider']=='codex' and not report['refs'],source
  receipt['sources'][source]={'baseSha256':sha(src/'base.png'),'provider':report['provider'],'externalBaseImageReferences':report['refs'],'curatedRun':str((src/'run/curated').relative_to(ROOT)).replace('\\','/'),'retainedSource':str((ART/'sources'/source).relative_to(ROOT)).replace('\\','/')}
  boss=species in ['king','warden','relic_warden','crag_titan'];cell=256 if boss else 192
  idle=Image.open(src/'run/curated/down45_idle-frame-0.png').convert('RGBA');box=idle.getbbox();quad=height*320/(box[3]-box[1])
  definition={'sourceId':source,'palette':palette,'cellSize':[cell,cell],'baseline':round(cell*290/320),'anchor':[.5,30/320],'quadWorldSize':[quad,quad],'bodyWorldHeight':height,'attackWindup':windup,'motions':{}}
  for state,motion,duration,loop in motions:
   sheet=Image.new('RGBA',(cell*4,cell*4));directions=[];inputs=[]
   front_right=source=='bramble_wolf'
   for row,(direction,mirror) in enumerate([('down45',not front_right),('down45',front_right),('up45',False),('up45',True)]):
    frames=[]
    for frame in range(4):
     p=src/f'run/curated/{direction}_{state}-frame-{frame}.png';inputs.append({'file':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p)})
     im=Image.open(p).convert('RGBA').resize((cell,cell),Image.Resampling.LANCZOS)
     if mirror:im=ImageOps.mirror(im)
     im=grade(im,palette);bounds=im.getbbox();assert bounds
     sheet.alpha_composite(im,(frame*cell,row*cell));frames.append({'bounds':list(bounds),'faceRect':None,'groundContact':[cell/2,round(cell*290/320)]})
    directions.append(frames)
   file=f'original-{species}-{motion}.webp';target=dest/file;sheet.save(target,format='WEBP',quality=92,method=4,exact=True)
   definition['motions'][motion]={'file':file,'frames':4,'columns':4,'rows':4,'duration':duration,'frameDurations':[duration/4]*4,'loop':loop,'holdLast':not loop,'directions':directions}
   receipt['files'].append({'group':group,'file':file,'sha256':sha(target),'sourceId':source,'palette':palette,'inputs':inputs})
   if group=='monsters-painted' and species=='wisp' and motion=='idle':
    projectile=sheet.crop((0,0,cell*4,cell));projectile.save(dest/'wisp-bolt-v1.png')
    receipt['files'].append({'group':group,'file':'wisp-bolt-v1.png','sha256':sha(dest/'wisp-bolt-v1.png'),'sourceId':source,'derivation':'first row of the original seed-lantern idle strip'})
  if group=='monsters-painted':
   definition['motions']['hop']=definition['motions']['move']
   if boss:
    for alias in ['slam','sweep','charge','spit','summon','roar','cast']:definition['motions'][alias]=definition['motions']['attack']
    for alias in ['stun','transform']:definition['motions'][alias]=definition['motions']['hit']
  manifest['species'][species]=definition
  receipt['variants'].append({'group':group,'species':species,'sourceId':source,'palette':palette,'geometryUnchanged':True})
 if group=='monsters-painted':
  Image.new('RGBA',(2,2)).save(dest/'phase2-empty.png')
  receipt['files'].append({'group':group,'file':'phase2-empty.png','sha256':sha(dest/'phase2-empty.png'),'sourceId':'procedural-transparent','derivation':'No inherited face artwork; existing phase colour shader remains active.'})
  manifest['phase2']={'hueShift':-.045,'expressionOverlay':'phase2-empty.png'}
  manifest['forestPhase2']={'expressionOverlay':None,'fullFrameCopies':0}
  manifest['projectiles']={'bolt':{'file':'wisp-bolt-v1.png','cellSize':[192,192],'frames':4}}
 (dest/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(group+': packed '+str(len(definitions))+' original variants',flush=True)
for source in receipt['sources']:
 src=folder(source);dest=ART/'sources'/source;dest.mkdir(parents=True,exist_ok=True)
 if src.resolve()==dest.resolve():continue
 for file in ['base-report.json','motion-qa.json','request.json']:shutil.copy2(src/file,dest/file)
 prompts=(REBUILD if src.parent==REBUILD else EXPANSION)/'prompts'/f'{source}.txt';shutil.copy2(prompts,dest/'base-prompt.txt')
 shutil.copy2(src/'run/sprite-inspect.report.json',dest/'inspection.json')
 shutil.copy2(src/'run/references/generation-plan.json',dest/'generation-plan.json')
 shutil.copytree(src/'run/reports',dest/'reports',dirs_exist_ok=True)
 shutil.copy2(src/'base.png',dest/'base.png')
 shutil.copytree(src/'run/curated',dest/'run/curated',dirs_exist_ok=True)
 shutil.copy2(src/'run/sprite-inspect.report.json',dest/'run/sprite-inspect.report.json')
(ART/'provenance.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Staged replacement atlases; public assets have not been changed.',flush=True)
