"""Render the real skill-book/hotbar UI with offline Job 2 display fixtures."""
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
import io,os
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'.codex-run'
URL=os.environ.get('JOB2_REVIEW_URL','http://127.0.0.1:5174')
images=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 for width,height in [(1440,900),(390,844)]:
  for job in ['guardian','berserker']:
   page=browser.new_page(viewport={'width':width,'height':height});page.route('**/api/**',lambda r:r.abort())
   page.goto(URL+'/art-review.html')
   page.evaluate('''async ({job})=>{
    const html=await (await fetch('/play.html')).text(),doc=new DOMParser().parseFromString(html,'text/html');
    doc.querySelectorAll('script').forEach(e=>e.remove());document.body.replaceChildren(...doc.body.childNodes);
    await import('/src/style.css');
    const {mountSkills}=await import('/src/skills-ui.ts');await import('/src/hud-qol.css');await import('/src/ui-glass.css');await import('/src/ui-windows.css');
    document.querySelector('#painted-loading')?.remove();
    const manifest=await (await fetch('/texture-manifest.json')).json();const im=new Image();im.src=manifest['/assets/skills-painted/skills-v2.png'].webp;await im.decode();document.documentElement.style.setProperty('--skill-atlas',`url(${im.src})`);
    const data=(await import('/@fs/D:/Project/ThaiNative-OnlineV2/shared/data/skills.json')).default;
    const ids=data.skills.filter(s=>s.jobId===job);const skills=Object.fromEntries(data.skills.map(s=>[s.id,1]));
    const ui=mountSkills(()=>{},()=>{},()=>{});
    ui.receive({type:'stats',job:{jobId:job,jobLevel:1,jobExp:0,skillPoints:5,skills,hotbar:Array.from({length:10},(_,i)=>({skill:ids[i%4].id,key:'Digit'+((i+1)%10)}))}});
    document.querySelector('#overlay').remove();ui.toggle();
    document.querySelector('#skills-window').style.maxHeight='70vh';
    document.querySelector('#skills-window').style.margin='10px auto';
   }''',{'job':job})
   page.wait_for_timeout(1000);images.append(Image.open(io.BytesIO(page.screenshot(type='jpeg',quality=92))).convert('RGB'));page.close()
 browser.close()
canvas=Image.new('RGB',(1830,1800),(26,42,35));canvas.paste(images[0],(0,0));canvas.paste(images[1],(0,900));canvas.paste(images[2],(1440,0));canvas.paste(images[3],(1440,900));canvas.save(OUT/'job2-icons.jpg',quality=92)
