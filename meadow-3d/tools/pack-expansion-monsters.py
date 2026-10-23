"""Pack reviewed Sprite-Gen curated exports; never slice AI strips directly."""
from pathlib import Path
from PIL import Image,ImageOps
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'output/monster-expansion-20261021'
DEST=ROOT/'meadow-3d/public/assets/monsters-expansion-v1'
ART=ROOT/'meadow-3d/art/monster-expansion-v1'
DEST.mkdir(parents=True,exist_ok=True);ART.mkdir(parents=True,exist_ok=True)
manifest={'version':1,'source':'Sprite-Gen / GPT, original text-only base designs','species':{}}
provenance={'date':'2026-10-21','provider':'codex','externalBaseImageReferences':[],
 'note':'Generation provenance and visual review do not constitute a legal clearance opinion.',
 'sources':[],'files':[]}
data=json.loads((ROOT/'shared/data/monsters.json').read_text(encoding='utf-8'))['monsters']
for c in json.loads((SOURCE/'production.json').read_text(encoding='utf-8'))['creatures']:
 id=c['id'];folder=SOURCE/id;run=folder/'run'
 qa=json.loads((folder/'motion-qa.json').read_text(encoding='utf-8'))
 assert qa['accepted'],id+' has not passed visual motion review'
 inspection=json.loads((run/'sprite-inspect.report.json').read_text(encoding='utf-8'))
 assert inspection['ok'],id+' extraction inspection failed'
 boss=id in ['grove_crown','moon_titan'];cell=256 if boss else 192
 worldHeight={'bud_shroom':1.8,'clay_puff':1.65,'pebble_puff':1.7,'amber_mantis':2.1,'dawn_owl':1.9,'grove_crown':5.4,'moon_crab':2.0,'frost_lynx':2.1,'moon_titan':6.2}[id]
 idle=Image.open(run/'curated/down45_idle-frame-0.png').convert('RGBA');bounds=idle.getbbox();assert bounds
 quad=worldHeight*320/(bounds[3]-bounds[1]);record=next((m for m in data if m['id']==id),{})
 entry={'cellSize':[cell,cell],'anchor':[.5,30/320],'quadWorldSize':[quad,quad],
        'attackWindup':record.get('behavior',{}).get('windup',.5),'motions':{}}
 for state,game in [('idle','idle'),('hop','move'),('attack','attack'),('hit','hit'),('death','death')]:
  sheet=Image.new('RGBA',(cell*4,cell*4));directions=[]
  # Front anchors were visually observed facing left; back anchors face right.
  for row,(direction,mirror) in enumerate([('down45',True),('down45',False),('up45',False),('up45',True)]):
   frames=[]
   for i in range(4):
    source=run/f'curated/{direction}_{state}-frame-{i}.png';assert source.exists(),source
    im=Image.open(source).convert('RGBA').resize((cell,cell),Image.Resampling.LANCZOS)
    if mirror:im=ImageOps.mirror(im)
    box=im.getbbox();assert box
    sheet.alpha_composite(im,(i*cell,row*cell))
    # Runtime hit testing and portrait crops both expect bounds within a single cell.
    frames.append({'bounds':list(box)})
   directions.append(frames)
  name=f'{id}-{game}.webp';sheet.save(DEST/name,format='WEBP',quality=90,method=6,exact=True)
  entry['motions'][game]={'file':name,'frames':4,'columns':4,'rows':4,'duration':1.8 if state=='idle' else .6 if state=='hop' else .75,'loop':state in ['idle','hop'],'directions':directions}
  provenance['files'].append({'file':name,'sha256':hashlib.sha256((DEST/name).read_bytes()).hexdigest()})
 manifest['species'][id]=entry
 target=ART/id;target.mkdir(exist_ok=True)
 for filename in ['base-report.json','request.json','motion-qa.json']:
  shutil.copy2(folder/filename,target/filename)
 shutil.copy2(SOURCE/f'prompts/{id}.txt',target/'base-prompt.txt')
 shutil.copy2(run/'sprite-inspect.report.json',target/'inspection.json')
 # Keep every provider receipt and resolved anchor chain, not credentials or raw image blobs.
 shutil.copytree(run/'reports',target/'reports',dirs_exist_ok=True)
 shutil.copytree(run/'prompts',target/'prompts',dirs_exist_ok=True)
 shutil.copy2(run/'references/generation-plan.json',target/'generation-plan.json')
 provenance['sources'].append({'id':id,'baseSha256':hashlib.sha256((folder/'base.png').read_bytes()).hexdigest(),'run':str(run.relative_to(ROOT)).replace('\\','/'),'curatedOnly':True,'mirrorDirections':['SE','NW'],'motionQA':str((target/'motion-qa.json').relative_to(ROOT)).replace('\\','/')})
(DEST/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
shutil.copy2(SOURCE/'provenance-audit.json',ART/'legacy-audit.json')
(ART/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Packed',len(manifest['species']),'reviewed creatures into',DEST)
