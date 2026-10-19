import {mountPartyCamp,paintPartyPortrait} from './party-camp';
import jobs from '../../shared/data/jobs.json';
import './party.css';
export interface PartyMember {id:string;name:string;online:boolean;level?:number;jobId?:string;hp?:number;maxHp?:number;mp?:number;maxMp?:number;mapId?:string;dead?:boolean}
interface OnlinePlayer{id:string;name:string;level:number;jobId:string;status:'available'|'invited'|'party'}
export interface PartyState {id:string;leader:string;members:PartyMember[]}
const maps:Record<string,string>={city_plaza:'นครที่ถูกลืมเลือน',meadow:'ทุ่งวุ้นจิ๋ว',forest:'ป่าหมอก',ruins:'ซากนครโบราณ',canyon:'หุบเขาหิน'};
const ratio=(value=0,max=0)=>Number.isFinite(value)&&Number.isFinite(max)&&max>0?Math.max(0,Math.min(1,value/max)):0;
const number=(n=0)=>Number.isFinite(n)?Math.max(0,Math.ceil(n)):0;
const glyph=(job='swordsman')=>{
 const paths:Record<string,string>={swordsman:'<path d="m5 3 15 15-2 2L3 5V3h2Zm14 0h2v2l-5 5M4 15l5 5M2 22l5-5M15 4l5 5M17 17l5 5"/>',archer:'<path d="M5 3c17 2 17 16 0 18L5 3Zm0 0 8 9-8 9M2 12h19m-3-3 3 3-3 3"/>',mage:'<path d="m5 21 12-12m-4-2 4-4 4 4-4 4-4-4ZM4 3v4M2 5h4M17 16v4m-2-2h4"/>',healer:'<path d="M9 3h6M10 3v6l-5 8a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-8V3M8 14h8M11 16v3m-1-2h3"/>',shaman:'<path d="M12 3v18M8 5l4 4 4-4M6 12l6 5 6-5M8 21h8"/>',boxer:'<path d="M5 12V8a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v6l-4 6H8l-5-7a2 2 0 0 1 2-2Z"/>',rogue:'<path d="M4 3h8l8 8-9 9-7-7V3Zm4 4 9 9M8 20l-4 2M3 17l4 4"/>'};
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[job]??paths.swordsman}</svg>`;
};
export function mountParty(o:{send:(m:unknown)=>void;you:()=>string;enabled:()=>boolean;onOpen?:()=>void;chat:()=>void}){
 const ui=document.querySelector('#ui')!;
 const frame=document.createElement('section');frame.id='party-frame';frame.hidden=true;frame.ariaLabel='สมาชิกปาร์ตี้';
 frame.innerHTML='<header><button type="button" class="party-manage"><i aria-hidden="true">◇</i> ปาร์ตี้ <span></span><small>จัดการ</small></button><button type="button" class="party-collapse" aria-label="ย่อรายชื่อปาร์ตี้" aria-expanded="true">⌃</button></header><ul></ul>';
 const invites=document.createElement('div');invites.id='party-invites';ui.append(frame,invites);
 const panel=document.createElement('dialog');panel.id='party-window';panel.setAttribute('aria-labelledby','party-heading');
 panel.innerHTML=`<button type="button" class="close" aria-label="ปิดปาร์ตี้">×</button>
 <header class="party-head"><div class="party-emblem" aria-hidden="true"><svg viewBox="0 0 56 64" fill="none"><defs><linearGradient id="party-crest-rim" x1="8" y1="5" x2="47" y2="60" gradientUnits="userSpaceOnUse"><stop stop-color="#ffedb1"/><stop offset=".26" stop-color="#cfaa60"/><stop offset=".52" stop-color="#f5da90"/><stop offset="1" stop-color="#956433"/></linearGradient><linearGradient id="party-crest-jade" x1="15" y1="9" x2="41" y2="55" gradientUnits="userSpaceOnUse"><stop stop-color="#426b57"/><stop offset=".5" stop-color="#1b453d"/><stop offset="1" stop-color="#0c292c"/></linearGradient><linearGradient id="party-crest-hero" x1="23" y1="20" x2="34" y2="45" gradientUnits="userSpaceOnUse"><stop stop-color="#fff0be"/><stop offset="1" stop-color="#c6a663"/></linearGradient></defs><path d="M28 3C21 8 13 9 6 10v19c0 15 10 25 22 32 12-7 22-17 22-32V10C43 9 35 8 28 3Z" fill="#071e23" stroke="#07191f" stroke-width="3"/><path d="M28 4C21 9 13 10 7 11v18c0 14 9 24 21 31 12-7 21-17 21-31V11C43 10 35 9 28 4Z" fill="url(#party-crest-rim)"/><path d="M28 8c-6 4-12 5-17 6v15c0 11 7 20 17 27 10-7 17-16 17-27V14c-5-1-11-2-17-6Z" fill="url(#party-crest-jade)"/><path d="M13 17v11c0 10 6 18 15 25" stroke="#e4c887" stroke-opacity=".28" stroke-linecap="round"/><path d="M16 16c4-1 8-2 12-5 4 3 8 4 12 5" stroke="#c2d4ae" stroke-opacity=".35" stroke-linecap="round"/><circle cx="17" cy="28" r="3.5" fill="#89b99b"/><circle cx="39" cy="28" r="3.5" fill="#89b99b"/><path d="M12 39v-2a5 5 0 0 1 9-3v7h-7a2 2 0 0 1-2-2ZM44 39v-2a5 5 0 0 0-9-3v7h7a2 2 0 0 0 2-2Z" fill="#79a98e"/><circle cx="28" cy="23" r="4.6" fill="url(#party-crest-hero)"/><path d="M20.5 40v-3a7.5 7.5 0 0 1 15 0v3a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3Z" fill="url(#party-crest-hero)"/><path d="M25 47h6" stroke="#c4a76b" stroke-width="1.5" stroke-linecap="round"/></svg></div><div><small>THE WAYFARERS' CAMP</small><h2 id="party-heading">ค่ายพักของเพื่อนร่วมทาง</h2><p class="party-summary">พบเพื่อนร่วมทาง แล้วออกผจญภัยไปด้วยกัน</p></div><span class="party-capacity"></span></header>
 <div class="party-camp-layout"><main class="party-camp-main"><section class="party-camp-scene" aria-label="ค่ายพัก"><div class="camp-caption"><span>ใต้แสงไฟเดียวกัน</span><small>ทุกการเดินทาง เริ่มจากเพื่อนร่วมทาง</small></div><small class="camp-art-note">ตัวละครจากโลกไทยเนทีฟ</small></section>
 <div class="party-list-heading"><span>เพื่อนร่วมทาง <small>สมาชิกสูงสุด 6 คน</small></span><small><i></i> อัปเดตสด</small></div><section class="party-roster" aria-label="รายชื่อสมาชิก 6 ช่อง"></section>
 <section class="party-empty"><div aria-hidden="true">◇</div><h3>จุดเริ่มต้นของการเดินทางร่วมกัน</h3><p>สร้างปาร์ตี้ หรือส่งคำเชิญให้เพื่อนคนแรก</p><button type="button" id="party-create">＋ สร้างปาร์ตี้</button></section></main>
 <aside class="party-camp-sidebar"><div class="camp-side-title"><small>GATHER YOUR COMPANIONS</small><h3>ชวนเพื่อนร่วมทาง</h3><p>เว้นที่รอบกองไฟไว้ให้เพื่อนของคุณ</p></div><section class="party-online"><header><h3>ผู้เล่นในแมพนี้ <span class="online-count">0</span></h3><button type="button" class="online-refresh" aria-label="รีเฟรชผู้เล่นออนไลน์">↻</button></header><p class="online-location">แมพเดียวกัน · CH เดียวกัน</p><ul class="party-online-list" aria-label="ผู้เล่นออนไลน์ในแมพและ CH เดียวกัน"></ul><p class="online-note" role="status">เปิดหน้าต่างเพื่อโหลดรายชื่อ</p></section><form class="party-invite-form" autocomplete="off"><label for="party-invite-name">ชื่อตัวละคร</label><div><input id="party-invite-name" maxlength="24" placeholder="ชื่อตัวละครที่ออนไลน์" required><button type="submit">＋ ส่งคำเชิญ</button></div><small class="party-invite-hint"></small></form><p class="party-feedback" role="status"></p>
 <section class="camp-policy"><div class="camp-policy-heading"><span>◇</span><h3>ร่วมทาง เติบโตไปด้วยกัน</h3></div><div class="camp-bonus"><strong>+10%</strong><span>โบนัส EXP รวม<br><small>ต่อสมาชิกที่มีสิทธิ์เพิ่มขึ้น 1 คน</small></span></div><p>แบ่ง EXP เท่ากันกับสมาชิกที่ออนไลน์และยังมีชีวิต ในแมพเดียวกันและ CH เดียวกัน</p><span class="camp-distance">↔ ไม่จำกัดระยะห่าง</span><small>6 คน รับโบนัสรวมสูงสุด +50%<br>ก่อนแบ่ง EXP ให้สมาชิกที่มีสิทธิ์</small></section>
 <div class="party-confirm" hidden></div><footer class="party-footer"><button type="button" id="party-chat">แชทปาร์ตี้ ↗</button><button type="button" id="party-leave">ออกจากปาร์ตี้</button><button type="button" id="party-disband">ยุบปาร์ตี้</button></footer><details class="party-rules"><summary>เมื่อเพื่อนหลุดการเชื่อมต่อ</summary><p>คงที่ในปาร์ตี้ไว้ 5 นาทีเพื่อกลับเข้ามา ระหว่างออฟไลน์จะไม่ถูกนับรับส่วนแบ่ง EXP และโบนัส</p></details></aside></div><div class="camp-bottom-note"><span>◇</span> ร่วมต่อสู้ ร่วมเติบโต และกลับมาพบกันที่กองไฟ</div>`;
 document.body.append(panel);
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>panel.querySelector<T>(s)!;
 const roster=$('.party-roster'),form=$<HTMLFormElement>('.party-invite-form'),input=$<HTMLInputElement>('#party-invite-name'),feedback=$('.party-feedback'),confirmBox=$('.party-confirm');
 let state:PartyState|null=null,structure='',lastInvite=0,onlineLoaded=false,onlineKey='';
 let onlinePlayers:OnlinePlayer[]=[];
 const cards=new Map<string,{card:HTMLElement;until:number}>();
 const button=(text:string,click:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;};
 function send(op:string,extra:Record<string,string>={}){if(!o.enabled())return;feedback.textContent='';o.send({t:'party',op,...extra});}
 const camp=mountPartyCamp($('.party-camp-scene'),()=>panel.open,o.you,()=>{if(state&&state.leader!==o.you())return;input.focus();});
 function open(){if(!o.enabled())return;document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>{if(d!==panel)d.close();});o.onOpen?.();if(!panel.open)panel.showModal();onlineLoaded=false;onlinePlayers=[];onlineKey='';drawOnline();send('status');send('online');draw();camp.refresh();}
 frame.querySelector<HTMLButtonElement>('.party-manage')!.onclick=open;
 const collapse=frame.querySelector<HTMLButtonElement>('.party-collapse')!;
 function setCollapsed(on:boolean){frame.classList.toggle('is-collapsed',on);collapse.setAttribute('aria-expanded',String(!on));collapse.ariaLabel=on?'ขยายรายชื่อปาร์ตี้':'ย่อรายชื่อปาร์ตี้';collapse.textContent=on?'⌄':'⌃';}
 setCollapsed(matchMedia('(max-width:650px)').matches);collapse.onclick=()=>setCollapsed(!frame.classList.contains('is-collapsed'));
 panel.querySelector<HTMLButtonElement>('.close')!.onclick=()=>panel.close();
 panel.addEventListener('close',()=>{confirmBox.hidden=true;confirmBox.replaceChildren();});
 function confirm(text:string,label:string,action:()=>void){
  const previous=document.activeElement as HTMLElement;confirmBox.replaceChildren();confirmBox.setAttribute('role','alertdialog');confirmBox.setAttribute('aria-label',text);const p=document.createElement('p');p.textContent=text;
  const close=()=>{confirmBox.hidden=true;previous?.isConnected&&previous.focus();};const yes=button(label,()=>{action();close();}),cancel=button('ยกเลิก',close);confirmBox.append(p,yes,cancel);confirmBox.hidden=false;cancel.focus();
  confirmBox.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){e.preventDefault();(document.activeElement===yes?cancel:yes).focus();}};
 }
 $('#party-create').onclick=()=>send('create');
 $('#party-leave').onclick=()=>confirm('ออกจากปาร์ตี้นี้หรือไม่?','ยืนยันออก',()=>send('leave'));
 $('#party-disband').onclick=()=>confirm('ยุบปาร์ตี้และยกเลิกคำเชิญทั้งหมดหรือไม่?','ยืนยันยุบปาร์ตี้',()=>send('disband'));
 $('#party-chat').onclick=()=>{panel.close();o.chat();};
 $('.online-refresh').onclick=()=>send('online');
 setInterval(()=>{if(panel.open&&!document.hidden&&o.enabled())send('online');},4000);
 function drawOnline(){
  const canInvite=!state||state.leader===o.you(),full=(state?.members.length??0)>=6;
  const visible=onlinePlayers.filter(p=>!state?.members.some(m=>m.id===p.id));
  $('.online-count').textContent=String(visible.length);
  $('.online-note').textContent=!onlineLoaded?'กำลังโหลดรายชื่อ…':!canInvite?'หัวหน้าปาร์ตี้เป็นผู้ส่งคำเชิญ':full?'ปาร์ตี้เต็มแล้ว':visible.length?'อัปเดตทุก 4 วินาที · คำเชิญมีอายุ 60 วินาที':'ยังไม่มีผู้เล่นอื่นในแมพและ CH นี้';
  const key=JSON.stringify([onlineLoaded,canInvite,full,visible]);if(key===onlineKey)return;onlineKey=key;
  const list=$('.party-online-list');list.replaceChildren();
  for(const p of visible){
   const row=document.createElement('li'),icon=document.createElement('i'),info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');
   icon.className='online-job';icon.innerHTML=glyph(p.jobId);name.textContent=p.name;meta.textContent=`Lv.${p.level} · ${jobs.jobs.find(j=>j.id===p.jobId)?.nameTh??'ผู้กล้า'}`;info.append(name,meta);
   const invite=button(p.status==='party'?'มีปาร์ตี้':p.status==='invited'?'ส่งแล้ว':'เชิญ',()=>{if(!canInvite||full||p.status!=='available')return;p.status='invited';drawOnline();send('inviteNearby',{id:p.id});feedback.textContent=`กำลังเชิญ ${p.name}…`;send('online');});
   invite.ariaLabel=(p.status==='available'?'เชิญ ':'สถานะ ')+p.name;invite.disabled=!canInvite||full||p.status!=='available';row.append(icon,info,invite);list.append(row);
  }
 }
 form.onsubmit=e=>{e.preventDefault();const name=input.value.trim();if(!name||Date.now()-lastInvite<800)return;lastInvite=Date.now();send('invite',{name});feedback.textContent=`กำลังส่งคำเชิญให้ ${name}…`;};
 function memberCard(m:PartyMember,compact=false){
  const card=document.createElement(compact?'li':'article');card.className='party-member';card.dataset.member=m.id;
  const icon=document.createElement('div');icon.className='party-job';icon.innerHTML=glyph(m.jobId);icon.title=jobs.jobs.find(j=>j.id===m.jobId)?.nameTh??'ผู้กล้า';
  const content=document.createElement('div');content.className='party-member-info';
  const heading=document.createElement('div');heading.className='party-member-heading';
  const name=document.createElement('strong');name.className='party-name';name.textContent=m.name;heading.append(name);
  if(m.id===state?.leader){const badge=document.createElement('small');badge.className='party-leader';badge.textContent=compact?'♛':'หัวหน้าปาร์ตี้';badge.title='หัวหน้าปาร์ตี้';heading.append(badge);}
  if(m.id===o.you()){const you=document.createElement('small');you.className='party-you';you.textContent='คุณ';heading.append(you);}
  const status=document.createElement('small');status.className='party-presence';heading.append(status);
  const meta=document.createElement('small');meta.className='party-meta';
  content.append(heading,meta);
  for(const kind of ['hp','mp']){const bar=document.createElement('div');bar.className='party-vital party-'+kind;bar.setAttribute('role','progressbar');bar.ariaLabel=(kind==='hp'?'HP ':'MP ')+m.name;bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.innerHTML=`<small>${kind.toUpperCase()}</small><b class="party-track"><i></i></b><span class="party-value"></span>`;content.append(bar);}
  if(!compact){const portrait=document.createElement('div');portrait.className='party-portrait';const canvas=document.createElement('canvas');portrait.append(canvas);paintPartyPortrait(canvas,m);card.append(portrait);}
  card.append(icon,content);
  if(!compact&&state?.leader===o.you()&&m.id!==o.you()){
   const actions=document.createElement('div');actions.className='party-member-actions';actions.hidden=true;
   const more=button('⋯',()=>{const on=actions.hidden;roster.querySelectorAll<HTMLElement>('.party-member-actions').forEach(a=>a.hidden=true);roster.querySelectorAll('[data-more]').forEach(b=>b.setAttribute('aria-expanded','false'));actions.hidden=!on;more.setAttribute('aria-expanded',String(on));});more.className='party-more';more.dataset.more='true';more.ariaLabel='จัดการ '+m.name;more.setAttribute('aria-expanded','false');card.append(more);
   const lead=button('ส่งหัวหน้า',()=>confirm(`ส่งหัวหน้าปาร์ตี้ให้ ${m.name}?`,'ยืนยันส่งหัวหน้า',()=>send('lead',{id:m.id})));lead.dataset.lead='true';lead.ariaLabel='ส่งหัวหน้าให้ '+m.name;
   const kick=button('เชิญออก',()=>confirm(`เชิญ ${m.name} ออกจากปาร์ตี้?`,'ยืนยันเชิญออก',()=>send('kick',{id:m.id})));kick.ariaLabel='เชิญ '+m.name+' ออกจากปาร์ตี้';actions.append(lead,kick);card.append(actions);
  }
  return card;
 }
 function update(card:HTMLElement,m:PartyMember){
  card.classList.toggle('offline',!m.online);card.classList.toggle('dead',!!m.dead);card.classList.toggle('me',m.id===o.you());
  const status=card.querySelector<HTMLElement>('.party-presence')!;status.textContent=!m.online?'ออฟไลน์':m.dead?'หมดสติ':'ออนไลน์';
  card.querySelector('.party-meta')!.textContent=m.online?`Lv.${m.level??'?'} · ${jobs.jobs.find(j=>j.id===m.jobId)?.nameTh??'ผู้กล้า'} · ${maps[m.mapId??'']??'ต่างแผนที่'}${m.dead?' · หมดสติ':''}`:'ออฟไลน์ · รอกลับเข้ามา';
  for(const [kind,value,max]of [['hp',m.hp,m.maxHp],['mp',m.mp,m.maxMp]]as const){const bar=card.querySelector<HTMLElement>('.party-'+kind)!;const r=m.online?ratio(value,max):0;bar.style.setProperty('--fill',String(r));bar.setAttribute('aria-valuenow',String(Math.round(r*100)));bar.querySelector('.party-value')!.textContent=m.online?(card.tagName==='LI'?`${Math.round(r*100)}%`:`${number(value)} / ${number(max)}`):'—';}
  const lead=card.querySelector<HTMLButtonElement>('[data-lead]');if(lead)lead.disabled=!m.online;
 }
 function draw(){
  const leader=state?.leader===o.you(),members=state?.members??[];
  $('.party-summary').textContent=state?`${members.length} / 6 คน · ${leader?'คุณเป็นหัวหน้าปาร์ตี้':'ร่วมทางไปด้วยกัน'}`:'ออกล่าเป็นกลุ่ม สูงสุด 6 คน';
  $('.party-capacity').textContent=`${members.length} / 6`;
  $('.party-empty').hidden=!!state;form.hidden=!!state&&!leader;
  form.querySelector<HTMLButtonElement>('button')!.disabled=members.length>=6;
  $('.party-invite-hint').textContent=members.length>=6?'ปาร์ตี้เต็มแล้ว':state?'คำเชิญมีอายุ 60 วินาที · หัวหน้าปาร์ตี้เป็นผู้เชิญ':'ส่งคำเชิญเพื่อสร้างปาร์ตี้และชวนเพื่อนพร้อมกันได้';
  $('.party-footer').hidden=!state;$('#party-disband').hidden=!leader;
  const next=JSON.stringify([state?.id,state?.leader,...members.map(m=>[m.id,m.name,m.jobId])]);
  if(next!==structure){structure=next;confirmBox.hidden=true;roster.replaceChildren(...members.map(m=>memberCard(m)),...Array.from({length:Math.max(0,6-members.length)},(_,i)=>{const slot=document.createElement('button');slot.type='button';slot.className='party-empty-slot';slot.ariaLabel='เชิญสมาชิก ช่องที่ '+(members.length+i+1);slot.innerHTML='<span>＋</span><strong>รอเพื่อนร่วมทาง</strong><small>ชวนเพื่อนมาออกผจญภัย</small>';slot.disabled=!!state&&!leader;slot.onclick=()=>{input.focus();};return slot;}));frame.querySelector('ul')!.replaceChildren(...members.map(m=>memberCard(m,true)));}
  camp.update(state);drawOnline();
  frame.hidden=!state;frame.querySelector('header span')!.textContent=`${members.length}/6`;
  for(const card of [...roster.children,...frame.querySelector('ul')!.children]){const member=members.find(m=>m.id===(card as HTMLElement).dataset.member);if(member)update(card as HTMLElement,member);}
 }
 function closeInvite(id:string){const old=cards.get(id);old?.card.remove();cards.delete(id);}
 function invitation(m:{partyId:string;from:string;expiresAt?:number}){
  closeInvite(m.partyId);if(cards.size>=6)closeInvite(cards.keys().next().value!);
  const card=document.createElement('section');card.className='party-invite';card.setAttribute('role','group');card.ariaLabel='คำเชิญปาร์ตี้จาก '+m.from;
  const text=document.createElement('p');text.textContent=m.from+' ชวนเข้าปาร์ตี้';const timer=document.createElement('small');timer.className='party-invite-timer';
  card.append(text,timer,button('เข้าร่วม',()=>{send('accept',{id:m.partyId});closeInvite(m.partyId);}),button('ปฏิเสธ',()=>{send('decline',{id:m.partyId});closeInvite(m.partyId);}));
  const until=m.expiresAt??Date.now()+60000;cards.set(m.partyId,{card,until});invites.append(card);tick();
 }
 function tick(){for(const[id,entry]of cards){const left=Math.ceil((entry.until-Date.now())/1000);if(left<=0){closeInvite(id);continue;}entry.card.querySelector('.party-invite-timer')!.textContent=left+' วินาที';}}
 setInterval(tick,1000);
 draw();
 return {open,invite:(name:string)=>send('invite',{name}),receive(m:any){
  if(m.t==='partyOnline'){onlinePlayers=m.list;onlineLoaded=true;$('.online-location').textContent=`${maps[m.mapId]??'แมพปัจจุบัน'} · CH เดียวกัน`;drawOnline();return true;}
  if(m.t==='partyState'){const before=JSON.stringify([state?.id,state?.leader,state?.members.map(m=>m.id)]);state=m.party;if(before!==JSON.stringify([state?.id,state?.leader,state?.members.map(m=>m.id)]))feedback.textContent='';if(state)for(const id of cards.keys())closeInvite(id);draw();return true;}
  if(m.t==='partyInvite'){invitation(m);return true;}
  if(m.t==='partyInviteClosed'){closeInvite(m.partyId);return true;}
  if(m.t==='chatError'&&m.scope==='party')feedback.textContent=m.text;
  if(m.t==='chat'&&m.ch==='system'&&panel.open)feedback.textContent=m.text;
  return false;
 }};
}
