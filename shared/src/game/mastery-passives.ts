import type {Game,Player,Enemy,Event} from './sim.js';
import type {Skill} from '../schema.js';
import {masteryPassiveValue,type MasteryPassive} from '../mastery.js';

type Charge={after:number;until:number};
interface State {map:string;serial:number;cast?:{id:string;serial:number;paid:number;steps:number;done:boolean};charges:Record<string,Charge>;counts:Record<string,number>;walk:number;lastElement?:string;friends:Map<string,number>;lastTarget?:number;escapeReady:boolean;}
const states=new WeakMap<Player,State>();
export const passiveValue=(g:Game,p:Player,id:MasteryPassive,key:string)=>masteryPassiveValue(g.data,p,p.stats.weaponType,id,key);
function state(g:Game,p=g.p){let s=states.get(p);if(!s||s.map!==g.mapId){s={map:g.mapId,serial:0,charges:{},counts:{},walk:0,friends:new Map(),escapeReady:true};states.set(p,s);}return s;}
export function clearPassiveState(p:Player){states.delete(p);p.statuses=p.statuses.filter(s=>!['archer_08','rogue_08'].includes(s.sourceId));}
const val=(g:Game,id:MasteryPassive,key:string,p=g.p)=>passiveValue(g,p,id,key);
const ready=(p:Player,id:string)=>!(p.cd['passive:'+id]>0);
function proc(g:Game,p:Player,id:string){g.events.push({type:'masteryPassive',skillId:id,playerId:p.id,x:p.x,z:p.z,origin:'passive'});}
function arm(g:Game,p:Player,id:MasteryPassive,seconds=Infinity){const s=state(g,p);if(s.charges[id]||!ready(p,id))return;const icd=val(g,id,'icd',p);p.cd['passive:'+id]=icd;s.charges[id]={after:s.serial,until:g.time+seconds};proc(g,p,id);}
function charged(g:Game,id:MasteryPassive,p=g.p){const s=state(g,p),c=s.charges[id];return !!c&&c.until>=g.time&&s.serial>c.after;}
function use(g:Game,id:MasteryPassive,p=g.p){delete state(g,p).charges[id];}
const reagent=(id:string)=>['healer_16','healer_17','healer_18','healer_19'].includes(id);
const directHeal=(id:string)=>id.startsWith('healer_')&&!['healer_03','healer_06','healer_10'].includes(id);
const mainMagic=(skill:Skill)=>skill.type==='magic'&&skill.id!=='basic';
export const medicalBasic=(g:Game,p=g.p)=>['unarmed','staff'].includes(p.stats.weaponType)?val(g,'healer_07','medicalBasic',p):0;

/** Quotes never consume a charge: failed MP/target validation must leave it available. */
export function passiveCost(g:Game,skill:Skill,cost:number){
 let reduction=0;
 if(skill.id.startsWith('boxer_')&&state(g).charges.boxer_09?.until!>=g.time)reduction=val(g,'boxer_09','comboCostDown');
 if(reagent(skill.id)&&state(g).charges.healer_21?.until!>=g.time)reduction=val(g,'healer_21','reagentCostDown');
 return cost*(1-Math.min(1,reduction/100));
}
export function passiveCastMultiplier(g:Game,id:string){return id==='archer_10'&&state(g).walk>=6?1-val(g,'archer_09','castDown')/100:1;}
export function passiveStart(g:Game,skill:Skill,paid:number,steps=0){
 const s=state(g);s.serial++;s.cast={id:skill.id,serial:s.serial,paid,steps,done:false};
 if(skill.id==='archer_10'&&s.walk>=6){s.walk=0;if(val(g,'archer_09','castDown'))proc(g,g.p,'archer_09');}
 if(skill.id.startsWith('boxer_')&&charged(g,'boxer_09'))use(g,'boxer_09');
 if(reagent(skill.id)&&charged(g,'healer_21'))use(g,'healer_21');
}
export function passiveComplete(g:Game,skill:Skill){
 const p=g.p,s=state(g),cast=s.cast;if(!cast||cast.id!==skill.id||cast.done)return;cast.done=true;
 if(mainMagic(skill)&&val(g,'mage_15','thirdSpell')&&!s.charges.mage_15&&ready(p,'mage_15')){if((s.counts.mage_15=(s.counts.mage_15??0)+1)>=3){s.counts.mage_15=0;arm(g,p,'mage_15');}}
 if(reagent(skill.id)&&val(g,'healer_21','reagentCostDown')&&!s.charges.healer_21&&ready(p,'healer_21')){if((s.counts.healer_21=(s.counts.healer_21??0)+1)>=3){s.counts.healer_21=0;arm(g,p,'healer_21');}}
 if(skill.id!=='basic'&&cast.paid>0&&p.summon&&!p.summon.dead)s.counts.petCast=g.time;
}
export function passiveEvent(g:Game,e:Event){
 if(e.type==='skillCancel'){
  const s=state(g),cast=s.cast;
  if(e.cause==='enemy'&&cast&&!cast.done&&cast.paid>0&&val(g,'mage_20','cancelRefund')&&ready(g.p,'mage_20')){g.p.mp=Math.min(g.p.maxMp,g.p.mp+cast.paid*val(g,'mage_20','cancelRefund')/100);g.p.cd['passive:mage_20']=val(g,'mage_20','icd');proc(g,g.p,'mage_20');}
  s.cast=undefined;return;
 }
 if(e.cleansed&&e.skillId?.startsWith('healer_')&&val(g,'healer_14','cleanseHealBonus'))arm(g,g.p,'healer_14',5);
}
export function passiveWalk(g:Game,from:{x:number;z:number}){const s=state(g);if(val(g,'archer_09','castDown'))s.walk=Math.min(6,s.walk+Math.hypot(g.p.x-from.x,g.p.z-from.z));}
export function passiveTick(g:Game){
 const p=g.p,s=state(g);if(p.dead){clearPassiveState(p);return;}
 if(p.hp>p.maxHp*.6)s.escapeReady=true;
 for(const [id,c]of Object.entries(s.charges))if(c.until<g.time||!val(g,id as MasteryPassive,Object.keys(g.data.mastery.skills.find(v=>v.id===id)!.ranks[0].params)[0]))delete s.charges[id];
 if(val(g,'archer_08','move')&&ready(p,'archer_08')&&g.enemies.some(e=>!e.dead&&Math.hypot(p.x-e.x,p.z-e.z)<3)){
  p.cd['passive:archer_08']=val(g,'archer_08','icd');p.statuses=p.statuses.filter(v=>v.sourceId!=='archer_08');p.statuses.push({id:'speed',sourceId:'archer_08',value:val(g,'archer_08','move')/100,remaining:val(g,'archer_08','duration')});proc(g,p,'archer_08');
 }
 for(const id of ['archer_08','rogue_08'] as const)if(!val(g,id,id==='archer_08'?'move':'escapeMove'))p.statuses=p.statuses.filter(v=>v.sourceId!==id);
}
export function passiveIncoming(g:Game,before:number,actual:number){
 const p=g.p,s=state(g);
 if(actual>0&&before>p.maxHp*.35&&p.hp<=p.maxHp*.35&&s.escapeReady&&ready(p,'rogue_08')&&val(g,'rogue_08','escapeMove')){
  s.escapeReady=false;p.cd['passive:rogue_08']=val(g,'rogue_08','icd');p.statuses=p.statuses.filter(v=>v.sourceId!=='rogue_08');p.statuses.push({id:'speed',sourceId:'rogue_08',remaining:val(g,'rogue_08','duration'),value:val(g,'rogue_08','escapeMove')/100});proc(g,p,'rogue_08');
 }
}
export const rear=(p:Player,e:Enemy)=>(p.x-e.x)*e.fx+(p.z-e.z)*e.fz<0;
export function passiveAccuracy(g:Game,e:Enemy){return rear(g.p,e)?val(g,'rogue_09','rearHit'):0;}
export function passiveArmorIgnore(g:Game,id:string){return id==='archer_10'?val(g,'archer_14','armorIgnore')/100:0;}
/** Called once per connected primary hit. Periodic/automatic/Mix/reflection callers are excluded upstream. */
export function passiveDamage(g:Game,e:Enemy,skill:Skill,damage:number){
 const p=g.p,s=state(g);let bonus=0;
 if(skill.id==='archer_10'){
  const mark=p.statuses.find(v=>v.id==='archer_mark'&&v.targetId===e.id&&v.remaining>0);
  if(mark&&val(g,'archer_15','markedBonus')&&ready(p,'archer_15')){bonus+=val(g,'archer_15','markedBonus');p.statuses=p.statuses.filter(v=>v!==mark);p.cd['passive:archer_15']=val(g,'archer_15','icd');proc(g,p,'archer_15');}
 }
 if(mainMagic(skill)){
  bonus+=val(g,'mage_14','magicDamage');
  for(const [id,key]of [['mage_09','elementBonus'],['mage_15','thirdSpell']] as const)if(charged(g,id)){bonus+=val(g,id,key);use(g,id);}
  if(val(g,'mage_09','elementBonus')&&s.counts.mage09Serial!==s.serial&&!s.charges.mage_09&&ready(p,'mage_09')){s.counts.mage09Serial=s.serial;
   if(s.lastElement&&s.lastElement!==skill.element){s.lastElement=undefined;arm(g,p,'mage_09');}else s.lastElement=skill.element;
  }
 }
 if(skill.type==='physical'&&skill.id==='rogue_12'&&charged(g,'rogue_15')){bonus+=val(g,'rogue_15','executeAmp');use(g,'rogue_15');}
 if(rear(p,e)&&skill.type==='physical'){
  bonus+=val(g,'rogue_14','rearDamage');
  if(skill.id!=='rogue_12'&&val(g,'rogue_15','executeAmp'))arm(g,p,'rogue_15',4);
 }
 if(e.summoned)bonus+=val(g,'shaman_20','summonDamage');
 if(p.stats.weaponType==='unarmed'&&skill.type==='physical'&&(skill.id==='basic'||skill.id.startsWith('boxer_'))){
  if(s.lastTarget!==e.id){s.lastTarget=e.id;s.counts.boxer_14=0;use(g,'boxer_14');}
  if(skill.id==='boxer_11'){
   bonus+=val(g,'boxer_07','comboBonus');
   if(charged(g,'boxer_14')){bonus+=val(g,'boxer_14','sameTarget');use(g,'boxer_14');}
   if(s.cast?.steps===3){if(val(g,'boxer_15','finisherAmp')&&ready(p,'boxer_15')){bonus+=val(g,'boxer_15','finisherAmp');p.cd['passive:boxer_15']=val(g,'boxer_15','icd');proc(g,p,'boxer_15');}if(val(g,'boxer_09','comboCostDown'))arm(g,p,'boxer_09');}
  }else if(s.counts.boxer14Serial!==s.serial&&val(g,'boxer_14','sameTarget')&&(s.counts.boxer_14=(s.counts.boxer_14??0)+1)>=3){s.counts.boxer_14=0;arm(g,p,'boxer_14');}
  s.counts.boxer14Serial=s.serial;
  if(skill.id==='boxer_16'&&charged(g,'boxer_21')){bonus+=val(g,'boxer_21','counterAmp');use(g,'boxer_21');}
  if(skill.id==='boxer_18'&&val(g,'boxer_21','counterAmp'))arm(g,p,'boxer_21');
 }
 passiveComplete(g,skill);
 return Math.round(damage*(1+bonus/100));
}
export function passiveHealAmount(g:Game,p:Player,target:Player,amount:number,skill:Skill){
 if(target.hp>=target.maxHp)return amount;
 let bonus=val(g,'healer_07','healUp',p);
 if(charged(g,'healer_09',p)){bonus+=val(g,'healer_09','triageBonus',p);use(g,'healer_09',p);}
 if(directHeal(skill.id)&&charged(g,'healer_14',p)){bonus+=val(g,'healer_14','cleanseHealBonus',p);use(g,'healer_14',p);}
 return amount*(1+bonus/100);
}
export function passiveAfterHeal(g:Game,p:Player,target:Player,actual:number,before:number,skill?:Skill,rawAmount=actual){
 if(actual<=0)return;
 if(skill?.id.startsWith('healer_')){
  const s=state(g,p);
  if(target!==p){
   for(const [id,t]of s.friends)if(g.time-t>6)s.friends.delete(id);s.friends.set(target.id,g.time);
   if(s.friends.size>=2&&val(g,'healer_09','triageBonus',p)){arm(g,p,'healer_09',6);s.friends.clear();}
   const hot=target.healingOverTime;
   if(skill.id==='healer_03'&&hot&&!hot.automatic&&before<target.maxHp*.3&&val(g,'healer_15','hotExtend',p)&&ready(p,'healer_15:'+target.id)){
    const extra=val(g,'healer_15','hotExtend',p),nominal=hot.ticksLeft>0?hot.amount/hot.ticksLeft:rawAmount;
    hot.until+=extra;hot.amount+=nominal*extra;hot.ticksLeft+=extra;hot.next=Math.min(hot.next,hot.until);p.cd['passive:healer_15:'+target.id]=val(g,'healer_15','icd',p);proc(g,p,'healer_15');
   }
  }
 }
 // Only an owner's real received primary heal can copy to their main pet. Copies never call healing hooks.
 const pet=target.summon,share=val(g,'shaman_15','petHealShare',target);
 if(pet&&!pet.dead&&pet.hp>0&&pet.ownerId===target.id&&pet.mapId===g.mapId&&target.mapId===g.mapId&&pet.hp<pet.maxHp&&share&&ready(target,'shaman_15')){
  const amount=Math.min(pet.maxHp-pet.hp,actual*share/100);pet.hp+=amount;target.cd['passive:shaman_15']=val(g,'shaman_15','icd',target);g.events.push({type:'summonHeal',playerId:target.id,petId:pet.id,x:pet.x,z:pet.z,amount,origin:'passive'});proc(g,target,'shaman_15');
 }
}
export function passivePetDamage(g:Game,p:Player,e:Enemy,damage:number){
 let bonus=e.summoned?val(g,'shaman_20','summonDamage',p):0;const s=state(g,p);
 if(s.counts.petCast!==undefined&&g.time-s.counts.petCast<=1&&val(g,'shaman_09','coordBonus',p)&&ready(p,'shaman_09')){bonus+=val(g,'shaman_09','coordBonus',p);delete s.counts.petCast;p.cd['passive:shaman_09']=val(g,'shaman_09','icd',p);proc(g,p,'shaman_09');}
 return Math.round(damage*(1+bonus/100));
}
// Main-school-only bond uses highest trained Mastery (ties allowed), preserving classless progression.
export function passiveBond(g:Game,p:Player){const pet=p.summon;return p.masteries.Summoner>=Math.max(...Object.values(p.masteries))&&pet&&!pet.dead&&pet.hp>0&&Math.hypot(pet.x-p.x,pet.z-p.z)<=8;}
export function passiveEnemyHeal(g:Game,e:Enemy,amount:number){
 const reductions=(e.masteryPoisons??[]).filter(d=>d.remaining>0&&!d.automatic).map(d=>{const p=g.players.get(d.owner);return p&&!p.dead&&p.mapId===g.mapId?val(g,'rogue_21','antiHeal',p):0;});
 return Math.max(0,amount*(1-Math.max(0,...reductions)/100));
}

export function passiveDispel(g:Game){if(val(g,'shaman_21','dispelCd')&&ready(g.p,'shaman_21')){g.p.cd.shaman_19=Math.max(0,(g.p.cd.shaman_19??0)-val(g,'shaman_21','dispelCd'));g.p.cd['passive:shaman_21']=val(g,'shaman_21','icd');proc(g,g.p,'shaman_21');}}
export function passivePeriodicDamage(g:Game,e:Enemy,skill:Skill,damage:number){
 let bonus=skill.id==='healer_16'?val(g,'healer_20','corrosionBonus'):0;
 if(skill.id==='archer_17'&&e.statuses.some(s=>s.sourceId===g.p.id&&s.remaining>0&&['archer_16','archer_18'].includes(s.skillId??'')))bonus+=val(g,'archer_21','trapBonus');
 return Math.round(damage*(1+bonus/100));
}
