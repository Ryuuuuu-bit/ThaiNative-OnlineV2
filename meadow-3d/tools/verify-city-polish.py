"""City-only screenshots and 48-actor crowd measurements. Run after builds finish."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[2]/'.codex-run';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist'])
 page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.route('**/api/**',lambda route:route.abort())
 page.goto('http://127.0.0.1:5173/art-review.html');page.wait_for_function('window.__ART__');page.wait_for_timeout(2500)
 stops=page.evaluate('__ART__.stops.city_plaza');rows=[]
 for hq in [True,False]:
  page.evaluate('(q)=>__ART__.quality(q)',hq)
  for i,stop in enumerate(stops):
   page.evaluate('(i)=>__ART__.point(i)',i);page.wait_for_timeout(2400)
   page.screenshot(path=str(OUT/(stop[0]+('-hq' if hq else '-low')+'.jpg')),type='jpeg',quality=92)
   page.evaluate('(i)=>__ART__.point(i,true)',i);page.wait_for_timeout(2200)
   row=page.evaluate('__ART__.snapshot()');assert row['map']=='city_plaza' and row['quality']==('HQ' if hq else 'LOW') and row['crowd']==49,'Review reloaded; rerun after builds finish'
   row['view']=stop[0];rows.append(row)
 assert not errors,errors
 assert all(r['fps']>=(50 if r['quality']=='HQ' else 30) for r in rows),'FPS target missed'
 assert max(r['drawCalls'] for r in rows if r['quality']=='HQ')<=220,'HQ draw budget missed'
 report={'viewport':[1600,1000],'crowd':'Aerin + 48 display actors, plus city residents; render-only benchmark','rows':rows,'errors':errors}
 (OUT/'city-polish-3-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print(json.dumps({'rows':[{k:r[k] for k in ['view','quality','drawCalls','triangles','instances','visibleInstances','fps']} for r in rows],'errors':errors},indent=2))
 browser.close()

