import './navigation';
import './portal-expansion';
import'../web.css';import'../web-glass.css';import'../web-modern.css';import'../web-fantasy.css';import{startGuest,mountAccountChip,getMe}from'./session';import{showError}from'./api';import{heroView}from'./portal-state';import{kindLabel,uidChip}from'./account-ui';
void mountAccountChip();
// Signed-in visitors get "continue" instead of guest/Google actions; both stay invisible until /api/me answers (no flash).
const hero=document.querySelector<HTMLElement>('#hero-session')!,$=(s:string)=>document.querySelector<HTMLElement>(s)!;
void getMe().catch(()=>null).then(me=>{const v=heroView(me);hero.dataset.session=v.session;hero.removeAttribute('aria-busy');if(v.session==='out')return;
 $('#guest-actions').hidden=true;$('#account-actions').hidden=false;$('#hero-account-name').textContent=v.name;$('#hero-account-kind').textContent='· '+kindLabel(v.kind);$('#hero-uid').replaceChildren(uidChip(v.uid));
 const go=document.querySelector<HTMLAnchorElement>('#hero-continue')!;go.href=v.continueHref;go.firstChild!.textContent=v.continueLabel+' ';$('#hero-characters').hidden=!v.showCharacters;$('#hero-guest-note').hidden=!v.guest;});
document.querySelector<HTMLButtonElement>('#guest-play')!.onclick=async function(this:HTMLButtonElement){this.disabled=true;try{await startGuest();location.assign('/characters.html');}catch(e){showError(document.querySelector('#portal-error')!,e);this.disabled=false;}};
document.querySelector('#build-id')!.textContent=import.meta.env.VITE_BUILD_ID||'ทดสอบ';
fetch('/changelog.json').then(r=>{if(!r.ok)throw Error('โหลดบันทึกไม่สำเร็จ');return r.json();}).then(entries=>{const list=document.querySelector('#changelog-list')!;for(const [index,item] of entries.entries()){const li=document.createElement('li'),time=document.createElement('time'),title=document.createElement('h3'),p=document.createElement('p');time.textContent=item.date;title.textContent=item.title;p.textContent=item.description;li.append(time,title,p);li.hidden=index>=4;list.append(li);}if(entries.length>4){const button=document.createElement('button');button.type='button';button.className='realm-text-link realm-news-toggle';button.textContent='ดูบันทึกทั้งหมด +';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','changelog-list');button.onclick=()=>{const expanded=button.getAttribute('aria-expanded')==='true';list.querySelectorAll('li').forEach((li,i)=>li.hidden=!expanded?false:i>=4);button.setAttribute('aria-expanded',String(!expanded));button.textContent=expanded?'ดูบันทึกทั้งหมด +':'แสดงน้อยลง −';};list.after(button);}}).catch(e=>{document.querySelector('#changelog-list')!.textContent=e.message;});

// Preview animation is loaded only when its section approaches the viewport.
const previewCanvas=document.querySelector<HTMLCanvasElement>('#portal-hero-preview');
if(previewCanvas){
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const observer=new IntersectionObserver(async entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();
  try{const {mountPreview}=await import('../character-preview');const preview=mountPreview(previewCanvas,{motion:'idle',direction:'SE',hd:true,running:!reducedMotion.matches});
   await preview.ready;const visibility=new IntersectionObserver(entries=>preview.set({running:entries.some(e=>e.isIntersecting)&&!reducedMotion.matches}));visibility.observe(previewCanvas);
   reducedMotion.addEventListener('change',()=>preview.set({running:!reducedMotion.matches}));window.addEventListener('pagehide',event=>{if(!event.persisted){visibility.disconnect();preview.dispose();}});
  }catch{previewCanvas.hidden=true;const img=document.createElement('img');img.src='/assets/hero-painted/portrait-v1-7bfe3823a9.webp';img.alt='อาเธอร์ นักดาบแห่งทุ่งหญ้า';img.className='realm-portrait-fallback';previewCanvas.after(img);}
 },{rootMargin:'200px'});observer.observe(previewCanvas);
}
