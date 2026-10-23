import './equipment-preview.css';
import {Ticker} from 'pixi.js';
import {CanvasAssets} from './game-2d-assets';
import {FULLBODY_MOTIONS,FullBodyHeroSheet,fullBodyLookKey,parseFullBodyManifest,fullBodyLayout,fullBodySheetData,drawFullBodyFrame,type FullBodyManifest,type FullBodyMotion,type HeroLook} from './fullbody-hero';
import {EquipmentPreviewSpells,previewBowPath,previewArrowPosition} from './equipment-preview-spells';

const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const assets=new CanvasAssets({});
let manifest:FullBodyManifest,look:HeroLook={outfit:'male',sword:'iron'},ready=false;
let motion:FullBodyMotion='idle',frame=0,playing=false,width=1,height=1,speed=1;
let layout={bodyHeight:0,x:0,feetY:0};
let sheet:FullBodyHeroSheet|undefined,sheetKey='';
let resume:{motion:FullBodyMotion;frame:number;playing:boolean}|undefined,completed=false;
const clipFor=(selection=look,pose=motion)=>manifest.looks[fullBodyLookKey(selection)].clips[pose];
const spells=new EquipmentPreviewSpells(),ticker=new Ticker();ticker.minFPS=10;
ticker.add(t=>{
 spells.advance(t.deltaMS/1000*speed);
 if(playing)sheet?.sprite.update(t);
 if(completed){
  completed=false;
  const previous=resume??{motion:'idle' as const,frame:0,playing:false};resume=undefined;
  ({motion,frame,playing}=previous);refresh();
 }
 draw();schedule();
});
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const canvas=$<HTMLCanvasElement>('#hero'),stage=$('#stage'),status=$('#status');
const ctx=canvas.getContext('2d');if(!ctx)throw Error('เบราว์เซอร์ไม่รองรับ Canvas 2D');
const context=ctx;
const samples:Array<{canvas:HTMLCanvasElement;button:HTMLButtonElement;look:HeroLook}>=[];
for(const outfit of ['male','female'] as const)for(const sword of ['iron','bow'] as const){
 const button=document.createElement('button'),sample=document.createElement('canvas'),label=document.createElement('span');
 const sampleLook={outfit,sword};button.className='combination';button.disabled=true;button.setAttribute('aria-pressed','false');
 sample.width=300;sample.height=280;sample.setAttribute('aria-hidden','true');button.append(sample,label);$('#combinations').append(button);
 button.onclick=()=>selectLook(sampleLook);samples.push({canvas:sample,button,look:sampleLook});
}
function resize(){
 spells.arrow=undefined;
 width=stage.clientWidth;height=stage.clientHeight;
 const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(width*dpr),h=Math.round(height*dpr);
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 if(manifest)layout=fullBodyLayout(manifest,width,height);
 context.setTransform(dpr,0,0,dpr,0,0);draw();
}
function draw(){
 context.clearRect(0,0,width,height);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
 if(!ready||!sheet)return;
 const clip=sheet.clip,{bodyHeight,x,feetY}=layout,scale=bodyHeight/1.9;
 const actor={id:'preview',x:0,z:0,fx:1,fz:0,castRemaining:motion==='cast'||motion==='heal'?1:0};
 const fx={ctx:context,width,height,dpr:1,scale,highQuality:true,reducedMotion:reducedMotion.matches,
  screen:(px:number,pz:number,h=0)=>({x:x+px*scale,y:feetY+pz*scale*.4-h*scale}),
  locate:(id:string)=>id==='preview'?actor:undefined,enemy:()=>undefined};
 spells.vfx.pre(fx,[actor],[],0);sheet.draw(context,x,feetY,bodyHeight);spells.vfx.post(fx,[actor],[],0);
 if(look.sword==='bow'){
  const path=previewBowPath(look.outfit,clipFor(look,'attack'),layout,width),arrow=spells.arrow;
  context.save();context.strokeStyle='#e7d9ae';context.lineWidth=1.5;
  for(const radius of [3,9]){context.beginPath();context.arc(path.to.x,path.to.y,radius,0,Math.PI*2);context.stroke();}
  if(arrow){
   const age=spells.vfx.time-arrow.at,point=previewArrowPosition(arrow,age/.28);
   if(age<.28){
    context.translate(point.x,point.y);context.rotate(point.angle);context.strokeStyle='#eddbb1';context.fillStyle='#fff3cd';context.lineWidth=2;
    context.beginPath();context.moveTo(-22,0);context.lineTo(0,0);context.stroke();
    context.beginPath();context.moveTo(0,0);context.lineTo(-7,-3);context.lineTo(-5,0);context.lineTo(-7,3);context.closePath();context.fill();
   }else{context.globalAlpha=1-(age-.28)/.2;context.beginPath();context.arc(arrow.to.x,arrow.to.y,4+(age-.28)*40,0,Math.PI*2);context.stroke();}
  }
  context.restore();
 }
 if($<HTMLInputElement>('#guides').checked){
  const s=bodyHeight/clip.bodyHeight;context.save();context.strokeStyle='#e2c68f';context.lineWidth=1;context.setLineDash([5,5]);
  context.strokeRect(x-clip.anchor[0]*s,feetY-clip.anchor[1]*s,clip.cell[0]*s,clip.cell[1]*s);
  context.beginPath();context.moveTo(0,feetY);context.lineTo(width,feetY);context.stroke();context.restore();
 }
}
function drawSamples(){
 if(!ready)return;
 for(const sample of samples){
  const c=sample.canvas.getContext('2d')!,clip=clipFor(sample.look);c.clearRect(0,0,300,280);
  drawFullBodyFrame(c,assets.get(clip.url)!,clip,Math.floor(frame/clipFor().frames*clip.frames),150,245,168);
 }
}
function drawReview(){
 if(!ready)return;
 const clip=clipFor(),review=$('#contact-sheet');review.replaceChildren();
 $('#review-caption').textContent=manifest.looks[fullBodyLookKey(look)].label+' · '+FULLBODY_MOTIONS[motion]+' · '+clip.frames+' เฟรม';
 for(let i=0;i<clip.frames;i++){
  const button=document.createElement('button'),image=document.createElement('canvas'),label=document.createElement('span');
  button.className='contact-frame';button.setAttribute('aria-label','ดูเฟรม '+(i+1));button.setAttribute('aria-pressed',String(i===frame));button.dataset.frame=String(i);
  image.width=300;image.height=280;image.setAttribute('aria-hidden','true');label.textContent=String(i+1).padStart(2,'0')+(i===clip.impactFrame?' · ปล่อยพลัง':'');
  drawFullBodyFrame(image.getContext('2d')!,assets.get(clip.url)!,clip,i,150,245,168);
  button.append(image,label);button.onclick=()=>seek(i);review.append(button);
 }
}
function refresh(){
 if(!ready)return;
 const clip=clipFor(),key=fullBodyLookKey(look)+'/'+motion;frame=Math.min(frame,clip.frames-1);
 if(key!==sheetKey){
  const next=new FullBodyHeroSheet(assets.get(clip.url)!,clip);next.sprite.gotoAndStop(frame);
  sheet?.destroy();sheet=next;sheetKey=key;sheet.sprite.animationSpeed=speed;
  sheet.sprite.loop=motion!=='cast'&&motion!=='heal';sheet.sprite.onComplete=()=>{completed=true;};
  sheet.sprite.onFrameChange=current=>{
   if(playing){
    const path=look.sword==='bow'?previewBowPath(look.outfit,clip,layout,width):undefined,attacks=spells.attacks;
    const scale=layout.bodyHeight/1.9;
    spells.target=path?{x:(path.to.x-layout.x)/scale,z:(path.to.y-layout.feetY+.8*scale)/(scale*.4)}:{x:1.1,z:0};
    const effect=spells.frame(motion,look.sword,frame,current,$<HTMLInputElement>('#auto-spell').checked,clip.impactFrame);
    if(path&&spells.attacks>attacks)spells.shoot(path);
    $('#attack-count').textContent=String(spells.attacks);$('#proc-count').textContent=String(spells.procs);
    if(effect)$('#spell-status').textContent=effect==='auto'?'Auto Spell · ไฟทำงานพร้อมโจมตี':effect==='heal'?'ฟื้นฟู · พลังฮีลรอบตัว':'ร่ายเวท · ปล่อยไฟ';
   }
   frame=current;updateMotionControls();drawSamples();
  };
  drawReview();schedule();
 }
 document.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.outfit===look.outfit)));
 document.querySelectorAll<HTMLButtonElement>('[data-sword]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sword===look.sword)));
 const caption=manifest.looks[fullBodyLookKey(look)].label;$('#look-caption').textContent=caption;canvas.setAttribute('aria-label',caption+' · '+FULLBODY_MOTIONS[motion]);
 for(const sample of samples){
  const name=manifest.looks[fullBodyLookKey(sample.look)].label;sample.button.setAttribute('aria-label',name);sample.button.lastElementChild!.textContent=name;
  sample.button.setAttribute('aria-pressed',String(fullBodyLookKey(sample.look)===fullBodyLookKey(look)));
 }
 updateMotionControls();draw();drawSamples();
}
function selectLook(next:HeroLook){
 if(fullBodyLookKey(next)===fullBodyLookKey(look))return;
 spells.arrow=undefined;
 // Each authored look can have a different contact frame; a new look starts a new attack cycle.
 frame=motion==='attack'?0:Math.floor(frame/clipFor().frames*clipFor(next).frames);
 if(resume)resume.frame=resume.motion==='attack'?0:Math.floor(resume.frame/clipFor(look,resume.motion).frames*clipFor(next,resume.motion).frames);
 look=next;refresh();
}
document.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach(b=>b.onclick=()=>selectLook({...look,outfit:b.dataset.outfit as HeroLook['outfit']}));
document.querySelectorAll<HTMLButtonElement>('[data-sword]').forEach(b=>b.onclick=()=>selectLook({...look,sword:b.dataset.sword as HeroLook['sword']}));
document.querySelectorAll<HTMLButtonElement>('button[data-background]').forEach(button=>button.onclick=()=>{
 stage.dataset.background=button.dataset.background;
 document.querySelectorAll<HTMLButtonElement>('button[data-background]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
});
$<HTMLInputElement>('#guides').onchange=draw;
function updateMotionControls(){
 if(!ready)return;
 const clip=clipFor(),count=String(clip.frames).padStart(2,'0'),current=String(frame+1).padStart(2,'0');
 document.querySelectorAll<HTMLButtonElement>('[data-motion],[data-spell]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.motion??b.dataset.spell)===motion)));
 const range=$<HTMLInputElement>('#motion-frame');range.max=String(clip.frames-1);range.value=String(frame);range.disabled=clip.frames===1;
 $('#frame-label').textContent=current+' / '+count;$('#pose-caption').textContent=FULLBODY_MOTIONS[motion]+' / SE · '+current+' / '+count;
 const toggle=$<HTMLButtonElement>('#play-motion');toggle.textContent=playing?'หยุด':'เล่น';toggle.setAttribute('aria-label',playing?'หยุดแอนิเมชัน':'เล่นแอนิเมชัน');toggle.disabled=clip.frames===1;
 for(const selector of ['#previous-frame','#next-frame'])$<HTMLButtonElement>(selector).disabled=clip.frames===1;
 document.querySelectorAll<HTMLButtonElement>('[data-frame]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.frame)===frame)));
}
function schedule(){
 const active=ready&&!document.hidden;
 if(playing&&active)sheet?.sprite.play();else sheet?.sprite.stop();
 if(active&&(playing||spells.vfx.effects.length||spells.arrow))ticker.start();else ticker.stop();
}
function seek(next:number){
 playing=false;const clip=clipFor();frame=(next+clip.frames)%clip.frames;sheet?.sprite.gotoAndStop(frame);
 schedule();updateMotionControls();draw();drawSamples();
}
document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b=>b.onclick=()=>{
 resume=undefined;completed=false;motion=b.dataset.motion as FullBodyMotion;frame=0;playing=clipFor().frames>1;
 sheetKey='';refresh();schedule();
});
document.querySelectorAll<HTMLButtonElement>('[data-spell]').forEach(b=>b.onclick=()=>{
 resume??={motion,frame,playing};motion=b.dataset.spell as 'cast'|'heal';frame=0;playing=true;completed=false;
 sheetKey='';spells.start(motion);$('#spell-status').textContent=motion==='heal'?'กำลังฮีล…':'กำลังร่ายเวท…';refresh();schedule();
});
$<HTMLInputElement>('#auto-spell').onchange=e=>{$('#spell-status').textContent=(e.target as HTMLInputElement).checked?'เปิด Auto Spell · กดโจมตีเพื่อทดลอง':'ปิด Auto Spell';};
document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b=>b.onclick=()=>{
 speed=Number(b.dataset.speed);if(sheet)sheet.sprite.animationSpeed=speed;
 document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button=>button.setAttribute('aria-pressed',String(button===b)));
});
$('#play-motion').onclick=()=>{playing=!playing;updateMotionControls();schedule();};
$('#previous-frame').onclick=()=>seek(frame-1);$('#next-frame').onclick=()=>seek(frame+1);
$<HTMLInputElement>('#motion-frame').oninput=e=>seek(Number((e.target as HTMLInputElement).value));
document.addEventListener('visibilitychange',schedule);window.addEventListener('pagehide',()=>ticker.stop());window.addEventListener('pageshow',schedule);
function dispose(){observer.disconnect();ticker.destroy();sheet?.destroy();sheet=undefined;}
if(import.meta.hot)import.meta.hot.dispose(dispose);
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches){playing=false;schedule();updateMotionControls();}});
const observer=new ResizeObserver(resize);observer.observe(stage);
async function load(){
 status.classList.remove('error');status.textContent='กำลังโหลดเฟรมตัวละครทั้งตัว…';
 try{
  manifest=parseFullBodyManifest(await assets.json('/assets/hero-shadow-v1/manifest.json'));
  layout=fullBodyLayout(manifest,width,height);
  const clips=Object.values(manifest.looks).flatMap(look=>Object.values(look.clips));
  await Promise.all([...new Set(clips.map(clip=>clip.url))].map(url=>assets.image(url)));
  for(const clip of clips){const image=assets.get(clip.url)!;fullBodySheetData(clip,image.naturalWidth,image.naturalHeight);}
  ready=true;refresh();
  document.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button:disabled,input:disabled').forEach(control=>control.disabled=false);updateMotionControls();
  status.textContent='พร้อมตรวจการเคลื่อนไหว · เล่นที่ความเร็วปกติหรือช้า 0.25× แล้วดูทุกเฟรมด้านล่าง';
 }catch(error){
  ready=false;sheet?.destroy();sheet=undefined;sheetKey='';schedule();draw();
  console.error('Full-body preview failed',error);
  status.classList.add('error');status.textContent='ชุดเฟรมตัวละครยังไม่พร้อม หรือโหลดภาพไม่ครบ กรุณาลองอีกครั้ง';
  const retry=document.createElement('button');retry.textContent='โหลดใหม่';retry.onclick=()=>void load();status.append(retry);
 }
}
void load();
