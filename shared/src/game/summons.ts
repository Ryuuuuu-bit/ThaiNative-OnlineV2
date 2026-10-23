import {passiveValue} from './mastery-passives.js';
import type {Game,Player,Enemy,Vec} from './sim.js';
import {monsterStats} from '../derive.js';
import {tickEffects,slowMovementMultiplier,type TimedEffect} from '../jobs.js';
import {masteryUseLock,masteryAutoRank} from '../mastery.js';
import {walkable} from './collision.js';
import {pathSegmentWalkable} from './pathfinding.js';
import {isField} from './maps.js';
import {advancedPetModifiers} from './mastery-runtime.js';

export interface Summon extends Vec {
 decoy?:boolean;
 id:number;ownerId:string;mapId:Game['mapId'];level:number;
 hp:number;maxHp:number;atk:number;fx:number;fz:number;
 state:'follow'|'chase'|'attack';target:number|null;cooldown:number;attack:number;
 dead:boolean;god?:boolean;invulnerable:number;statuses:TimedEffect[];
 command?:{target:number|null;level:number;nextBonus:number};
 dots?:{kind:'poison'|'bleed';damage:number;remaining:number;tick:number}[];
}
export type CombatTarget=Player|Summon;
export const isSummonTarget=(p:CombatTarget):p is Summon=>typeof p.id==='number';
export function combatTargets(g:Game):CombatTarget[]{return [...g.players.values()].flatMap<CombatTarget>(p=>p.dead||p.mapId!==g.mapId?[]:[p,...(p.summon&&!p.summon.dead&&p.summon.hp>0?[p.summon]:[]),...(p.decoy&&!p.decoy.dead&&p.decoy.hp>0?[p.decoy]:[])]);}
export function enemyTarget(g:Game,e:Enemy):CombatTarget{
 const taunt=e.statuses.find(s=>s.id==='taunt'),p=taunt?g.players.get(taunt.sourceId):undefined;
 return p&&!p.dead?p:combatTargets(g).filter(t=>!e.boss||!isSummonTarget(t)||!t.decoy).sort((a,b)=>distance(a,e)-distance(b,e))[0]??g.p;
}
export function summonStats(g:Game,p:Player,pet:Summon){return monsterStats({...g.data.monsters.monsters[0],level:p.level,hp:pet.maxHp,atk:pet.atk,matk:0,element:'neutral',race:'brute',size:'small',boss:false,hit:100+p.level,flee:p.level,hardDef:0,softDef:0,hardMdef:0,softMdef:0},g.data);}
export function summonDot(pet:Summon,kind:'poison'|'bleed',damage:number,seconds:number){pet.dots=[...(pet.dots??[]).filter(d=>d.kind!==kind),{kind,damage,remaining:seconds,tick:0}];}
const routes=new WeakMap<Summon,{points:Vec[];goal:Vec;next:number}>();
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.z-b.z);
export function removeSummon(g:Game,p:Player,reason:string){
 const pet=p.summon;if(!pet)return;
 p.summon=undefined;
 g.events.push({type:'summonEnd',playerId:p.id,petId:pet.id,x:pet.x,z:pet.z,reason});
}

/** Server cast completion: never grant an extra pet or heal the caster when replacing one. */
export function createSummon(g:Game,p:Player,level:number):boolean{
 if(g.players.get(p.id)!==p||p.dead||p.mapId!==g.mapId||!isField(g.mapId)||!Number.isInteger(level)||level<1||level>(p.skills.shaman_01??0)||masteryUseLock(p,'shaman_01',p.stats.weaponType,g.data.mastery))return false;
 const rank=g.data.mastery.skills.find(s=>s.id==='shaman_01')!.ranks[level-1];
 const offsets=[[.8,0],[-.8,0],[0,.8],[0,-.8],[0,0]];
 const at=offsets.map(([x,z])=>({x:p.x+x,z:p.z+z})).find(v=>walkable(v.x,v.z,.3,g.mapId)&&pathSegmentWalkable(p,v,(x,z)=>walkable(x,z,.3,g.mapId)));
 if(!at)return false;
 removeSummon(g,p,'replaced');
 const maxHp=Math.max(1,Math.round(p.maxHp*rank.params.petHp/100*(1+passiveValue(g,p,'shaman_14','petHpUp')/100)));
 p.summon={...at,id:g.nextId++,ownerId:p.id,mapId:g.mapId,level,hp:maxHp,maxHp,atk:Math.max(1,p.stats.matk*rank.params.petAtk/100),fx:p.fx,fz:p.fz,state:'follow',target:null,cooldown:.6,attack:0,dead:false,invulnerable:0,statuses:[]};
 g.events.push({type:'summon',playerId:p.id,petId:p.summon.id,x:at.x,z:at.z,skillId:'shaman_01'});
 return true;
}
/** Immediate commands require an owned, ready body already in real melee reach and clear sight. */
export function commandableSummon(g:Game,p:Player,target:Enemy):Summon|undefined{
 const pet=p.summon;
 if(g.players.get(p.id)!==p||p.dead||p.mapId!==g.mapId||!isField(g.mapId)||!g.enemies.includes(target)||target.dead||!pet||pet.dead||pet.hp<=0||pet.ownerId!==p.id||pet.mapId!==g.mapId||!Number.isInteger(pet.level)||pet.level<1||pet.level>(p.skills.shaman_01??0)||masteryUseLock(p,'shaman_01',p.stats.weaponType,g.data.mastery)||masteryUseLock(p,'shaman_03',p.stats.weaponType,g.data.mastery))return;
 if(pet.statuses.some(s=>s.remaining>0&&['stun','knockup'].includes(s.id))||distance(p,pet)>12||distance(p,target)>g.data.mastery.skills.find(s=>s.id==='shaman_03')!.range+(target.boss?.5:0)||distance(pet,target)>1.6||!pathSegmentWalkable(pet,target,(x,z)=>walkable(x,z,.3,g.mapId)))return;
 return pet;
}
interface Hooks {path:(map:Game['mapId'],from:Vec,to:Vec)=>Vec[];move:(pet:Summon,x:number,z:number)=>void;hit:(pet:Summon,e:Enemy)=>void;hurt:(pet:Summon,amount:number)=>void;}

/** Follow the owner or their engaged enemy; cached routes prevent pathfinding every tick. */
export function stepSummon(g:Game,p:Player,dt:number,h:Hooks){
 const pet=p.summon;if(!pet)return;
 if(p.dead||pet.hp<=0||p.mapId!==g.mapId||pet.mapId!==g.mapId||pet.ownerId!==p.id||pet.level>(p.skills.shaman_01??0)||!isField(g.mapId)||masteryUseLock(p,'shaman_01',p.stats.weaponType,g.data.mastery)){removeSummon(g,p,'invalid');return;}
 const params=g.data.mastery.skills.find(s=>s.id==='shaman_01')!.ranks[pet.level-1].params;
 pet.atk=Math.max(1,p.stats.matk*params.petAtk/100);
 pet.maxHp=Math.max(1,Math.round(p.maxHp*params.petHp/100*(1+passiveValue(g,p,'shaman_14','petHpUp')/100)));pet.hp=Math.min(pet.hp,pet.maxHp);
 pet.invulnerable=Math.max(0,pet.invulnerable-dt);
 for(const dot of pet.dots??[]){dot.tick+=Math.min(dt,dot.remaining);dot.remaining-=dt;while(dot.tick>=1-1e-8&&!pet.dead){dot.tick-=1;h.hurt(pet,dot.damage);}}
 pet.dots=pet.dots?.filter(d=>d.remaining>0);if(pet.dead)return;
 const resistance=Math.min(g.data.stats.caps.maxResist,passiveValue(g,p,'shaman_07','petCcResist')/100);for(const status of pet.statuses)if(['stun','knockup','freeze','sleep','fear','root','silence'].includes(status.id))status.remaining-=dt*(1/Math.max(.01,1-resistance)-1);
 const controlled=pet.statuses.some(s=>['stun','knockup'].includes(s.id));tickEffects(pet,dt);
 if(controlled){pet.attack=0;return;}
 if(p.castRemaining>0&&g.meteors.some(m=>m.ownerId===p.id&&m.skillId==='shaman_01')){pet.attack=0;return;}
 pet.cooldown=Math.max(0,pet.cooldown-dt);
 if(pet.cooldown<1e-8)pet.cooldown=0;
 const inLeash=(e:Enemy)=>!e.dead&&distance(e,p)<=12;
 if(pet.command&&(pet.command.level>(p.skills.shaman_03??0)||masteryUseLock(p,'shaman_03',p.stats.weaponType,g.data.mastery)))pet.command=undefined;
 const mods=advancedPetModifiers(g,p),commanded=mods.recall?undefined:g.enemies.find(e=>e.id===pet.command?.target&&inLeash(e));
 if(pet.command&&!commanded)pet.command.target=null;
 const target=mods.recall?undefined:commanded??g.enemies.find(e=>e.id===p.target&&inLeash(e))??g.enemies.find(e=>inLeash(e)&&e.aggro>0&&(e.damageBy[p.id]??0)>0);
 if(mods.recall)pet.attack=0;
 const clear=(from:Vec,to:Vec)=>pathSegmentWalkable(from,to,(x,z)=>walkable(x,z,.3,g.mapId));
 if(pet.attack>0){
  pet.attack=Math.max(0,pet.attack-dt);
  if(pet.attack<=1e-8){
   pet.attack=0;pet.cooldown=Math.max(.6,1.2/mods.haste);
   const locked=g.enemies.find(e=>e.id===pet.target&&inLeash(e));
   if(locked&&distance(pet,locked)<=1.6&&clear(pet,locked))h.hit(pet,locked);
  }
  return;
 }
 let goal:Vec=target??p;pet.target=target?.id??null;
 if(target&&distance(pet,target)<=1.3&&clear(pet,target)){
  pet.state='attack';
  if(pet.cooldown<=0){const d=distance(pet,target)||1;pet.fx=(target.x-pet.x)/d;pet.fz=(target.z-pet.z)/d;pet.attack=.3;g.events.push({type:'summonAttack',playerId:p.id,petId:pet.id,id:target.id,x:pet.x,z:pet.z,duration:.3});}
  return;
 }
 pet.state=target?'chase':'follow';
 if(pet.statuses.some(s=>s.id==='root'))return;
 if(!target&&distance(pet,p)<=1)return;
 if(!walkable(goal.x,goal.z,.4,g.mapId)){
  const angle=Math.atan2(pet.z-goal.z,pet.x-goal.x);
  goal=Array.from({length:12},(_,i)=>({x:goal.x+Math.cos(angle+i*Math.PI/6),z:goal.z+Math.sin(angle+i*Math.PI/6)})).find(v=>walkable(v.x,v.z,.4,g.mapId))??goal;
 }
 let navigation=routes.get(pet);
 if(!navigation||g.time>=navigation.next||distance(navigation.goal,goal)>1){navigation={points:h.path(g.mapId,pet,goal),goal:{x:goal.x,z:goal.z},next:g.time+.5};routes.set(pet,navigation);}
 while(navigation.points.length&&distance(pet,navigation.points[0])<.15)navigation.points.shift();
 const point=navigation.points[0];if(!point)return;
 const d=distance(pet,point);pet.fx=(point.x-pet.x)/(d||1);pet.fz=(point.z-pet.z)/(d||1);
 const speed=3.5*slowMovementMultiplier(pet);
 h.move(pet,pet.fx*Math.min(d,speed*dt),pet.fz*Math.min(d,speed*dt));
}


export interface Wisp extends Vec {
 automatic?:boolean;
 id:number;mapId:Game['mapId'];level:number;target:number;next:number;until:number;hitsLeft:number;
}
export function removeWisp(g:Game,p:Player,reason:string){
 const w=p.wisp;if(!w)return;p.wisp=undefined;
 g.events.push({type:'wispEnd',playerId:p.id,wispId:w.id,x:w.x,z:w.z,reason});
}
/** One intangible batch, independent of the main pet; only trusted cast completion creates it. */
export function createWisp(g:Game,p:Player,level:number,targetId:number,automatic=false):boolean{
 const skill=g.data.mastery.skills.find(s=>s.id==='shaman_02')!,rank=(automatic?skill.autoRanks:skill.ranks)[level-1],target=g.enemies.find(e=>e.id===targetId&&!e.dead);
 if(g.players.get(p.id)!==p||p.dead||p.mapId!==g.mapId||!isField(g.mapId)||!Number.isInteger(level)||!rank||level>(p.skills.shaman_02??0)||masteryUseLock(p,'shaman_02',p.stats.weaponType,g.data.mastery)||!target||distance(p,target)>skill.range+(target.boss?.5:0))return false;
 removeWisp(g,p,'replaced');
 p.wisp={id:g.nextId++,mapId:g.mapId,level,target:target.id,x:p.x,z:p.z,next:g.time+rank.params.duration/rank.params.hits,until:g.time+rank.params.duration,hitsLeft:rank.params.hits,automatic};
 g.events.push({type:'wisp',skillId:'shaman_02',playerId:p.id,wispId:p.wisp.id,id:target.id,x:p.x,z:p.z,duration:rank.params.duration});
 return true;
}
export function stepWisp(g:Game,p:Player,hit:(w:Wisp,e:Enemy)=>void){
 const w=p.wisp;if(!w)return;
 const skill=g.data.mastery.skills.find(s=>s.id==='shaman_02')!,target=g.enemies.find(e=>e.id===w.target&&!e.dead);
 if(p.dead||p.mapId!==g.mapId||w.mapId!==g.mapId||!isField(g.mapId)||!target||w.level>(p.skills.shaman_02??0)||w.automatic&&w.level>masteryAutoRank(p,'shaman_02',g.data.mastery)||masteryUseLock(p,'shaman_02',p.stats.weaponType,g.data.mastery)||g.time>w.until+1e-8){removeWisp(g,p,'invalid');return;}
 w.x=p.x;w.z=p.z;
 const rank=(w.automatic?skill.autoRanks:skill.ranks)[w.level-1],interval=rank.params.duration/rank.params.hits;
 while(w.hitsLeft>0&&w.next<=g.time+1e-8&&w.next<=w.until+1e-8){
  w.hitsLeft--;w.next+=interval;
  if(distance(p,target)<=skill.range+(target.boss?.5:0))hit(w,target);
  if(p.wisp!==w)return;
 }
 if(w.hitsLeft===0)removeWisp(g,p,'spent');
}
