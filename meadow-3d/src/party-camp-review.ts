import './fonts.css';
import './social.css';
import {mountParty,type PartyState,type PartyMember} from './party-ui';
import {GameCanvas2D} from './game-2d-renderer';
import {createGame,loadGameData} from '@thainative/shared';
import './style.css';
import './hud-qol.css';
import './ui-glass.css';
import './ui-windows.css';
import './ui-theme.css';
const style=document.createElement('style');style.textContent=`*{box-sizing:border-box}body{margin:0;background:#10282a;color:#dce6d9;font-family:var(--font-ui)}#world{position:fixed;inset:0}#world canvas{position:absolute;inset:0}#ui{position:fixed;inset:0;pointer-events:none}#open-review{position:fixed;left:20px;top:20px;padding:10px 16px;color:#d8e7cf;background:#16352c;border:1px solid #96b08466;border-radius:7px}.camp-review-tools{display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:8px 24px;background:#05191ea3;border-bottom:1px solid #a4b47633;color:#9cb193;font-size:9px}.camp-review-tools>span{margin-right:auto}.camp-review-tools button{font-size:9px!important;padding:4px 9px!important;min-height:26px}.camp-review-tools button.active{border-color:#d6bd7c!important;color:#ecd696!important}.mobile-review{margin:0;display:grid;place-items:center;min-height:100vh;background:#08171b}.mobile-review iframe{border:1px solid #a6b69266;border-radius:16px;width:390px;height:min(844px,96vh);background:#142f2b}.mobile-review>p{position:fixed;top:5px;left:20px;font-size:12px;color:#d5cc9d}@media(max-width:650px){.camp-review-tools{padding:6px 12px}.camp-review-tools>span{width:100%;font-size:8px}}`;
document.head.append(style);
if(new URLSearchParams(location.search).has('mobile')){document.body.className='mobile-review';document.body.innerHTML='<p>พรีวิวมือถือ · 390px · ยังไม่ขึ้นเว็บจริง</p><iframe title="พรีวิวปาร์ตี้บนมือถือ" src="/party-camp-review.html?embedded=1"></iframe>';}else{
 const samples:PartyMember[]=[{id:'you',name:'อรุณ',online:true,level:18,jobId:'swordsman',hp:412,maxHp:480,mp:106,maxMp:140,mapId:'meadow'},{id:'jade',name:'จันทร์เจ้า',online:true,level:17,jobId:'swordsman',hp:351,maxHp:420,mp:82,maxMp:130,mapId:'meadow'},{id:'mist',name:'เมฆา',online:true,level:16,jobId:'swordsman',hp:300,maxHp:390,mp:95,maxMp:120,mapId:'meadow'},{id:'pine',name:'ไผ่เงิน',online:true,level:15,jobId:'swordsman',hp:280,maxHp:370,mp:60,maxMp:115,mapId:'forest'},{id:'dawn',name:'แสงดาว',online:false},{id:'rain',name:'สายฝน',online:true,level:14,jobId:'swordsman',hp:0,maxHp:350,mp:50,maxMp:110,mapId:'meadow',dead:true}];
 samples.push({id:'new1',name:'ตะวัน',online:true,level:12,jobId:'swordsman',hp:250,maxHp:300,mp:80,maxMp:100,mapId:'meadow'},{id:'new2',name:'พฤกษา',online:true,level:15,jobId:'swordsman',hp:300,maxHp:350,mp:90,maxMp:110,mapId:'meadow'});
 let state:PartyState|null={id:'local-camp',leader:'you',members:structuredClone(samples.slice(0,3))};
 const party=mountParty({you:()=> 'you',enabled:()=>true,chat:()=>{party.open();notice('พรีวิวแชทปาร์ตี้ · ยังไม่ส่งข้อความ');},send:(raw:any)=>{
  if(raw.op==='online'){queueMicrotask(()=>party.receive({t:'partyOnline',mapId:'meadow',list:samples.filter(m=>m.id!=='you'&&m.online&&m.mapId==='meadow'&&!state?.members.some(x=>x.id===m.id)).map(m=>({...m,status:m.id==='new2'?'party':'available'}))}));return;}
  if(raw.op==='inviteNearby')raw={op:'invite',name:samples.find(m=>m.id===raw.id)?.name};

  if(raw.op==='create')state={id:'local-camp',leader:'you',members:structuredClone(samples.slice(0,1))};
  if(raw.op==='leave'||raw.op==='disband')state=null;
  if(raw.op==='kick'&&state)state.members=state.members.filter(m=>m.id!==raw.id);
  if(raw.op==='lead'&&state)state.leader=raw.id;
  if(raw.op==='invite'){if(!state)state={id:'local-camp',leader:'you',members:structuredClone(samples.slice(0,1))};const member=samples.find(m=>m.name===raw.name);if(!member||!member.online||state.members.some(m=>m.id===member.id)){notice('ลองเชิญ: จันทร์เจ้า, เมฆา หรือไผ่เงิน');return;}state.members.push(structuredClone(member));queueMicrotask(()=>notice('เพื่อนทดสอบตอบรับคำเชิญแล้ว'));}
  party.receive({t:'partyState',party:state});
 }});
 function notice(text:string){party.receive({t:'chatError',scope:'party',text});}
 const panel=document.querySelector<HTMLDialogElement>('#party-window')!,tools=document.createElement('div');tools.className='camp-review-tools';tools.innerHTML='<span>LOCAL PREVIEW · ข้อมูลสมาชิกตัวอย่าง · ยังไม่ขึ้นเว็บจริง</span>';
 for(const [label,count]of [['3 คน',3],['6 คน',6],['ยังไม่มีปาร์ตี้',0]]as const){const b=document.createElement('button');b.textContent=label;b.type='button';b.onclick=()=>{state=count?{id:'local-camp',leader:'you',members:structuredClone(samples.slice(0,count))}:null;party.receive({t:'partyState',party:state});tools.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));};if(count===3)b.classList.add('active');tools.append(b);}
 panel.querySelector('.party-head')!.after(tools);
 document.querySelector<HTMLButtonElement>('#open-review')!.onclick=party.open;
 party.receive({t:'partyState',party:state});party.open();
 void(async()=>{try{const manifest=await(await fetch('/texture-manifest.json')).json(),renderer=new GameCanvas2D(manifest,'canvas');document.querySelector('#world')!.append(renderer.canvas);await renderer.init('city_plaza');const game=createGame(47,undefined,'camp-review',loadGameData(),'city_plaza');Object.assign(game.p,{x:-13,z:27,name:'อรุณ'});game.enemies=[];renderer.zoomHeight=25;let last=0;function frame(t:number){if(t-last>70){renderer.render(game,[],.07,t/1000);last=t;}requestAnimationFrame(frame);}requestAnimationFrame(frame);window.addEventListener('resize',()=>renderer.resize());}catch(error){console.warn('Camp review backdrop unavailable',error);}})();
}
