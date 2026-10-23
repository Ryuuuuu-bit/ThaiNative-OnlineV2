/** Offline fixture using the same renderer, skill actions and status simulation as the game. */
import {GameCanvas2D} from './game-2d-renderer';
import {createGame,spawn,action,step} from '@the-beginning-online/shared';
import {facing8For} from './sprite-animation';
import type {Enemy} from './sim';

const $=<T extends HTMLElement=HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
const axes:Record<string,[number,number]>={SE:[1,-1],SW:[-1,-1],NE:[1,1],NW:[-1,1],S:[0,-1],E:[1,0],N:[0,1],W:[-1,0]};
const keys=new Set<string>();
let game:ReturnType<typeof createGame>,enemy:Enemy,renderer:GameCanvas2D,ready=false,last=performance.now(),time=0,direction='SE',casts=0;

function face(d:string){
 direction=d;
 const [h,u]=axes[d],x=13*h-9*u,z=-9*h-13*u,n=Math.hypot(x,z);
 game.p.fx=x/n;game.p.fz=z/n;
 Object.assign(enemy,{x:game.p.x+game.p.fx*1.5,z:game.p.z+game.p.fz*1.5,vx:0,vz:0});
 enemy.homeX=enemy.wx=enemy.x;enemy.homeZ=enemy.wz=enemy.z;
 for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-dir]'))button.setAttribute('aria-pressed',String(button.dataset.dir===d));
}
function reset(){
 game=createGame();game.enemies=[];game.p.x=0;game.p.z=4;
 game.p.jobId='guardian';game.p.skills.shield_bash=1;game.p.skills.bulwark=1;
 game.p.name='ผู้พิทักษ์ · ตัวละครทดลอง';
 enemy=spawn(game,1.5,4);enemy.hp=enemy.maxHp=100000;
 enemy.behavior={ai:'melee',speed:0,aggroRange:0,attackRange:0,lunge:0,cooldown:999,windup:.5};
 game.target=null;game.events.length=0;casts=0;
 face(direction);renderer?.skillVfx.clear();
 $('#impact').textContent='กด E หรือ R เพื่อทดลอง';
}
function flush(){for(const event of game.events)renderer.event(event);game.events.length=0;}
function cast(skill:'shield_bash'|'bulwark'){
 if(!ready)return;
 const hp=enemy.hp;
 if(action(game,skill)){
  casts++;
  $('#impact').textContent=skill==='shield_bash'?`กระแทกโล่ · ความเสียหาย ${hp-enemy.hp} · ${enemy.statuses?.some(s=>s.id==='stun')?'เป้าหมายมึนงง':'โดนเป้าหมาย'}`:'ป้อมปราการ · เปิดสถานะป้องกัน';
  renderer.canvas.dataset.lastSkill=skill;renderer.canvas.dataset.casts=String(casts);
 }
 flush();
}
async function init(){
 const manifest=await fetch('/texture-manifest.json').then(r=>r.json());
 renderer=new GameCanvas2D(manifest,'canvas');renderer.zoomHeight=14;
 $('#world').append(renderer.canvas);reset();await renderer.init('meadow');ready=true;
 $('#loading').hidden=true;$('#status').textContent='พร้อมลอง · โล่ใหม่โปร่งแสง 50%';
 $('#bash').onclick=()=>cast('shield_bash');$('#bulwark').onclick=()=>cast('bulwark');$('#reset').onclick=reset;
 for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-dir]'))button.onclick=()=>face(button.dataset.dir!);
 $('#zoom').onchange=()=>renderer.zoomHeight=Number($<HTMLSelectElement>('#zoom').value);
 window.addEventListener('resize',()=>renderer.resize());
 window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);
  if(e.repeat)return;
  if(e.code==='KeyE')cast('shield_bash');
  if(e.code==='KeyR')cast('bulwark');
  if(e.code==='Space'){action(game,'attack');flush();}
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
 renderer.canvas.addEventListener('pointerdown',()=>renderer.canvas.focus());
 function tick(now:number){
  const dt=Math.min(.05,(now-last)/1000)*Number($<HTMLSelectElement>('#speed').value);last=now;time+=dt;
  const h=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  const u=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  const x=13*h-9*u,z=-9*h-13*u,n=Math.hypot(x,z)||1;
  game.p.invulnerable=999;step(game,dt,{x:x/n,z:z/n});flush();renderer.render(game,[],dt,time);
  for(const [skill,id]of [['shield_bash','bash'],['bulwark','bulwark']] as const){
   const cd=game.p.cd[skill]||0;
   $<HTMLButtonElement>('#'+id).disabled=cd>0||game.p.castRemaining>0;
   $('#'+id+'-cd').textContent=cd>0?`พร้อมใน ${cd.toFixed(1)} วินาที`:'พร้อมใช้';
  }
  const fx=renderer.skillVfx.snapshot();
  $('#detail').textContent=`${facing8For(game.p.fx,game.p.fz)} · ${fx.kinds.join(', ')||'พร้อมร่าย'}`;
  $('#resources').textContent=`SP ${Math.floor(game.p.mp)} / ${game.p.maxMp} · เป้า ${Math.ceil(enemy.hp).toLocaleString()} HP`;
  renderer.canvas.dataset.kinds=fx.kinds.join(',');
  requestAnimationFrame(tick);
 }
 requestAnimationFrame(tick);
}
init().catch(e=>{$('#load-info').textContent=e.message;$('#status').textContent=e.message;console.error(e);});
