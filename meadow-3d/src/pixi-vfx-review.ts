import {createGame,spawn,loadGameData} from '@the-beginning-online/shared';
import {GameCanvas2D} from './game-2d-renderer';

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const mode=new URLSearchParams(location.search).get('vfx')==='canvas'?'canvas':'pixi';
const autoMeasure=new URLSearchParams(location.search).get('bench')==='1';
const manifest=await (await fetch('/texture-manifest.json')).json();
const renderer=new GameCanvas2D(manifest,mode);
$('world').append(renderer.canvas);
const initStart=performance.now();
await renderer.init('meadow');
const initMs=performance.now()-initStart;
const game=createGame(47,undefined,'vfx-review',loadGameData(),'meadow');
game.enemies=[];game.p.x=0;game.p.z=4;game.p.name='นักดาบแห่งหยก';game.p.fx=1;game.p.fz=0;
const enemy=spawn(game,1.35,4);enemy.hp=enemy.maxHp=100000;enemy.motion='idle';
let time=0,previous=performance.now(),auto=false,combo=0,lastSwing=-1,lastBurst=-1,measuring=false,slow=false;
let profile='normal',sample:{start:number;last:number;intervals:number[];cpu:number[];resolve:(v:any)=>void}|null=null;
const results:any[]=[];
function swing(x=game.p.x,z=game.p.z){
 renderer.event({type:'slash',x,z,dx:1,dz:0,combo:++combo%3,playerId:game.p.id});
 renderer.event({type:'hit',x:x+1.35,z,id:enemy.id,skillId:'basic',playerId:game.p.id,crit:combo%3===0});
 game.p.attack=.22;enemy.hurt=.16;
}
$('swing').onclick=()=>swing();
$('auto').onclick=()=>{auto=!auto;$('auto').textContent=auto?'หยุดฟันต่อเนื่อง':'ฟันต่อเนื่อง';};
$('slow').onclick=()=>{slow=!slow;$('slow').textContent=slow?'กลับความเร็วปกติ':'ดูภาพช้า';};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();if(!measuring)swing();}});
window.addEventListener('resize',()=>renderer.resize());
const percentile=(a:number[],p:number)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]??0;
function frame(now:number){
 const wallDt=Math.min(.05,Math.max(0,(now-previous)/1000)),dt=wallDt*(slow&&!measuring?.25:1);previous=now;time+=dt;
 const start=performance.now();
 if((auto||measuring)&&time-lastSwing>=.55){swing();lastSwing=time;}
 if(measuring&&profile==='stress'&&time-lastBurst>=.10){
  lastBurst=time;
  for(let i=0;i<12;i++){const angle=i*Math.PI/6;swing(Math.cos(angle)*3,4+Math.sin(angle)*2);}
 }
 game.p.attack=Math.max(0,game.p.attack-dt);enemy.hurt=Math.max(0,enemy.hurt-dt);enemy.motionTime+=dt;
 renderer.render(game,[],dt,time);
 const cpu=performance.now()-start;
 if(sample){
  const s=sample;if(now-s.start>=1000){s.intervals.push(now-s.last);s.cpu.push(cpu);}s.last=now;
  if(now-s.start>=6000){sample=null;const intervals=s.intervals;
   s.resolve({profile,fps:1000/(intervals.reduce((a,b)=>a+b,0)/intervals.length),p95FrameMs:percentile(intervals,.95),medianRenderMs:percentile(s.cpu,.5),p95RenderMs:percentile(s.cpu,.95),frames:intervals.length});
  }
 }
 if(Math.floor(time*2)!==Math.floor((time-dt)*2))$('fps').textContent=`FPS ${Math.round(1/Math.max(wallDt,.001))} · ${mode}`;
 requestAnimationFrame(frame);
}
renderer.render(game,[],0,0);requestAnimationFrame(frame);
const load={readyMs:performance.now(),rendererInitMs:initMs,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},engine:renderer.snapshot().swordVfx};
for(const id of ['swing','auto','measure'])$<HTMLButtonElement>(id).disabled=false;
$('status').textContent='พร้อมแล้ว · ทดลองฟันดาบได้เลย';
$('measure').onclick=async()=>{
 if(measuring)return;measuring=true;auto=false;results.length=0;
 for(const id of ['swing','auto','measure'])$<HTMLButtonElement>(id).disabled=true;
 for(const p of ['normal','stress'])for(let round=1;round<=3;round++){
  profile=p;$('status').textContent=`กำลังวัด ${p} รอบ ${round}/3 · กรุณาเปิดหน้านี้ไว้`;
  const result=await new Promise(resolve=>{sample={start:performance.now(),last:performance.now(),intervals:[],cpu:[],resolve};});
  results.push({...result as object,round});
  $('result').textContent=JSON.stringify({mode,load,results},null,2);
 }
 measuring=false;profile='normal';for(const id of ['swing','auto','measure'])$<HTMLButtonElement>(id).disabled=false;
 $('status').textContent='วัดครบแล้ว · ทดลองฟันดาบต่อได้';
};
$('result').textContent=JSON.stringify({mode,load,results},null,2);
if(location.pathname==='/before'||location.pathname==='/after'){
 document.querySelectorAll<HTMLAnchorElement>('header a').forEach(a=>{a.href=a.textContent?.includes('PixiJS')?'/after?vfx=pixi':'/before?vfx=canvas';});
}
if(autoMeasure)setTimeout(()=>$<HTMLButtonElement>('measure').click(),600);
