import { titleDefinition, type TitleDefinition, type RankingBoard } from '@the-beginning-online/shared';
import jobsData from '../../shared/data/jobs.json';
import './titles.css';
type TitleEntry=TitleDefinition&{unlocked:boolean;progress:number;rank:number|null};
type Profile={name:string;level:number;kills:number};
const CATEGORIES=[['all','ทั้งหมด'],['level','เลเวล'],['hunt','การล่า'],['boss','บอส'],['rank','อันดับ'],['pvp','PvP / ตำนาน']] as const;
const RANK_STEPS=[1,3,10];
const n=(v:number)=>v.toLocaleString('th-TH');
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const jobName=(id:string)=>jobsData.jobs.find(j=>j.id===id)?.nameTh??'';
/** Titles book (ui-mockup/titles.html): a live nameplate preview with collection progress on the left,
 *  title cards grouped by category on the right; the rankings tab shows a podium, the table and your rank. */
export function mountTitles(o:{send:(m:unknown)=>void;onOpen:()=>void;notice:(text:string)=>void;you:()=>string;profile:()=>Profile}){
 const panel=document.createElement('dialog');panel.id='titles-window';panel.setAttribute('aria-labelledby','titles-heading');
 panel.innerHTML='<header class="ti-head"><h2 id="titles-heading">สมุดฉายา</h2><span class="g-sub">เกียรติประวัติของผู้กล้า</span><nav class="ti-seg" aria-label="หน้า"><button type="button" data-tab="titles">ฉายา</button><button type="button" data-tab="rankings">อันดับเซิร์ฟเวอร์</button></nav><button type="button" class="close" aria-label="ปิด">×</button></header><p class="prestige-status" role="status"></p><div class="ti-body"></div>';
 document.body.append(panel);
 const status=panel.querySelector<HTMLElement>('.prestige-status')!,body=panel.querySelector<HTMLElement>('.ti-body')!;
 let tab='titles',category='all',hideSoon=false,list:TitleEntry[]=[],selected:string|null=null,board:RankingBoard='level',ranking:any,pending=false;
 const owned=(t:TitleEntry)=>t.available&&t.unlocked;
 const stateOf=(t:TitleEntry)=>!t.available?'soon':t.id===selected?'worn':t.unlocked?'owned':t.metric==='rank'?'rank':'locked';
 function plateHTML(){return '<div class="ti-stage"><div class="ti-plate"><div class="ti-ttl"></div><div class="ti-nm"></div><div class="ti-hint"></div></div><div class="ti-hero"></div></div>';}
 /** Shows the worn title, or `t` as a preview while it is hovered or focused. */
 function preview(t:TitleEntry|null){
  const plate=body.querySelector<HTMLElement>('.ti-plate');if(!plate)return;
  const worn=titleDefinition(selected),show=t&&t.available?t:worn;
  plate.querySelector('.ti-ttl')!.textContent=show?.name??'— ไม่มีฉายา —';
  plate.style.setProperty('--tc',show?.color??'rgba(243,239,230,.45)');
  plate.querySelector('.ti-nm')!.textContent=o.profile().name;
  const previewing=!!(t&&t.available&&t.id!==selected);
  plate.classList.toggle('previewing',previewing);
  plate.querySelector('.ti-hint')!.textContent=previewing?(t!.unlocked?'ตัวอย่าง · คลิกเพื่อใช้':'ตัวอย่าง · ยังไม่ปลดล็อก'):'ฉายาที่ใช้อยู่';
 }
 function card(t:TitleEntry){
  const s=stateOf(t),b=document.createElement('button');b.type='button';
  b.className=`ti-card ${s}${t.metric==='rank'?' is-rank':''}`;b.style.setProperty('--tc',t.color);
  const pct=t.metric==='rank'?(t.unlocked?100:0):Math.round(Math.min(1,t.progress/Math.max(1,t.goal))*100);
  const tag=s==='worn'?'ใช้อยู่':s==='owned'?'ใช้ฉายา':s==='soon'?'รอเปิดระบบ':s==='rank'?(t.rank?`คุณอยู่อันดับ ${n(t.rank)}`:'ยังไม่มีอันดับ'):'';
  const foot=s==='soon'?`<div class="ti-row"><span class="ti-tag">${tag}</span></div>`
   :t.metric==='rank'?`<div class="ti-row"><span>ถือครองขณะอยู่ในอันดับ</span>${tag?`<span class="ti-tag">${tag}</span>`:''}</div>`
   :`<div class="ti-bar"><i style="width:${pct}%"></i></div><div class="ti-row"><span>${n(t.progress)} / ${n(t.goal)}</span>${tag?`<span class="ti-tag">${tag}</span>`:`<span>${pct}%</span>`}</div>`;
  b.innerHTML=`<span class="ti-name">${esc(t.name)}</span><span class="ti-desc">${esc(t.hint)}</span>${foot}`;
  b.setAttribute('aria-label',`${t.name} · ${t.hint} · ${tag||pct+'%'}`);
  b.disabled=pending&&s==='owned';
  b.onmouseenter=b.onfocus=()=>preview(t);b.onmouseleave=b.onblur=()=>preview(null);
  b.onclick=()=>{if(s==='owned'&&!pending)equip(t.id);};
  return b;
 }
 function drawTitles(){
  const visible=list.filter(t=>t.metric!=='rank'),have=visible.filter(owned).length,total=visible.filter(t=>t.available).length;
  const p=o.profile(),bosses=list.filter(t=>t.category==='boss');
  body.innerHTML=`<aside class="ti-side">${plateHTML()}
   <div class="ti-collect"><div class="ti-ring" style="--p:${total?have/total:0}"><b>${have}</b></div><div><h4>สะสมแล้ว ${have} / ${total} ฉายา</h4><p>ฉายาเป็นของตกแต่ง ไม่เพิ่มค่าพลัง<br>PvP และตำนานรอเปิดระบบ</p></div></div>
   <div class="ti-stats"><div><small>ระดับ</small><b>${n(p.level)}</b></div><div><small>ปราบแล้ว</small><b>${n(p.kills)}</b></div><div><small>บอส</small><b>${bosses.filter(owned).length}/${bosses.length}</b></div></div>
   <button type="button" class="ti-btn ti-unequip">ถอดฉายา</button></aside>
   <section class="ti-main"><div class="ti-filters"></div><div class="ti-grid" tabindex="-1"></div></section>`;
  const unequip=body.querySelector<HTMLButtonElement>('.ti-unequip')!;unequip.disabled=pending||!selected;unequip.onclick=()=>equip(null);
  const filters=body.querySelector<HTMLElement>('.ti-filters')!;
  for(const [id,label] of CATEGORIES){
   const items=list.filter(t=>id==='all'||t.category===id||(id==='pvp'&&t.category==='legend')),open=items.filter(t=>t.available);
   const b=document.createElement('button');b.type='button';b.className='ti-chip';b.setAttribute('aria-pressed',String(category===id));
   b.innerHTML=`${label}<i>${open.length?`${items.filter(owned).length}/${open.length}`:'เร็วๆ นี้'}</i>`;
   b.onclick=()=>{category=id;draw();};filters.append(b);
  }
  const hide=document.createElement('label');hide.className='ti-switch';hide.innerHTML='<input type="checkbox"><i></i>ซ่อนที่ยังไม่เปิด';
  const box=hide.querySelector('input')!;box.checked=hideSoon;box.onchange=()=>{hideSoon=box.checked;draw();};filters.append(hide);
  const grid=body.querySelector<HTMLElement>('.ti-grid')!;
  for(const [id,label] of CATEGORIES.slice(1)){
   if(category!=='all'&&category!==id)continue;
   const items=list.filter(t=>(t.category===id||(id==='pvp'&&t.category==='legend'))&&(!hideSoon||t.available));
   if(!items.length)continue;
   const head=document.createElement('div');head.className='ti-group';head.textContent=label;grid.append(head);
   for(const t of items)grid.append(card(t));
  }
  if(!list.length)grid.innerHTML='<p class="ti-empty">กำลังโหลดฉายา…</p>';
  preview(null);
 }
 function drawRankings(){
  const mine=ranking?.board===board?ranking.mine:null,rank=mine?.rank as number|undefined;
  const next=rank?RANK_STEPS.filter(s=>s<rank).pop():undefined,holding=rank?RANK_STEPS.find(s=>rank<=s):undefined;
  const titleFor=(step:number)=>titleDefinition(`${board}_top${step}`);
  const meText=!rank?'ยังไม่มีอันดับในกระดานนี้':holding&&!next?`ถือครองฉายา <b style="color:${titleFor(holding)?.color}">${esc(titleFor(holding)?.name??'')}</b>`
   :`${holding?`ถือครอง <b style="color:${titleFor(holding)?.color}">${esc(titleFor(holding)?.name??'')}</b><br>`:''}ติด ${next===1?'อันดับ 1':`${next} อันดับแรก`} เพื่อรับ <b style="color:${titleFor(next!)?.color}">${esc(titleFor(next!)?.name??'')}</b>`;
  body.innerHTML=`<aside class="ti-side rk">
   <h4 class="ti-cap">กระดานอันดับ</h4>
   <div class="rk-boards"><button type="button" data-board="level">ระดับตัวละคร<small>เลเวล · EXP</small></button><button type="button" data-board="hunt">นักล่า<small>มอนที่ปราบ</small></button></div>
   <div class="rk-me"><small>อันดับของคุณ</small><b>${rank?'#'+n(rank):'—'}</b><p>${meText}</p></div>
   <p class="rk-note">${ranking?.board===board?`${n(ranking.total)} ตัวละคร · รวมผู้เล่นออฟไลน์ · อัปเดตทุก 1 นาที`:''}</p>
   <button type="button" class="ti-btn rk-refresh">รีเฟรช</button></aside>
   <section class="ti-main rk-main"></section>`;
  body.querySelectorAll<HTMLButtonElement>('[data-board]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.board===board));b.onclick=()=>{board=b.dataset.board as RankingBoard;ranking=undefined;o.send({t:'rankings',board});draw();};});
  body.querySelector<HTMLButtonElement>('.rk-refresh')!.onclick=()=>o.send({t:'rankings',board});
  const main=body.querySelector<HTMLElement>('.rk-main')!;
  if(!ranking||ranking.board!==board){main.innerHTML='<p class="ti-empty">กำลังโหลดอันดับ…</p>';return;}
  const value=(p:any)=>board==='level'?`ระดับ ${n(p.level)}`:`ปราบ ${n(p.kills)}`;
  const top=ranking.list.slice(0,3) as any[];
  const podium=document.createElement('div');podium.className='rk-podium';
  for(const i of [1,0,2]){
   const p=top[i];if(!p){podium.append(document.createElement('div'));continue;}
   const t=titleDefinition(p.titleId),el=document.createElement('div');el.className=`rk-pod p${i+1}${p.id===o.you()?' is-me':''}`;
   el.innerHTML=`<span class="rk-medal">${i+1}</span>${t?`<span class="rk-t" style="color:${t.color}">${esc(t.name)}</span>`:''}<b>${esc(p.name)}</b><span>${value(p)}</span>`;
   podium.append(el);
  }
  const wrap=document.createElement('div');wrap.className='rk-list';
  const table=document.createElement('table');
  table.innerHTML=`<thead><tr><th scope="col">อันดับ</th><th scope="col">ผู้กล้า</th><th scope="col">อาชีพ</th><th scope="col">${board==='level'?'ระดับ':'ปราบมอน'}</th></tr></thead>`;
  const rows=table.createTBody();
  for(const p of ranking.list){
   const row=rows.insertRow();row.classList.toggle('is-me',p.id===o.you());
   row.insertCell().textContent=n(p.rank);
   const who=row.insertCell(),name=document.createElement('strong');name.textContent=p.name;who.append(name);
   const t=titleDefinition(p.titleId);if(t){const badge=document.createElement('small');badge.textContent=t.name;badge.style.color=t.color;who.append(badge);}
   row.insertCell().textContent=jobName(p.jobId);
   row.insertCell().textContent=n(board==='level'?p.level:p.kills);
  }
  wrap.append(table);main.append(podium,wrap);
 }
 function draw(){
  panel.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
  panel.dataset.tab=tab;
  if(tab==='titles')drawTitles();else drawRankings();
 }
 function equip(id:string|null){pending=true;status.textContent='กำลังบันทึกฉายา…';o.send({t:'titleEquip',id});draw();}
 function open(at='titles'){
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>{if(d!==panel)d.close();});o.onOpen();tab=at;status.textContent='';
  if(!panel.open)panel.showModal();o.send(at==='titles'?{t:'titles'}:{t:'rankings',board});draw();
 }
 panel.querySelector('.close')!.addEventListener('click',()=>panel.close());panel.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>b.onclick=()=>open(b.dataset.tab!));
 const host=document.querySelector('#game-menu-window .menu-play');
 const button=(text:string,click:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;};
 if(host){for(const [id,label] of [['titles','ฉายา'],['rankings','อันดับ']] as const){const b=button(label,()=>open(id));b.className='menu-tile';b.id='menu-'+id;b.dataset.icon=id;b.innerHTML='<i></i><span></span>';b.querySelector('span')!.textContent=label;host.append(b);}}
 return {open,receive(m:any){
  if(m.t==='titles'){selected=m.selected;list=m.list;pending=false;status.textContent='';if(panel.open)draw();return true;}
  if(m.t==='rankings'){ranking=m;if(panel.open)draw();return true;}
  if(m.t==='titleError'||m.t==='rankingError'){pending=false;status.textContent=m.text;o.notice(m.text);if(panel.open)draw();return true;}
  return false;
 }};
}
