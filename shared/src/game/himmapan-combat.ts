import {passiveEnemyHeal} from './mastery-passives.js';
import {slowMovementMultiplier} from '../jobs.js';
import {combatTargets,enemyTarget,isSummonTarget,summonDot,type CombatTarget} from './summons.js';
import {telegraphContains} from './telegraph-area.js';
import type {Game,Enemy,Player,MonsterMotion,BossTelegraph} from './sim.js';
import {lootEvadedWarning} from './loot-effects.js';
import {walkable} from './collision.js';
export interface HimmapanCombat {next:number;recovery?:number;action?:{kind:string;left:number;target:{x:number;z:number};areas:BossTelegraph[];targets:string[]};}
interface Hooks {motion:(e:Enemy,m:MonsterMotion)=>void;move:(e:Enemy,x:number,z:number)=>void;hurt:(p:CombatTarget,e:Enemy,attack?:string)=>void;}
const ids=new Set(['himmapan_01','himmapan_jade_turtle','himmapan_03','himmapan_blossom_deer','himmapan_golden_macaque','himmapan_06','himmapan_azure_garuda','himmapan_08']);
const near=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const contains=(a:BossTelegraph,p:{x:number;z:number})=>telegraphContains(a,p.x,p.z);
/** Server-only species mechanics. Ordinary movement/attacks remain with the existing field AI. */
export function himmapanStep(g:Game,e:Enemy,dt:number,h:Hooks){
 if(!ids.has(e.dataId))return false;
 const s=e.himmapan??={next:0},p=enemyTarget(g,e),d=near(e,p);
 if(e.motion==='transform'){s.action=undefined;if(e.motionTime<1.5)return true;h.motion(e,'idle');}
 if(e.motion==='hit'){if(e.motionTime<e.motionDuration)return true;h.motion(e,'idle');}
 if(s.recovery){if(s.recovery>g.time)return true;s.recovery=undefined;h.motion(e,'idle');}
 if(s.action){
  const a=s.action;
  // Stun, death and another combat action cancel the locked warning, never leave invisible damage.
  if(e.motion!=='attack'||!e.telegraph){s.action=undefined;g.events.push({type:'warningCancel',id:e.id,x:e.x,z:e.z});return false;}
  a.left-=dt;e.windup=Math.max(0,a.left);e.telegraph.left=e.windup;
  if(a.left>0)return true;
  e.telegraph=undefined;s.action=undefined;
  let reached=true;if(a.kind==='dive'){reached=walkable(a.target.x,a.target.z,.65,g.mapId);if(reached){e.x=a.target.x;e.z=a.target.z;}}
  if(a.kind==='pounce'){const dx=a.target.x-e.x,dz=a.target.z-e.z,len=Math.hypot(dx,dz)||1;const steps=Math.max(1,Math.ceil(len/.5));for(let i=0;i<steps;i++)h.move(e,dx/steps,dz/steps);}
  if(a.kind==='pounce')reached=near(e,a.target)<.8;
  for(const victim of combatTargets(g))if(!victim.dead){const hit=reached&&a.areas.some(area=>contains(area,victim));if(!isSummonTarget(victim)&&a.targets.includes(victim.id)&&(!hit||(victim.invulnerable>0&&victim.cd.dash>0)))lootEvadedWarning(victim,g);if(hit)h.hurt(victim,e,a.areas[0].id);}
  g.events.push({type:'bossBlast',id:e.id,x:a.target.x,z:a.target.z,r:a.kind==='wave'?10:2});
  s.recovery=g.time+(a.kind==='dive'||a.kind==='pounce'?1.2:.7);e.attackApplied=true;return true;
 }
 if(e.dataId==='himmapan_01'&&g.time>=s.next&&e.motion!=='attack'){
  const ally=g.enemies.filter(v=>v.id!==e.id&&!v.dead&&!v.summoned&&ids.has(v.dataId)&&near(e,v)<9&&v.hp<v.maxHp*.8).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
  if(ally){const amount=Math.min(ally.maxHp-ally.hp,Math.round(passiveEnemyHeal(g,ally,ally.maxHp*.08)));ally.hp+=amount;s.next=g.time+7;s.recovery=g.time+.8;h.motion(e,'attack');e.motionDuration=.8;g.events.push({type:'heal',id:ally.id,x:ally.x,z:ally.z,amount});return true;}
 }
 if(e.dataId==='himmapan_blossom_deer'&&e.hp<e.maxHp*.65&&g.time>=s.next){
  const home={x:e.homeX,z:e.homeZ},distance=near(home,e);if(distance>1){h.motion(e,'hop');h.move(e,(home.x-e.x)/distance*3.2*dt*slowMovementMultiplier(e),(home.z-e.z)/distance*3.2*dt*slowMovementMultiplier(e));return true;}
  const amount=Math.min(e.maxHp-e.hp,Math.round(passiveEnemyHeal(g,e,e.maxHp*.15)));e.hp+=amount;s.next=g.time+12;s.recovery=g.time+1;g.events.push({type:'heal',id:e.id,x:e.x,z:e.z,amount});return true;
 }
 const naga=e.dataId==='himmapan_08';if(d>(naga?14:8)||p.dead||g.time<s.next||e.motion==='attack'||e.motion==='hit')return naga;
 const waveSpec=naga?g.data.monsters.monsters.find(m=>m.id===e.dataId)?.telegraphs?.[e.patternIndex%2]:undefined;
 let kind='',windup=1.2,areas:BossTelegraph[]=[],target={x:p.x,z:p.z};
 const area=(x:number,z:number,radius:number,shape:BossTelegraph['shape']='circle',inner=0,angle=0):BossTelegraph=>({id:'himmapan_'+kind,nameTh:'',shape,x,z,radius,inner,angle,fx:(p.x-e.x)/(d||1),fz:(p.z-e.z)/(d||1),left:windup});
 if(naga){kind='wave';windup=e.bossPhase===2?Math.max(1.6,(waveSpec?.windup??2.1)-.3):(waveSpec?.windup??2.1);const side=(e.patternIndex++%3)-1;target={x:e.homeX+side*4,z:e.homeZ};areas=[area(target.x,target.z,waveSpec?.radius??12,'ring',waveSpec?.inner??2.2)];s.next=g.time+(e.bossPhase===2?4:5.5);g.events.push({type:'safe_zone',id:e.id,x:target.x,z:target.z,r:2.2,duration:windup});}
 else if(e.dataId==='himmapan_jade_turtle'){kind='spout';areas=[area(e.x,e.z,6,'cone',0,80)];s.next=g.time+6;}
 else if(e.dataId==='himmapan_03'||e.dataId==='himmapan_06'){kind='pounce';windup=e.dataId==='himmapan_06'?1.1:1.4;const dx=(p.x-e.x)/(d||1),dz=(p.z-e.z)/(d||1),reach=Math.min(6,d);target={x:e.x+dx*reach,z:e.z+dz*reach};areas=[area(target.x,target.z,1.8)];s.next=g.time+7;}
 else if(e.dataId==='himmapan_golden_macaque'){kind='fruit';windup=1.3;areas=[area(p.x-1.5,p.z,1.5),area(p.x+1.5,p.z,1.5)];s.next=g.time+7;}
 else if(e.dataId==='himmapan_azure_garuda'&&d<7&&walkable(p.x,p.z,.65,g.mapId)){kind='dive';windup=1.6;areas=[area(target.x,target.z,2.1)];s.next=g.time+8;}
 if(!areas.length)return false;
 for(const a of areas){a.id=waveSpec?.id??('himmapan_'+kind);a.left=windup;a.nameTh=kind==='wave'?'คลื่นธารานาคา':kind==='dive'?'ครุฑดิ่งเวหา':kind==='spout'?'เต่าพ่นธารา':kind==='fruit'?'ผลทองแยกวิถี':'กระโจนฝ่าตลิ่ง';g.events.push({type:'warning',id:e.id,attack:a.id,x:a.x,z:a.z,r:a.radius,inner:a.inner,shape:a.shape,angle:a.angle,fx:a.fx,fz:a.fz,duration:windup,name:a.nameTh});}
 h.motion(e,'attack');e.fx=(p.x-e.x)/(d||1);e.fz=(p.z-e.z)/(d||1);e.telegraph=areas[0];e.motionDuration=windup+.7;e.windup=windup;e.cooldown=windup+1.2;s.action={kind,left:windup,target,areas,targets:[...g.players.values()].filter(p=>!p.dead&&areas.some(a=>contains(a,p))).map(p=>p.id)};return true;
}
/** Shells protect only the front; the turtle exposes itself after spouting, and Garuda after diving. */
export function himmapanHitMultiplier(g:Game,e:Enemy,p:Pick<Player,"x"|"z">){
 if(e.dataId==='himmapan_jade_turtle'&&(e.himmapan?.recovery??0)<=g.time&&e.motion!=='attack'&&(p.x-e.x)*e.fx+(p.z-e.z)*e.fz>0)return .45;
 if(e.dataId==='himmapan_azure_garuda'&&(e.himmapan?.recovery??0)>g.time)return 1.25;
 return 1;
}
