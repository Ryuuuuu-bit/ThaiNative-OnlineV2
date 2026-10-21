import './city-2d-review.css';
import { CITY_BUILDINGS, CITY_PLANTERS, CITY_BENCHES, CITY_STALLS } from '@the-beginning-online/shared/maps';
import { atlasCell, facingFor, motionFrame } from './sprite-animation';
import { HERO_PIXEL_METRES } from './world-scale';
import { createCityExplorer, project } from './city-2d-sim';

import {bake,type Sprite} from './city-2d-art';
import {CITY_HOUSES,CITY_ART_SOLIDS,DECOR,DISTRICTS,TOUR_STOPS,CITY2D_FOUNTAIN as CITY_FOUNTAIN,GARDEN_TREES,districtAt,city2dWalkable,NEW_BUILDINGS} from './city-2d-layout';
import {createCityLife} from './city-2d-life';
import {loadCitizenArt} from './city-2d-citizen-art';
import {TOWN_NPCS,WAYPOINTS,CITY_EXITS,nearbyWaypoint,nearbyExit,waypointArrival} from './city-2d-locations';
import {loadPaintedCityScene} from './city-2d-painted-scene';
import {makePaintedGround,isCityPlantingGround} from './city-2d-ground';
import {drawFountainWater} from './city-2d-fountain';
import {CITY_GATES} from './city-2d-gates';
import {npcSprite,drawNpcSprite,type NpcSprite} from './city-npc-sprite';
import {CanvasAssets} from './game-2d-assets';
import {loadMapBackdrop} from './game-2d-backdrop';
let backdrop:Awaited<ReturnType<typeof loadMapBackdrop>>;
type Prop = { x: number; z: number; image: Sprite; label?: string; fade?: boolean; water?: boolean };
const canvas = document.querySelector<HTMLCanvasElement>('#city')!;
const ctx = canvas.getContext('2d')!;
const sim = createCityExplorer(), player = sim.player, life = createCityLife();
let twilight=false;const showDistricts=true;let speechUntil=0;
const keys = new Set<string>();
let width = 1, height = 1, zoom = 26, overview = false, paused = false, ready = false;
const follow = () => { const p = project(player.x, player.z); return { x: p.x, y: p.y - 4 }; };
let camera = follow(), time = 0, last = 0;
let manifest: Record<string, { webp: string }>;
const props: Prop[] = [];
let paintedSceneAssets=0;
let citizenArt:Awaited<ReturnType<typeof loadCitizenArt>>;
const cacheScale = 28;
const status = document.querySelector('#position')!;
const npcs=TOWN_NPCS;
const npcSprites=new Map<string,NpcSprite>();
type PaintedAsset={id:string;rect:[number,number,number,number]};
type PaintedGroup={image:string;assets:PaintedAsset[]};
const image = async (key: string) => {
  const img = new Image(); img.src = manifest[key]?.webp ?? key;
  await img.decode(); return img;
};
function add(x: number,z: number,draw:(c:CanvasRenderingContext2D)=>void,label?:string,fade=false){props.push({x,z,image:bake(draw),label,fade});}

let ground: HTMLCanvasElement, idle: HTMLImageElement, run: HTMLImageElement;
async function init() {
  manifest=await fetch('/texture-manifest.json').then(r=>{if(!r.ok)throw Error('โหลดรายการภาพไม่สำเร็จ');return r.json();});
  const env=await fetch('/assets/env-painted/manifest.json').then(r=>r.json());
  const tree=env.assets.find((a: {name:string})=>a.name==='tree-round');
  const loaded=await Promise.all([image('/assets/hero-painted/hero-idle-v1.png'),image('/assets/hero-painted/hero-run-v1.png'),image('/assets/city-painted-v1/npcs-idle-se-atlas-v1.png'),image('/assets/env-painted/'+tree.atlas)]);
  [idle,run]=loaded;ground=await makePaintedGround();backdrop=await loadMapBackdrop('city_plaza',new CanvasAssets(manifest));
  const cityArt=await fetch('/assets/city-painted-v1/manifest.json').then(r=>r.json()) as {houses:PaintedGroup;npcs:PaintedGroup;residents:PaintedGroup};
  const houses=await image(cityArt.houses.image);
  const theme=await loadPaintedCityScene();paintedSceneAssets=theme.assetCount;
  function themed(x:number,z:number,image:Sprite,label?:string,fade=true){props.push({x,z,image,label,fade});}
  function building(b:{x:number;z:number;w:number;d:number},id:string,label?:string){
    const asset=cityArt.houses.assets.find(a=>a.id===id)!;
    const w=(.83205*b.w+.5547*b.d)*1.13,h=w*asset.rect[3]/asset.rect[2];
    const foot=(.39223*b.w+.58835*b.d)/2;
    add(b.x,b.z,c=>c.drawImage(houses,...asset.rect,-w/2,foot-h,w,h),label,true);
  }
  for(const group of [cityArt.npcs,cityArt.residents]){
    const atlas=await image(group.image);
    for(const a of group.assets){const h=a.id==='child'?1.3:a.id==='guard'?2.65:2.05;
      npcSprites.set(a.id,npcSprite(atlas,a.rect,h));
    }
  }
  const paintedCache=new Map<string,Sprite>();
  async function painted(name:string,w:number,h:number){
    const key=`${name}:${w}:${h}`;if(paintedCache.has(key))return paintedCache.get(key)!;
    const asset=env.assets.find((a:{name:string})=>a.name===name);const atlas=asset.atlas===tree.atlas?loaded[3]:await image('/assets/env-painted/'+asset.atlas);
    // Fit inside the requested size without stretching the painted silhouette.
    const unit=Math.min(w/asset.rect[2],h/asset.rect[3]),drawW=asset.rect[2]*unit,drawH=asset.rect[3]*unit;
    const sprite=bake(c=>c.drawImage(atlas,...asset.rect as [number,number,number,number],-drawW*asset.anchor[0],-drawH*asset.anchor[1],drawW,drawH));paintedCache.set(key,sprite);return sprite;
  }
  const blossom=await painted('tree-flowering',5.4,5.4),tall=await painted('tree-tall',4.7,6.2);
  GARDEN_TREES.forEach(p=>props.push({...p,image:p.flowering?blossom:tall,fade:true}));
  const shrub=await painted('bush-flowering',1.25,1),flowers=await painted('flowers-lavender',.6,.7),white=await painted('flowers-white',.6,.6),grass=await painted('grass-2',.5,.5);
  for(let i=0;i<180;i++){
    const a=i*2.39996,r=4+Math.sqrt(i)*1.45,x=-19+Math.cos(a)*r,z=26+Math.sin(a)*r*.65;
    if(x<-44||x>0||z>44||z<17||!city2dWalkable(x,z,.15)||!isCityPlantingGround(x,z))continue;
    if(Math.hypot(x-CITY_FOUNTAIN.x,z-CITY_FOUNTAIN.z)<6.8)continue;
    props.push({x,z,image:i%4===0?shrub:i%3===0?white:i%2?flowers:grass});
  }
  for(const b of CITY_HOUSES)for(const dx of [-b.w/2-1,b.w/2+1])props.push({x:b.x+dx,z:b.z+1,image:shrub});
  for(const p of DECOR){
    if(p.kind==='gate')continue;
    if(['guild','inn','workshop'].includes(p.kind)){building(p,p.kind==='workshop'?'cottage':p.kind,p.label);continue;}
    const sprite=p.kind==='lamp'?theme.upright('lamp',3.2):p.kind==='banner'?theme.upright('banner',4.2):p.kind==='dummy'?theme.upright('dummy',2.25):theme.footprint(p.kind,p.w,p.d);
    themed(p.x,p.z,sprite,p.label,!['flowerbed','table'].includes(p.kind));
  }

  CITY_HOUSES.forEach((b,i)=>building(b,i%3===0?'townhouse':'cottage'));
  CITY_BUILDINGS.forEach(b=>building(b,b.id==='storage'?'guild':b.id,b.name));
  themed(0,0,theme.footprint('clocktower',4.4,4.4),'หอนาฬิกา');
  props.push({x:CITY_FOUNTAIN.x,z:CITY_FOUNTAIN.z,image:theme.sprite('fountain',6,1.6),label:'น้ำพุธาราจันทร์',water:true});
  for(const p of CITY_PLANTERS){
    themed(p.x,p.z,theme.footprint('flowerbed',1.3,1.3),undefined,false);
    add(p.x,p.z,c=>{const [sx,sy,sw,sh]=tree.rect;const w=5.1,h=w*sh/sw;c.drawImage(loaded[3],sx,sy,sw,sh,-w*tree.anchor[0],-h,w,h);},undefined,true);
  }
  for(const b of CITY_BENCHES)themed(b.x,b.z,theme.footprint('bench',b.w,b.d));
  for(const p of CITY_STALLS)themed(p.x,p.z,theme.footprint('stall',p.w,p.d));
  for(const p of CITY_ART_SOLIDS){
    if(p.kind==='circle')themed(p.x,p.z,theme.sprite('well',p.r*2.2,p.r*.5),undefined,false);
    else {const id=p.label.startsWith('guard')?'booth':p.label.startsWith('cart')?'wagon':p.label.startsWith('hay')?'hay':'crates';themed(p.x,p.z,theme.footprint(id,p.w,p.d));}
  }
  // Repeated painted panels are fitted at their ground endpoints, not tiled as rectangles.
  function wallRun(axis:'x'|'z',fixed:number,start:number,end:number){
    const count=Math.ceil((end-start)/8),length=(end-start)/count;
    const sprite=theme.wall(axis,length);
    for(let i=0;i<count;i++){const v=start+(i+.5)*length;themed(axis==='x'?v:fixed,axis==='x'?fixed:v,sprite);}
  }
  for(const [start,end] of [[-47,-4.8],[4.8,47]])for(const side of [-47,47]){wallRun('x',side,start,end);wallRun('z',side,start,end);}
  for(const [x,z] of [[-47,-47],[47,-47],[-47,47],[47,47]])themed(x,z,theme.footprint('watchtower',3.4,3.4));
  for(const gate of CITY_GATES)themed(gate.x,gate.z,theme.gate(gate.axis),gate.name);
  for(const p of WAYPOINTS){
    themed(p.x,p.z,theme.sprite('portal',3.8,3.8*240/359/2),undefined,false);
    for(const dx of [-2,2])themed(p.x+dx,p.z,theme.upright('marker',1.65));
  }
  citizenArt=await loadCitizenArt();
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
const reviewStops=[...TOUR_STOPS,...CITY_EXITS,...WAYPOINTS.map(p=>({...p,id:'waypoint-'+p.id,name:'วาร์ป · '+p.name}))];
for(const d of reviewStops){const option=document.createElement('option');option.value=d.id;option.textContent=d.name;tour.append(option);}
tour.addEventListener('change',()=>{const d=reviewStops.find(d=>d.id===tour.value);if(!d)return;let found=false;for(let r=0;r<6&&!found;r++)for(let z=-r;z<=r&&!found;z++)for(let x=-r;x<=r&&!found;x++)if(city2dWalkable(d.x+x,d.z+z,.5)){player.x=d.x+x;player.z=d.z+z;found=true;}player.moving=false;keys.clear();overview=false;document.querySelector('#overview')!.setAttribute('aria-pressed','false');camera=follow();canvas.focus();});
document.querySelector('#daylight')!.addEventListener('click',()=>{twilight=!twilight;document.querySelector('#daylight')!.setAttribute('aria-pressed',String(twilight));document.querySelector('#daylight')!.textContent=twilight?'แสงกลางวัน':'แสงเย็น';canvas.focus();});
function talk(){
 if(paused)return;
 const waypoint=nearbyWaypoint(player.x,player.z),exit=nearbyExit(player.x,player.z);if(waypoint||exit){openTravel(waypoint?.id,exit?.destination);return;}
 const npc=npcs.find(n=>Math.hypot(n.x-player.x,n.z-player.z)<3.5),citizen=life.citizens.find(n=>Math.hypot(n.x-player.x,n.z-player.z)<3);
 const speech=document.querySelector<HTMLElement>('#speech')!;
 if(!npc&&!citizen)return;speech.textContent=npc?`${npc.name} — ${npc.line}`:`${citizen!.profile.name} · ${citizen!.profile.occupation} — ${citizen!.speech}`;speech.hidden=false;speechUntil=time+4.5;
 if(citizen)citizen.wait=5;
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
function actor(img:HTMLImageElement,x:number,z:number,sw:number,sh:number,col:number,row:number,w:number,h:number,anchor=.9375){const p=project(x,z);const s=scale();const q=screen(p);ctx.drawImage(img,col*sw,row*sh,sw,sh,q.x-w*s/2,q.y-h*s*anchor,w*s,h*s);}
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
   const n=life.citizens[(Math.floor(time/6)*7)%life.citizens.length];if(!n.moving&&time%6<2.8&&Math.hypot(n.x-player.x,n.z-player.z)<12){const p=screen(project(n.x,n.z));label(n.speech,p.x,p.y-2.3*s);}
 }
 if(twilight){ctx.fillStyle='#24345150';ctx.fillRect(0,0,width,height);ctx.globalCompositeOperation='screen';for(const lamp of DECOR.filter(p=>p.kind==='lamp')){const p=screen(project(lamp.x,lamp.z,3.5)),r=s*2.1;const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);glow.addColorStop(0,'#ffd887b0');glow.addColorStop(.18,'#f6bc5860');glow.addColorStop(1,'#f3a33d00');ctx.fillStyle=glow;ctx.fillRect(p.x-r,p.y-r,r*2,r*2);}ctx.globalCompositeOperation='source-over';}
 if(speechUntil&&time>speechUntil){document.querySelector<HTMLElement>('#speech')!.hidden=true;speechUntil=0;}
}
function render(now:number){requestAnimationFrame(render);const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!ready||document.hidden)return;if(!paused&&!travelDialog.open){time+=dt;life.step(dt);}
  if(!paused&&!travelDialog.open){const h=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));const v=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));sim.step(h,v,dt);}
  const goal=overview?{x:0,y:0}:follow();const smoothing=1-Math.exp(-dt*10);camera.x+=(goal.x-camera.x)*smoothing;camera.y+=(goal.y-camera.y)*smoothing;
  const s=scale(),o=screen({x:0,y:0});ctx.clearRect(0,0,width,height);backdrop.draw(ctx,o,s,width,height);ctx.drawImage(ground,o.x-75*s,o.y-55.5556*s,150*s,111.1111*s);
  const heroDepth=project(player.x,player.z).y;
  const draws: {depth:number;draw:()=>void}[]=props.map(p=>({depth:project(p.x,p.z).y,draw:()=>{const q=screen(project(p.x,p.z)),w=p.image.width/cacheScale*s,h=p.image.height/cacheScale*s;const x=q.x+p.image.left*s,y=q.y+p.image.top*s;if(x>width||x+w<0||y>height||y+h<0)return;const hp=screen(project(player.x,player.z));ctx.globalAlpha=!overview&&p.fade&&project(p.x,p.z).y>heroDepth&&hp.x>x&&hp.x<x+w&&hp.y>y&&hp.y<q.y?.5:1;ctx.drawImage(p.image,x,y,w,h);ctx.globalAlpha=1;if(p.water)drawFountainWater(ctx,q.x,q.y,s,time);}}));
  for(const p of backdrop.props){const q=screen(project(p.x,p.z));if(q.x<-p.h*s||q.x>width+p.h*s||q.y<0||q.y>height+p.h*s)continue;draws.push({depth:project(p.x,p.z).y,draw:()=>ctx.drawImage(p.image,...p.rect as [number,number,number,number],q.x-p.w*p.anchor[0]*s,q.y-p.h*p.anchor[1]*s,p.w*s,p.h*s)});}
  for(const p of [...WAYPOINTS,...CITY_EXITS])draws.push({depth:project(p.x,p.z).y+.01,draw:()=>{
    const q=screen(project(p.x,p.z));ctx.save();ctx.strokeStyle=p.color;ctx.lineWidth=Math.max(1,s*.06);
    // Ground effects use the same dimetric plane as roads, rather than a flat 2:1 ellipse.
    for(const r of [1.15,1.55]){ctx.beginPath();for(let i=0;i<=48;i++){const a=i*Math.PI/24,v=project(Math.cos(a)*r,Math.sin(a)*r);i?ctx.lineTo(q.x+v.x*s,q.y+v.y*s):ctx.moveTo(q.x+v.x*s,q.y+v.y*s);}ctx.stroke();}
    for(let i=0;i<8;i++){const a=i*Math.PI/4+time*.22,v=project(Math.cos(a)*1.35,Math.sin(a)*1.35);ctx.beginPath();ctx.arc(q.x+v.x*s,q.y+v.y*s,Math.max(1,s*.065),0,Math.PI*2);ctx.fillStyle=p.color;ctx.fill();}
    if(!overview)for(let i=0;i<5;i++){const phase=(time*.3+i/5)%1;ctx.globalAlpha=(1-phase)*.6;ctx.fillStyle=p.color;const x=q.x+Math.sin(i*2.4)*s*.85,y=q.y-phase*2.2*s;ctx.fillRect(x,y,Math.max(1,s*.055),Math.max(2,s*.1));}
    ctx.restore();
  }});
  npcs.forEach(n=>draws.push({depth:project(n.x,n.z).y,draw:()=>{const sprite=npcSprites.get(n.art)!;const q=screen(project(n.x,n.z));if(q.x<-60||q.x>width+60||q.y<-20||q.y>height+90)return;drawNpcSprite(ctx,sprite,q.x,q.y,s);if(!overview&&Math.hypot(n.x-player.x,n.z-player.z)<4)label(n.name,q.x,q.y-2.5*s);}}));
  life.citizens.forEach(n=>draws.push({depth:project(n.x,n.z).y,draw:()=>{const p=screen(project(n.x,n.z));if(p.x>-40&&p.x<width+40&&p.y>-40&&p.y<height+80)citizenArt.draw(ctx,n,p,s);}}));
  draws.push({depth:heroDepth,draw:()=>{const p=screen(project(player.x,player.z));ctx.beginPath();ctx.ellipse(p.x,p.y,.48*s,.23*s,0,0,Math.PI*2);ctx.fillStyle='#172c2966';ctx.fill();if(!overview){ctx.beginPath();ctx.ellipse(p.x,p.y,.63*s,.31*s,0,0,Math.PI*2);ctx.strokeStyle='#e2d3a2a0';ctx.lineWidth=1;ctx.stroke();}const motion=!paused&&player.moving?'run':'idle',cell=atlasCell(motion,facingFor(player.fx,player.fz),motionFrame(motion,player.clock)),img=motion==='run'?run:idle;actor(img,player.x,player.z,img.width/cell.columns,img.height/cell.rows,cell.column,cell.row,384*HERO_PIXEL_METRES,256*HERO_PIXEL_METRES);if(overview){ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#f0d786';ctx.fill();}else label('คุณ',p.x,p.y-2.1*s);}});
  draws.sort((a,b)=>a.depth-b.depth).forEach(d=>d.draw());
  drawAtmosphere(s);
  for(const p of props.filter(p=>p.label)){const q=screen(project(p.x,p.z));if(!overview&&Math.hypot(p.x-player.x,p.z-player.z)<15)label(p.label!,q.x,q.y+Math.max(18,s*2.1));}
  if(overview){if(showDistricts)for(const d of DISTRICTS){const p=screen(project(d.x,d.z));label(d.name,p.x,p.y+15);}
  for(const gate of CITY_GATES){const q=screen(project(gate.x,gate.z));label(gate.name,q.x,q.y+22);}}
  for(const p of WAYPOINTS)if(overview||Math.hypot(p.x-player.x,p.z-player.z)<11){const q=screen(project(p.x,p.z));label('◇ '+p.name,q.x,q.y+2.1*s);}
  const portal=nearbyWaypoint(player.x,player.z),exit=nearbyExit(player.x,player.z);
  const near=npcs.find(n=>Math.hypot(n.x-player.x,n.z-player.z)<3.2);const neighbor=life.citizens.find(n=>Math.hypot(n.x-player.x,n.z-player.z)<2.8);document.querySelector('#landmark')!.textContent=portal?`E · วาร์ปจาก${portal.name}`:exit?`E · เส้นทางสู่${exit.destination}`:near?`E · คุยกับ${near.name}`:neighbor?'E · ทักทายชาวเมือง':Math.max(Math.abs(player.x),Math.abs(player.z))>44?'เขตประตูเมือง · ตัวอย่างนี้ยังไม่เชื่อมแผนที่ถัดไป':'';
  const district=districtAt(player.x,player.z);document.querySelector('#district-name')!.textContent=exit?exit.name:district.name;document.querySelector('#district-detail')!.textContent=exit?'ประตูเมือง · จุดรวมพลก่อนออกเดินทาง':district.subtitle;
  status.textContent=`X ${player.x.toFixed(1)} · Z ${player.z.toFixed(1)}   |   ${overview?'ภาพรวมเมือง':Math.round(zoom/26*100)+'%'}${paused?' · พัก':''}`;
}
// Read-only diagnostics for local playtests; nothing is persisted.
Object.defineProperty(window,'__CITY2D__',{value:{snapshot:()=>({ready,player:{...player},paused,overview,renderer:'Canvas2D',props:props.length,paintedSceneAssets,groundArt:'painted road / garden / grass v1',fountainTime:time,npcs:npcs.length,npcArtTypes:npcSprites.size,waypoints:WAYPOINTS,travelOpen:travelDialog.open,citizens:life.citizens.map(n=>({x:n.x,z:n.z,moving:n.moving,role:n.role})),twilight,assetSource:'production hero-idle / hero-run',viewport:[width,height]})}});
void init().catch(error=>{document.querySelector('#loading')!.textContent=`โหลดฉากไม่สำเร็จ: ${error.message} — ลองรีเฟรชหน้า`;console.error(error);});requestAnimationFrame(render);
