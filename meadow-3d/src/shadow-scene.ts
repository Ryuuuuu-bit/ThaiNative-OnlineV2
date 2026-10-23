import './shadow-scene.css';
import {GameCanvas2D} from './game-2d-renderer';
import {createCityExplorer,project} from './city-2d-sim';
import {NetworkWorld} from './net/world';
import {assetJSON} from './asset-request';
import {loadUIFonts} from './fonts';
import {PREVIEW_FACING} from './hero-presentation';
import {facing8For,WALK_DIRECTIONS,type Facing} from './sprite-animation';
import {ShadowHero,parseShadowManifest,SHADOW_MOTIONS,type ShadowLook,type ShadowMotion} from './shadow-hero';

const $=<T extends HTMLElement>(id:string)=>document.querySelector<T>(id)!;
const status=$<HTMLOutputElement>('#status'),look=$<HTMLSelectElement>('#look');
const explorer=createCityExplorer(),game=new NetworkWorld().game,keys=new Set<string>();
let ready=false,paused=false,previous=0,time=0,loadError='',destination:{x:number;z:number}|undefined;
let renderer:GameCanvas2D,hero:ShadowHero,selected:ShadowMotion='idle';
const labels={idle:'ยืน',walk:'เดิน',attack:'โจมตี',cast:'ร่ายเวท',hit:'โดนโจมตี',dodge:'หลบ',death:'ตาย'};
function selectMotion(motion:ShadowMotion){selected=motion;hero.motion=motion;hero.clock=0;destination=undefined;refresh();}
function refresh(){
 if(look.disabled)return;
 const facing=facing8For(game.p.fx,game.p.fz);
 document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===selected)));
 document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===facing)));
 status.textContent=loadError||`${look.selectedOptions[0].textContent} · ${labels[game.p.moving?'walk':selected]} · ${facing} · ${game.p.x.toFixed(1)}, ${game.p.z.toFixed(1)}`;
}
async function init(){
 const [textures,manifest]=await Promise.all([assetJSON<Record<string,{webp:string}>>('/texture-manifest.json'),assetJSON('/assets/hero-shadow-8dir-v1/manifest.json'),loadUIFonts()]);
 hero=new ShadowHero(parseShadowManifest(manifest));hero.motion='idle';renderer=new GameCanvas2D(textures);renderer.shadowHero=hero;renderer.zoomHeight=16;
 $('#world').append(renderer.canvas);await Promise.all([renderer.init('city_plaza'),hero.load(renderer.assets,'male-iron')]);
 Object.assign(game.p,explorer.player,{id:'shadow-scene-trial',name:'นักฆ่าในเงามืด',hp:120,maxHp:120});
 for(const motion of SHADOW_MOTIONS){const b=document.createElement('button');b.textContent=labels[motion];b.dataset.motion=motion;b.onclick=()=>selectMotion(motion);$('#motions').append(b);}
 for(const direction of WALK_DIRECTIONS){const b=document.createElement('button');b.textContent=direction;b.dataset.direction=direction;b.onclick=()=>{const [fx,fz]=PREVIEW_FACING[direction];Object.assign(explorer.player,{fx,fz});Object.assign(game.p,{fx,fz});destination=undefined;refresh();};$('#directions').append(b);}
 look.onchange=async()=>{const wasPaused=paused;look.disabled=true;loadError='';keys.clear();destination=undefined;paused=true;status.textContent='กำลังโหลดอุปกรณ์…';try{await hero.load(renderer.assets,look.value as ShadowLook);hero.clock=0;}catch{loadError='โหลดอุปกรณ์ไม่สำเร็จ ลองเลือกใหม่';look.value=hero.look;}finally{look.disabled=false;paused=wasPaused;refresh();}};
 $('#zoom').onchange=()=>{renderer.zoomHeight=Number($<HTMLSelectElement>('#zoom').value);};
 $('#home').onclick=()=>{explorer.reset();destination=undefined;selectMotion('idle');};
 $('#pause').onclick=()=>{paused=!paused;keys.clear();$('#pause').textContent=paused?'เล่นต่อ':'หยุดภาพ';};
 renderer.canvas.onpointerdown=e=>{renderer.canvas.focus();destination=renderer.ground(e.clientX,e.clientY);selected='idle';};
 window.addEventListener('resize',()=>renderer.resize());
 ready=true;refresh();renderer.canvas.focus();requestAnimationFrame(frame);
}
const controls=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
window.addEventListener('keydown',e=>{if(!ready||e.target!==renderer.canvas||!controls.includes(e.code))return;e.preventDefault();keys.add(e.code);destination=undefined;});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{keys.clear();previous=0;});
function frame(now:number){
 requestAnimationFrame(frame);const dt=previous?Math.min(.05,(now-previous)/1000):0;previous=now;if(!ready||document.hidden)return;
 if(!paused){
  let h=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),v=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  if(destination){const dx=destination.x-explorer.player.x,dz=destination.z-explorer.player.z;if(Math.hypot(dx,dz)<.18)destination=undefined;else{const d=project(dx,dz);h=d.x;v=d.y;}}
  explorer.step(h,v,dt);if(destination&&!explorer.player.moving)destination=undefined;
  Object.assign(game.p,explorer.player);const motion=game.p.moving?'walk':selected;if(hero.motion!==motion)hero.clock=0;hero.motion=motion;hero.clock+=dt;time+=dt;game.time=time;
 }
 renderer.render(game,[],paused?0:dt,time);refresh();
}
void init().catch(error=>{status.textContent='โหลดฉากไม่สำเร็จ: '+(error instanceof Error?error.message:'กรุณาลองใหม่');console.error(error);});
