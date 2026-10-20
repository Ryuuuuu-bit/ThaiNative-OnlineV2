import {createGame,loadGameData} from '@the-beginning-online/shared';
import type {MapId} from '@the-beginning-online/shared/maps';
import {GameCanvas2D} from './game-2d-renderer';
import {unproject2D} from './game-2d-projection';
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const manifest=await(await fetch('/texture-manifest.json')).json(),renderer=new GameCanvas2D(manifest,'canvas');
$('#world').append(renderer.canvas);
$<HTMLInputElement>('#motion').checked=!renderer.atmosphere.reducedMotion;
$('#motion').onchange=e=>renderer.atmosphere.setMotionPreview((e.target as HTMLInputElement).checked);
const starts:Record<MapId,{x:number;z:number}>={meadow:{x:19,z:-3},city_plaza:{x:-13,z:27},forest:{x:3,z:-30},ruins:{x:0,z:-7},canyon:{x:-16,z:9}};
let map:MapId='meadow',game=createGame(47,undefined,'scenery-review',loadGameData(),map),loading=true,version=0,time=12,last=performance.now(),lastStats=last,frames=0,renderMs=0;
function place(){game.enemies=[];game.drops=[];Object.assign(game.p,starts[map],{name:'นักเดินทาง',fx:1,fz:0});}
place();
async function scene(id:MapId){const token=++version;loading=true;$('#status').textContent='กำลังเตรียมฉาก…';$<HTMLSelectElement>('#scene').disabled=true;
 try{if(token===1)await renderer.init(id);else await renderer.prepareMap(id);if(token!==version)return;map=id;game=createGame(47,undefined,'scenery-review',loadGameData(),map);place();renderer.zoomHeight=30;loading=false;$('#status').textContent='พร้อมแล้ว · ลมเบาและน้ำไหว · ยังไม่ขึ้นเว็บจริง';}
 catch(error){$('#status').classList.add('status-error');$('#status').textContent='โหลดฉากไม่สำเร็จ: '+String(error);console.error(error);}finally{$<HTMLSelectElement>('#scene').disabled=false;}
}
$('#scene').onchange=e=>void scene((e.target as HTMLSelectElement).value as MapId);
for(const id of ['hour','sun','wind']as const){$<HTMLInputElement>('#'+id).oninput=e=>{const value=Number((e.target as HTMLInputElement).value);renderer.atmosphere.configure({[id]:value});$('#'+id+'-value').textContent=id==='hour'?`${Math.floor(value).toString().padStart(2,'0')}:${Math.round(value%1*60).toString().padStart(2,'0')}`:id==='sun'?`${Math.round(value*100)}%`:value===0?'สงบ':value<=.5?'เบา':'แรง';};}
for(const id of ['water','leaves']as const)$<HTMLInputElement>('#'+id).onchange=e=>renderer.atmosphere.configure({[id]:(e.target as HTMLInputElement).checked});
function mode(enabled:boolean){renderer.atmosphere.configure({enabled});$('#before').setAttribute('aria-pressed',String(!enabled));$('#after').setAttribute('aria-pressed',String(enabled));$('#status').textContent=enabled?'บรรยากาศใหม่ · น้ำไหว แสงอุ่น และลมอ่อน':'ภาพเดิม · ปิดชั้นบรรยากาศเพื่อเทียบ';}
$('#before').onclick=()=>mode(false);$('#after').onclick=()=>mode(true);
$('#low').onchange=e=>{renderer.highQuality=!(e.target as HTMLInputElement).checked;renderer.resize();$('#quality-note').textContent=renderer.highQuality?' · ภาพสูง':' · ภาพต่ำ';};
let drag:{id:number;x:number;y:number}|null=null;
renderer.canvas.addEventListener('pointerdown',e=>{if(loading)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};renderer.canvas.setPointerCapture(e.pointerId);});
renderer.canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const d=unproject2D((e.clientX-drag.x)/renderer.scale,(e.clientY-drag.y)/renderer.scale);game.p.x-=d.x;game.p.z-=d.z;drag.x=e.clientX;drag.y=e.clientY;});
for(const name of ['pointerup','pointercancel','lostpointercapture'])renderer.canvas.addEventListener(name,()=>drag=null);
renderer.canvas.addEventListener('wheel',e=>{e.preventDefault();renderer.zoomHeight=Math.max(18,Math.min(46,renderer.zoomHeight*(1+Math.sign(e.deltaY)*.05)));},{passive:false});
window.addEventListener('resize',()=>renderer.resize());
function frame(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(!loading){if(!$<HTMLInputElement>('#pause').checked&&!document.hidden)time+=dt;const start=performance.now();renderer.render(game,[],dt,time);renderMs+=performance.now()-start;frames++;if(now-lastStats>1000){$('#fps').textContent=`${Math.round(frames*1000/(now-lastStats))} FPS`;$('#scene-data').textContent=JSON.stringify({map,time:+time.toFixed(2),renderMs:+(renderMs/frames).toFixed(3),...renderer.snapshot()},null,2);frames=0;renderMs=0;lastStats=now;}}requestAnimationFrame(frame);}
void scene(map);requestAnimationFrame(frame);
