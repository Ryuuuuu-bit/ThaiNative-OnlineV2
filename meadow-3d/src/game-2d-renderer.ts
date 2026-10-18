import {titleDefinition} from '@thainative/shared';
import {LAYOUTS,FIELD_BOSS,GATES,MAP_INFO,travelDestination,type MapId} from '@thainative/shared/maps';
import jobs from '../../shared/data/jobs.json' with {type:'json'};
import {CanvasAssets} from './game-2d-assets';
import {loadCity2DScene} from './city-2d-scene';
import {loadCitizenArt} from './city-2d-citizen-art';
import {drawNpcSprite} from './city-npc-sprite';
import {createCityLife} from './city-2d-life';
import {TOWN_NPCS,CITY_EXITS,WAYPOINTS} from './city-2d-locations';
import {drawFountainWater} from './city-2d-fountain';
import {loadField2D} from './game-2d-fields';
import {loadMapBackdrop} from './game-2d-backdrop';
import {project2D,unproject2D} from './game-2d-projection';
import {MOTIONS,motionFor,motionFrame,atlasCell,facingFor} from './sprite-animation';
import {SKILL_MOTIONS,BORROWED_MOTION,SKILL_DURATION,SKILL_FRAMES,skillFrame,isSkillMotion,type SkillMotion} from './skill-motions';
import {monsterSpecies,monsterCell,monsterOpacity,SPECIES_SCALE} from './monster-animation';
import {huntingCell,HUNTING_ASSET_ROOT} from './hunting-monster-animation';
import {HERO_PIXEL_METRES,BOSS_METRES} from './world-scale';
import type {CombatFeel} from './combat-feel';

const tint:Record<string,string>={ruin_shroom:'hue-rotate(40deg) saturate(.65)',relic_hound:'sepia(.45)',relic_wisp:'hue-rotate(125deg)',ruin_guard:'saturate(.65)',relic_warden:'sepia(.3)',crag_slime:'sepia(.8) saturate(.7)',crag_wolf:'sepia(.75)',dust_wisp:'saturate(.7)',crag_guard:'sepia(.8)',crag_titan:'sepia(.8) saturate(1.2)'};

export class GameCanvas2D{
 readonly canvas=document.createElement('canvas');readonly ctx:CanvasRenderingContext2D;readonly assets:CanvasAssets;
 private city?:Awaited<ReturnType<typeof loadCity2DScene>>;private citizenArt?:Awaited<ReturnType<typeof loadCitizenArt>>;
 private life=createCityLife();private fields=new Map<MapId,Awaited<ReturnType<typeof loadField2D>>>();private monsterManifest:any;
 private huntingManifest:any;private monsterImages=new Set<string>();
 private backdrops=new Map<MapId,Awaited<ReturnType<typeof loadMapBackdrop>>>();
 combatFeel?:CombatFeel;private shakeOffset={x:0,y:0};private monsterFrames=new Map<number,{motion:string;time:number}>();
 private heroStates=new Map<string,{motion:string;clock:number;skill?:SkillMotion;elapsed:number}>();
 private effects:any[]=[];private hits:{id:number;left:number;top:number;right:number;bottom:number}[]=[];
 private width=1;private height=1;private dpr=1;
 /** Static ground (backdrop, roads, map plane) rendered once with a margin, then blitted; redrawn on zoom, resize or after the camera moves past the margin. */
 private groundCache:{canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;key:string;ox:number;oy:number}|null=null;
 /** Hue-shifted copies of slime atlases (canvas filters are far too slow to run per sprite per frame). */
 private tints=new WeakMap<CanvasImageSource,Map<string,HTMLCanvasElement>>();private focus={x:0,y:0};private initialized=false;private map:MapId='city_plaza';
 scale=30;zoomHeight=27.5;overview=false;highQuality=true;drawCalls=0;
 constructor(manifest:Record<string,{webp:string}>){this.assets=new CanvasAssets(manifest);this.canvas.setAttribute('aria-label','โลกเกม 2D');this.canvas.tabIndex=0;const context=this.canvas.getContext('2d');if(!context)throw Error('เบราว์เซอร์ไม่รองรับ Canvas 2D');this.ctx=context;this.resize();}
 resize(){this.width=innerWidth;this.height=innerHeight;const dpr=this.highQuality?Math.min(devicePixelRatio,1.5):1;this.dpr=dpr;this.canvas.width=Math.round(this.width*dpr);this.canvas.height=Math.round(this.height*dpr);this.canvas.style.width='100%';this.canvas.style.height='100%';this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 async init(map:MapId){
  this.monsterManifest=await this.assets.json('/assets/monsters-painted/manifest.json');
  await Promise.all([...MOTIONS.map(m=>`/assets/hero-painted/hero-${m}-v1.png`),...SKILL_MOTIONS.filter(m=>!BORROWED_MOTION[m]).map(m=>`/assets/hero-skills/hero-skill-${m}-v1.png`),'/assets/skills-painted/angel-v1.png','/assets/hero-painted/portrait-v1.png','/assets/skills-painted/skills-v2.png','/assets/skills-painted/skills-vfx-v1.png','/assets/skills-painted/skills-vfx-job2-v1.png'].map(p=>this.assets.image(p)));
  await this.prepareMap(map);
 }
 async prepareMap(id:MapId){
  const neededMonsters=new Set<string>();
  if(!this.backdrops.has(id))this.backdrops.set(id,await loadMapBackdrop(id,this.assets));
  if(id==='city_plaza'){if(!this.city){const [city,people]=await Promise.all([loadCity2DScene(),loadCitizenArt()]);this.city=city;this.citizenArt=people;}}
  else{if(!this.fields.has(id))this.fields.set(id,await loadField2D(id,this.assets));
   const ids=[...new Set([...LAYOUTS[id].spawns.map(m=>m.dataId),FIELD_BOSS[id].dataId])];
   if(id==='ruins'||id==='canyon'){
    this.huntingManifest??=await this.assets.json(HUNTING_ASSET_ROOT+'manifest.json');
    for(const dataId of ids)for(const clip of Object.values<any>(this.huntingManifest.species[dataId]?.motions??{}))neededMonsters.add(HUNTING_ASSET_ROOT+clip.file);
   }
   const species=[...new Set(ids.filter(dataId=>!this.huntingManifest?.species[dataId]).map(dataId=>monsterSpecies(dataId,dataId===FIELD_BOSS[id].dataId)))];
   for(const s of species)for(const clip of Object.values<any>(this.monsterManifest.species[s].motions))neededMonsters.add('/assets/monsters-painted/'+clip.file);
   await Promise.all([...neededMonsters].map(p=>this.assets.image(p)));
  }
  // Commit only after the destination is ready. Keep shared atlases, release
  // every previous-map monster (including meadow/forest, not just hunting art).
  for(const path of this.monsterImages)if(!neededMonsters.has(path))this.assets.release(path);
  this.monsterImages=neededMonsters;
  this.map=id;this.initialized=false;this.effects.length=0;this.heroStates.clear();this.monsterFrames.clear();
 }
 screen(x:number,z:number,h=0){const p=project2D(x,z,h);return{x:this.width/2+(p.x-this.focus.x)*this.scale+this.shakeOffset.x,y:this.height*.55+(p.y-this.focus.y)*this.scale+this.shakeOffset.y};}
 ground(x:number,y:number){const b=this.canvas.getBoundingClientRect();return unproject2D((x-b.left-this.width/2-this.shakeOffset.x)/this.scale+this.focus.x,(y-b.top-this.height*.55-this.shakeOffset.y)/this.scale+this.focus.y);}
 pickEnemy(x:number,y:number){return [...this.hits].reverse().find(p=>x>=p.left&&x<=p.right&&y>=p.top&&y<=p.bottom)?.id??null;}
 event(e:any){
  if(e.type==='skill'&&isSkillMotion(e.skillId)){const s=this.heroStates.get(e.playerId)??{motion:'idle',clock:0,elapsed:0};s.skill=BORROWED_MOTION[e.skillId]??e.skillId;s.elapsed=0;this.heroStates.set(e.playerId,s);}
  if(e.type==='warningCancel'){this.effects=this.effects.filter(v=>v.id!==e.id||v.type!=='warning');return;}
  if(['warning','bossBlast','slash','skill','skillImpact','heal','level','dash','impact','slam','hit','kill','meteor'].includes(e.type))this.effects.push({...e,age:0,life:e.duration??(e.type==='level'?.9:.45)});
  if(this.effects.length>140)this.effects.splice(0,this.effects.length-140);
 }
 private text(text:string,x:number,y:number,color='#eee1bc',size=12){const c=this.ctx;c.font=`500 ${size}px Inter,"Noto Sans Thai",sans-serif`;c.textAlign='center';c.lineJoin='round';c.lineWidth=3;c.strokeStyle='#17251ee0';c.strokeText(text,x,y);c.fillStyle=color;c.fillText(text,x,y);}
 private circle(x:number,z:number,r:number,fill:string,stroke?:string,inner=0,start=0,end=Math.PI*2){const c=this.ctx,q=this.screen(x,z),s=this.scale,m=c.getTransform();c.beginPath();
  // Build the path in world space through the projection, then restore the transform so the line width is not skewed.
  c.transform(.83205*s,.39223*s,-.5547*s,.58835*s,q.x,q.y);if(end-start<6.28)c.moveTo(0,0);else c.moveTo(Math.cos(start)*r,Math.sin(start)*r);c.arc(0,0,r,start,end);c.closePath();
  if(inner){c.moveTo(inner,0);c.arc(0,0,inner,0,Math.PI*2,true);c.closePath();}c.setTransform(m);
  if(fill!=='transparent'){c.fillStyle=fill;c.fill('evenodd');}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
 private tinted(image:CanvasImageSource&{width:number;height:number},filter:string){let byFilter=this.tints.get(image);if(!byFilter)this.tints.set(image,byFilter=new Map());let out=byFilter.get(filter);
  if(!out){out=document.createElement('canvas');out.width=image.width;out.height=image.height;const t=out.getContext('2d')!;t.filter=filter;t.drawImage(image,0,0);byFilter.set(filter,out);}return out;}
 private drawGround(c:CanvasRenderingContext2D,backdrop:Awaited<ReturnType<typeof loadMapBackdrop>>|undefined,s:number){
  const M=320,o=this.screen(0,0),w=this.width,h=this.height,dpr=this.dpr,field=this.fields.get(this.map);
  const key=`${this.map}|${s}|${w}|${h}|${dpr}|${!!this.city}|${!!field}`;let g=this.groundCache;
  if(!g||g.key!==key||Math.abs(o.x-g.ox)>M||Math.abs(o.y-g.oy)>M){
   if(!g){const canvas=document.createElement('canvas');g=this.groundCache={canvas,ctx:canvas.getContext('2d')!,key:'',ox:0,oy:0};}
   const W=Math.ceil((w+2*M)*dpr),H=Math.ceil((h+2*M)*dpr);if(g.canvas.width!==W||g.canvas.height!==H){g.canvas.width=W;g.canvas.height=H;}
   const gc=g.ctx,at={x:o.x+M,y:o.y+M};gc.setTransform(dpr,0,0,dpr,0,0);gc.fillStyle=this.map==='forest'?'#223d35':'#364f36';gc.fillRect(0,0,w+2*M,h+2*M);
   backdrop?.draw(gc,at,s,w+2*M,h+2*M);
   if(this.map==='city_plaza'){if(this.city)gc.drawImage(this.city.ground,at.x-75*s,at.y-55.5556*s,150*s,111.1111*s);}
   else if(field){const l=field.layout,p=project2D(-l.halfX,-l.halfZ);gc.save();gc.transform(.83205*s,.39223*s,-.5547*s,.58835*s,at.x+p.x*s,at.y+p.y*s);gc.drawImage(field.plane,0,0,l.halfX*2,l.halfZ*2);gc.restore();}
   g.key=key;g.ox=o.x;g.oy=o.y;}
  c.drawImage(g.canvas,(M-(o.x-g.ox))*dpr,(M-(o.y-g.oy))*dpr,w*dpr,h*dpr,0,0,w,h);this.drawCalls++;
 }
 private hero(p:any,dt:number,time:number,own:boolean){
  const state=this.heroStates.get(p.id)??{motion:'idle',clock:0,elapsed:0};this.heroStates.set(p.id,state);const motion=motionFor(p);state.clock=motion===state.motion?state.clock+dt:0;state.motion=motion;state.elapsed+=dt;
  if(state.skill&&(state.elapsed>SKILL_DURATION[state.skill]||p.dead||p.hurt>0))state.skill=undefined;
  let cell=atlasCell(motion,facingFor(p.fx,p.fz),motionFrame(motion,state.clock)),key=`/assets/hero-painted/hero-${motion}-v1.png`;
  if(state.skill){key=`/assets/hero-skills/hero-skill-${state.skill}-v1.png`;cell={column:skillFrame(state.skill,state.elapsed),row:['SE','SW','NE','NW'].indexOf(facingFor(p.fx,p.fz)),columns:SKILL_FRAMES[state.skill],rows:4};}
  const image=this.assets.get(key)!;const q=this.screen(p.x,p.z),w=384*HERO_PIXEL_METRES*this.scale,h=256*HERO_PIXEL_METRES*this.scale;
  this.circle(p.x,p.z,.42,'#162c2940',own?'#e7d39b88':undefined);this.ctx.drawImage(image,cell.column*image.width/cell.columns,cell.row*image.height/cell.rows,image.width/cell.columns,image.height/cell.rows,q.x-w/2,q.y-h*.9375,w,h);this.drawCalls++;
  if(!this.overview&&!p.dead){const title=titleDefinition(p.titleId);if(title)this.text(title.name,q.x,q.y-2.5*this.scale,title.color,10);this.text(p.name||'นักผจญภัย',q.x,q.y-2.1*this.scale);}
  for(const [i,status]of (p.statuses??[]).entries()){if(i>4)break;this.circle(p.x,p.z,.55+i*.08,'transparent',status.id==='guard'?'#b9d9ed88':'#d6d28c66');}
 }
 private monster(e:any,selected:boolean){
  const species=monsterSpecies(e.dataId,e.boss),fresh=this.huntingManifest?.species[e.dataId],def=fresh??this.monsterManifest.species[species];
  const legacyMotion=def.motions[e.motion]?e.motion:'idle',cell=fresh?huntingCell(e,def.attackWindup):monsterCell(species,legacyMotion,e.fx,e.fz,e.motionTime),motion='motion' in cell?cell.motion:legacyMotion;
  const info=def.motions[motion],image=this.assets.get((fresh?HUNTING_ASSET_ROOT:'/assets/monsters-painted/')+info.file);if(!image)return;
  const factor=fresh?1:SPECIES_SCALE[species]*(e.boss?BOSS_METRES/(def.bodyWorldHeight||6.9):1),w=def.quadWorldSize[0]*factor*this.scale,h=def.quadWorldSize[1]*factor*this.scale,q=this.screen(e.x,e.z),x=q.x-w*def.anchor[0],y=q.y-h*(1-def.anchor[1]);
  if(selected)this.circle(e.x,e.z,e.boss?1.6:.7,'#a66e3322','#eec68b');

  const c=this.ctx,src=fresh?image:tint[e.dataId]?this.tinted(image as HTMLImageElement,tint[e.dataId]):species==='slime'&&e.variant!=='pink'?this.tinted(image as HTMLImageElement,`hue-rotate(${e.variant==='mint'?162:220}deg)`):image,alpha=monsterOpacity(e),sx=cell.column*image.width/info.columns,sy=cell.row*image.height/info.rows,sw=image.width/info.columns,sh=image.height/info.rows;
  c.globalAlpha=alpha;c.drawImage(src,sx,sy,sw,sh,x,y,w,h);this.drawCalls++;
  // Hit flash: add 35 % of the sprite again (≈ brightness(1.35)) instead of a canvas filter.
  if(e.hurt>0){c.globalCompositeOperation='lighter';c.globalAlpha=alpha*.35;c.drawImage(src,sx,sy,sw,sh,x,y,w,h);c.globalCompositeOperation='source-over';this.drawCalls++;}c.globalAlpha=1;
  const bounds=info.directions?.[cell.row]?.[cell.column]?.bounds;const b=bounds?{left:x+bounds[0]/def.cellSize[0]*w,top:y+bounds[1]/def.cellSize[1]*h,right:x+bounds[2]/def.cellSize[0]*w,bottom:y+bounds[3]/def.cellSize[1]*h}:{left:q.x-w*.25,top:q.y-h*.7,right:q.x+w*.25,bottom:q.y};
  if(!e.dead){this.hits.push({id:e.id,...b});if(selected||e.hp<e.maxHp){const by=q.y-(e.boss?4.8:1.5)*this.scale;c.fillStyle='#17251e';c.fillRect(q.x-22,by,44,4);c.fillStyle='#d99491';c.fillRect(q.x-22,by,44*e.hp/e.maxHp,4);}if(e.statuses?.length)this.text(e.statuses.map((s:any)=>s.id==='stun'?'มึนงง':s.id==='taunt'?'ยั่วยุ':'↓').join(' '),q.x,q.y-1.8*this.scale,'#e7d79d',10);}
 }
 render(game:any,others:any[],dt:number,time:number){
  const c=this.ctx;this.drawCalls=0;this.hits=[];this.scale=this.overview?Math.min(this.width/145,this.height/112):this.height/this.zoomHeight;
  const now=performance.now(),shake=(this.combatFeel?.camera(dt)??0)*this.scale;this.shakeOffset={x:Math.sin(time*113)*shake,y:Math.cos(time*97)*shake*.7};
  const focus=this.overview?{x:0,y:0}:project2D(game.p.x,game.p.z,3);
  if(!this.initialized){this.focus=focus;this.initialized=true;}else{const k=1-Math.exp(-dt*8);this.focus.x+=(focus.x-this.focus.x)*k;this.focus.y+=(focus.y-this.focus.y)*k;}
  c.clearRect(0,0,this.width,this.height);c.fillStyle=this.map==='forest'?'#223d35':'#364f36';c.fillRect(0,0,this.width,this.height);
  const draws:{depth:number;draw:()=>void}[]=[],s=this.scale,add=(x:number,z:number,draw:()=>void)=>draws.push({depth:project2D(x,z).y,draw});
  const visible=(q:{x:number;y:number},r=220)=>q.x>-r&&q.x<this.width+r&&q.y>-r&&q.y<this.height+r;
  const backdrop=this.backdrops.get(this.map);this.drawGround(c,backdrop,s);
  for(const p of backdrop?.props??[]){const q=this.screen(p.x,p.z);if(!visible(q,p.h*s))continue;add(p.x,p.z,()=>{const hp=this.screen(game.p.x,game.p.z),x=q.x-p.w*p.anchor[0]*s,y=q.y-p.h*p.anchor[1]*s;c.globalAlpha=q.y>hp.y&&hp.x>x&&hp.x<x+p.w*s&&hp.y>y&&hp.y<q.y?.35:1;c.drawImage(p.image,...p.rect as [number,number,number,number],x,y,p.w*s,p.h*s);c.globalAlpha=1;this.drawCalls++;});}
  if(this.map==='city_plaza'&&this.city){
   this.life.step(dt);
   for(const p of this.city.props){const q=this.screen(p.x,p.z);if(!visible(q))continue;add(p.x,p.z,()=>{const x=q.x+p.image.left*s,y=q.y+p.image.top*s,w=p.image.width/28*s,h=p.image.height/28*s,hp=this.screen(game.p.x,game.p.z);c.globalAlpha=p.fade&&q.y>hp.y&&hp.x>x&&hp.x<x+w&&hp.y>y&&hp.y<q.y?.45:1;c.drawImage(p.image,x,y,w,h);c.globalAlpha=1;if(p.water)drawFountainWater(c,q.x,q.y,s,time);});}
   for(const n of TOWN_NPCS){const q=this.screen(n.x,n.z);if(!visible(q))continue;add(n.x,n.z,()=>drawNpcSprite(c,this.city!.npcSprites.get(n.art)!,q.x,q.y,s));}
   for(const n of this.life.citizens){const q=this.screen(n.x,n.z);if(visible(q,100))add(n.x,n.z,()=>this.citizenArt!.draw(c,n,q,s));}
   for(const p of [...CITY_EXITS,...WAYPOINTS]){this.circle(p.x,p.z,1.35,'transparent',p.color);}
   // The job-change NPC remains at the authoritative service position.
   add(jobs.angel.x,jobs.angel.z,()=>{const q=this.screen(jobs.angel.x,jobs.angel.z),sprite=this.assets.get('/assets/skills-painted/angel-v1.png')!;c.drawImage(sprite,q.x-1.3*s,q.y-3.9*.975*s,2.6*s,3.9*s);this.circle(jobs.angel.x,jobs.angel.z,.8,'transparent','#e9d594');});
  }else{const field=this.fields.get(this.map);if(field){
   for(const p of field.props){const q=this.screen(p.x,p.z);if(!visible(q))continue;add(p.x,p.z,()=>{const hp=this.screen(game.p.x,game.p.z),x=q.x-p.w*p.anchor[0]*s,y=q.y-p.h*p.anchor[1]*s;c.globalAlpha=q.y>hp.y&&hp.x>x&&hp.x<x+p.w*s&&hp.y>y&&hp.y<q.y?.4:1;c.drawImage(p.image,...p.rect as [number,number,number,number],x,y,p.w*s,p.h*s);c.globalAlpha=1;});}
  }}
  for(const effect of this.effects){effect.age+=dt;if(effect.type==='warning'){const half=(effect.angle??360)*Math.PI/360,start=effect.shape==='cone'?Math.atan2(effect.fz,effect.fx)-half:0,end=effect.shape==='cone'?start+half*2:Math.PI*2;this.circle(effect.x,effect.z,effect.r??2,'#e5503a42','#ff8264',effect.shape==='ring'?effect.inner:0,start,end);}}
  for(const drop of game.drops){const q=this.screen(drop.x,drop.z);add(drop.x,drop.z,()=>{c.fillStyle='#e6ce79';c.beginPath();c.moveTo(q.x,q.y-11);c.lineTo(q.x+5,q.y-5);c.lineTo(q.x,q.y+1);c.lineTo(q.x-5,q.y-5);c.closePath();c.fill();});}
  for(const p of [game.p,...others]){if(visible(this.screen(p.x,p.z),100))add(p.x,p.z,()=>this.hero(p,this.combatFeel?.frozen(p.id,now)?0:dt,time,p===game.p));}
  const liveIds=new Set<number>();
  for(const e of game.enemies){liveIds.add(e.id);const last=this.monsterFrames.get(e.id),frozen=this.combatFeel?.frozen('monster:'+e.id,now)&&last?.motion===e.motion,motionTime=frozen?last!.time:e.motionTime;this.monsterFrames.set(e.id,{motion:e.motion,time:motionTime});if(visible(this.screen(e.x,e.z),160)){const n=this.combatFeel?.nudge(e.id,now)??{x:0,z:0};add(e.x,e.z,()=>this.monster({...e,x:e.x+n.x,z:e.z+n.z,motionTime,hurt:Math.max(e.hurt,this.combatFeel?.flash(e.id,now)??0)},e.id===game.target));}}
  for(const id of this.monsterFrames.keys())if(!liveIds.has(id))this.monsterFrames.delete(id);
  draws.sort((a,b)=>a.depth-b.depth).forEach(d=>d.draw());
  if(this.map==='ruins'||this.map==='canyon'||this.map==='forest')for(const [gate,p] of Object.entries(GATES[this.map])){
   const destination=travelDestination(this.map,gate,p),q=this.screen(p.x,p.z);if(!destination||!visible(q,100))continue;
   this.circle(p.x,p.z,1.1,'#d5c58222','#dfca88');c.save();c.font='12px sans-serif';c.textAlign='center';c.lineWidth=4;c.strokeStyle='#17221e';c.fillStyle='#f4e4b5';const label=(p.x<0?'← ':'→ ')+MAP_INFO[destination.mapId].name;c.strokeText(label,q.x,q.y-30);c.fillText(label,q.x,q.y-30);c.restore();
  }
  for(const e of this.effects){if(e.type==='warning')continue;const ratio=e.age/e.life,r=e.r??(e.type==='hit'?.3:1.6);this.circle(e.x??game.p.x,e.z??game.p.z,r*(.4+ratio),'transparent',e.type==='heal'?'#b9e49e':e.type==='bossBlast'?'#f3a67a':'#e8d4a4');
   if(e.type==='skill'||e.type==='skillImpact'){const id=BORROWED_MOTION[e.skillId as SkillMotion]??e.skillId,index=['slash','whirlwind','dash_strike','earth_break','provoke','endure'].indexOf(id),image=this.assets.get('/assets/skills-painted/skills-vfx-v1.png');if(index>=0&&image){const q=this.screen(e.x??game.p.x,e.z??game.p.z,.6),w=s*(3+ratio);c.save();c.globalAlpha=(1-ratio)*.85;c.drawImage(image,index%3*image.width/3,Math.floor(index/3)*image.height/2,image.width/3,image.height/2,q.x-w/2,q.y-w/2,w,w);c.restore();}}
  }
  this.effects=this.effects.filter(e=>e.age<e.life);
  for(const p of game.projectiles){const q=this.screen(p.x,p.z,.6);c.fillStyle=p.attack==='bolt'?'#f4dfa5':'#add6d5';c.shadowColor=c.fillStyle;c.shadowBlur=8;c.beginPath();c.arc(q.x,q.y,Math.max(3,s*.13),0,Math.PI*2);c.fill();c.shadowBlur=0;}
 }
 snapshot(){return{renderer:'Canvas2D',map:this.map,citizens:this.map==='city_plaza'?40:0,drawCalls:this.drawCalls,assets:this.assets.snapshot()};}
}
