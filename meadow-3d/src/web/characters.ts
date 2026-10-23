import '../pc-only';
import { characterNameError } from '@the-beginning-online/shared';

import statsData from "../../../shared/data/stats.json";

import'../web.css';import'../web-glass.css';import'./characters.css';import'../web-modern.css';import'../web-fantasy.css';import{api,post,showError,ApiError}from'./api';import{kindLabel,uidChip,mountBuild}from'./account-ui';import{requireLogin,mountAccountChip}from'./session';

/* Character identity is independent of weapon mastery. */
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const error=$('#character-error'),grid=$('#character-grid'),removeDialog=$<HTMLDialogElement>('#delete-dialog');
const selectScreen=$('#cs-select'),createScreen=$('#cs-create'),nameInput=$<HTMLInputElement>('#character-name');
window.tnBoot.stage(0);window.tnBoot.stage(1);window.tnBoot.stage(3);
let characters:any[]=[],selectedId='',deleteId='',currentGender:'male'|'female'='male';
const needsJob=(c:any)=>['villager','needs_job'].includes(c.jobId);
const MAP_TH:Record<string,string>={city_plaza:'นครที่ถูกลืมเลือน',meadow:'ทุ่งวุ้นจิ๋ว',forest:'ป่าหมอก',ruins:'ซากนครโบราณ',canyon:'หุบเขาหิน'};
const fmt=(n:number)=>Math.round(n).toLocaleString('en-US');
const ago=(date:string)=>{const m=Math.max(0,Math.round((Date.now()-new Date(date).getTime())/60000));return m<1?'เมื่อสักครู่':m<60?`${m} นาทีที่แล้ว`:m<1440?`${Math.round(m/60)} ชั่วโมงที่แล้ว`:new Intl.DateTimeFormat('th-TH',{dateStyle:'medium'}).format(new Date(date));};

const portrait=(gender:unknown)=>`/assets/hero-portraits-v1/${gender==='female'?'female':'male'}-full.webp`;
/* ---------- drifting light motes ---------- */
for(const c of document.querySelectorAll<HTMLCanvasElement>('.cs-fx')){
 const g=c.getContext('2d')!,P=Array.from({length:60},()=>({x:Math.random(),y:Math.random(),r:Math.random()*2+.6,v:Math.random()*.00045+.00015,w:Math.random()*6.28,a:Math.random()*.55+.2}));
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const tick=()=>{if(c.width!==c.clientWidth||c.height!==c.clientHeight){c.width=c.clientWidth;c.height=c.clientHeight;}g.clearRect(0,0,c.width,c.height);
  if(c.offsetParent)for(const p of P){if(!reduce){p.y-=p.v;p.w+=.02;p.x+=Math.sin(p.w)*.0002;if(p.y<-.02){p.y=1.02;p.x=Math.random();}}const x=p.x*c.width,y=p.y*c.height,grd=g.createRadialGradient(x,y,0,x,y,p.r*5);grd.addColorStop(0,`rgba(255,226,160,${p.a})`);grd.addColorStop(1,'rgba(255,226,160,0)');g.fillStyle=grd;g.beginPath();g.arc(x,y,p.r*5,0,6.28);g.fill();}
  requestAnimationFrame(tick);};requestAnimationFrame(tick);
}

/* ---------- select screen ---------- */
function showSelected(){
 const c=characters.find(x=>x.id===selectedId);
 $('#enter-world').toggleAttribute('disabled',!c);$('#delete-selected').toggleAttribute('disabled',!c);
 $('#sel-sheet').hidden=!c;selectScreen.classList.toggle('cs-empty',!c);
 if(!c){$('#sel-crest').innerHTML='';$('#sel-name').textContent='ยังไม่มีตัวละคร';$('#sel-where').textContent='สร้างนักผจญภัยคนแรกของคุณ';$('#enter-world').firstChild!.textContent='เข้าสู่โลก';return;}
 $('#sel-crest').textContent=(c.gender==='female'?'หญิง':'ชาย')+' · เล่นได้ทุกสายอาวุธ';
 $<HTMLImageElement>('#select-hero').src=portrait(c.gender);
 $('#sel-name').textContent=c.name;
 $('#sel-where').innerHTML='';const where=document.createElement('span');where.innerHTML=`กำลังผจญภัยที่ <b></b> · เล่นล่าสุด ${ago(c.lastPlayedAt)}`;where.querySelector('b')!.textContent=MAP_TH[c.mapId]||'นครที่ถูกลืมเลือน';$('#sel-where').append(where);
 $('#sel-lv').textContent=String(c.level);$('#sel-lvnote').innerHTML='ระดับนักผจญภัย';
 const need=statsData.expToNext[(c.level||1)-1]||1,xp=Math.min(1,(c.xp||0)/need);

 $('#sel-xp').style.width=xp*100+'%';$('#sel-xpt').textContent=(xp*100).toFixed(1)+'%';
 $('#sel-gold').textContent=fmt(c.gold||0);$('#sel-kills').textContent=fmt(c.kills||0);$('#sel-last').textContent=ago(c.lastPlayedAt);
 $('#enter-world').firstChild!.textContent='เข้าสู่โลก';
 grid.querySelectorAll<HTMLElement>('[data-id]').forEach(b=>b.classList.toggle('sel',b.dataset.id===selectedId));
}
async function refresh(){
 ({characters}=await api('/characters'));
 if(!characters.some(c=>c.id===selectedId))selectedId=[...characters].sort((a,b)=>+new Date(b.lastPlayedAt)-+new Date(a.lastPlayedAt))[0]?.id||'';
 grid.replaceChildren();
 for(let i=0;i<3;i++){const c=characters[i],card=document.createElement('button');card.type='button';
  if(c){card.className='cs-card';card.dataset.id=c.id;
   card.innerHTML=`<img class="art" alt=""><span class="info"><small></small><b></b></span><span class="lv">${c.level}<small>Lv</small></span>`;
   card.querySelector('img')!.src=portrait(c.gender);card.querySelector('small')!.textContent=`${c.gender==='female'?'หญิง':'ชาย'} · ${MAP_TH[c.mapId]||'นคร'}`;card.querySelector('b')!.textContent=c.name;
   card.onclick=()=>{selectedId=c.id;showSelected();};card.ondblclick=()=>enter();
  }else{card.className='cs-card empty';card.innerHTML=`<span><span class="plus">+</span><b>สร้างตัวละคร</b><small>ช่องว่าง ${i+1} / 3</small></span>`;card.onclick=()=>openCreate();}
  grid.append(card);}
 showSelected();

}
async function enter(){const c=characters.find(x=>x.id===selectedId);if(!c)return;
 const b=$<HTMLButtonElement>('#enter-world');b.disabled=true;try{if(needsJob(c))await post(`/characters/${c.id}/job`,{jobId:'swordsman'});await post(`/characters/${c.id}/select`);location.assign('/play.html');}catch(e){showError(error,e);b.disabled=false;}}
$('#enter-world').onclick=()=>void enter();
$('#delete-selected').onclick=()=>{const c=characters.find(x=>x.id===selectedId);if(!c)return;deleteId=c.id;$('#delete-name').textContent=c.name;removeDialog.showModal();};

/* ---------- create screen ---------- */
function showGender(gender:'male'|'female'){
 currentGender=gender;
 document.querySelectorAll<HTMLInputElement>('[name=gender]').forEach(r=>{r.checked=r.value===gender;r.closest('label')!.classList.toggle('sel',r.checked);});
 $<HTMLImageElement>('#create-preview').src=portrait(gender);
 $('#cr-th').textContent=gender==='female'?'นักผจญภัยหญิง':'นักผจญภัยชาย';
}
document.querySelectorAll<HTMLInputElement>('[name=gender]').forEach(r=>r.onchange=()=>showGender(r.value as 'male'|'female'));
function checkName(){
 const v=nameInput.value,n=[...v.normalize('NFC')].length,policy=characterNameError(v),ok=!policy,st=$('#name-state');
 $('#name-count').textContent=`${n} / 12`;st.className='cs-st '+(ok?'ok':'bad');
 st.querySelector('b')!.textContent=!v?'ใส่ชื่อ':ok?'✓ รูปแบบผ่าน':policy!.includes('สงวน')?'ชื่อสงวน':policy!.includes('ไม่เหมาะสม')?'คำไม่เหมาะสม':/\s/.test(v)?'ห้ามเว้นวรรค':n<2?'สั้นไป':n>12?'ยาวเกินไป':/^\p{Nd}+$/u.test(v)?'ต้องมีตัวอักษร':'ไทย/อังกฤษ/ตัวเลข';
 nameInput.setAttribute('aria-invalid',String(!!v&&!ok));
 st.title=ok?'รูปแบบผ่าน · ระบบจะตรวจชื่อซ้ำเมื่อสร้างตัวละคร':policy||'';
 $<HTMLButtonElement>('#create-submit').disabled=!ok;
}
nameInput.addEventListener('input',checkName);
const POOL=['ธารา','ภูผา','ลมหนาว','ดาวเหนือ','ไพลิน','อัคนี','สายฟ้า','ตะวัน','Kira','Ren','Mira'];
$('#name-dice').onclick=()=>{nameInput.value=POOL[Math.floor(Math.random()*POOL.length)]+(Math.random()<.5?'':String(Math.floor(Math.random()*90+10)));checkName();nameInput.focus();};
function show(screen:'select'|'create'){selectScreen.hidden=screen!=='select';createScreen.hidden=screen!=='create';}
function openCreate(){
 nameInput.value='';nameInput.disabled=false;$('#name-dice').hidden=false;
 $('#create-slot').textContent=`· ช่อง ${characters.length+1} / 3`;
 $('#create-error').hidden=true;showGender('male');checkName();show('create');nameInput.focus();
}
$('[data-back]').onclick=()=>show('select');
$<HTMLFormElement>('#create-form').onsubmit=async e=>{
 e.preventDefault();const button=$<HTMLButtonElement>('#create-submit');
 if(characterNameError(nameInput.value)){checkName();nameInput.focus();return;}button.disabled=true;
 try{const out=await post('/characters',{name:nameInput.value,gender:currentGender});selectedId=out?.character?.id||selectedId;show('select');await refresh();}
 catch(err){showError($('#create-error'),err);}finally{checkName();}
};

$<HTMLButtonElement>('#confirm-delete').onclick=async function(this:HTMLButtonElement){this.disabled=true;try{await api(`/characters/${deleteId}`,{method:'DELETE'});removeDialog.close();if(selectedId===deleteId)selectedId='';await refresh();}catch(e){showError(error,e);removeDialog.close();}finally{this.disabled=false;}};
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog')!.close());
// Change password (username accounts only). The server signs out every other device and re-issues this session.
function mountPassword(account:{kind:string;username?:string}){if(account.kind!=='password')return;const open=document.querySelector<HTMLButtonElement>('#change-password')!,d=document.querySelector<HTMLDialogElement>('#password-dialog')!,form=document.querySelector<HTMLFormElement>('#password-form')!,inputs=['current-password','new-password','confirm-new-password'].map(id=>document.getElementById(id) as HTMLInputElement),failure=document.querySelector<HTMLElement>('#password-error')!,done=document.querySelector<HTMLElement>('#password-done')!;
 document.querySelector<HTMLInputElement>('#password-username')!.value=account.username||'';open.hidden=false;
 const mark=(input:HTMLInputElement,message='')=>{const out=document.getElementById(input.id+'-error')!;out.textContent=message;out.hidden=!message;input.setAttribute('aria-invalid',String(!!message));return!message;};
 open.onclick=()=>{form.reset();failure.hidden=true;done.hidden=true;inputs.forEach(i=>mark(i));d.showModal();inputs[0].focus();};
 form.onsubmit=async e=>{e.preventDefault();failure.hidden=true;const[current,next,confirm]=inputs,ok=[mark(current,current.value?'':'กรุณากรอกรหัสผ่านปัจจุบัน'),mark(next,[...next.value].length>=8?'':'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว'),mark(confirm,confirm.value===next.value?'':'รหัสผ่านทั้งสองช่องไม่ตรงกัน')];if(ok.includes(false)){inputs[ok.indexOf(false)].focus();return;}
  const button=document.querySelector<HTMLButtonElement>('#password-submit')!;button.disabled=true;try{await post('/password',{currentPassword:current.value,newPassword:next.value,confirmPassword:confirm.value});form.reset();done.hidden=false;}catch(err){const field=err instanceof ApiError?{PASSWORD_WRONG:current,WEAK_PASSWORD:next,PASSWORD_MISMATCH:confirm}[err.code]:undefined;if(field){mark(field,(err as Error).message);field.focus();}else showError(failure,err);}finally{button.disabled=false;}};}
mountBuild();
void requireLogin().then(async me=>{if(!me)return;document.querySelector('#account-name')!.textContent=me.account.displayName;document.querySelector('#account-kind')!.textContent='· '+kindLabel(me.account.kind);document.querySelector('#account-uid')!.replaceChildren(uidChip(me.account.uid));mountPassword(me.account);document.querySelector<HTMLElement>('#link-note')!.hidden=me.account.kind!=='guest';await mountAccountChip();window.tnBoot.stage(2);await refresh();window.tnBoot.stage(4);}).catch(e=>{showError(error,e);window.tnBoot.fail('เปิดสมุดตัวละครไม่สำเร็จ กรุณาลองใหม่');});
