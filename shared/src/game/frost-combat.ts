import {passiveEnemyHeal} from './mastery-passives.js';
import {slowMovementMultiplier} from '../jobs.js';
import {combatTargets,enemyTarget,isSummonTarget,summonDot,type CombatTarget} from './summons.js';
import type {Game,Enemy,Player,MonsterMotion,BossTelegraph} from './sim.js';
import {telegraphContains} from './telegraph-area.js';
import {pathSegmentWalkable} from './pathfinding.js';
import {walkable} from './collision.js';
import {lootEvadedWarning} from './loot-effects.js';

export interface FrostCombat {next:number;recovery?:number;openUntil?:number;retreatUntil?:number;combo?:number;action?:{kind:string;left:number;target:{x:number;z:number};areas:BossTelegraph[];targets:string[]};}
interface Hooks {motion:(e:Enemy,m:MonsterMotion)=>void;move:(e:Enemy,x:number,z:number)=>void;hurt:(p:CombatTarget,e:Enemy,attack?:string)=>boolean|void;}
const near=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const contains=(a:BossTelegraph,p:{x:number;z:number})=>telegraphContains(a,p.x,p.z);
const species=new Set(['frost_01','frost_rune_raven','frost_03','frost_ice_lindworm','frost_winter_wavehorse','frost_06','frost_fractured_valkyrie','frost_08']);
/** Distinguish the new Norse encounters from the existing Lv.38 frost_lynx. */
export const isFrostEnemy=(id:string)=>species.has(id);
export function frostHitMultiplier(g:Game,e:Enemy,p:Pick<Player,"x"|"z">){
 const front=(p.x-e.x)*e.fx+(p.z-e.z)*e.fz>0,s=e.frost;
 if(e.dataId==='frost_01'){if((s?.openUntil??0)>g.time)return 1.2;if(front&&(s?.recovery??0)<=g.time&&e.motion!=='attack')return .65;}
 if(e.dataId==='frost_ice_lindworm'&&s?.action?.kind==='tail')return .7;
 if(e.dataId==='frost_fractured_valkyrie'){if(front&&s?.action)return .5;if(!front&&(s?.openUntil??0)>g.time)return 1.25;}
 return 1;
}
/** Original Norse encounters: guard openings, ally signals, flanking and shifting stone lanes. */
export function frostStep(g:Game,e:Enemy,dt:number,h:Hooks){
 if(!isFrostEnemy(e.dataId))return false;
 const s=e.frost??={next:0},p=enemyTarget(g,e),d=near(e,p),boss=e.dataId==='frost_08';
 if(e.motion==='transform'){s.action=undefined;s.combo=0;if(e.motionTime<1.5)return true;h.motion(e,'idle');}
 if(e.motion==='hit'){if(e.motionTime<e.motionDuration)return true;h.motion(e,'idle');}
 if(s.recovery){if(s.recovery>g.time)return true;s.recovery=undefined;h.motion(e,'idle');}
 if(s.action){
  const a=s.action;if(e.motion!=='attack'||!e.telegraph){s.action=undefined;s.recovery=g.time+1.1;s.combo=0;g.events.push({type:'warningCancel',id:e.id,x:e.x,z:e.z});return true;}
  a.left-=dt;e.windup=Math.max(0,a.left);e.telegraph.left=e.windup;if(a.left>0)return true;e.telegraph=undefined;s.action=undefined;
  if(a.kind==='ward'){const amount=Math.min(e.maxHp-e.hp,Math.round(passiveEnemyHeal(g,e,e.maxHp*.12)));e.hp+=amount;g.events.push({type:'heal',id:e.id,x:e.x,z:e.z,amount});s.recovery=g.time+.8;return true;}
  let reached=true;
  if(a.kind==='flank'||a.kind==='slide'){
   const start={x:e.x,z:e.z},dx=a.target.x-e.x,dz=a.target.z-e.z,len=Math.hypot(dx,dz)||1,steps=Math.max(1,Math.ceil(len/.35));for(let i=0;i<steps;i++)h.move(e,dx/steps,dz/steps);reached=near(e,a.target)<.8;
   g.events.push({type:'frost_tracks',id:e.id,x:start.x,z:start.z,targetX:e.x,targetZ:e.z,duration:2.8});
  }
  let hitAnyone=false;
  for(const victim of combatTargets(g))if(!victim.dead){const hit=reached&&a.areas.some(area=>contains(area,victim));if(!isSummonTarget(victim)&&a.targets.includes(victim.id)&&(!hit||victim.invulnerable>0&&victim.cd.dash>0))lootEvadedWarning(victim,g);if(hit){hitAnyone=true;const bleeding=a.kind==='tail'&&!victim.god&&victim.invulnerable<=0;const connected=h.hurt(victim,e,a.areas[0].id);if(connected&&bleeding&&!victim.dead){if(isSummonTarget(victim))summonDot(victim,'bleed',Math.max(1,Math.round((e.behavior?g.data.monsters.monsters.find(m=>m.id===e.dataId)!.atk:200)*.15)),4);else{victim.lootEffects??={cooldowns:{},shield:0,shieldFor:0};victim.lootEffects.bleed={remaining:4,tick:0,map:g.mapId,damage:Math.max(1,Math.round((e.behavior?g.data.monsters.monsters.find(m=>m.id===e.dataId)!.atk:200)*.15))};}}}}
  if(a.kind==='axe'&&!hitAnyone)s.openUntil=g.time+2;
  if(a.kind==='spear'){s.combo=(s.combo??0)+1;if(s.combo===1){s.next=g.time+.5;s.recovery=g.time+.4;}else{s.combo=0;s.next=g.time+7;s.recovery=g.time+2;s.openUntil=g.time+2;}}
  else s.recovery=g.time+(a.kind==='slide'?1.4:a.kind==='flank'?.5:1.2);
  g.events.push({type:'bossBlast',id:e.id,x:a.target.x,z:a.target.z,r:a.kind==='quake'?9:2});e.attackApplied=true;return true;
 }
 if(e.dataId==='frost_rune_raven'&&g.time>=s.next&&e.motion!=='attack'){
  const ally=g.enemies.filter(v=>v.id!==e.id&&!v.dead&&!v.summoned&&isFrostEnemy(v.dataId)&&near(e,v)<9&&!v.statuses.some(s=>s.id==='rage')).sort((a,b)=>near(e,a)-near(e,b))[0];
  if(ally){ally.statuses.push({id:'rage',sourceId:'frost_raven:'+e.id,remaining:4,value:.12});s.next=g.time+8;s.recovery=g.time+.8;h.motion(e,'attack');e.motionDuration=.8;g.events.push({type:'frost_signal',id:ally.id,x:ally.x,z:ally.z,r:1.6,duration:.8});return true;}
 }
 if(e.dataId==='frost_06'&&e.hp<e.maxHp*.7&&g.time>=s.next&&e.motion!=='attack'){
  const distance=Math.hypot(e.homeX-e.x,e.homeZ-e.z);
  if(distance>1.5){s.retreatUntil??=g.time+5;if(g.time<s.retreatUntil){h.motion(e,'hop');h.move(e,(e.homeX-e.x)/distance*2.2*dt*slowMovementMultiplier(e),(e.homeZ-e.z)/distance*2.2*dt*slowMovementMultiplier(e));return true;}s.retreatUntil=undefined;s.next=g.time+10;return false;}
  s.retreatUntil=undefined;s.next=g.time+12;h.motion(e,'attack');e.windup=2.2;e.motionDuration=2.9;e.telegraph={id:'frost_ward',nameTh:'ปักหลักศิลาชีพ',shape:'circle',x:e.x,z:e.z,radius:2,inner:0,angle:0,fx:e.fx,fz:e.fz,left:2.2};s.action={kind:'ward',left:2.2,target:{x:e.x,z:e.z},areas:[],targets:[]};g.events.push({type:'frost_ward',id:e.id,x:e.x,z:e.z,r:2,duration:2.2});return true;
 }
 if(d>(boss?15:8)||p.dead||g.time<s.next||e.motion==='attack'||e.motion==='hit')return boss;
 let kind='',windup=1.4,target={x:p.x,z:p.z},areas:BossTelegraph[]=[];
 const dx=(p.x-e.x)/(d||1),dz=(p.z-e.z)/(d||1),clear=(x:number,z:number)=>walkable(x,z,.4,g.mapId);
 const area=(x:number,z:number,radius:number,shape:BossTelegraph['shape']='circle',angle=0):BossTelegraph=>({id:'',nameTh:'',x,z,radius,shape,angle,inner:0,fx:dx,fz:dz,left:windup});
 if(e.dataId==='frost_01'){kind='axe';areas=[area(e.x,e.z,3.5,'cone',75)];s.next=g.time+5.5;}
 else if(e.dataId==='frost_03'){
  kind='flank';windup=1.1;const partner=g.enemies.find(v=>v.id!==e.id&&!v.dead&&v.dataId==='frost_03'&&near(e,v)<9),side=partner?(e.id<partner.id?-1:1):e.id%2?1:-1;
  target={x:p.x-dz*2.5*side,z:p.z+dx*2.5*side};if(!clear(target.x,target.z)||!pathSegmentWalkable(e,target,clear))return false;areas=[area(target.x,target.z,1.6)];s.next=g.time+6;
 }else if(e.dataId==='frost_ice_lindworm'){kind='tail';windup=1.6;areas=[area(e.x,e.z,4.5,'cone',210)];s.next=g.time+7;}
 else if(e.dataId==='frost_winter_wavehorse'){
  kind='slide';windup=1.6;const line=[2,4,6,8].map(n=>({x:e.x+dx*n,z:e.z+dz*n})).filter(q=>clear(q.x,q.z)&&pathSegmentWalkable(e,q,clear));if(!line.length)return false;target=line.at(-1)!;areas=line.map(q=>area(q.x,q.z,1.25));s.next=g.time+7;
 }else if(e.dataId==='frost_fractured_valkyrie'){kind='spear';windup=s.combo===1?1.1:1.7;areas=[area(e.x,e.z,5.5,'cone',60)];s.next=g.time+7;}
 else if(boss){
  if(e.patternIndex++%2===0){kind='quake';windup=e.bossPhase===2?2.1:2.6;const safe=(Math.floor(e.patternIndex/2)%3-1)*3;
   for(const z of [-6,-3,0,3,6])if(z!==safe)for(const x of [-6,-3,0,3,6])areas.push(area(e.homeX+x,e.homeZ+z,1.7));
   for(const x of [-6,-3,0,3,6])g.events.push({type:'safe_zone',id:e.id,x:e.homeX+x,z:e.homeZ+safe,r:1.2,duration:windup});target={x:e.homeX,z:e.homeZ+safe};
  }else{kind='smash';windup=e.bossPhase===2?1.5:1.9;areas=[area(e.x,e.z,7,'cone',90)];}
  s.next=g.time+(e.bossPhase===2?5:6.4);
 }
 if(!areas.length)return false;
 const names:Record<string,string>={axe:'ขวานผู้เฝ้าเหมันต์',flank:'หมาป่าล้อมปีก',tail:'หางลินด์เวิร์มกวาด',slide:'พุ่งร่องคลื่นน้ำแข็ง',spear:'หอกวาลคีรีสองจังหวะ',quake:'รอยแยกธารแข็ง',smash:'ค้อนโยตุนผ่าฟยอร์ด'};
 for(const a of areas){a.id='frost_'+kind;a.nameTh=names[kind];a.left=windup;g.events.push({type:'warning',id:e.id,attack:a.id,x:a.x,z:a.z,r:a.radius,shape:a.shape,angle:a.angle,fx:a.fx,fz:a.fz,duration:windup,name:a.nameTh});}
 h.motion(e,'attack');e.fx=dx;e.fz=dz;e.telegraph=areas[0];e.windup=windup;e.motionDuration=windup+.7;e.cooldown=windup+1.2;s.action={kind,left:windup,target,areas,targets:[...g.players.values()].filter(p=>!p.dead&&areas.some(a=>contains(a,p))).map(p=>p.id)};return true;
}
