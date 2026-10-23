import {mountPartyCamp,paintPartyAvatar,paintPartyPortrait} from './party-camp';
import {ATLAS_REGIONS} from './world-atlas';
import jobs from '../../shared/data/jobs.json';
import './party.css';
export interface PartyMember {id:string;name:string;online:boolean;level?:number;jobId?:string;hp?:number;maxHp?:number;mp?:number;maxMp?:number;mapId?:string;dead?:boolean}
interface OnlinePlayer{id:string;name:string;level:number;jobId:string;status:'available'|'invited'|'party'}
export interface PartyState {id:string;leader:string;members:PartyMember[]}
const mapName=(id='')=>ATLAS_REGIONS.find(r=>r.mapId===id)?.name??'ต่างแผนที่';
const jobName=(id='')=>jobs.jobs.find(j=>j.id===id)?.nameTh??'ผู้กล้า';
const ratio=(value=0,max=0)=>Number.isFinite(value)&&Number.isFinite(max)&&max>0?Math.max(0,Math.min(1,value/max)):0;
const number=(n=0)=>Number.isFinite(n)?Math.max(0,Math.ceil(n)).toLocaleString('en-US'):'0';
const INVITE_MS=60000;
const glyph=(job='swordsman')=>{
 const paths:Record<string,string>={swordsman:'<path d="m5 3 15 15-2 2L3 5V3h2Zm14 0h2v2l-5 5M4 15l5 5M2 22l5-5M15 4l5 5M17 17l5 5"/>',archer:'<path d="M5 3c17 2 17 16 0 18L5 3Zm0 0 8 9-8 9M2 12h19m-3-3 3 3-3 3"/>',mage:'<path d="m5 21 12-12m-4-2 4-4 4 4-4 4-4-4ZM4 3v4M2 5h4M17 16v4m-2-2h4"/>',healer:'<path d="M9 3h6M10 3v6l-5 8a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-5-8V3M8 14h8M11 16v3m-1-2h3"/>',shaman:'<path d="M12 3v18M8 5l4 4 4-4M6 12l6 5 6-5M8 21h8"/>',boxer:'<path d="M5 12V8a2 2 0 0 1 4 0V5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a2 2 0 0 1 4 0v6l-4 6H8l-5-7a2 2 0 0 1 2-2Z"/>',rogue:'<path d="M4 3h8l8 8-9 9-7-7V3Zm4 4 9 9M8 20l-4 2M3 17l4 4"/>'};
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[job]??paths.swordsman}</svg>`;
};
/** Party EXP share: online, alive members on your map split EXP evenly; each extra member adds +10%. */
function share(state:PartyState|null,you:string){
 const members=state?.members??[],myMap=members.find(m=>m.id===you)?.mapId;
 const eligible=members.filter(m=>m.online&&!m.dead&&m.mapId===myMap);
 const count=Math.max(1,eligible.length),bonus=(count-1)*10;
 return {eligible,count,bonus,each:Math.round((100+bonus)/count),myMap};
}
export function mountParty(o:{send:(m:unknown)=>void;you:()=>string;enabled:()=>boolean;onOpen?:()=>void;chat:()=>void;whisper?:(name:string)=>void}){
 let selectedAlly:string|undefined;
 const ui=document.querySelector('#ui')!;
 const frame=document.createElement('section');frame.id='party-frame';frame.hidden=true;frame.ariaLabel='สมาชิกปาร์ตี้';
 frame.innerHTML='<header><button type="button" class="party-manage" aria-label="เปิดหน้าต่างปาร์ตี้">ปาร์ตี้ <small></small><em></em></button><button type="button" class="party-collapse" aria-label="ย่อรายชื่อปาร์ตี้" aria-expanded="true">⌃</button></header><ul></ul><div class="pf-pips" aria-hidden="true"></div><div class="pf-actions"><button type="button" data-act="chat">แชท</button><button type="button" data-act="manage">จัดการปาร์ตี้</button></div>';
 const invites=document.createElement('div');invites.id='party-invites';ui.append(frame,invites);
 const panel=document.createElement('dialog');panel.id='party-window';panel.setAttribute('aria-labelledby','party-heading');
 panel.innerHTML=`<header class="pw-head"><h2 id="party-heading">ปาร์ตี้</h2><span class="party-summary"></span><span class="pw-pill party-capacity"></span><span class="pw-pill exp party-exp"></span><button type="button" id="party-chat" class="pw-chat">แชทปาร์ตี้ ↗</button><button type="button" class="close" aria-label="ปิดปาร์ตี้">×</button></header>
 <div class="pw-body"><main class="pw-main"><section class="party-camp-scene" aria-label="ค่ายพัก"><div class="camp-caption"><span>ใต้แสงไฟเดียวกัน</span><small>ทุกการเดินทาง เริ่มจากเพื่อนร่วมทาง</small></div><div class="camp-bonus" hidden><strong></strong><span><b></b><small></small><span class="pw-pips"></span></span></div><small class="camp-art-note">ตัวละครจากโลกไทยเนทีฟ</small></section>
 <div class="party-list-heading">เพื่อนร่วมทาง <small>สมาชิกสูงสุด 6 คน</small><span class="live">อัปเดตสด</span></div><section class="party-roster" aria-label="รายชื่อสมาชิก 6 ช่อง"></section>
 <section class="party-empty"><h3>ยังไม่มีปาร์ตี้</h3><p>ชวนเพื่อนในแมพเดียวกันมาร่วมทาง แบ่ง EXP เท่ากันและได้โบนัสเพิ่มตามจำนวนคน</p><div class="perks"><span>2 คน +10%</span><span>4 คน +30%</span><span>6 คน +50%</span></div><button type="button" id="party-create">＋ สร้างปาร์ตี้</button><small>หรือกดเชิญจากรายชื่อด้านขวา ระบบจะสร้างปาร์ตี้ให้อัตโนมัติ</small></section></main>
 <aside class="pw-side"><div><h3>ชวนเพื่อนร่วมทาง</h3><p class="party-invite-hint"></p></div><form class="party-invite-form" autocomplete="off"><input id="party-invite-name" maxlength="24" placeholder="พิมพ์ชื่อตัวละคร" aria-label="ชื่อตัวละคร" required><button type="submit">เชิญ</button></form><p class="party-feedback" role="status"></p>
 <section class="party-online"><h3>ผู้เล่นในแมพนี้ <span class="online-count">0</span><button type="button" class="online-refresh" aria-label="รีเฟรชผู้เล่นออนไลน์">↻</button></h3><p class="online-location">แมพเดียวกัน · CH เดียวกัน</p><ul class="party-online-list" aria-label="ผู้เล่นออนไลน์ในแมพและ CH เดียวกัน"></ul><p class="online-note" role="status">เปิดหน้าต่างเพื่อโหลดรายชื่อ</p></section>
 <section class="pw-rules"><h4>ใครได้ EXP ร่วม</h4><ul><li>ออนไลน์และยังมีชีวิต</li><li>อยู่แมพเดียวกัน · CH เดียวกัน</li><li>ไม่จำกัดระยะห่างในแมพ</li><li class="nb">หลุดการเชื่อมต่อ: เก็บที่ไว้ 5 นาที</li></ul></section></aside></div>
 <footer class="party-footer"><span class="pw-note"></span><div class="party-confirm" hidden></div><button type="button" id="party-leave">ออกจากปาร์ตี้</button><button type="button" id="party-disband">ยุบปาร์ตี้</button></footer>`;
 document.body.append(panel);
 const $=<T extends HTMLElement=HTMLElement>(s:string)=>panel.querySelector<T>(s)!;
 const roster=$('.party-roster'),form=$<HTMLFormElement>('.party-invite-form'),input=$<HTMLInputElement>('#party-invite-name'),feedback=$('.party-feedback'),confirmBox=$('.party-confirm'),footer=$('.party-footer');
 let state:PartyState|null=null,structure='',hudKey='',lastInvite=0,onlineLoaded=false,onlineKey='';
 let onlinePlayers:OnlinePlayer[]=[];
 const sentAt=new Map<string,number>();
 const cards=new Map<string,{card:HTMLElement;until:number}>();
 const button=(text:string,click:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;};
 function send(op:string,extra:Record<string,string>={}){if(!o.enabled())return;feedback.textContent='';o.send({t:'party',op,...extra});}
 const canInvite=()=>!state||state.leader===o.you();
 const camp=mountPartyCamp($('.party-camp-scene'),()=>panel.open,o.you,()=>{if(!canInvite())return;input.focus();});
 function open(){if(!o.enabled())return;document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>{if(d!==panel)d.close();});o.onOpen?.();if(!panel.open)panel.showModal();onlineLoaded=false;onlinePlayers=[];onlineKey='';drawOnline();send('status');send('online');draw();camp.refresh();}
 frame.querySelector<HTMLButtonElement>('.party-manage')!.onclick=open;
 frame.querySelector<HTMLButtonElement>('[data-act=manage]')!.onclick=open;
 frame.querySelector<HTMLButtonElement>('[data-act=chat]')!.onclick=()=>o.chat();
 const collapse=frame.querySelector<HTMLButtonElement>('.party-collapse')!;
 function setCollapsed(on:boolean){frame.classList.toggle('is-collapsed',on);collapse.setAttribute('aria-expanded',String(!on));collapse.ariaLabel=on?'ขยายรายชื่อปาร์ตี้':'ย่อรายชื่อปาร์ตี้';collapse.textContent=on?'⌄':'⌃';}
 setCollapsed(matchMedia('(max-width:650px)').matches);collapse.onclick=()=>setCollapsed(!frame.classList.contains('is-collapsed'));
 panel.querySelector<HTMLButtonElement>('.close')!.onclick=()=>panel.close();
 const closeMenus=()=>{roster.querySelectorAll<HTMLElement>('.party-member-actions').forEach(a=>a.hidden=true);roster.querySelectorAll('[data-more]').forEach(b=>b.setAttribute('aria-expanded','false'));};
 panel.addEventListener('close',()=>{hideConfirm();closeMenus();});
 panel.addEventListener('click',e=>{if(!(e.target as HTMLElement).closest('.party-member-actions,[data-more]'))closeMenus();});
 function hideConfirm(){confirmBox.hidden=true;confirmBox.replaceChildren();footer.classList.remove('confirming');}
 function confirm(text:string,label:string,action:()=>void){
  const previous=document.activeElement as HTMLElement;confirmBox.replaceChildren();confirmBox.setAttribute('role','alertdialog');confirmBox.setAttribute('aria-label',text);const p=document.createElement('p');p.textContent=text;
  const close=()=>{hideConfirm();previous?.isConnected&&previous.focus();};const yes=button(label,()=>{action();close();}),cancel=button('ยกเลิก',close);yes.className='danger';confirmBox.append(p,yes,cancel);confirmBox.hidden=false;footer.classList.add('confirming');cancel.focus();
  confirmBox.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){e.preventDefault();(document.activeElement===yes?cancel:yes).focus();}};
 }
 $('#party-create').onclick=()=>send('create');
 $('#party-leave').onclick=()=>{const next=state?.leader===o.you()?state.members.find(m=>m.id!==o.you()&&m.online):undefined;confirm(`ออกจากปาร์ตี้นี้?${next?` หัวหน้าจะส่งต่อให้ ${next.name}`:''}`,'ยืนยันออก',()=>send('leave'));};
 $('#party-disband').onclick=()=>confirm('ยุบปาร์ตี้และยกเลิกคำเชิญทั้งหมด?','ยืนยันยุบปาร์ตี้',()=>send('disband'));
 $('#party-chat').onclick=()=>{panel.close();o.chat();};
 $('.online-refresh').onclick=()=>send('online');
 setInterval(()=>{if(panel.open&&!document.hidden&&o.enabled())send('online');},4000);
 function drawOnline(){
  const may=canInvite(),full=(state?.members.length??0)>=6;
  const visible=onlinePlayers.filter(p=>!state?.members.some(m=>m.id===p.id));
  $('.online-count').textContent=String(visible.length);
  $('.online-note').textContent=!onlineLoaded?'กำลังโหลดรายชื่อ…':!may?'หัวหน้าปาร์ตี้เป็นผู้ส่งคำเชิญ':full?'ปาร์ตี้เต็มแล้ว':visible.length?'':'ยังไม่มีผู้เล่นอื่นในแมพและ CH นี้';
  const now=Date.now(),key=JSON.stringify([onlineLoaded,may,full,visible,visible.map(p=>Math.ceil(((sentAt.get(p.id)??0)+INVITE_MS-now)/1000))]);if(key===onlineKey)return;onlineKey=key;
  const list=$('.party-online-list');list.replaceChildren();
  for(const p of visible){
   const row=document.createElement('li'),icon=document.createElement('i'),info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');
   icon.className='online-job';icon.innerHTML=glyph(p.jobId);name.textContent=p.name;meta.textContent=`Lv.${p.level} · ${jobName(p.jobId)}`;info.append(name,meta);row.append(icon,info);
   if(p.status==='available'){
    const invite=button('＋ เชิญ',()=>{if(!canInvite()||(state?.members.length??0)>=6)return;p.status='invited';sentAt.set(p.id,Date.now());drawOnline();send('inviteNearby',{id:p.id});feedback.textContent=`กำลังเชิญ ${p.name}…`;send('online');});
    invite.className='online-invite';invite.ariaLabel='เชิญ '+p.name;invite.disabled=!may||full;row.append(invite);
   }else{
    const tag=document.createElement('span'),left=Math.ceil(((sentAt.get(p.id)??0)+INVITE_MS-now)/1000);tag.className='online-status '+p.status;
    tag.textContent=p.status==='party'?'มีปาร์ตี้แล้ว':'ส่งแล้ว';if(p.status==='invited'&&left>0){const s=document.createElement('small');s.textContent=left+' วิ';tag.append(s);}row.append(tag);
   }
   list.append(row);
  }
 }
 form.onsubmit=e=>{e.preventDefault();const name=input.value.trim();if(!name||Date.now()-lastInvite<800)return;lastInvite=Date.now();send('invite',{name});feedback.textContent=`กำลังส่งคำเชิญให้ ${name}…`;};
 function memberCard(m:PartyMember){
  const me=m.id===o.you(),leader=state?.leader===o.you();
  const card=document.createElement('article');card.className='party-member';card.dataset.member=m.id;
  const art=document.createElement('div');art.className='pm-art';
  const portrait=document.createElement('div');portrait.className='party-portrait';const canvas=document.createElement('canvas');portrait.append(canvas);paintPartyPortrait(canvas,m);
  const icon=document.createElement('span');icon.className='party-job';icon.innerHTML=glyph(m.jobId);icon.title=jobName(m.jobId);
  const presence=document.createElement('span');presence.className='party-presence';art.append(portrait,icon,presence);
  if(m.id===state?.leader){const crown=document.createElement('span');crown.className='party-leader';crown.textContent='♛';crown.title='หัวหน้าปาร์ตี้';art.append(crown);}
  const body=document.createElement('div');body.className='pm-body';
  const heading=document.createElement('b');heading.className='pm-name';const name=document.createElement('span');name.className='party-name';name.textContent=m.name;heading.append(name);
  if(me){const you=document.createElement('small');you.className='party-you';you.textContent='คุณ';heading.append(you);}
  const meta=document.createElement('small');meta.className='party-meta';const where=document.createElement('small');where.className='pm-where';const exp=document.createElement('span');exp.className='pm-exp';
  body.append(heading,meta,where,exp);
  const vitals=document.createElement('div');vitals.className='pm-vitals';
  for(const kind of ['hp','mp']){const bar=document.createElement('div');bar.className='party-vital party-'+kind;bar.setAttribute('role','progressbar');bar.ariaLabel=(kind==='hp'?'HP ':'MP ')+m.name;bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.innerHTML=`<small>${kind.toUpperCase()}</small><b class="party-track"><i></i><span class="party-value"></span></b>`;vitals.append(bar);}
  body.append(vitals);card.append(art,body);
  const actions:HTMLButtonElement[]=[];
  if(!me&&o.whisper)actions.push(button('ส่งข้อความส่วนตัว',()=>{panel.close();o.whisper!(m.name);}));
  if(!me&&leader){
   const lead=button(`♛ ส่งหัวหน้าให้ ${m.name}`,()=>confirm(`ส่งหัวหน้าปาร์ตี้ให้ ${m.name}?`,'ยืนยันส่งหัวหน้า',()=>send('lead',{id:m.id})));lead.dataset.lead='true';
   const kick=button('เชิญออกจากปาร์ตี้',()=>confirm(`เชิญ ${m.name} ออกจากปาร์ตี้?`,'ยืนยันเชิญออก',()=>send('kick',{id:m.id})));kick.className='danger';actions.push(lead,kick);
  }
  if(actions.length){
   const menu=document.createElement('div');menu.className='party-member-actions';menu.hidden=true;menu.append(...actions);
   const more=button('⋯',()=>{const on=menu.hidden;closeMenus();menu.hidden=!on;more.setAttribute('aria-expanded',String(on));});more.className='party-more';more.dataset.more='true';more.ariaLabel='จัดการ '+m.name;more.setAttribute('aria-expanded','false');
   art.append(more);card.append(menu);
  }
  return card;
 }
 function update(card:HTMLElement,m:PartyMember,myMap?:string){
  const away=m.online&&!m.dead&&m.mapId!==myMap,eligible=m.online&&!m.dead&&!away;
  card.classList.toggle('offline',!m.online);card.classList.toggle('dead',!!m.dead);card.classList.toggle('away',away);card.classList.toggle('me',m.id===o.you());
  const presence=card.querySelector<HTMLElement>('.party-presence')!;presence.textContent=!m.online?'ออฟไลน์':m.dead?'หมดสติ':'ออนไลน์';
  card.querySelector('.party-meta')!.textContent=m.online?`Lv.${m.level??'?'} · ${jobName(m.jobId)}`:'ออฟไลน์';
  card.querySelector('.pm-where')!.textContent=m.online?mapName(m.mapId):'รอกลับเข้ามา';
  const exp=card.querySelector<HTMLElement>('.pm-exp')!;exp.className='pm-exp '+(eligible?'ok':away?'warn':m.dead?'bad':'dim');
  exp.textContent=eligible?'ได้รับ EXP ร่วม':away?'ต่างแมพ · ไม่ได้ EXP':m.dead?'หมดสติ · ไม่ได้ EXP':'ไม่ได้ EXP';
  for(const [kind,value,max]of [['hp',m.hp,m.maxHp],['mp',m.mp,m.maxMp]]as const){const bar=card.querySelector<HTMLElement>('.party-'+kind)!;const r=m.online?ratio(value,max):0;bar.style.setProperty('--fill',String(r));bar.classList.toggle('low',kind==='hp'&&m.online&&!m.dead&&r<.35);bar.setAttribute('aria-valuenow',String(Math.round(r*100)));bar.querySelector('.party-value')!.textContent=m.online?`${number(value)}/${number(max)}`:'—';}
  const lead=card.querySelector<HTMLButtonElement>('[data-lead]');if(lead)lead.disabled=!m.online;
 }
 /** HUD strip: everyone except you (your own vitals already sit in the player frame). */
 function drawHud(myMap?:string){
  const members=state?.members??[],others=members.filter(m=>m.id!==o.you()),list=frame.querySelector('ul')!;
  const key=JSON.stringify([state?.leader,others.map(m=>[m.id,m.name,m.jobId])]);
  if(key!==hudKey){
   hudKey=key;list.replaceChildren();
   for(const m of others){
    const li=document.createElement('li');li.className='party-member';li.dataset.member=m.id;li.title=m.name;
    const av=document.createElement('span');av.className='pf-av';const canvas=document.createElement('canvas');paintPartyAvatar(canvas);const job=document.createElement('b');job.innerHTML=glyph(m.jobId);av.append(canvas,job);
    const info=document.createElement('div');info.className='pf-info';
    info.innerHTML=`<div class="pf-name">${m.id===state?.leader?'<span class="pf-crown" title="หัวหน้าปาร์ตี้">♛</span>':''}<span class="party-name"></span><small class="pf-lv"></small><span class="pf-tag"></span></div><div class="pf-hp"><b class="party-track"><i></i></b><span class="pf-pct"></span></div><b class="pf-mp party-track"><i></i></b>`;
    info.querySelector('.party-name')!.textContent=m.name;li.append(av,info);{const target=button('เลือกฮีล',()=>{selectedAlly=selectedAlly===m.id?undefined:m.id;frame.querySelectorAll<HTMLButtonElement>('[data-heal-target]').forEach(b=>{const on=b.dataset.healTarget===selectedAlly;b.setAttribute('aria-pressed',String(on));b.textContent=on?'เป้าฮีล ✓':'เลือกฮีล';});});target.dataset.healTarget=m.id;target.ariaLabel='เลือกเป้าฮีล '+m.name;target.setAttribute('aria-pressed',String(selectedAlly===m.id));li.append(target);}list.append(li);
   }
   if(!others.length){const li=document.createElement('li');li.className='pf-empty';const b=button('＋ เชิญเพื่อนร่วมทาง',open);li.append(b);list.append(li);}
   frame.querySelector('.pf-pips')!.replaceChildren(...others.map(()=>document.createElement('i')));
  }
  others.forEach((m,i)=>{
   const li=list.querySelector<HTMLElement>(`[data-member="${CSS.escape(m.id)}"]`);if(!li)return;
   const away=m.online&&!m.dead&&m.mapId!==myMap,hp=m.online?ratio(m.hp,m.maxHp):0,mp=m.online?ratio(m.mp,m.maxMp):0;
   li.className='party-member'+(!m.online?' offline':m.dead?' dead':away?' away':hp<.35?' low':'');
   li.querySelector('.pf-lv')!.textContent=m.online?`Lv.${m.level??'?'}`:'';
   const tag=li.querySelector<HTMLElement>('.pf-tag')!;tag.textContent=!m.online?'ออฟไลน์':m.dead?'หมดสติ':away?'↗ '+mapName(m.mapId):'';
   li.querySelector<HTMLElement>('.pf-hp i')!.style.width=hp*100+'%';li.querySelector<HTMLElement>('.pf-mp i')!.style.width=mp*100+'%';
   li.querySelector('.pf-pct')!.textContent=m.online?Math.round(hp*100)+'%':'—';
   const pip=frame.querySelectorAll<HTMLElement>('.pf-pips i')[i];if(pip){pip.style.setProperty('--f',String(hp));pip.classList.toggle('low',m.online&&!m.dead&&hp<.35);}
  });
 }
 function draw(){
  const leader=state?.leader===o.you(),members=state?.members??[],{count,bonus,each,myMap}=share(state,o.you());
  const leaderName=members.find(m=>m.id===state?.leader)?.name;
  $('.party-summary').textContent=state?(leader?'คุณเป็นหัวหน้าปาร์ตี้':`ร่วมทางกับ ${leaderName??'เพื่อนร่วมทาง'}`):'ออกล่าเป็นกลุ่ม สูงสุด 6 คน';
  $('.party-capacity').innerHTML=`สมาชิก <b>${members.length} / 6</b>`;$('.party-exp').innerHTML=`EXP <b>+${bonus}%</b>`;
  for(const s of ['.party-capacity','.party-exp','#party-chat'])$(s).hidden=!state;
  const bonusBox=$('.camp-bonus');bonusBox.hidden=!state;
  if(state){bonusBox.querySelector('strong')!.textContent=`+${bonus}%`;bonusBox.querySelector('b')!.textContent=`EXP ร่วม ${count}/${members.length} คน`;bonusBox.querySelector('small')!.textContent=`แต่ละคนได้ ${each}% ของ EXP มอน`;$('.pw-pips').replaceChildren(...Array.from({length:6},(_,i)=>{const p=document.createElement('i');p.className=i<count?'on':i<members.length?'off':'';return p;}));}
  $('.party-empty').hidden=!!state;$('.party-list-heading').hidden=roster.hidden=!state;
  input.disabled=form.querySelector<HTMLButtonElement>('button')!.disabled=!canInvite()||members.length>=6;
  $('.party-invite-hint').textContent=members.length>=6?'ปาร์ตี้เต็มแล้ว':canInvite()?'คำเชิญมีอายุ 60 วินาที':'หัวหน้าปาร์ตี้เป็นผู้ส่งคำเชิญ';
  $('#party-leave').hidden=!state;$('#party-disband').hidden=!leader;
  $('.pw-note').textContent=state?`◇ ออนไลน์ ${members.filter(m=>m.online).length}/${members.length}`:'◇ เชิญได้เฉพาะผู้เล่นที่ออนไลน์';
  const next=JSON.stringify([state?.id,state?.leader,...members.map(m=>[m.id,m.name,m.jobId])]);
  if(next!==structure){structure=next;hideConfirm();roster.replaceChildren(...members.map(m=>memberCard(m)),...Array.from({length:Math.max(0,6-members.length)},()=>{const slot=document.createElement('button');slot.type='button';slot.className='party-empty-slot';const may=!state||leader;slot.ariaLabel='เชิญสมาชิก';slot.innerHTML=`<span>＋</span><strong>${may?'เชิญเพื่อน':'รอเพื่อนร่วมทาง'}</strong><small>${may?'ชวนเพื่อนมาออกผจญภัย':'หัวหน้าเป็นผู้เชิญ'}</small>`;slot.disabled=!may;slot.onclick=()=>input.focus();return slot;}));}
  camp.update(state);drawOnline();
  frame.hidden=!state;frame.querySelector('.party-manage small')!.textContent=`${members.length}/6`;frame.querySelector('.party-manage em')!.textContent=bonus?`EXP +${bonus}%`:'';
  for(const card of roster.children){const member=members.find(m=>m.id===(card as HTMLElement).dataset.member);if(member)update(card as HTMLElement,member,myMap);}
  drawHud(myMap);
 }
 function closeInvite(id:string){const old=cards.get(id);old?.card.remove();cards.delete(id);}
 function invitation(m:{partyId:string;from:string;expiresAt?:number}){
  closeInvite(m.partyId);if(cards.size>=6)closeInvite(cards.keys().next().value!);
  const card=document.createElement('section');card.className='party-invite';card.setAttribute('role','group');card.ariaLabel='คำเชิญปาร์ตี้จาก '+m.from;
  const text=document.createElement('p');text.textContent=m.from+' ชวนเข้าปาร์ตี้';const timer=document.createElement('small');timer.className='party-invite-timer';
  const accept=button('เข้าร่วม',()=>{send('accept',{id:m.partyId});closeInvite(m.partyId);});accept.className='primary';
  card.append(text,timer,accept,button('ปฏิเสธ',()=>{send('decline',{id:m.partyId});closeInvite(m.partyId);}));
  const until=m.expiresAt??Date.now()+INVITE_MS;cards.set(m.partyId,{card,until});invites.append(card);tick();
 }
 function tick(){
  for(const[id,entry]of cards){const left=Math.ceil((entry.until-Date.now())/1000);if(left<=0){closeInvite(id);continue;}const timer=entry.card.querySelector<HTMLElement>('.party-invite-timer')!;timer.textContent=String(left);timer.style.setProperty('--left',String(left*1000/INVITE_MS));}
  if(panel.open&&sentAt.size){for(const[id,at]of sentAt)if(Date.now()-at>INVITE_MS)sentAt.delete(id);drawOnline();}
 }
 setInterval(tick,1000);
 draw();
 return {get allyTarget(){return state?.members.some(m=>m.id===selectedAlly&&m.online&&!m.dead)?selectedAlly:undefined;},open,invite:(name:string)=>send('invite',{name}),receive(m:any){
  if(m.t==='partyOnline'){onlinePlayers=m.list;onlineLoaded=true;$('.online-location').textContent=`${mapName(m.mapId)} · CH เดียวกัน · อัปเดตทุก 4 วิ`;drawOnline();return true;}
  if(m.t==='partyState'){const before=JSON.stringify([state?.id,state?.leader,state?.members.map(m=>m.id)]);state=m.party;if(before!==JSON.stringify([state?.id,state?.leader,state?.members.map(m=>m.id)]))feedback.textContent='';if(state)for(const id of cards.keys())closeInvite(id);draw();return true;}
  if(m.t==='partyInvite'){invitation(m);return true;}
  if(m.t==='partyInviteClosed'){closeInvite(m.partyId);return true;}
  if(m.t==='chatError'&&m.scope==='party')feedback.textContent=m.text;
  if(m.t==='chat'&&m.ch==='system'&&panel.open)feedback.textContent=m.text;
  return false;
 }};
}
