import jobsData from "../../../shared/data/jobs.json";
import skillsData from "../../../shared/data/skills.json";
import statsData from "../../../shared/data/stats.json";
import{assetJSON}from'../asset-request';
import'../web.css';import'./characters.css';import{api,post,showError}from'./api';import{requireLogin,mountAccountChip}from'./session';import{mountPreview}from'../character-preview';

/* Character select + creation, laid out as ui-mockup/characters.html: the chosen hero on a lit pedestal,
   roster cards along the bottom, and a class showcase for creation. The API calls are unchanged. */
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const error=$('#character-error'),grid=$('#character-grid'),removeDialog=$<HTMLDialogElement>('#delete-dialog');
const selectScreen=$('#cs-select'),createScreen=$('#cs-create'),nameInput=$<HTMLInputElement>('#character-name');
window.tnBoot.stage(0);window.tnBoot.stage(1);window.tnBoot.stage(3);
let characters:any[]=[],selectedId='',pickId='',deleteId='',currentJob='swordsman';
const needsJob=(c:any)=>['villager','needs_job'].includes(c.jobId);
const jobName=(id:string)=>jobsData.jobs.find(j=>j.id===id)?.nameTh||'นักดาบ';
const MAP_TH:Record<string,string>={city_plaza:'นครที่ถูกลืมเลือน',meadow:'ทุ่งวุ้นจิ๋ว',forest:'ป่าหมอก'};
const fmt=(n:number)=>Math.round(n).toLocaleString('en-US');
const ago=(date:string)=>{const m=Math.max(0,Math.round((Date.now()-new Date(date).getTime())/60000));return m<1?'เมื่อสักครู่':m<60?`${m} นาทีที่แล้ว`:m<1440?`${Math.round(m/60)} ชั่วโมงที่แล้ว`:new Intl.DateTimeFormat('th-TH',{dateStyle:'medium'}).format(new Date(date));};

/* ---------- presentation copy per first job (display only; game rules live in shared data) ---------- */
const ICON:Record<string,string>={swordsman:'<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',archer:'<path d="M5 3c8 3 13 8 16 16"/><path d="M5 3l16 16"/><path d="M3 12h9M9 9l3 3-3 3"/>',mage:'<path d="M6 21 17 10"/><circle cx="18.5" cy="5.5" r="3"/>',healer:'<path d="M10 3h4M10 3v5L6 14a6 6 0 1 0 12 0l-4-6V3"/><path d="M7.5 15h9"/>',shaman:'<path d="M4 6c3-2 13-2 16 0v5c0 5-4 9-8 9s-8-4-8-9z"/><path d="M8 11h2M14 11h2"/>',boxer:'<path d="M7 11V7a2 2 0 0 1 4 0v3M11 10V6a2 2 0 0 1 4 0v4M15 10V7a2 2 0 0 1 4 0v6c0 4-3 7-7 7-3 0-6-2-6-6v-3a2 2 0 0 1 4 0"/>',rogue:'<path d="m14 4 6 6-9 9-4 1 1-4z"/><path d="M5 19 3 21M12 6l6 6"/>'};
const FLAVOR:Record<string,{en:string;tint:string;tag:string;range:string;role:[string,string][];diff:number;desc:string;stats:number[];preview:[number,string,string][]}>={
 swordsman:{en:'SWORDSMAN',tint:'#e8c88a',tag:'“ดาบนำหน้า ใจไม่ถอย”',range:'ระยะประชิด',role:[['a','โจมตี'],['d','แท็งก์']],diff:1,desc:'นักสู้แนวหน้า ฟันเร็วและทนทาน เหมาะกับนักผจญภัยมือใหม่ที่อยากบุกตะลุยทุ่งและป่า',stats:[],preview:[]},
 archer:{en:'ARCHER',tint:'#8fd18a',tag:'“ลูกศรไม่เคยพลาดเป้า”',range:'ระยะไกล',role:[['a','โจมตีระยะไกล']],diff:2,desc:'ยิงจากระยะไกล คล่องตัว คุมระยะเก่ง',stats:[3,5,2,2,5,3],preview:[[3,'ยิงคู่','เป้าเดียว'],[2,'ฝนธนู','วงกว้าง'],[4,'ถอยยิง','หลบ']]},
 mage:{en:'MAGE',tint:'#c495f2',tag:'“ปลดปล่อยพลังธาตุ”',range:'ระยะไกล',role:[['a','เวทวงกว้าง']],diff:3,desc:'ร่ายเวทธาตุรุนแรง แต่ตัวบาง ต้องคุมระยะดี',stats:[1,2,2,6,4,2],preview:[[5,'ลูกไฟ','เป้าเดียว'],[2,'ดาวตก','วงกว้าง'],[6,'โล่น้ำแข็ง','ป้องกัน']]},
 healer:{en:'HEALER',tint:'#6cc3f2',tag:'“ทุกบาดแผลมีทางรักษา”',range:'กลาง',role:[['d','ซัพพอร์ต']],diff:2,desc:'รักษาและเสริมพลังเพื่อน หัวใจของปาร์ตี้',stats:[2,2,4,5,3,3],preview:[[6,'สมานแผล','รักษา'],[5,'ยาบำรุง','บัฟ'],[1,'ไม้เท้าตี','ประชิด']]},
 shaman:{en:'SHAMAN',tint:'#a6a0f0',tag:'“สื่อสารกับวิญญาณ”',range:'กลาง',role:[['a','คำสาป'],['d','ควบคุม']],diff:3,desc:'เรียกวิญญาณและสาปศัตรู เล่นยากแต่ทรงพลัง',stats:[2,3,3,5,3,3],preview:[[5,'กระสุนวิญญาณ','ไกล'],[2,'ไฟนรก','วงกว้าง'],[6,'ผีบรรพบุรุษ','บัฟ']]},
 boxer:{en:'BOXER',tint:'#ffb38a',tag:'“หมัดเร็ว ใจกล้า”',range:'ระยะประชิด',role:[['a','คอมโบ']],diff:2,desc:'ต่อยรัวเป็นคอมโบ เคลื่อนไหวเร็ว',stats:[5,5,3,1,3,2],preview:[[1,'หมัดตรง','เป้าเดียว'],[3,'ศอกกลับ','สตั้น'],[2,'เตะกวาด','วงกว้าง']]},
 rogue:{en:'ROGUE',tint:'#f2a4a7',tag:'“เงาที่มองไม่เห็น”',range:'ระยะประชิด',role:[['a','ลอบโจมตี']],diff:3,desc:'ซ่อนตัว ลอบแทง ทำคริติคอลสูง',stats:[3,6,2,2,4,4],preview:[[3,'แทงข้างหลัง','คริ'],[4,'ซ่อนตัว','หลบ'],[2,'มีดบิน','ไกล']]},
};
const BRANCH_TH:Record<string,string>={guardian:'โล่ · ป้องกันทีม',berserker:'ดาเมจรุนแรง',ranger:'กับดัก · สัตว์เลี้ยง',marksman:'ยิงแม่นจุดตาย',wizard:'ดาเมจเวท',sage:'สนับสนุน',physician:'ฮีลหนัก',alchemist:'ยาพิเศษ',spirit_master:'อัญเชิญ',exorcist:'ขับไล่',champion:'หมัดหนัก',monk:'ลมปราณ',assassin:'ฆ่าเป้าเดียว',shadow:'พิษ · เงา'};
const STAT_KEYS=['str','agi','vit','int','dex','luk'],STAT_TH=['พลัง','ว่องไว','อดทน','ปัญญา','แม่นยำ','โชค'];
const tier1=jobsData.jobs.filter(j=>j.tier===1);
const playable=(id:string)=>!!tier1.find(j=>j.id===id)?.available;
const skillIcon=(icon:number,cell:number)=>`background-position:-${(icon%4)*cell}px -${Math.floor(icon/4)*cell}px`;

/* ---------- drifting light motes ---------- */
for(const c of document.querySelectorAll<HTMLCanvasElement>('.cs-fx')){
 const g=c.getContext('2d')!,P=Array.from({length:60},()=>({x:Math.random(),y:Math.random(),r:Math.random()*2+.6,v:Math.random()*.00045+.00015,w:Math.random()*6.28,a:Math.random()*.55+.2}));
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const tick=()=>{if(c.width!==c.clientWidth||c.height!==c.clientHeight){c.width=c.clientWidth;c.height=c.clientHeight;}g.clearRect(0,0,c.width,c.height);
  if(c.offsetParent)for(const p of P){if(!reduce){p.y-=p.v;p.w+=.02;p.x+=Math.sin(p.w)*.0002;if(p.y<-.02){p.y=1.02;p.x=Math.random();}}const x=p.x*c.width,y=p.y*c.height,grd=g.createRadialGradient(x,y,0,x,y,p.r*5);grd.addColorStop(0,`rgba(255,226,160,${p.a})`);grd.addColorStop(1,'rgba(255,226,160,0)');g.fillStyle=grd;g.beginPath();g.arc(x,y,p.r*5,0,6.28);g.fill();}
  requestAnimationFrame(tick);};requestAnimationFrame(tick);
}

/* ---------- hero previews ---------- */
mountPreview($<HTMLCanvasElement>('#select-hero'),{motion:'idle',direction:'SE',hd:true});
mountPreview($<HTMLCanvasElement>('#create-preview'),{motion:'idle',direction:'SE',hd:true});

/* ---------- select screen ---------- */
let portraitUrl:Promise<string>|null=null;
const portrait=()=>portraitUrl??=assetJSON<Record<string,{webp:string}>>('/texture-manifest.json?v='+import.meta.env.VITE_BUILD_ID).then(m=>m['/assets/hero-painted/portrait-v1.png'].webp);
function showSelected(){
 const c=characters.find(x=>x.id===selectedId);
 $('#enter-world').toggleAttribute('disabled',!c);$('#delete-selected').toggleAttribute('disabled',!c);
 $('#sel-sheet').hidden=!c;selectScreen.classList.toggle('cs-empty',!c);
 if(!c){$('#sel-crest').innerHTML='';$('#sel-name').textContent='ยังไม่มีตัวละคร';$('#sel-where').textContent='สร้างนักผจญภัยคนแรกของคุณ';$('#enter-world').firstChild!.textContent='เข้าสู่โลก';return;}
 const job=needsJob(c)?'':c.jobId||'swordsman',jobRow=jobsData.jobs.find(j=>j.id===job);
 $('#sel-crest').innerHTML=job?`<svg viewBox="0 0 24 24">${ICON[jobRow?.parent||job]||ICON.swordsman}</svg>${jobName(job)} · ${(FLAVOR[jobRow?.parent||job]?.en)||''}`:'ยังไม่ได้เลือกอาชีพ';
 $('#sel-name').textContent=c.name;
 $('#sel-where').innerHTML='';const where=document.createElement('span');where.innerHTML=`กำลังผจญภัยที่ <b></b> · เล่นล่าสุด ${ago(c.lastPlayedAt)}`;where.querySelector('b')!.textContent=MAP_TH[c.mapId]||'นครที่ถูกลืมเลือน';$('#sel-where').append(where);
 $('#sel-lv').textContent=String(c.level);$('#sel-lvnote').innerHTML=`ระดับ · ${job?jobName(job):'—'}<br>Job Lv ${c.jobLevel||1}`;
 const need=statsData.expToNext[(c.level||1)-1]||1,xp=Math.min(1,(c.xp||0)/need);
 const jt=jobRow?.tier===2?jobsData.expToNext.tier2:jobsData.expToNext.tier1,jneed=jt[(c.jobLevel||1)-1]||1,jxp=Math.min(1,(c.jobExp||0)/jneed);
 $('#sel-xp').style.width=xp*100+'%';$('#sel-xpt').textContent=(xp*100).toFixed(1)+'%';$('#sel-jxp').style.width=jxp*100+'%';$('#sel-jxpt').textContent=(jxp*100).toFixed(1)+'%';
 $('#sel-gold').textContent=fmt(c.gold||0);$('#sel-kills').textContent=fmt(c.kills||0);$('#sel-last').textContent=ago(c.lastPlayedAt);
 $('#enter-world').firstChild!.textContent=needsJob(c)?'เลือกอาชีพ':'เข้าสู่โลก';
 grid.querySelectorAll<HTMLElement>('[data-id]').forEach(b=>b.classList.toggle('sel',b.dataset.id===selectedId));
}
async function refresh(){
 ({characters}=await api('/characters'));const pic=await portrait();
 if(!characters.some(c=>c.id===selectedId))selectedId=[...characters].sort((a,b)=>+new Date(b.lastPlayedAt)-+new Date(a.lastPlayedAt))[0]?.id||'';
 grid.replaceChildren();
 for(let i=0;i<3;i++){const c=characters[i],card=document.createElement('button');card.type='button';
  if(c){card.className='cs-card';card.dataset.id=c.id;const job=needsJob(c)?'':c.jobId;
   card.innerHTML=`<img class="art" alt=""><span class="info"><small></small><b></b></span><span class="lv">${c.level}<small>Lv</small></span>`;
   card.querySelector('img')!.src=pic;card.querySelector('small')!.textContent=`${job?jobName(job):'ยังไม่มีอาชีพ'} · ${MAP_TH[c.mapId]||'นคร'}`;card.querySelector('b')!.textContent=c.name;
   card.onclick=()=>{selectedId=c.id;showSelected();};card.ondblclick=()=>enter();
  }else{card.className='cs-card empty';card.innerHTML=`<span><span class="plus">+</span><b>สร้างตัวละคร</b><small>ช่องว่าง ${i+1} / 3</small></span>`;card.onclick=()=>openCreate();}
  grid.append(card);}
 showSelected();
 const requested=new URLSearchParams(location.search).get('chooseJob');const pending=characters.find((c:any)=>c.id===requested&&needsJob(c));if(pending)openCreate(pending);
}
async function enter(){const c=characters.find(x=>x.id===selectedId);if(!c)return;if(needsJob(c)){openCreate(c);return;}
 const b=$<HTMLButtonElement>('#enter-world');b.disabled=true;try{await post(`/characters/${c.id}/select`);location.assign('/play.html');}catch(e){showError(error,e);b.disabled=false;}}
$('#enter-world').onclick=()=>void enter();
$('#delete-selected').onclick=()=>{const c=characters.find(x=>x.id===selectedId);if(!c)return;deleteId=c.id;$('#delete-name').textContent=c.name;removeDialog.showModal();};

/* ---------- create screen ---------- */
const cards=$('#creation-job-cards');
cards.innerHTML=tier1.map(j=>{const f=FLAVOR[j.id];return `<label class="cs-cls${j.available?'':' lock'}" style="--tint:${f?.tint||'#e8c88a'}"><input type="radio" name="jobId" value="${j.id}" ${j.available?'':'data-locked="1"'}><i><svg viewBox="0 0 24 24">${ICON[j.id]||ICON.swordsman}</svg></i><span><b>${j.nameTh}</b><small>${f?.en||''}</small></span>${j.available?'':'<em>เร็ว ๆ นี้</em>'}</label>`;}).join('');
function showClass(id:string){
 currentJob=id;const j=tier1.find(x=>x.id===id)!,f=FLAVOR[id],open=playable(id);
 cards.querySelectorAll<HTMLInputElement>('[name=jobId]').forEach(r=>{r.checked=r.value===id;r.closest('label')!.classList.toggle('sel',r.value===id);});
 $('#cr-en').textContent=f.en;$('#cr-th').textContent=j.nameTh;$('#cr-tag').textContent=f.tag;$('#cr-range').textContent=f.range;$('#cr-desc').textContent=f.desc;
 $('#cr-role').innerHTML=f.role.map(([k,t])=>`<span class="${k}">${t}</span>`).join('');
 $('#cr-diff').innerHTML=[1,2,3].map(n=>`<em class="${n<=f.diff?'on':''}"></em>`).join('');
 // a playable job shows its real starting stats and skills; the rest show the planned kit
 const stats=open?STAT_KEYS.map(k=>(statsData.defaultBuild.baseStats as any)[k]):f.stats;
 const sk=open?(skillsData.skills as any[]).filter(s=>s.jobId===id&&!s.passive&&!s.requires?.length).slice(0,3).map(s=>[s.icon,s.nameTh,s.kind==='area'?'วงกว้าง':s.effect==='taunt'?'ยั่วยุ':'เป้าเดียว'] as [number,string,string]):f.preview;
 $('#cr-skills').innerHTML=sk.map(([ic,n,t])=>`<span class="cs-sk${open?'':' lock'}"><i class="job-icon" style="${skillIcon(ic,44)}"></i>${n}<small>${t}</small></span>`).join('');
 const branches=jobsData.jobs.filter(x=>x.tier===2&&x.parent===id);
 $('#cr-branch').innerHTML=branches.map(b=>`<span><b>${b.nameTh}</b>${BRANCH_TH[b.id]||''}</span>`).join('')||'<span>เร็ว ๆ นี้</span>';
 const max=Math.max(6,...stats);
 $('#cr-bars').innerHTML=stats.map((v,k)=>`<div class="cs-bar">${STAT_TH[k]}<span><i style="width:${v/max*100}%"></i></span><b>${v}</b></div>`).join('');
 const R=56,at=(k:number,r:number)=>[Math.cos(-Math.PI/2+k*Math.PI/3)*r,Math.sin(-Math.PI/2+k*Math.PI/3)*r],poly=(f2:(k:number)=>number)=>STAT_KEYS.map((_,k)=>at(k,f2(k)).map(n=>n.toFixed(1)).join(',')).join(' ');
 $('#cr-radar').innerHTML=[.33,.66,1].map(s=>`<polygon points="${poly(()=>R*s)}" fill="none" stroke="rgba(255,255,255,.1)"/>`).join('')+STAT_KEYS.map((n,k)=>{const[x,y]=at(k,R+14);return `<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle">${n.toUpperCase()}</text>`;}).join('')+`<polygon points="${poly(k=>R*stats[k]/max)}" fill="color-mix(in srgb,${f.tint} 25%,transparent)" stroke="${f.tint}" stroke-width="1.6"/>`;
 createScreen.classList.toggle('cs-locked',!open);$('#cr-lock').hidden=open;$('#cr-lock').innerHTML=`🔒 <b>${j.nameTh}</b> จะเปิดให้เล่นเร็ว ๆ นี้`;
 checkName();
}
cards.addEventListener('change',e=>{const r=e.target as HTMLInputElement;if(r.name==='jobId')showClass(r.value);});
// mirrors the server rule for quick feedback (Thai, Latin incl. accents, digits); the server still decides
const NAME_OK=/^[฀-๿a-zA-Z0-9À-ɏ]{2,12}$/;
function checkName(){
 const v=nameInput.value,n=[...v].length,ok=!!pickId||NAME_OK.test(v),st=$('#name-state');
 $('#name-count').textContent=`${n} / 12`;st.className='cs-st '+(ok?'ok':'bad');
 st.querySelector('b')!.textContent=pickId?'ชื่อเดิม':!v?'ใส่ชื่อ':ok?'✓ ใช้ได้':/\s/.test(v)?'ห้ามเว้นวรรค':n<2?'สั้นไป':'ไทย/อังกฤษ/ตัวเลข';
 $<HTMLButtonElement>('#create-submit').disabled=!ok||!playable(currentJob);
}
nameInput.addEventListener('input',checkName);
const POOL=['แอริน','ธารา','ภูผา','ลมหนาว','ดาวเหนือ','ไพลิน','อัคนี','สายฟ้า','ตะวัน','Kira','Ren','Mira'];
$('#name-dice').onclick=()=>{nameInput.value=POOL[Math.floor(Math.random()*POOL.length)]+(Math.random()<.5?'':String(Math.floor(Math.random()*90+10)));checkName();nameInput.focus();};
function show(screen:'select'|'create'){selectScreen.hidden=screen!=='select';createScreen.hidden=screen!=='create';}
function openCreate(c?:any){
 pickId=c?.id||'';nameInput.value=c?.name||'';nameInput.disabled=!!c;$('#name-dice').hidden=!!c;
 $('#create-title').textContent=c?'เลือกอาชีพก่อนออกผจญภัย':'สร้างนักผจญภัยคนใหม่';$('#create-slot').textContent=c?`· ${c.name}`:`· ช่อง ${characters.length+1} / 3`;
 $('#create-submit').firstChild!.textContent=c?'ยืนยันอาชีพ':'เริ่มการผจญภัย';$('#create-error').hidden=true;
 showClass(tier1.find(j=>j.available)?.id||'swordsman');show('create');if(!c)nameInput.focus();
}
$('[data-back]').onclick=()=>show('select');
$<HTMLFormElement>('#create-form').onsubmit=async e=>{e.preventDefault();const button=$<HTMLButtonElement>('#create-submit');if(!playable(currentJob))return;button.disabled=true;
 try{if(pickId){await post(`/characters/${pickId}/job`,{jobId:currentJob});await post(`/characters/${pickId}/select`);location.assign('/play.html');}
  else{const out=await post('/characters',{name:nameInput.value,jobId:currentJob});selectedId=out?.character?.id||selectedId;show('select');await refresh();}}
 catch(err){showError($('#create-error'),err);}finally{checkName();}};

$<HTMLButtonElement>('#confirm-delete').onclick=async function(this:HTMLButtonElement){this.disabled=true;try{await api(`/characters/${deleteId}`,{method:'DELETE'});removeDialog.close();if(selectedId===deleteId)selectedId='';await refresh();}catch(e){showError(error,e);removeDialog.close();}finally{this.disabled=false;}};
document.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog')!.close());
void requireLogin().then(async me=>{if(!me)return;$('#account-name').textContent=me.account.kind==='guest'?'ผู้เยี่ยมชม':me.account.displayName;$('#link-note').hidden=me.account.kind!=='guest';await mountAccountChip();window.tnBoot.stage(2);await refresh();window.tnBoot.stage(4);}).catch(e=>{showError(error,e);window.tnBoot.fail('เปิดสมุดตัวละครไม่สำเร็จ กรุณาลองใหม่');});
