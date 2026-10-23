import {combatTargets,enemyTarget,isSummonTarget,summonDot,type CombatTarget} from './summons.js';
import {applySlow,slowMovementMultiplier} from '../jobs.js';
import {telegraphContains} from './telegraph-area.js';
import type {Game,Enemy,Player,MonsterMotion,BossTelegraph} from './sim.js';
import {walkable} from './collision.js';
import {lootEvadedWarning} from './loot-effects.js';

export interface DesertCombat {
 next:number;recovery?:number;returnUntil?:number;cracks?:number;
 action?:{kind:string;left:number;target:{x:number;z:number};areas:BossTelegraph[];targets:string[]};
 hazard?:{kind:'ball'|'knot';life:number;dx:number;dz:number};
 sand?:{areas:BossTelegraph[];until:number};
}
interface Hooks {motion:(e:Enemy,m:MonsterMotion)=>void;move:(e:Enemy,x:number,z:number)=>void;hurt:(p:CombatTarget,e:Enemy,attack?:string)=>void;spawn:(x:number,z:number,id:string,parent:number)=>Enemy;}
const near=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const contains=(a:BossTelegraph,p:{x:number;z:number})=>telegraphContains(a,p.x,p.z);
const retire=(e:Enemy)=>{e.dead=true;e.rewarded=true;e.deathAge=0;e.respawn=999;};
function slow(p:CombatTarget,source:string,value:number,seconds:number){p.statuses=p.statuses.filter(s=>s.sourceId!==source);applySlow(p,source,seconds,value);}
/** Destroying a binding is the escape condition, regardless of who lands the last hit. */
export function desertDestroyed(g:Game,e:Enemy){if(!e.dataId.startsWith('desert_'))return;if(e.dataId==='desert_binding_knot')for(const p of [...g.players.values(),...combatTargets(g).filter(isSummonTarget)])p.statuses=p.statuses.filter(s=>s.sourceId!=='desert_bind:'+e.id);for(const child of g.enemies)if(child.summonedBy===e.id&&!child.dead){desertDestroyed(g,child);retire(child);}}
export const desertBurrowed=(e:Enemy)=>e.dataId==='desert_03'&&e.motion==='attack'&&!!e.telegraph&&e.desert?.action?.kind==='burrow'&&e.motionTime>.3;
export function desertHitMultiplier(g:Game,e:Enemy){return e.dataId==='desert_glass_scorpion'&&(e.desert?.recovery??0)>g.time?1.2:1;}
export function desertStruck(e:Enemy){if(e.dataId==='desert_glass_scorpion'){const s=e.desert??={next:0};s.cracks=Math.min(3,(s.cracks??0)+1);if(s.cracks>=3&&!e.statuses.some(v=>v.sourceId==='scorpion_shell'))e.statuses.push({id:'def_down',sourceId:'scorpion_shell',remaining:6,value:.08});}}

/** Region-specific encounters run on the server; generated sprites only present these decisions. */
export function desertStep(g:Game,e:Enemy,dt:number,h:Hooks){
 if(!e.dataId.startsWith('desert_'))return false;
 const s=e.desert??={next:0},p=enemyTarget(g,e),d=near(e,p);
 if(s.hazard){
  const a=s.hazard;a.life-=dt;const parent=g.enemies.find(v=>v.id===e.summonedBy&&!v.dead);
  if(a.life<=0||!parent){desertDestroyed(g,e);retire(e);return true;}
  if(a.kind==='ball'){
   const x=e.x+a.dx*4.5*dt,z=e.z+a.dz*4.5*dt;
   if(!walkable(x,z,.4,g.mapId)){retire(e);return true;}
   h.motion(e,'hop');h.move(e,a.dx*4.5*dt,a.dz*4.5*dt);
   for(const victim of combatTargets(g))if(!victim.dead&&near(e,victim)<.85){h.hurt(victim,e,'desert_sand_roll');retire(e);break;}
  }
  return true;
 }
 if(s.sand){if(s.sand.until<=g.time)s.sand=undefined;else for(const victim of combatTargets(g))if(!victim.dead&&!victim.god&&victim.invulnerable<=0&&s.sand.areas.some(a=>contains(a,victim)))slow(victim,'desert_sand:'+e.id,.35,.3);}
 if(e.motion==='transform'){s.action=undefined;if(e.motionTime<1.5)return true;h.motion(e,'idle');}
 if(e.motion==='hit'){if(e.motionTime<e.motionDuration)return true;h.motion(e,'idle');}
 if(s.recovery){if(s.recovery>g.time)return true;s.recovery=undefined;h.motion(e,'idle');}
 if(s.returnUntil){const len=Math.hypot(e.homeX-e.x,e.homeZ-e.z);if(len>1&&g.time<s.returnUntil){h.motion(e,'hop');h.move(e,(e.homeX-e.x)/len*4*dt*slowMovementMultiplier(e),(e.homeZ-e.z)/len*4*dt*slowMovementMultiplier(e));return true;}s.returnUntil=undefined;s.recovery=g.time+.6;return true;}
 if(s.action){
  const a=s.action;
  if(e.motion!=='attack'||!e.telegraph){s.action=undefined;s.recovery=g.time+1.2;g.events.push({type:'warningCancel',id:e.id,x:e.x,z:e.z});return true;}
  a.left-=dt;e.windup=Math.max(0,a.left);e.telegraph.left=e.windup;if(a.left>0)return true;
  e.telegraph=undefined;s.action=undefined;
  if(a.kind==='roll'){
   const dx=(a.target.x-e.x)/(near(e,a.target)||1),dz=(a.target.z-e.z)/(near(e,a.target)||1),x=e.x+dx*1.2,z=e.z+dz*1.2;
   if(walkable(x,z,.4,g.mapId)){const ball=h.spawn(x,z,'desert_sand_ball',e.id);ball.desert={next:0,hazard:{kind:'ball',life:2.5,dx,dz}};}
  }else{
   if(a.kind==='burrow'&&walkable(a.target.x,a.target.z,.65,g.mapId)){e.x=a.target.x;e.z=a.target.z;}
   let landed=true;if(a.kind==='swoop'){landed=walkable(a.target.x,a.target.z,.35,g.mapId);if(landed){e.x=a.target.x;e.z=a.target.z;}s.returnUntil=g.time+2.5;}
   for(const victim of combatTargets(g))if(!victim.dead){const hit=landed&&a.areas.some(area=>contains(area,victim));if(!isSummonTarget(victim)&&a.targets.includes(victim.id)&&(!hit||victim.invulnerable>0&&victim.cd.dash>0))lootEvadedWarning(victim,g);if(hit){const canBind=!victim.god&&victim.invulnerable<=0;h.hurt(victim,e,a.areas[0].id);
     if(a.kind==='rake'&&canBind&&!victim.dead)slow(victim,'desert_sand:'+e.id,.35,.3);
     if(a.kind==='bind'&&canBind&&!victim.dead){const x=victim.x+1,z=victim.z;if(walkable(x,z,.35,g.mapId)){const knot=h.spawn(x,z,'desert_binding_knot',e.id);knot.desert={next:0,hazard:{kind:'knot',life:3,dx:0,dz:0}};slow(victim,'desert_bind:'+knot.id,1,3);}}
   }}
  }
  if(a.kind==='rake'){s.sand={areas:a.areas,until:g.time+3.5};for(const area of a.areas)g.events.push({type:'sand_patch',id:e.id,x:area.x,z:area.z,r:area.radius,duration:3.5});}
  g.events.push({type:'bossBlast',id:e.id,x:a.target.x,z:a.target.z,r:a.kind==='glyph'?10:2});s.recovery=g.time+(a.kind==='tail'?2:.8);e.attackApplied=true;return true;
 }
 const boss=e.dataId==='desert_08';if(d>(boss?14:8)||p.dead||g.time<s.next||e.motion==='attack'||e.motion==='hit')return boss;
 let kind='',windup=1.3,target={x:p.x,z:p.z},areas:BossTelegraph[]=[];
 const dx=(p.x-e.x)/(d||1),dz=(p.z-e.z)/(d||1);
 const area=(x:number,z:number,radius:number,shape:BossTelegraph['shape']='circle',inner=0,angle=0):BossTelegraph=>({id:'',nameTh:'',x,z,radius,shape,inner,angle,fx:dx,fz:dz,left:windup});
 if(e.dataId==='desert_01'){
  if(g.enemies.some(v=>v.summonedBy===e.id&&!v.dead))return false;
  kind='roll';windup=1.1;target={x:e.x+dx*8,z:e.z+dz*8};areas=[2.5,5,7.5].map(n=>area(e.x+dx*n,e.z+dz*n,.85));s.next=g.time+8;
 }else if(e.dataId==='desert_oasis_hawk'){kind='swoop';windup=1.4;const reach=Math.min(7,d);target={x:e.x+dx*reach,z:e.z+dz*reach};areas=[area(target.x,target.z,1.7)];s.next=g.time+7;}
 else if(e.dataId==='desert_03'){kind='burrow';windup=1.5;areas=[area(target.x,target.z,1.8)];s.next=g.time+8;}
 else if(e.dataId==='desert_sand_ushabti'){kind='rake';windup=1.7;areas=[2,4,6].map(n=>area(e.x+dx*n,e.z+dz*n,1.3));s.next=g.time+8;}
 else if(e.dataId==='desert_seal_mummy'){
  if(g.enemies.some(v=>v.summonedBy===e.id&&!v.dead))return false;
  kind='bind';windup=1.6;areas=[area(target.x,target.z,1.7)];s.next=g.time+9;
 }else if(e.dataId==='desert_06'){kind='spear';windup=1.8;areas=[area(e.x,e.z,7,'cone',0,24)];s.next=g.time+7;}
 else if(e.dataId==='desert_glass_scorpion'){kind='tail';windup=1.8;areas=[2,4,6].map(n=>area(e.x+dx*n,e.z+dz*n,.95));s.next=g.time+7;}
 else if(boss){
  if(e.patternIndex++%2===0){kind='glyph';windup=e.bossPhase===2?1.9:2.3;const glyph=(Math.floor(e.patternIndex/2)%3),offset=[[-4,2],[4,2],[0,-4]][glyph];target={x:e.homeX+offset[0],z:e.homeZ+offset[1]};areas=[area(target.x,target.z,12,'ring',2.4)];g.events.push({type:'safe_zone',id:e.id,x:target.x,z:target.z,r:2.4,duration:windup});}
  else{kind='beam';windup=e.bossPhase===2?1.8:2.2;areas=[area(e.x,e.z,12,'cone',0,32)];target={x:e.x+dx*7,z:e.z+dz*7};}
  s.next=g.time+(e.bossPhase===2?4.6:5.8);
 }
 if(!areas.length)return false;
 const names:Record<string,string>={roll:'ลูกทรายกลิ้ง',swoop:'เงาเหยี่ยวโฉบ',burrow:'รอยอสรพิษผุด',rake:'คราดสร้างสันทราย',bind:'ตราผ้าผูกมัด',spear:'หอกผู้เฝ้าสุสาน',tail:'แนวเหล็กในแก้ว',glyph:'ตราสฟิงซ์สุริยคราส',beam:'ลำแสงสุริยคราส'};
 for(const a of areas){a.id='desert_'+kind;a.nameTh=names[kind];a.left=windup;g.events.push({type:'warning',id:e.id,attack:a.id,x:a.x,z:a.z,r:a.radius,inner:a.inner,shape:a.shape,angle:a.angle,fx:a.fx,fz:a.fz,duration:windup,name:a.nameTh});}
 h.motion(e,'attack');e.fx=dx;e.fz=dz;e.telegraph=areas[0];e.motionDuration=windup+.7;e.windup=windup;e.cooldown=windup+1.2;s.action={kind,left:windup,target,areas,targets:[...g.players.values()].filter(p=>!p.dead&&areas.some(a=>contains(a,p))).map(p=>p.id)};return true;
}
