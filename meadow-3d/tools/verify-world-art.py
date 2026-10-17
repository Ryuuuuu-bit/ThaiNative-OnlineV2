"""Local-only, reproducible world-art captures. Requires Python Playwright + Chrome."""
import json, sys, subprocess
if '--job2' in sys.argv:
 import runpy
 from pathlib import Path
 runpy.run_path(str(Path(__file__).with_name('verify-job2-art.py')),run_name='__main__')
 raise SystemExit
from PIL import Image
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[2]/'.codex-run';OUT.mkdir(exist_ok=True)
before='--before' in sys.argv
# Read-only historical scene replay, kept outside shipping sources.
source=subprocess.check_output(['git','show','HEAD:meadow-3d/src/city-scene.ts']).decode('utf-8')
current=(OUT.parent/'meadow-3d/src/city-scene.ts').read_text(encoding='utf-8')
helpers=current[current.index('const scaleSamples:'):current.index('const matrix=new')]
source=source.replace('const matrix=new',helpers+'const matrix=new').replace('../../shared/data/jobs.json','../shared/data/jobs.json')
source=source.replace('g.applyMatrix4(matrix);if(!batches', 'g.applyMatrix4(matrix);if(sample){sample.add(new T.Mesh(g.clone().translate(-sampleOrigin.x,0,-sampleOrigin.z),material));}if(!batches')
source=source.replace(' box(0,.12,0,4,10,4)', " beginSample('clock-tower');box(0,.12,0,4,10,4)").replace(' function house(', ' endSample();\n function house(')
source=source.replace('){box(x,0,z,w,h,d,3);roof',"){const capture=scaleSamples.every(s=>s.name!=='house-door-window-roof');if(capture)beginSample('house-door-window-roof',x,z);box(x,0,z,w,h,d,3);roof").replace('1.1,1.2,7,0,glow);}','1.1,1.2,7,0,glow);if(capture)endSample();}')
source=source.replace('for(const p of props.values()){','for(const [key,p] of props){').replace('p.transforms.forEach((t,i)=>mesh.setMatrixAt',"mesh.name='city-'+key;p.transforms.forEach((t,i)=>mesh.setMatrixAt").replace('return{root,npcActors:','return{root,scaleSamples,npcActors:')
baseline_city=OUT/'before-city.ts';baseline_city.write_text(source,encoding='utf-8')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist'])
 page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/api/**',lambda route:route.abort())
 page.goto('http://127.0.0.1:5173/art-review.html');page.wait_for_function('window.__ART__');page.wait_for_timeout(3000)
 rows=[]
 for map_id in ['city_plaza','meadow','forest']:
  page.evaluate('(m)=>__ART__.load(m)',map_id);page.wait_for_timeout(1500)
  for hq in [True,False]:
   page.evaluate('(q)=>__ART__.quality(q)',hq)
   if before:
    page.evaluate('__ART__.point(1,true)');page.wait_for_timeout(2500)
   else:
    stops=page.evaluate('(m)=>__ART__.stops[m]',map_id)
    for i,stop in enumerate(stops):
     page.evaluate('(i)=>__ART__.point(i)',i);page.wait_for_timeout(450)
     page.screenshot(path=str(OUT/(stop[0]+('-hq' if hq else '-low')+'.jpg')),type='jpeg',quality=88)
     if hq:page.screenshot(path=str(OUT/(stop[0]+'.jpg')),type='jpeg',quality=88)
    page.evaluate('__ART__.point(1,true)');page.wait_for_timeout(5500)
   sample=page.evaluate('__ART__.snapshot()');assert sample['map']==map_id and sample['quality']==('HQ' if hq else 'LOW') and sample['crowd']==49, 'Review reloaded during capture; rerun after builds stop'
   rows.append(sample)
 originals=[json.loads(subprocess.check_output(['git','show','HEAD:meadow-3d/public/assets/'+b+'/manifest.json'])) for b in ['env-painted','env-forest']]
 page.set_viewport_size({'width':3200,'height':2400})
 page.reload();page.wait_for_function('window.__ART__');page.evaluate('async p=>{const m=await import(p.url);await __ART__.lineup(p.originals,m.buildCity)}',{'url':'/@fs/'+baseline_city.as_posix(),'originals':originals});page.wait_for_timeout(2000)
 page.screenshot(path=str(OUT/'scale-lineup-before.jpg'),type='jpeg',quality=94)
 page.reload();page.wait_for_function('window.__ART__');page.evaluate('__ART__.lineup()');page.wait_for_timeout(2000)
 page.screenshot(path=str(OUT/('scale-lineup-before.jpg' if before else 'scale-lineup.jpg')),type='jpeg',quality=94)
 idle=Image.open(OUT.parent/'meadow-3d/art/texture-sources/hero-painted/hero-idle-v1.png');cell=idle.width//4;bounds=[idle.crop((i*cell,0,(i+1)*cell,idle.height)).getbbox() for i in range(4)];assert all(b[3]-b[1]==168 for b in bounds)
 report={'scaleVerification':{'heroIdleBounds':bounds,'heroBodyPixels':168,'heroMetres':1.8,'quadHeightMetres':256*1.8/168,'bossMetres':4.5,'smallJellyMetres':1.656*.72},'scope':'Local offline scene review, 48 nearby display actors + Aerin; no network/gameplay simulation','viewport':[1600,1000],'rows':rows,'errors':errors}
 (OUT/('world-art-before.json' if before else 'world-art-report.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps({'rows':[{k:v for k,v in r.items() if k!='environment'} for r in rows],'errors':errors},indent=2))
 browser.close()

