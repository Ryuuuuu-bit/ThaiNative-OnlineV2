import {clearPassiveState,passiveValue,passiveBond,passiveDispel} from './mastery-passives.js';
import type {Game,Player,Enemy,Vec} from './sim.js';
import type {Skill} from '../schema.js';
import {resolveSkill,applyEffects,applySlow,type TimedEffect} from '../jobs.js';
import {masteryUseLock,ADVANCED_MASTERY_ACTIONS} from '../mastery.js';
import {walkable} from './collision.js';
import {pathSegmentWalkable} from './pathfinding.js';
import {resolveAutomaticSkill} from './mastery-automatic.js';


export const MASTERY_ALLY_ACTIONS=['healer_01','healer_02','healer_03','healer_04','healer_05','healer_06','healer_11','healer_12','healer_13','healer_17'] as readonly string[];
const selfActions=new Set(['endure','bulwark','blood_rage','shaman_01','mage_02','rogue_02','boxer_02','boxer_03','archer_04','shaman_04','rogue_04','boxer_04','archer_11','archer_19','mage_19','rogue_06','rogue_13','rogue_17','rogue_19','boxer_06','boxer_17','boxer_19']);
const groundActions=new Set(['archer_16','archer_17','archer_18','mage_05','mage_10','mage_12','mage_16','mage_18','healer_10','healer_18','shaman_16','shaman_19']);
const petActions=new Set(['shaman_05','shaman_10','shaman_12','shaman_13']);
export function masteryTarget(id:string):'self'|'enemy'|'ally'|'ground'|'pet'{return MASTERY_ALLY_ACTIONS.includes(id)?'ally':selfActions.has(id)?'self':groundActions.has(id)?'ground':petActions.has(id)?'pet':'enemy';}
type Effect={until:number;value:number;target?:number;x?:number;z?:number;extra?:number;automatic?:boolean};
type Zone=Vec&{id:number;skillId:string;until:number;next:number;armed:number;ticks:number;paid:number;level:number;radius:number};
type Dot={id:number;skillId:string;level:number;next:number;ticks:number;percent:number};
type Channel={skillId:string;level:number;ally:string;next:number;until:number;ticks:number;interval:number;x:number;z:number};
interface Runtime {map:Game['mapId'];effects:Record<string,Effect>;zones:Zone[];dots:Dot[];channel?:Channel;anchor?:Vec&{until:number};healLink?:{ally:string;until:number;ratio:number};origin?:'periodic'|'autoSpell'|'mix';lastX:number;lastZ:number;lastHurt:number;}
const states=new WeakMap<Player,Runtime>();
function state(g:Game,p=g.p):Runtime{
 let s=states.get(p);if(!s||s.map!==g.mapId){s={map:g.mapId,effects:{},zones:[],dots:[],lastX:p.x,lastZ:p.z,lastHurt:p.hp};states.set(p,s);}return s;
}
export function clearAdvancedMastery(p:Player){states.delete(p);clearPassiveState(p);p.decoy=undefined;}
export const masteryOrigin=(g:Game,p=g.p)=>state(g,p).origin;
export function withMasteryOrigin<T>(g:Game,origin:Runtime['origin'],run:()=>T):T{const s=state(g),old=s.origin;s.origin=origin;try{return run();}finally{s.origin=old;}}
const distance=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.z-b.z);
export function masteryParams(g:Game,id:string,p=g.p){
 if(masteryUseLock(p,id,p.stats.weaponType,g.data.mastery))return undefined;
 return g.data.mastery.skills.find(s=>s.id===id)?.ranks[(p.skills[id]??1)-1]?.params;
}
function effect(g:Game,id:string,p=g.p){const s=state(g,p),e=s.effects[id];return e&&e.until>g.time&&(!selfActions.has(id)||!masteryUseLock(p,id,p.stats.weaponType,g.data.mastery))?e:undefined;}
function set(g:Game,id:string,value:number,seconds:number,target?:number,p=g.p){state(g,p).effects[id]={value,until:g.time+seconds,target,automatic:masteryOrigin(g)==='autoSpell'};}
export function grantMasteryBarrier(g:Game,p:Player,amount:number,seconds:number){set(g,'mix_physical_barrier',Math.max(amount,effect(g,'mix_physical_barrier',p)?.value??0),seconds,undefined,p);}
export function grantMasteryPetRest(g:Game,p:Player,seconds:number,reduction:number){set(g,'mix_pet_rest',reduction,seconds,undefined,p);}
export interface MasteryHooks{
 hit:(enemy:Enemy,skill:Skill)=>boolean;
 staged:(enemy:Enemy,skill:Skill,level:number)=>void;
 summonHit:(enemy:Enemy,skill:Skill)=>void;
 removePet:(reason:string)=>void;
 guarded:(amount:number)=>void;
 reflect:(enemy:Enemy,amount:number)=>void;
 heal:(target:Player,amount:number,skill:Skill)=>number;
 effects:(enemy:Enemy,effects:TimedEffect[])=>unknown;
 emit:(type:string,data?:Record<string,unknown>)=>void;
}
const rankParams=(g:Game,id:string,level:number)=>g.data.mastery.skills.find(s=>s.id===id)!.ranks[level-1].params;
function allies(g:Game,p:Player,center:Vec,radius:number,max=3){const ids=new Set([p.id,...g.partyMembers?.(p.id)??[]]);return [...g.players.values()].filter(a=>ids.has(a.id)&&!a.dead&&a.mapId===g.mapId&&distance(a,center)<=radius).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp||a.id.localeCompare(b.id)).slice(0,max);}
function enemies(g:Game,center:Vec,radius:number,max:number){return g.enemies.filter(e=>!e.dead&&distance(e,center)<=radius).sort((a,b)=>distance(a,center)-distance(b,center)||a.id-b.id).slice(0,max);}
function movePath(g:Game,p:Player|Enemy,to:Vec){
 if(p.statuses.some(s=>s.id==='root'&&s.remaining>0))return false;
 const from={x:p.x,z:p.z},d=distance(from,to),n=Math.max(1,Math.ceil(d/.1));
 for(let i=1;i<=n;i++){const q={x:from.x+(to.x-from.x)*i/n,z:from.z+(to.z-from.z)*i/n};if(!walkable(q.x,q.z,.3,g.mapId)||!pathSegmentWalkable(p,q,(x,z)=>walkable(x,z,.3,g.mapId)))break;p.x=q.x;p.z=q.z;}
 return distance(from,p)>1e-6;
}
function shifted(g:Game,p:Player|Enemy,to:Vec,id:string,h:MasteryHooks){const from={x:p.x,z:p.z};if(movePath(g,p,to))h.emit('skillDisplace',{skillId:id,x:p.x,z:p.z,fromX:from.x,fromZ:from.z,id:typeof p.id==='number'?p.id:undefined});}
function poison(g:Game,target:Enemy,params:Record<string,number>,h:MasteryHooks){
 const p=g.p,total=Math.round(p.stats.atk*(params.poison??0)/100*(1+passiveValue(g,g.p,'rogue_20','poisonBonus')/100)),duration=params.duration??5;
 const old=target.masteryPoisons?.find(d=>d.owner===p.id),remaining=old?.damage??0;
 if(total>0&&total>=remaining){target.masteryPoisons=[...(target.masteryPoisons??[]).filter(d=>d.owner!==p.id),{owner:p.id,skillId:'rogue_16',remaining:duration,tick:0,damage:total,ticks:Math.ceil(duration)}];h.emit('poisonApplied',{skillId:'rogue_16',id:target.id,x:target.x,z:target.z,duration});}
}
export function advancedCastAllowed(g:Game,id:string,target?:Enemy,ally?:Player){
 const p=g.p,s=state(g),pet=p.summon;
 if(petActions.has(id)||id==='shaman_11')if(!pet||pet.dead||pet.hp<=0||distance(p,pet)>12)return false;
 if(id==='shaman_11'&&(!target||distance(pet!,target)>1.6||!pathSegmentWalkable(pet!,target,(x,z)=>walkable(x,z,.3,g.mapId))))return false;
 if(id==='healer_05'&&(!ally||ally===p||p.hp<=p.maxHp*.3||ally.hp>=ally.maxHp))return false;
 if(id==='rogue_11'&&(!target||(p.x-target.x)*target.fx+(p.z-target.z)*target.fz>=0))return false;
 if(id==='rogue_13'&&(!s.anchor||s.anchor.until<=g.time||!walkable(s.anchor.x,s.anchor.z,.3,g.mapId)||!pathSegmentWalkable(p,s.anchor,(x,z)=>walkable(x,z,.3,g.mapId))))return false;
 if(id==='boxer_18'&&!effect(g,'boxer_counter'))return false;
 if(id==='healer_19'&&!s.dots.some(d=>d.id===target?.id&&d.skillId==='healer_16'))return false;
 if(id==='archer_19'&&!s.zones.some(z=>z.armed>0&&z.until>g.time&&distance(z,p)<=6))return false;
 return true;
}
function addZone(g:Game,id:string,level:number,at:Vec,paid:number,h:MasteryHooks){
 const p=g.p,s=state(g),params=rankParams(g,id,level),trap=!!params.trap,duration=trap?12:params.duration??4;
 s.zones=s.zones.filter(z=>z.skillId!==id);
 const zone={id:g.nextId++,skillId:id,x:at.x,z:at.z,level,until:g.time+duration,next:g.time+1,armed:trap?g.time+1:0,ticks:params.hits??Math.ceil(duration),paid,radius:(id==='mage_18'?3:2.5)*(trap?1+passiveValue(g,p,'archer_20','trapRadius')/100:1)};
 s.zones.push(zone);h.emit('masteryZone',{...zone,playerId:p.id,duration});
}
export function startMasteryChannel(g:Game,id:string,level:number,ally:Player|undefined,duration:number){
 if(id!=='healer_06'||!ally)return false;
 state(g).channel={skillId:id,level,ally:ally.id,next:g.time+duration/4,until:g.time+duration,ticks:4,interval:duration/4,x:g.p.x,z:g.p.z};return true;
}
/** These handlers share the same paid cast, rank, target and interruption gates as the existing roots. */
export function finishAdvancedMastery(g:Game,id:string,level:number,at:Vec,enemyId:number|undefined,allyId:string|undefined,paid:number,h:MasteryHooks,automatic=false):boolean{
 if(!(ADVANCED_MASTERY_ACTIONS as readonly string[]).includes(id))return false;
 const p=g.p,s=state(g),spec=g.data.mastery.skills.find(v=>v.id===id)!,params=automatic?spec.autoRanks[level-1].params:rankParams(g,id,level),skill=automatic?resolveAutomaticSkill(g.data,id,level):resolveSkill(g.data,id,level);
 const target=g.enemies.find(e=>e.id===enemyId&&!e.dead),ally=g.players.get(allyId??p.id),pet=p.summon;
 const impact=(point:Vec=p,extra:Record<string,unknown>={})=>h.emit('skillImpact',{skillId:id,x:point.x,z:point.z,...extra});
 const buff=(value:number,seconds=params.duration??3,targetId?:number)=>{set(g,id,value,seconds,targetId);impact();};
 if(masteryTarget(id)==='enemy'&&(!target||distance(p,target)>skill.range+(target.boss?.5:0)))return true;
 if(masteryTarget(id)==='ally'&&(!ally||!allies(g,p,p,skill.range,100).includes(ally)))return true;
 if(!advancedCastAllowed(g,id,target,ally))return true;
 if(groundActions.has(id)&&id!=='mage_05'&&id!=='mage_10'&&id!=='mage_16'&&id!=='shaman_19'){addZone(g,id,level,at,paid,h);return true;}
 if(id==='archer_19'){
  let refund=0;s.zones=s.zones.filter(z=>{if(z.armed>0&&distance(z,p)<=skill.range){refund+=z.paid*params.refund/100;h.emit('masteryZoneEnd',{skillId:z.skillId,id:z.id,x:z.x,z:z.z});return false;}return true;});p.mp=Math.min(p.maxMp,p.mp+refund);impact(p,{refund});return true;
 }
 if(id==='archer_11'){buff(params.crit,params.duration);return true;}
 if(id==='mage_05'){const d=distance(p,at),range=params.zoneMove,to=d?{x:p.x+(at.x-p.x)*Math.min(1,range/d),z:p.z+(at.z-p.z)*Math.min(1,range/d)}:{x:p.x+p.fx*range,z:p.z+p.fz*range};shifted(g,p,to,id,h);impact();return true;}
 if(id==='mage_06'){h.effects(target!,[{id:'mdef_down',sourceId:p.id,remaining:params.duration,value:params.mdefDown/100,hardOnly:true}]);impact(target!);return true;}
 if(id==='mage_19'){buff(params.reflectMagic,params.duration);return true;}
 if(id==='healer_06')return true;
 if(id==='healer_05'||id==='healer_13'){
  if(id==='healer_05')p.hp-=Math.round(p.maxHp*params.hpCost/100);
  const bonus=id==='healer_13'&&ally!.hp<ally!.maxHp*.3?1+params.lowHpBonus/100:1;
  const amount=h.heal(ally!,Math.round(p.stats.matk*params.heal/100*bonus),skill);impact(ally!,{amount});return true;
 }
 if(id==='healer_11'){
  for(const a of allies(g,p,ally??p,2.5,spec.targets)){
   const bad=a.statuses.find(v=>['slow','burn','def_down','mdef_down'].includes(v.id)&&v.remaining>0);
   let cleansed:string|undefined=bad?.id;if(bad)a.statuses=a.statuses.filter(v=>v!==bad);else if(a.lootEffects?.venom){delete a.lootEffects.venom;cleansed='poison';}
   const amount=h.heal(a,Math.round(p.stats.matk*params.heal/100),skill);impact(a,{cleansed,amount});
  }return true;
 }
 if(id==='healer_12'||id==='healer_17'){set(g,id,id==='healer_12'?params.healLink:params.enemyAtkDown,params.duration,undefined,ally!);if(id==='healer_12')s.healLink={ally:ally!.id,until:g.time+params.duration,ratio:params.healLink/100};impact(ally!);return true;}
 if(id==='healer_16'){
  s.dots=s.dots.filter(d=>d.skillId!==id);s.dots.push({id:target!.id,skillId:id,level,next:g.time+1,ticks:params.duration,percent:params.damage/params.duration});
  h.effects(target!,[{id:'def_down',sourceId:p.id,remaining:params.duration,value:params.armorDown/100,hardOnly:true}]);impact(target!,{duration:params.duration});return true;
 }
 if(id==='healer_19'){
  const dot=s.dots.find(d=>d.id===target!.id&&d.skillId==='healer_16')!;s.dots=s.dots.filter(d=>d!==dot);h.hit(target!,{...skill,percent:params.damage+dot.percent*dot.ticks});impact(target!);return true;
 }
 if(id==='shaman_05'){pet!.command=undefined;pet!.target=null;pet!.state='follow';buff(params.petRetreatGuard,params.duration);return true;}
 if(id==='shaman_10'){buff(params.redirect,params.duration);return true;}
 if(id==='shaman_12'){buff(params.petHaste,params.duration);return true;}
 if(id==='shaman_13'){buff(params.petDamageBuff,params.duration);set(g,'pet_shield',pet!.maxHp*params.petShield/100,params.duration);return true;}
 if(id==='shaman_18'){if(!target!.boss)set(g,id,1,params.summonLock,target!.id);impact(target!,{immune:target!.boss});return true;}
 if(id==='rogue_06'){buff(1,params.stealth);return true;}
 if(id==='rogue_11'){buff(params.weakPoint,params.duration,target!.id);impact(target!);return true;}
 if(id==='rogue_13'){shifted(g,p,s.anchor!,id,h);s.anchor=undefined;buff(params.returnGuard,params.duration);return true;}
 if(id==='rogue_17'){buff(params.flee,params.duration);return true;}
 if(id==='rogue_19'){
  const at={x:p.x+p.fx,z:p.z+p.fz};if(!walkable(at.x,at.z,.3,g.mapId)){at.x=p.x;at.z=p.z;}
  const hp=Math.round(p.maxHp*params.decoyHp/100);p.decoy={...at,id:g.nextId++,ownerId:p.id,mapId:g.mapId,level:1,hp,maxHp:hp,atk:0,fx:p.fx,fz:p.fz,state:'follow',target:null,cooldown:999,attack:0,dead:false,invulnerable:0,statuses:[],decoy:true};
  buff(hp,params.duration);const b=s.effects[id];b.x=at.x;b.z=at.z;impact(at,{duration:params.duration});return true;
 }
 if(id==='boxer_06'){buff(params.parry,params.duration+(masteryParams(g,'boxer_20')?.parryWindow??0));return true;}
 if(id==='boxer_17'){buff(params.guard,params.duration);return true;}
 if(id==='boxer_19'){buff(params.storedForce,params.duration);return true;}
 if(id==='boxer_05'||id==='rogue_05'||id==='archer_05'){
  const d=distance(p,target!),from={x:p.x,z:p.z},max=params.dash??params.approach??params.retreat??0;
  if(id==='rogue_05')s.anchor={...from,until:g.time+3};
  const sign=id==='archer_05'?-1:1,travel=id==='archer_05'?max:Math.min(max,Math.max(0,d-1));
  shifted(g,p,{x:p.x+(target!.x-p.x)/(d||1)*travel*sign,z:p.z+(target!.z-p.z)/(d||1)*travel*sign},id,h);
  if(id==='boxer_05'){if(p.boxerCombo&&p.boxerCombo.until>g.time)p.boxerCombo.until+=params.comboGrace;impact();return true;}
 }
 let modified=skill;
 if(id==='archer_13'&&!target!.attackApplied&&(!!target!.telegraph||target!.motion==='attack'&&target!.motionTime<(target!.behavior?.windup??.5)))modified={...skill,percent:skill.percent*(1+params.windupBonus/100)};
 if(id==='rogue_10'&&(p.x-target!.x)*target!.fx+(p.z-target!.z)*target!.fz<0)modified={...skill,percent:skill.percent*(1+params.rearBonus/100)};
 if(id==='rogue_12'&&target!.hp<target!.maxHp*.3)modified={...skill,percent:skill.percent*(1+params.executeBonus/100)};
 if(id==='rogue_18'&&target!.masteryPoisons?.some(d=>d.owner===p.id&&d.remaining>0))modified={...skill,percent:skill.percent*(1+params.poisonTargetBonus/100)};
 if(id==='boxer_18'){const stored=effect(g,'boxer_force')?.value??0;modified={...skill,percent:skill.percent+stored/Math.max(1,p.stats.atk)*100};delete s.effects.boxer_counter;delete s.effects.boxer_force;}
 let targets=target?[target]:[];
 if(id==='archer_12'){
  const d=distance(p,target!)||1,dx=(target!.x-p.x)/d,dz=(target!.z-p.z)/d;
  targets=g.enemies.filter(e=>{const x=e.x-p.x,z=e.z-p.z,t=x*dx+z*dz;return !e.dead&&t>=0&&t<=skill.range&&Math.abs(x*dz-z*dx)<=.6;}).sort((a,b)=>distance(p,a)-distance(p,b)).slice(0,3);
 }
 if(id==='mage_11'){targets=target?[target]:[];while(targets.length<3){const last=targets.at(-1);if(!last)break;const next=enemies(g,last,4,100).find(e=>!targets.includes(e));if(!next)break;targets.push(next);}}
 if(['mage_10','mage_16','shaman_19'].includes(id))targets=enemies(g,at,2.5,spec.targets);
 if(id==='boxer_12')targets=enemies(g,p,skill.range,spec.targets);
 impact(groundActions.has(id)?at:target??p,{r:['boxer_12'].includes(id)?skill.range:2.5});
 let previous:Vec={x:p.x,z:p.z};
 for(const e of targets){
  const before=e.hp,amplified=id==='shaman_19'&&e.summoned?{...modified,percent:modified.percent*(1+params.summonedBonus/100)}:modified;
  if(id==='boxer_13')h.staged(e,amplified,level);else h.hit(e,amplified);
  if(id==='shaman_11'&&pet&&!pet.dead)h.summonHit(e,{...skill,percent:params.petBurst,type:'physical',kind:'single',element:'neutral'});
  if(e.hp>=before)continue;
  if(id==='mage_11'){h.emit('skillImpact',{skillId:id,x:e.x,z:e.z,fromX:previous.x,fromZ:previous.z,chain:true});previous={x:e.x,z:e.z};}
  if(id==='archer_06'&&!e.boss){const d=distance(p,e)||1;shifted(g,e,{x:e.x+(e.x-p.x)/d*params.push,z:e.z+(e.z-p.z)/d*params.push},id,h);}
  if(id==='mage_13')set(g,id,params.setupBonus,params.duration,e.id);
  if(id==='mage_16'&&!e.boss){h.effects(e,[{id:'freeze',sourceId:p.id,remaining:1,value:0}]);set(g,'freeze:'+e.id,1,1,e.id);}
  if(id==='mage_17')set(g,id,1,params.duration,e.id);
  if(id==='shaman_06'){set(g,id,1,params.reveal,e.id);const hidden=e.statuses.filter(v=>v.sourceId==='stealth');e.statuses=e.statuses.filter(v=>!hidden.includes(v));h.emit('skillReveal',{skillId:id,id:e.id,x:e.x,z:e.z,duration:params.reveal});}
  if(id==='shaman_17'){const allowed=e.statuses.find(v=>['guard','rage','endure'].includes(v.id));if(allowed&&!e.boss){e.statuses=e.statuses.filter(v=>v!==allowed);passiveDispel(g);}}
  if(id==='rogue_16')poison(g,e,params,h);
  if(id==='boxer_12')h.effects(e,[{id:'slow',sourceId:p.id,remaining:params.duration,value:params.slow/100}]);
  if(id==='boxer_16')set(g,id,params.nextGuard,params.duration,e.id);
 }
 return true;
}

export function advanceAdvancedMastery(g:Game,dt:number,input:Vec,h:MasteryHooks){
 const p=g.p,s=state(g);if(p.dead){clearAdvancedMastery(p);return;}
 const moved=distance({x:s.lastX,z:s.lastZ},p)>.01||Math.hypot(input.x,input.z)>.05||!!p.destination&&distance(p,p.destination)>.1;
 if(moved){delete s.effects.archer_11;if(g.meteors.some(m=>m.ownerId===p.id&&m.skillId==='archer_10')){g.meteors=g.meteors.filter(m=>m.ownerId!==p.id||m.skillId!=='archer_10');p.castRemaining=0;h.emit('skillCancel',{skillId:'archer_10',cause:'movement'});}}
 for(const [id,e]of Object.entries(s.effects))if(e.until<=g.time)delete s.effects[id];
 const reveal=effect(g,'shaman_06');if(reveal){const target=g.enemies.find(e=>e.id===reveal.target&&!e.dead);if(target)target.statuses=target.statuses.filter(v=>v.sourceId!=='stealth');}
 if(p.decoy&&!effect(g,'rogue_19')){h.emit('decoyEnd',{skillId:'rogue_19',x:p.decoy.x,z:p.decoy.z});p.decoy=undefined;}
 if(s.anchor&&s.anchor.until<=g.time)s.anchor=undefined;
 if(s.channel){const c=s.channel,ally=g.players.get(c.ally),skill=resolveSkill(g.data,c.skillId,c.level);
  if(c.level>(p.skills[c.skillId]??0)||masteryUseLock(p,c.skillId,p.stats.weaponType,g.data.mastery)||moved||p.hp<s.lastHurt||p.statuses.some(v=>['stun','knockup','silence'].includes(v.id))||!ally||!allies(g,p,p,skill.range,100).includes(ally)){s.channel=undefined;p.castRemaining=0;h.emit('skillCancel',{skillId:c.skillId,cause:!moved&&(p.hp<s.lastHurt||p.statuses.some(v=>['stun','knockup','silence'].includes(v.id)))?'enemy':'invalid'});}
  else{while(c.ticks>0&&c.next<=g.time+1e-8){c.ticks--;c.next+=c.interval;h.heal(ally,p.stats.matk*rankParams(g,c.skillId,c.level).heal/400,skill);}if(c.ticks<=0){s.channel=undefined;p.castRemaining=0;}}
 }
 s.lastX=p.x;s.lastZ=p.z;s.lastHurt=p.hp;
 for(const dot of s.dots){const e=g.enemies.find(e=>e.id===dot.id&&!e.dead);if(!e||dot.level>(p.skills[dot.skillId]??0)||masteryUseLock(p,dot.skillId,p.stats.weaponType,g.data.mastery)){dot.ticks=0;continue;}while(dot.ticks>0&&dot.next<=g.time+1e-8){dot.ticks--;dot.next++;withMasteryOrigin(g,'periodic',()=>h.hit(e,{...resolveSkill(g.data,dot.skillId,dot.level),percent:dot.percent}));}}
 s.dots=s.dots.filter(d=>d.ticks>0);
 for(const zone of s.zones){
  if(zone.until<g.time-1e-8||zone.level>(p.skills[zone.skillId]??0)||masteryUseLock(p,zone.skillId,p.stats.weaponType,g.data.mastery)){zone.ticks=0;continue;}
  const params=rankParams(g,zone.skillId,zone.level),skill=resolveSkill(g.data,zone.skillId,zone.level),spec=g.data.mastery.skills.find(v=>v.id===zone.skillId)!;
  if(zone.armed){if(zone.armed>g.time+1e-8||!enemies(g,zone,zone.radius,spec.targets).length)continue;zone.ticks=0;
   h.emit('skillImpact',{skillId:zone.skillId,x:zone.x,z:zone.z,r:zone.radius});
   for(const e of enemies(g,zone,zone.radius,spec.targets)){const hp=e.hp;withMasteryOrigin(g,'periodic',()=>h.hit(e,skill));if(e.hp<hp){if(params.root&&!e.boss)h.effects(e,[{id:'root',sourceId:p.id,remaining:1,value:0,skillId:zone.skillId}]);if(params.slow)h.effects(e,[{id:'slow',sourceId:p.id,remaining:params.duration,value:params.slow/100,skillId:zone.skillId}]);}}
   continue;
  }
  if(zone.skillId==='mage_18'||zone.skillId==='healer_18'){
   for(const a of allies(g,p,zone,zone.radius,spec.targets))set(g,zone.skillId,params.castDown??params.healReceived,.15+(zone.skillId==='mage_18'?passiveValue(g,p,'mage_21','linger'):0),undefined,a);
   continue;
  }
  while(zone.ticks>0&&zone.next<=g.time+1e-8){zone.ticks--;zone.next++;
   if(zone.skillId==='healer_10'){for(const a of allies(g,p,zone,zone.radius,spec.targets))h.heal(a,p.stats.matk*params.heal/100/(params.duration??4),skill);}
   else for(const e of enemies(g,zone,zone.radius,spec.targets)){withMasteryOrigin(g,'periodic',()=>h.hit(e,{...skill,percent:params.hits?params.damage:params.damage/(params.duration??4)}));if(params.slow)h.effects(e,[{id:'slow',sourceId:p.id,remaining:1.1,value:params.slow/100}]);}
  }
 }
 s.zones=s.zones.filter(z=>{if(z.ticks>0&&z.until>=g.time-1e-8)return true;h.emit('masteryZoneEnd',{skillId:z.skillId,id:z.id,x:z.x,z:z.z});return false;});
}
export function advancedMasterySnapshot(g:Game,p:Player){const s=states.get(p);if(!s||s.map!==g.mapId||p.dead)return null;return {link:s.healLink&&s.healLink.until>g.time?{...s.healLink}:null,effects:Object.entries(s.effects).filter(([,v])=>v.until>g.time).map(([id,v])=>({id,until:v.until,targetId:v.target,x:v.x,z:v.z})),zones:s.zones.map(z=>({id:z.id,skillId:z.skillId,x:z.x,z:z.z,until:z.until,armed:z.armed,radius:z.radius}))};}

export function advancedAfterDamage(g:Game,target:Enemy){
 for(const owner of g.players.values()){
  const frozen=effect(g,'freeze:'+target.id,owner);if(frozen){target.statuses=target.statuses.filter(v=>v.id!=='freeze'||v.sourceId!==owner.id);delete state(g,owner).effects['freeze:'+target.id];}
 }
 delete state(g).effects.rogue_06;
}
export function advancedOutgoing(g:Game,target:Enemy,skill:Skill):Skill{
 if(state(g).origin)return skill;
 const s=state(g),weak=effect(g,'rogue_11'),setup=effect(g,'mage_13');let percent=skill.percent;
 if(weak?.target===target.id&&skill.type==='physical'&&skill.id.startsWith('rogue_')){percent*=1+weak.value/100;delete s.effects.rogue_11;}
 if(setup?.target===target.id&&skill.type==='magic'&&skill.id.startsWith('mage_')&&skill.id!=='mage_13'){percent*=1+setup.value/100;delete s.effects.mage_13;}
 return percent===skill.percent?skill:{...skill,percent};
}
export function advancedCombatStats(g:Game,p:Player){
 const aim=effect(g,'archer_11',p),evasion=effect(g,'rogue_17',p),guard=effect(g,'rogue_13',p);const fear=passiveBond(g,p)?passiveValue(g,p,'shaman_08','fearResist')/100:0;return aim||evasion||guard||fear?{...p.stats,statusResist:{...p.stats.statusResist,fear:Math.min(g.data.stats.caps.maxResist,(p.stats.statusResist.fear??0)+fear)},hardDef:p.stats.hardDef*(1+(guard?.value??0)/100),crit:p.stats.crit+(aim?.value??0)/100,flee:p.stats.flee+(evasion?.value??0)}:p.stats;
}
export function advancedCastMultiplier(g:Game,p=g.p){return 1-Math.min(.5,(effect(g,'mage_18',p)?.value??0)/100);}
export function advancedReflectBolt(g:Game,source:Enemy|undefined,amount:number,magic:boolean,ranged:boolean,periodic:boolean,h:MasteryHooks){
 const mirror=effect(g,'mage_19');if(!mirror||!source||source.dead||!magic||!ranged||periodic||amount<=0)return;
 delete state(g).effects.mage_19;h.emit('masteryReflect',{skillId:'mage_19',id:source.id,amount:amount*mirror.value/100});withMasteryOrigin(g,'periodic',()=>h.reflect(source,amount*mirror.value/100));
}
export function advancedPlayerHidden(g:Game,p:Player){return !!effect(g,'rogue_06',p);}
export function advancedBeforeHurt(g:Game,amount:number,source:Enemy|undefined,magic:boolean,periodic:boolean,h:MasteryHooks){
 const p=g.p,s=state(g);if(periodic||!source||amount<=0)return amount;
 const before=amount,front=(source.x-p.x)*p.fx+(source.z-p.z)*p.fz>=0,parry=effect(g,'boxer_06'),palm=effect(g,'boxer_16'),guard=effect(g,'boxer_17');
 const barrier=!magic?effect(g,'mix_physical_barrier'):undefined;if(barrier){const take=Math.min(amount,barrier.value);amount-=take;barrier.value-=take;if(barrier.value<=0)delete s.effects.mix_physical_barrier;}
 if(parry&&front&&amount>0){const current=amount;amount=Math.round(amount*(1-parry.value/100));delete s.effects.boxer_06;set(g,'boxer_counter',1,3);set(g,'boxer_prevented',current-amount,3);if(!parry.automatic)h.guarded(current-amount);h.emit('masteryGuard',{skillId:'boxer_06',amount:current-amount});}
 if(palm?.target===source.id&&amount>0){amount=Math.round(amount*(1-palm.value/100));delete s.effects.boxer_16;}
 if(guard&&amount>0){amount=Math.round(amount*(1-guard.value/100));set(g,'boxer_counter',1,3);const force=effect(g,'boxer_19');if(force){const cap=rankParams(g,'boxer_19',p.skills.boxer_19).forceCap;set(g,'boxer_force',Math.min(p.maxHp*cap/100,(effect(g,'boxer_force')?.value??0)+amount*force.value/100),3);}}
 delete s.effects.rogue_06;
 const coat=effect(g,'healer_17');if(coat&&!magic&&amount>0){h.effects(source,[{id:'atk_down',sourceId:p.id,value:coat.value/100,remaining:4}]);delete s.effects.healer_17;}
 const redirect=effect(g,'shaman_10'),pet=p.summon;
 if(redirect&&pet&&!pet.dead&&distance(p,pet)<=8&&amount>0){const share=Math.min(pet.hp,Math.round(amount*redirect.value/100));if(share>0){pet.hp-=share;amount-=share;h.emit('summonHurt',{petId:pet.id,x:pet.x,z:pet.z,amount:share});if(pet.hp<=0){pet.dead=true;h.removePet('redirect');}}}
 return amount;
}
export function advancedHealMultiplier(g:Game,p:Player){return 1+(effect(g,'healer_18',p)?.value??0)/100;}
export function advancedHealLink(g:Game,caster:Player,target:Player,actual:number,skill:Skill|undefined,heal:(a:Player,n:number)=>void){
 const s=state(g,caster),link=s.healLink;if(!skill||!skill.id.startsWith('healer_')||s.origin||actual<=0||!link||link.until<=g.time||link.ally===target.id)return;
 const ally=g.players.get(link.ally);if(ally&&allies(g,caster,caster,8,100).includes(ally))withMasteryOrigin(g,'periodic',()=>heal(ally,actual*link.ratio));
}
export function advancedPetModifiers(g:Game,p:Player){return {damage:1+(effect(g,'shaman_13',p)?.value??0)/100,haste:1+(effect(g,'shaman_12',p)?.value??0)/100,recall:!!effect(g,'shaman_05',p)||!!effect(g,'mix_pet_rest',p),guard:Math.max((effect(g,'shaman_05',p)?.value??0)/100,effect(g,'mix_pet_rest',p)?.value??0)};}
export function advancedPetIncoming(g:Game,p:Player,amount:number){
 const mods=advancedPetModifiers(g,p);amount=Math.round(amount*(1-mods.guard));const shield=effect(g,'pet_shield',p);if(shield){const take=Math.min(shield.value,amount);shield.value-=take;amount-=take;if(shield.value<=0)delete state(g,p).effects.pet_shield;}return amount;
}
export function advancedEnemyBlocked(g:Game,e:Enemy,kind:'silence'|'summon'){
 return [...g.players.values()].some(p=>{const effectId=kind==='silence'?'mage_17':'shaman_18',v=effect(g,effectId,p);return v?.target===e.id&&v.until>g.time;});
}
