import { titleDefinition, type TitleDefinition, type RankingBoard } from '@thainative/shared';
import './titles.css';
type TitleEntry=TitleDefinition&{unlocked:boolean;progress:number;rank:number|null};
const CATEGORIES=[['all','ทั้งหมด'],['level','เลเวล'],['hunt','การล่า'],['boss','บอส'],['rank','อันดับ'],['pvp','PvP / ตำนาน']] as const;
export function mountTitles(o:{send:(m:unknown)=>void;onOpen:()=>void;notice:(text:string)=>void;you:()=>string}){
 const panel=document.createElement('dialog');panel.id='titles-window';panel.setAttribute('aria-labelledby','titles-heading');
 panel.innerHTML='<button type="button" class="close" aria-label="ปิด">×</button><header class="g-head"><h2 id="titles-heading">สมุดฉายา</h2><span class="g-sub">เกียรติประวัติของผู้กล้า</span></header><nav class="prestige-tabs"><button type="button" data-tab="titles">ฉายา</button><button type="button" data-tab="rankings">อันดับเซิร์ฟเวอร์</button></nav><section class="prestige-tools"></section><p class="prestige-status" role="status"></p><section class="prestige-body"></section>';
 document.body.append(panel);
 const tools=panel.querySelector<HTMLElement>('.prestige-tools')!,status=panel.querySelector<HTMLElement>('.prestige-status')!,body=panel.querySelector<HTMLElement>('.prestige-body')!;
 let tab='titles',category='all',list:TitleEntry[]=[],selected:string|null=null,board:RankingBoard='level',ranking:any,pending=false;
 const button=(text:string,click:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=click;return b;};
 function draw(){
  panel.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
  tools.replaceChildren();body.replaceChildren();
  if(tab==='titles'){
   const select=document.createElement('select');select.ariaLabel='หมวดฉายา';
   for(const [id,label] of CATEGORIES){const opt=new Option(label,id);opt.selected=id===category;select.add(opt);}select.onchange=()=>{category=select.value;draw();};
   const clear=button('ถอดฉายา',()=>equip(null));clear.disabled=pending||!selected;tools.append(select,clear);
   if(!list.length){body.textContent='กำลังโหลดฉายา…';return;}
   const summary=document.createElement('p');summary.className='g-sub';summary.textContent=`สะสมแล้ว ${list.filter(t=>t.unlocked&&t.metric!=='rank').length} / ${list.filter(t=>t.available&&t.metric!=='rank').length} ฉายา · ฉายาเป็นของตกแต่ง`;body.append(summary);
   for(const t of list.filter(t=>category==='all'||t.category===category||(category==='pvp'&&t.category==='legend'))){
    const row=document.createElement('article');row.className='prestige-card';row.dataset.state=!t.available?'future':t.unlocked?'unlocked':'locked';
    const info=document.createElement('div'),name=document.createElement('strong'),hint=document.createElement('p'),progress=document.createElement('small');
    name.textContent=t.name;name.style.color=t.color;hint.textContent=t.hint;
    progress.textContent=!t.available?'รอเปิดระบบ PvP':t.metric==='rank'?`อันดับของคุณ: ${t.rank??'ยังไม่มี'} · เปลี่ยนตามอันดับปัจจุบัน`:`${t.progress.toLocaleString('th-TH')} / ${t.goal.toLocaleString('th-TH')}`;
    info.append(name,hint,progress);
    const use=button(selected===t.id?'ใช้อยู่':!t.available?'รอ PvP':t.unlocked?'ใช้ฉายา':'ยังไม่ปลดล็อก',()=>equip(t.id));use.disabled=pending||!t.unlocked||selected===t.id;
    row.append(info,use);body.append(row);
   }
  }else{
   for(const [id,label] of [['level','ระดับตัวละคร'],['hunt','จำนวนมอนสเตอร์ที่ปราบ']] as const){const b=button(label,()=>{board=id;ranking=undefined;o.send({t:'rankings',board});draw();});b.setAttribute('aria-pressed',String(board===id));tools.append(b);}
   tools.append(button('รีเฟรช',()=>o.send({t:'rankings',board})));
   if(!ranking||ranking.board!==board){body.textContent='กำลังโหลดอันดับ…';return;}
   const note=document.createElement('p');note.className='g-sub';note.textContent=`${ranking.total.toLocaleString('th-TH')} ตัวละคร · คุณ: ${ranking.mine?'อันดับ '+ranking.mine.rank:'ยังไม่มีอันดับ'} · รวมผู้เล่นออฟไลน์ อัปเดตฐานข้อมูลทุก 1 นาที`;body.append(note);
   const table=document.createElement('table'),head=table.createTHead().insertRow();for(const name of ['อันดับ','ผู้กล้า',board==='level'?'ระดับ':'ปราบมอน']){const th=document.createElement('th');th.scope='col';th.textContent=name;head.append(th);}
   const rows=table.createTBody();
   for(const p of ranking.list){const row=rows.insertRow();row.classList.toggle('is-me',p.id===o.you());row.insertCell().textContent=String(p.rank);const who=row.insertCell(),name=document.createElement('strong');name.textContent=p.name;who.append(name);const title=titleDefinition(p.titleId);if(title){const badge=document.createElement('small');badge.textContent=title.name;badge.style.color=title.color;who.append(badge);}row.insertCell().textContent=(board==='level'?p.level:p.kills).toLocaleString('th-TH');}
   body.append(table);
  }
 }
 function equip(id:string|null){pending=true;status.textContent='กำลังบันทึกฉายา…';o.send({t:'titleEquip',id});draw();}
 function open(at='titles'){
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>{if(d!==panel)d.close();});o.onOpen();tab=at;status.textContent='';
  if(!panel.open)panel.showModal();o.send(at==='titles'?{t:'titles'}:{t:'rankings',board});draw();
 }
 panel.querySelector('.close')!.addEventListener('click',()=>panel.close());panel.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>b.onclick=()=>open(b.dataset.tab!));
 const host=document.querySelector('#game-menu-window .menu-play');
 if(host){for(const [id,label] of [['titles','ฉายา'],['rankings','อันดับ']] as const){const b=button(label,()=>open(id));b.className='menu-tile';b.id='menu-'+id;b.dataset.icon=id;b.innerHTML='<i></i><span></span>';b.querySelector('span')!.textContent=label;host.append(b);}}
 return {open,receive(m:any){
  if(m.t==='titles'){selected=m.selected;list=m.list;pending=false;status.textContent=selected?'ฉายาที่ใช้: '+(titleDefinition(selected)?.name??''):'ยังไม่ได้ติดฉายา';if(panel.open)draw();return true;}
  if(m.t==='rankings'){ranking=m;if(panel.open)draw();return true;}
  if(m.t==='titleError'||m.t==='rankingError'){pending=false;status.textContent=m.text;o.notice(m.text);if(panel.open)draw();return true;}
  return false;
 }};
}
