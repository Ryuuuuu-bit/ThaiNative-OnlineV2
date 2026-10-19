import RAPIER from '@dimforge/rapier2d-compat';
import {performance} from 'node:perf_hooks';
import {walkable} from '@thainative/shared/collision';
import {LAYOUTS,MEADOW_LANDMARKS,CITY_PLANTERS,GARDEN_TREES,CITY_ART_SOLIDS,CITY_FOUNTAIN,CITY_BUILDINGS,CITY_HOUSES,CITY_BENCHES,CITY_STALLS,FORTIFICATION_SOLIDS,DECOR,CITY_TOWER,type MapId} from '@thainative/shared/maps';

const initStart=performance.now();
await RAPIER.init();
const initializationMs=performance.now()-initStart;
type Point={x:number;z:number};
type Circle=Point&{r:number};
type Box=Point&{w:number;d:number};
export interface KnockbackGeometry {circles:readonly Circle[];boxes:readonly Box[]}
const RADIUS=.3,SKIN=.001;

export function knockbackGeometry(mapId:MapId):KnockbackGeometry {
 const l=LAYOUTS[mapId];
 const border:Box[]=[{x:l.halfX,z:0,w:2,d:l.halfZ*2+4},{x:-l.halfX,z:0,w:2,d:l.halfZ*2+4},{x:0,z:l.halfZ,w:l.halfX*2+4,d:2},{x:0,z:-l.halfZ,w:l.halfX*2+4,d:2}];
 if(mapId==='city_plaza')return {
  circles:[CITY_FOUNTAIN,...CITY_PLANTERS,...GARDEN_TREES.map(t=>({...t,r:.55})),...CITY_ART_SOLIDS.filter(s=>s.kind==='circle') as Circle[]],
  boxes:[...border,{x:0,z:0,w:CITY_TOWER.half*2,d:CITY_TOWER.half*2},...FORTIFICATION_SOLIDS,...DECOR.filter(p=>p.solid),...CITY_BUILDINGS,...CITY_HOUSES,...CITY_BENCHES,...CITY_STALLS.map(s=>s.solid),...CITY_ART_SOLIDS.filter(s=>s.kind==='box') as Box[]],
 };
 return {circles:[...l.obstacles,...(mapId==='meadow'?MEADOW_LANDMARKS.circles:[])],boxes:[...border,...(mapId==='meadow'?MEADOW_LANDMARKS.boxes:[])]};
}

/** A fixed-collider query world, shared across rooms on one map. No dynamic bodies or extra tick loop. */
export class KnockbackScene {
 private world=new RAPIER.World({x:0,y:0});private ball=new RAPIER.Ball(RADIUS);
 readonly setupMs:number;readonly colliderCount:number;
 constructor(geometry:KnockbackGeometry,private canStand:(x:number,z:number)=>boolean){
  const start=performance.now();
  for(const c of geometry.circles)this.world.createCollider(RAPIER.ColliderDesc.ball(c.r).setTranslation(c.x,c.z));
  for(const b of geometry.boxes)this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w/2,b.d/2).setTranslation(b.x,b.z));
  // Publish fixed colliders to Rapier's broad phase once. Queries do not step the world.
  this.world.step();this.colliderCount=geometry.circles.length+geometry.boxes.length;this.setupMs=performance.now()-start;
 }
 resolve=(from:Point,delta:Point):Point=>{
  const start={x:from.x,z:from.z},length=Math.hypot(delta.x,delta.z);
  if(!Number.isFinite(from.x)||!Number.isFinite(from.z)||!Number.isFinite(length)||length===0||length>32||!this.canStand(from.x,from.z))return start;
  const hit=this.world.castShape({x:from.x,y:from.z},0,{x:delta.x,y:delta.z},this.ball,SKIN,1,false);
  const fraction=hit?Math.max(0,Math.min(1,hit.time_of_impact-SKIN/length)):1;
  // Retain exact shared terrain rules for water/bridges and floating-point boundaries.
  const count=Math.max(1,Math.ceil(length*fraction/.1));let safe=0;
  for(let i=1;i<=count;i++){
   const t=fraction*i/count;
   if(!this.canStand(from.x+delta.x*t,from.z+delta.z*t)){
    let lo=safe,hi=t;for(let n=0;n<12;n++){const mid=(lo+hi)/2;if(this.canStand(from.x+delta.x*mid,from.z+delta.z*mid))lo=mid;else hi=mid;}
    return {x:from.x+delta.x*lo,z:from.z+delta.z*lo};
   }
   safe=t;
  }
  return {x:from.x+delta.x*fraction,z:from.z+delta.z*fraction};
 };
 free(){this.world.free();}
}

const scenes=new Map<MapId,KnockbackScene>();
export function monsterKnockbackFor(mapId:MapId){
 let scene=scenes.get(mapId);
 if(!scene){scene=new KnockbackScene(knockbackGeometry(mapId),(x,z)=>walkable(x,z,RADIUS,mapId));scenes.set(mapId,scene);}
 return scene.resolve;
}
export function knockbackPhysicsStats(){return {engine:'Rapier2D',initializationMs,maps:[...scenes].map(([mapId,s])=>({mapId,colliders:s.colliderCount,setupMs:s.setupMs}))};}
