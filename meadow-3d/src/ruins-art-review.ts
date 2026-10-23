import {GameCanvas2D} from './game-2d-renderer';
import {createGame,loadGameData,buildForLevel,setAuto,moveTo,step,DEFAULT_AUTO,type Game} from '@the-beginning-online/shared';
import {LAYOUTS,ruinsWalkable} from '@the-beginning-online/shared/maps';
import {gridPath} from './hud-path';
import beforeImage from '../art/ruins-painted-v1/uat-before.png';
const $=(id:string)=>document.getElementById(id)!;
const view=new GameCanvas2D(await fetch('/texture-manifest.json').then(r=>r.json()));$('world').append(view.canvas);
await view.init('ruins');
const data=loadGameData();let game=createGame(37,buildForLevel('swordsman',30,data),'ruins-review',data,'ruins');game.p.name='นักสำรวจ';game.p.autoCfg={...DEFAULT_AUTO,elites:false,range:'far'};
let route:{x:number;z:number}[]=[],next=0,goal:{x:number;z:number}|null=null;
const keys=new Set<string>();
const places:Record<string,number[]>={entry:[-58,0],homes:[-39,-24],market:[-22,28],archive:[13,-28],temple:[43,-20]};
function reset(){route=[];goal=null;game.destination=null;game.target=null;setAuto(game,false);keys.clear();drawAuto();}
function drawAuto(){const b=$('auto');b.textContent=game.p.auto?'AUTO เปิด (F)':'AUTO ปิด (F)';b.setAttribute('aria-pressed',String(game.p.auto));}
function place(name:string){reset();const [x,z]=places[name];for(let r=0;r<6;r+=.5){let found=false;for(let i=0;i<16;i++){const a=i*Math.PI/8,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(ruinsWalkable(px,pz,.4)){game.p.x=px;game.p.z=pz;found=true;break;}}if(found)break;}game.p.hp=game.p.maxHp;game.p.mp=game.p.maxMp;}
function auto(){route=[];goal=null;game.destination=null;setAuto(game,!game.p.auto);drawAuto();}
$('place').onchange=e=>place((e.target as HTMLSelectElement).value);$('auto').onclick=auto;
$('overview').onclick=()=>{view.overview=!view.overview;$('overview').setAttribute('aria-pressed',String(view.overview));};
$('zoom').oninput=e=>{view.zoomHeight=innerHeight/Number((e.target as HTMLInputElement).value);};view.zoomHeight=innerHeight/30;
const dialog=$('comparison') as HTMLDialogElement;($('old-image') as HTMLImageElement).src=beforeImage;
$('before').onclick=()=>{reset();dialog.showModal();};$('close').onclick=()=>dialog.close();
view.canvas.onclick=e=>{if(view.overview)return;const p=view.ground(e.clientX,e.clientY);if(!ruinsWalkable(p.x,p.z,.4))return;reset();goal=p;route=gridPath(game.p,p,(x,z)=>ruinsWalkable(x,z,.3),LAYOUTS.ruins);next=0;view.canvas.focus();};
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||dialog.open)return;if(e.code==='KeyF'){e.preventDefault();auto();return;}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();if(!keys.size)reset();keys.add(e.code);}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());addEventListener('resize',()=>view.resize());place('entry');
let last=performance.now(),uiTime=0;
function frame(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;
 const right=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),down=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
 if(route.length){const p=route[0];if(Math.hypot(game.p.x-p.x,game.p.z-p.z)<.3){route.shift();next=0;}else if(game.time>=next){moveTo(game,p.x,p.z);next=game.time+.6;}}
 game.p.invulnerable=1;step(game,dt,{x:right*.83205+down*.5547,z:-right*.5547+down*.83205});
 view.render(game,[],dt,game.time);
 if(($('footprints') as HTMLInputElement).checked){const c=view.ctx;c.strokeStyle='#edc17899';c.lineWidth=1;for(const o of LAYOUTS.ruins.obstacles){const p=view.screen(o.x,o.z);c.beginPath();c.ellipse(p.x,p.y,o.r*view.scale*.95,o.r*view.scale*.6,0,0,Math.PI*2);c.stroke();}}
 if(goal&&route.length){const c=view.ctx;c.strokeStyle='#f5dc94bb';c.lineWidth=2;c.beginPath();[game.p,...route].forEach((p,i)=>{const s=view.screen(p.x,p.z);i?c.lineTo(s.x,s.y):c.moveTo(s.x,s.y)});c.stroke();}
 if(now-uiTime>150){uiTime=now;$('status').textContent=`${game.p.x.toFixed(1)}, ${game.p.z.toFixed(1)} · ${game.p.auto?({seek:'หาเป้าหมาย',fight:'กำลังต่อสู้',retreat:'กลับแคมป์',idle:'พัก'} as Record<string,string>)[game.p.autoState]??game.p.autoState:route.length?'กำลังเดิน':'พร้อมเดิน'} · ปราบ ${game.p.kills} ตัว`;}
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);
