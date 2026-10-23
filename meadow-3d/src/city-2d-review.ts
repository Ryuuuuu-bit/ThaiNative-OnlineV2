import {CityLighting,drawCityWindowGlow} from './city-lighting';
import {heroBodyCalibration} from './city-character-calibration';
import './city-2d-review.css';
import {z} from 'zod';
import { CITY, CITY_LAYOUT, CITY_BUILDINGS } from '@the-beginning-online/shared/maps';
import {facing8For} from './sprite-animation';
import {shadowClipSchema,shadowPose} from './shadow-hero';
import { HERO_METRES,HERO_PIXEL_METRES } from './world-scale';
import { createCityExplorer, project } from './city-2d-sim';

import type {Sprite} from './city-2d-art';
import {DECOR,DISTRICTS,TOUR_STOPS,districtAt,city2dWalkable,NEW_BUILDINGS} from './city-2d-layout';
import {TOWN_NPCS,WAYPOINTS,CITY_EXITS,nearbyWaypoint,nearbyExit,waypointArrival} from './city-2d-locations';
import {loadCity2DScene} from './city-2d-scene';
import {makePaintedGround} from './city-2d-ground';
import {drawFountainWater} from './city-2d-fountain';
import {CITY_GATES} from './city-2d-gates';
import {drawNpcSprite,type NpcSprite} from './city-npc-sprite';
import {CanvasAssets} from './game-2d-assets';
import {loadMapBackdrop} from './game-2d-backdrop';
let backdrop:Awaited<ReturnType<typeof loadMapBackdrop>>;
const cityLighting=new CityLighting();
const cityMotionPreference=matchMedia('(prefers-reduced-motion: reduce)');
type Prop = {glow?:Sprite; x: number; z: number; image: Sprite; label?: string; fade?: boolean; water?: boolean };
const canvas = document.querySelector<HTMLCanvasElement>('#city')!;
const ctx = canvas.getContext('2d')!;
const sim = createCityExplorer(), player = sim.player;
let twilight=false;const showDistricts=true;let speechUntil=0;
const keys = new Set<string>();
let width = 1, height = 1, zoom = 26, overview = false, paused = false, ready = false;
const follow = () => { const p = project(player.x, player.z); return { x: p.x, y: p.y - 4 }; };
let camera = follow(), time = 0, last = 0;
let manifest: Record<string, { webp: string }>;
const props: Prop[] = [];
let paintedSceneAssets=0;
const cacheScale = 28;
const status = document.querySelector('#position')!;
const npcs=TOWN_NPCS;
const npcSprites=new Map<string,NpcSprite>();
const image = async (key: string) => {
  const img = new Image(); img.src = manifest[key]?.webp ?? key;
  await img.decode(); return img;
};

let ground: HTMLCanvasElement, idle: HTMLImageElement, run: HTMLImageElement;
const reviewHeroSchema=z.object({version:z.literal(1),looks:z.object({'male-iron':z.object({idle:shadowClipSchema,walk:shadowClipSchema})})});
let heroManifest:z.infer<typeof reviewHeroSchema>;
let cityScene:Awaited<ReturnType<typeof loadCity2DScene>>;
async function init() {
  [manifest,heroManifest]=await Promise.all([
    fetch('/texture-manifest.json').then(r=>{if(!r.ok)throw Error('โหลดรายการภาพไม่สำเร็จ');return r.json();}),
    fetch('/assets/hero-shadow-8dir-v1/manifest.json').then(r=>{if(!r.ok)throw Error('โหลดข้อมูลตัวละครไม่สำเร็จ');return r.json();}).then(value=>reviewHeroSchema.parse(value)),
  ]);
  const hero=heroManifest.looks['male-iron'];
  if(CITY.empty){
    [idle,run]=await Promise.all([image(hero.idle.url),image(hero.walk.url)]);
    ground=await makePaintedGround();backdrop=await loadMapBackdrop('city_plaza',new CanvasAssets(manifest));
    ready=true;document.querySelector<HTMLElement>('#loading')!.hidden=true;canvas.focus();return;
  }
  [cityScene,idle,run]=await Promise.all([loadCity2DScene(),image(hero.idle.url),image(hero.walk.url)]);
  ground=cityScene.ground;props.push(...cityScene.props);paintedSceneAssets=cityScene.paintedSceneAssets;
  for(const [id,sprite]of cityScene.npcSprites)npcSprites.set(id,sprite);
  backdrop=await loadMapBackdrop('city_plaza',new CanvasAssets(manifest));
  ready=true;document.querySelector<HTMLElement>('#loading')!.hidden=true;canvas.focus();
}
function resize() { const b=canvas.getBoundingClientRect();width=b.width;height=b.height;const dpr=Math.min(devicePixelRatio,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0); }
new ResizeObserver(resize).observe(canvas);
const movementCodes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
function setPause(value:boolean){paused=value;keys.clear();document.querySelector<HTMLElement>('#pause')!.hidden=value===false;if(!value)canvas.focus();}
function toggleOverview(){overview=!overview;document.querySelector('#overview')!.setAttribute('aria-pressed',String(overview));canvas.focus();}
function reset(){sim.reset();camera=follow();overview=false;document.querySelector('#overview')!.setAttribute('aria-pressed','false');canvas.focus();}
window.addEventListener('keydown',e=>{if(e.target!==canvas&&e.code!=='Escape')return;if(movementCodes.includes(e.code)){e.preventDefault();keys.add(e.code);}if(e.repeat)return;if(e.code==='KeyM')toggleOverview();if(e.code==='KeyR')reset();if(e.code==='KeyE')talk();if(e.code==='Escape'){if(travelDialog.open)travelDialog.close();else setPause(!paused);}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{keys.clear();last=0;});
canvas.addEventListener('pointerdown',()=>canvas.focus());
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!overview)zoom=Math.max(14,Math.min(58,zoom*Math.exp(-e.deltaY*.001)));},{passive:false});
document.querySelector('#overview')!.addEventListener('click',toggleOverview);document.querySelector('#home')!.addEventListener('click',reset);
document.querySelector('#resume')!.addEventListener('click',()=>setPause(false));
const tour=document.querySelector<HTMLSelectElement>('#district-tour')!;
const reviewStops=[...TOUR_STOPS,...npcs.map(n=>({...n,id:'npc-'+n.id,name:'NPC · '+n.name})),...CITY_EXITS,...WAYPOINTS.map(p=>({...p,id:'waypoint-'+p.id,name:'วาร์ป · '+p.name}))];
for(const d of reviewStops){const option=document.createElement('option');option.value=d.id;option.textContent=d.name;tour.append(option);}
tour.addEventListener('change',()=>{const d=reviewStops.find(d=>d.id===tour.value);if(!d)return;let found=false;for(let r=0;r<6&&!found;r++)for(let z=-r;z<=r&&!found;z++)for(let x=-r;x<=r&&!found;x++)if(city2dWalkable(d.x+x,d.z+z,.5)){player.x=d.x+x;player.z=d.z+z;found=true;}player.moving=false;keys.clear();overview=false;document.querySelector('#overview')!.setAttribute('aria-pressed','false');camera=follow();canvas.focus();});
document.querySelector('#daylight')!.addEventListener('click',()=>{twilight=!twilight;document.querySelector('#daylight')!.setAttribute('aria-pressed',String(twilight));document.querySelector('#daylight')!.textContent=twilight?'แสงกลางวัน':'แสงเย็น';canvas.focus();});
function talk(){
 if(paused)return;
 const waypoint=nearbyWaypoint(player.x,player.z),exit=nearbyExit(player.x,player.z);if(waypoint||exit){openTravel(waypoint?.id,exit?.destination);return;}
 const npc=npcs.find(n=>Math.hypot(n.x-player.x,n.z-player.z)<3.5);
 const speech=document.querySelector<HTMLElement>('#speech')!;
 if(!npc)return;speech.textContent=`${npc.name} — ${npc.line}`;speech.hidden=false;speechUntil=time+4.5;
}
for(const [id,factor] of [['zoom-in',1.2],['zoom-out',1/1.2]] as const)document.querySelector('#'+id)!.addEventListener('click',()=>{zoom=Math.max(14,Math.min(58,zoom*factor));canvas.focus();});


const travelDialog=document.querySelector<HTMLDialogElement>('#travel-dialog')!;
function openTravel(current?:string,destination?:string){
 keys.clear();player.moving=false;
 document.querySelector('#travel-title')!.textContent=destination?'เส้นทางสู่'+destination:'วงแหวนเดินทาง';
 document.querySelector('#travel-description')!.textContent=destination?'ประตูนี้เตรียมไว้เชื่อม '+destination+' ในฉบับเกมจริง ขณะนี้ทดลองเดินทางได้เฉพาะภายในเมือง':'เลือกจุดหมายภายในเมือง';
 const choices=document.querySelector('#travel-choices')!;choices.replaceChildren();
 if(!destination)for(const p of WAYPOINTS){const button=document.createElement('button');button.textContent=p.name+(p.id===current?' · คุณอยู่ที่นี่':'');button.disabled=p.id===current;button.addEventListener('click',()=>{
   const arrival=waypointArrival(p.id);if(!arrival||!city2dWalkable(arrival.x,arrival.z,.5))return;
   player.x=arrival.x;player.z=arrival.z;tour.value='waypoint-'+p.id;player.moving=false;keys.clear();overview=false;document.querySelector('#overview')!.setAttribute('aria-pressed','false');camera=follow();travelDialog.close();
   const speech=document.querySelector<HTMLElement>('#speech')!;speech.textContent='เดินทางถึง'+p.name;speech.hidden=false;speechUntil=time+3;
 });choices.append(button);}
 travelDialog.showModal();
}
document.querySelector('#travel-close')!.addEventListener('click',()=>travelDialog.close());
travelDialog.addEventListener('close',()=>{keys.clear();canvas.focus();});

function label(text:string,x:number,y:number){ctx.font='500 11px Inter,"Noto Sans Thai",sans-serif';ctx.textAlign='center';const w=ctx.measureText(text).width+18;ctx.fillStyle='#1d2e25dd';ctx.fillRect(x-w/2,y-15,w,23);ctx.fillStyle='#e0d5b5';ctx.fillText(text,x,y);}
function actor(img:HTMLImageElement,x:number,z:number,sw:number,sh:number,col:number,row:number,w:number,h:number,anchor:number,anchorX:number){const p=project(x,z);const s=scale();const q=screen(p);ctx.drawImage(img,col*sw,row*sh,sw,sh,q.x-w*s*anchorX,q.y-h*s*anchor,w*s,h*s);}
function scale(){return overview?Math.min(width/148,height/115):zoom;}
function screen(p:{x:number;y:number}){const s=scale();return {x:width/2+(p.x-camera.x)*s,y:height*.55+(p.y-camera.y)*s};}
function drawAtmosphere(s:number){
 // Steam from busy chimneys; only visible plumes are drawn.
 for(const b of [...CITY_BUILDINGS,...NEW_BUILDINGS].filter(b=>'id'in b?b.id==='forge':['inn','workshop'].includes(b.kind))){
   const p=screen(project(b.x-b.w*.27,b.z,7));if(p.x<-80||p.x>width+80||p.y<-100||p.y>height+100)continue;
   for(let i=0;i<5;i++){const age=(time*.35+i/5)%1;ctx.beginPath();ctx.ellipse(p.x+Math.sin(age*4+i)*s*.28+age*s,p.y-age*3*s,(.18+age*.4)*s,(.25+age*.55)*s,0,0,Math.PI*2);ctx.fillStyle=`rgba(225,222,194,${(1-age)*.16})`;ctx.fill();}
 }
 if(!overview){
   for(let i=0;i<7;i++){const a=time*.07+i*2.4,p=screen(project(-12+Math.cos(a)*5,20+Math.sin(a)*6,1+Math.sin(time+i)*.2));ctx.fillStyle=['#e1b4c6','#d7c58e','#e1ccb1'][i%3];ctx.beginPath();ctx.ellipse(p.x,p.y,.07*s,Math.abs(Math.sin(time*5+i))*.12*s+.02*s,.4,0,Math.PI*2);ctx.fill();}
 }
 if(twilight){ctx.fillStyle='#24345150';ctx.fillRect(0,0,width,height);}
 if(speechUntil&&time>speechUntil){document.querySelector<HTMLElement>('#speech')!.hidden=true;speechUntil=0;}
}
function render(now:number){requestAnimationFrame(render);const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!ready||document.hidden)return;if(!paused&&!travelDialog.open)time+=dt;
  if(!paused&&!travelDialog.open){const h=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));const v=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));sim.step(h,v,dt);}
  const goal=overview?{x:0,y:0}:follow();const smoothing=1-Math.exp(-dt*10);camera.x+=(goal.x-camera.x)*smoothing;camera.y+=(goal.y-camera.y)*smoothing;
  const s=scale(),o=screen({x:0,y:0});ctx.clearRect(0,0,width,height);backdrop.draw(ctx,o,s,width,height);ctx.drawImage(ground,o.x-75*s,o.y-55.5556*s,150*s,111.1111*s);
  cityLighting.draw(ctx,CITY_LAYOUT.items,(x,z)=>screen(project(x,z)),s,width,height,true);
  const heroDepth=project(player.x,player.z).y;
  const draws: {depth:number;draw:()=>void}[]=props.map(p=>({depth:project(p.x,p.z).y,draw:()=>{const q=screen(project(p.x,p.z)),w=p.image.width/cacheScale*s,h=p.image.height/cacheScale*s;const x=q.x+p.image.left*s,y=q.y+p.image.top*s;if(x>width||x+w<0||y>height||y+h<0)return;const hp=screen(project(player.x,player.z));ctx.globalAlpha=!overview&&p.fade&&project(p.x,p.z).y>heroDepth&&hp.x>x&&hp.x<x+w&&hp.y>y&&hp.y<q.y?.5:1;ctx.drawImage(p.image,x,y,w,h);drawCityWindowGlow(ctx,p.glow,q.x,q.y,s);ctx.globalAlpha=1;if(p.water)drawFountainWater(ctx,q.x,q.y,s,time);}}));
  for(const p of backdrop.props){const q=screen(project(p.x,p.z));if(q.x<-p.h*s||q.x>width+p.h*s||q.y<0||q.y>height+p.h*s)continue;draws.push({depth:project(p.x,p.z).y,draw:()=>ctx.drawImage(p.image,...p.rect as [number,number,number,number],q.x-p.w*p.anchor[0]*s,q.y-p.h*p.anchor[1]*s,p.w*s,p.h*s)});}
  npcs.forEach((n,i)=>draws.push({depth:project(n.x,n.z).y,draw:()=>{const sprite=npcSprites.get(n.art)!;const q=screen(project(n.x,n.z));if(q.x<-60||q.x>width+60||q.y<-20||q.y>height+90)return;drawNpcSprite(ctx,sprite,q.x,q.y,s,time+i*.173);if(!overview&&Math.hypot(n.x-player.x,n.z-player.z)<4)label(n.icon+' '+n.name,q.x,q.y-(n.art==='angel'?4:2.5)*s);}}));
  draws.push({depth:heroDepth,draw:()=>{const p=screen(project(player.x,player.z));ctx.beginPath();ctx.ellipse(p.x,p.y,.48*s,.23*s,0,0,Math.PI*2);ctx.fillStyle='#172c2966';ctx.fill();if(!overview){ctx.beginPath();ctx.ellipse(p.x,p.y,.63*s,.31*s,0,0,Math.PI*2);ctx.strokeStyle='#e2d3a2a0';ctx.lineWidth=1;ctx.stroke();}const motion=!paused&&player.moving?'walk':'idle',pose=shadowPose(heroManifest,'male-iron',motion,facing8For(player.fx,player.fz),player.clock),cell=pose.cell,img=motion==='walk'?run:idle;actor(img,player.x,player.z,img.width/cell.columns,img.height/cell.rows,cell.column,cell.row,pose.w*HERO_PIXEL_METRES*pose.scale,pose.h*HERO_PIXEL_METRES*pose.scale,pose.feet/pose.h,pose.anchorX);if(overview){ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#f0d786';ctx.fill();}else label('คุณ',p.x,p.y-(HERO_METRES+.3)*s);}});
  draws.sort((a,b)=>a.depth-b.depth).forEach(d=>d.draw());
  if(!CITY.empty)drawAtmosphere(s);
  cityLighting.draw(ctx,CITY_LAYOUT.items,(x,z)=>screen(project(x,z)),s,width,height);
  cityLighting.exits(ctx,CITY_EXITS,(x,z)=>screen(project(x,z)),s,time,width,height,cityMotionPreference.matches);
  for(const p of props.filter(p=>p.label)){const q=screen(project(p.x,p.z));if(!overview&&Math.hypot(p.x-player.x,p.z-player.z)<15)label(p.label!,q.x,q.y+Math.max(18,s*2.1));}
  if(overview&&!CITY.empty){if(showDistricts)for(const d of DISTRICTS){const p=screen(project(d.x,d.z));label(d.name,p.x,p.y+15);}
  for(const gate of CITY_GATES){const q=screen(project(gate.x,gate.z));label(gate.name,q.x,q.y+22);}}
  for(const p of WAYPOINTS)if(overview||Math.hypot(p.x-player.x,p.z-player.z)<11){const q=screen(project(p.x,p.z));label('◇ '+p.name,q.x,q.y+2.1*s);}
  const portal=nearbyWaypoint(player.x,player.z),exit=nearbyExit(player.x,player.z);
  const near=npcs.find(n=>Math.hypot(n.x-player.x,n.z-player.z)<3.2);document.querySelector('#landmark')!.textContent=portal?`E · วาร์ปจาก${portal.name}`:exit?`E · เส้นทางสู่${exit.destination}`:near?`E · คุยกับ${near.name}`:Math.max(Math.abs(player.x),Math.abs(player.z))>44?'เขตประตูเมือง · ตัวอย่างนี้ยังไม่เชื่อมแผนที่ถัดไป':'';
  const district=districtAt(player.x,player.z);document.querySelector('#district-name')!.textContent=CITY.empty?'เมืองว่าง':exit?exit.name:district.name;document.querySelector('#district-detail')!.textContent=CITY.empty?'พื้นที่โล่ง ไม่มี NPC อาคาร หรือสิ่งกีดขวาง':exit?'ประตูเมือง · จุดรวมพลก่อนออกเดินทาง':district.subtitle;
  status.textContent=`X ${player.x.toFixed(1)} · Z ${player.z.toFixed(1)}   |   ${overview?'ภาพรวมเมือง':Math.round(zoom/26*100)+'%'}${paused?' · พัก':''}`;
}
// Read-only diagnostics for local playtests; nothing is persisted.
Object.defineProperty(window,'__CITY2D__',{value:{snapshot:()=>({ready,player:{...player},paused,overview,renderer:'Canvas2D',props:props.length,paintedSceneAssets,groundArt:CITY.empty?'grass only':'city-sprite-v2 road / garden / grass',fountainTime:time,npcs:npcs.length,npcArtTypes:npcSprites.size,waypoints:WAYPOINTS,travelOpen:travelDialog.open,citizens:[],twilight,assetSource:'hero-shadow-8dir-v1 male-iron',viewport:[width,height]})}});
void init().then(()=>{const id=new URLSearchParams(location.search).get('npc');if(id&&npcs.some(n=>n.id===id)){tour.value='npc-'+id;tour.dispatchEvent(new Event('change'));}}).catch(error=>{document.querySelector('#loading')!.textContent=`โหลดฉากไม่สำเร็จ: ${error.message} — ลองรีเฟรชหน้า`;console.error(error);});requestAnimationFrame(render);
