"""Offline Job 2 art review, never authenticates or accesses production."""
import io,json,os
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.codex-run'
URL=os.environ.get('JOB2_REVIEW_URL','http://127.0.0.1:5174')
rows=[];errors=[];stops=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True,args=['--enable-webgl','--ignore-gpu-blocklist'])
 for width,height in [(1440,900),(390,844)]:
  for job in ['guardian','berserker']:
   for borrowed in [True,False]:
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/api/**',lambda r:r.abort())
    page.goto(URL+'/art-review.html?job2');page.wait_for_function('window.__ART__?.job2')
    page.evaluate('([job,b])=>{__ART__.job2.setup(job,0,b);__ART__.look(0,-30);__ART__.zoom(16)}',[job,borrowed])
    page.wait_for_timeout(10000)
    page.evaluate('__ART__.quality(true)');page.wait_for_timeout(5500)
    rows.append({'viewport':[width,height],'job':job,'borrowed':borrowed,**page.evaluate('__ART__.snapshot()'),'review':page.evaluate('__ART__.job2.snapshot()')})
    if not borrowed:
     name=('job2-'+job+'.jpg') if width==1440 else 'job2-mobile.jpg'
     page.evaluate('(t)=>__ART__.job2.pose(t)',.52 if job=='guardian' else .25)
     page.wait_for_timeout(100)
     page.screenshot(path=str(OUT/name),type='jpeg',quality=90)
    page.close()
 # All 32 skill/direction review stops, rendered and checked; retain only allowed screenshots.
 page=browser.new_page(viewport={'width':1440,'height':900});page.goto(URL+'/art-review.html?job2');page.wait_for_function('window.__ART__?.job2')
 for i in range(32):
  stop=page.evaluate('(i)=>__ART__.job2.point(i)',i);page.wait_for_timeout(1200)
  stops.append({**stop,**page.evaluate('__ART__.job2.snapshot()')})
 crowd=[]
 contact_events=json.loads((OUT/'job2-contact-events.json').read_text())
 contacts=page.evaluate('(runs)=>__ART__.job2.replay(runs)',contact_events)
 for high in [True,False]:
  page.evaluate('(hq)=>{__ART__.quality(hq);__ART__.job2.setup("berserker",0,false,undefined,48)}',high);page.wait_for_timeout(5500)
  crowd.append(page.evaluate('__ART__.snapshot()'))
 browser.close()
(OUT/'job2-review-measurements.json').write_text(json.dumps({'scope':'Offline display replay; not live server combat','rows':rows,'stops':stops,'crowd':crowd,'contacts':contacts,'errors':errors},indent=2),encoding='utf-8')
print(json.dumps({'rows':[{k:v for k,v in row.items() if k not in ['environment','review']} for row in rows],'errors':errors}))
