import type {Game,Player,Enemy,Event} from './sim.js';
import type {Skill} from '../schema.js';
import type {MasteryCatalog} from '../mastery.js';
import {masteryWeaponMatches} from '../mastery.js';
import {resolveSkill,skillValue} from '../jobs.js';
import {masteryOrigin,withMasteryOrigin,grantMasteryBarrier,grantMasteryPetRest} from './mastery-runtime.js';
type Mix=MasteryCatalog['mixes'][number];
interface Charge {until:number;value:number;target?:number;serial:number;}
interface Pending {id:string;target:number;at:number;base:number;}
interface MixState {map:string;selected?:string;cooldowns:Record<string,number>;charge?:Charge;healCount:number;serial:number;healSerial:number;busy:number;pending?:Pending;moved?:number;bulwarkUntil?:number;}
const states=new WeakMap<Player,MixState>();
function state(g:Game,p=g.p){
 let s=states.get(p);if(!s){s={map:g.mapId,cooldowns:{},healCount:0,serial:0,healSerial:-1,busy:0};states.set(p,s);}
 const selected=p.hotbar.find(s=>s.signature)?.signature;
 if(s.map!==g.mapId||s.selected!==selected||p.dead){s.map=g.mapId;s.selected=selected;s.charge=undefined;s.pending=undefined;s.healCount=0;s.busy=0;}
 return s;
}
export function selectedMasteryMix(g:Game,p=g.p):Mix|undefined{
 const s=state(g,p),m=g.data.mastery.mixes.find(m=>m.id===s.selected);if(!m||p.dead||p.mapId!==g.mapId||masteryOrigin(g,p))return;
 if(!masteryWeaponMatches(m.weapon,p.stats.weaponType)||Object.entries(m.masteries).some(([school,n])=>(p.masteries[school as keyof typeof p.masteries]??0)<n!)||Object.entries(m.pathRanks).some(([id,n])=>(p.skills[id]??0)<n)||Object.keys(m.requires).some(id=>!p.hotbar.some(s=>s.skill===id&&!s.mode)))return;
 return m;
}
const ready=(g:Game,p:Player,m:Mix)=>p.mp>=m.mp&&(state(g,p).cooldowns[m.id]??0)<=g.time;
function spend(g:Game,p:Player,m:Mix,at:Pick<Player,'x'|'z'>=p){
 p.mp-=m.mp;state(g,p).cooldowns[m.id]=g.time+m.icd;
 g.events.push({type:'masteryMix',playerId:p.id,mixId:m.id,kind:m.kind,x:at.x,z:at.z,mp:m.mp,origin:'mix'});
}
function charge(g:Game,p:Player,value=0,target?:number){const m=selectedMasteryMix(g,p);if(m)state(g,p).charge={until:g.time+m.window,value,target,serial:state(g,p).serial};}
function currentCharge(g:Game,p=g.p){const s=state(g,p),c=s.charge;if(c&&c.until>=g.time-1e-8)return c;s.charge=undefined;return;}
export const masteryMixBusy=(g:Game)=>state(g).busy>g.time;
export interface MixHooks {damage:(e:Enemy,base:number,magic:boolean,id:string)=>void;petHit:(e:Enemy,percent:number)=>void;refresh:()=>void;}
export function mixNormalCast(g:Game,id:string){
 const s=state(g);s.serial++;const m=selectedMasteryMix(g);if(!m)return;
 if(id==='bulwark'){const rank=g.p.skills[id]??1,skill=resolveSkill(g.data,id,rank);s.bulwarkUntil=g.time+(skillValue(skill,'duration',rank)||skill.duration||0);}
 if(m.kind==='tauntBond'&&id==='provoke')charge(g,g.p);
}
/** Only authoritative normal impacts set recipe windows; automatic and periodic results never do. */
export function mixAuthoritativeEvent(g:Game,e:Event){
 const m=selectedMasteryMix(g),p=g.p;if(!m||e.autoSpell||e.origin||masteryOrigin(g))return;
 if(e.type==='masteryZone'&&e.skillId==='archer_16'&&m.kind==='venomTrap')charge(g,p);
 if(e.type==='skillImpact'&&e.skillId==='shaman_03'&&m.kind==='commandArrow'&&p.summon?.command)charge(g,p);
 if(e.type==='skillDisplace'&&e.skillId==='archer_05'&&m.kind==='retreatMedicine')charge(g,p);
 if(e.type==='skillDisplace'&&e.skillId==='rogue_05'&&m.kind==='veilDagger')state(g).moved=g.time;
 if(e.type==='skillImpact'&&e.skillId==='healer_04'&&e.cleansed&&m.kind==='venomMedicine'&&ready(g,p,m)){
  const coat=p.statuses.find(s=>s.id==='poison_coat'&&s.remaining>0&&!s.automatic);if(coat){p.statuses=p.statuses.filter(s=>s!==coat);spend(g,p,m);charge(g,p);}
 }
}
export function mixGuardedHit(g:Game,prevented:number){const m=selectedMasteryMix(g);if(m?.kind==='sealedForce'&&prevented>0)charge(g,g.p,prevented);}
export function mixIncoming(g:Game,source:Enemy|undefined,amount:number,h:MixHooks){
 const p=g.p,m=selectedMasteryMix(g);if(!m||!source||amount<=0)return amount;
 const endure=p.statuses.find(s=>s.id==='endure'&&s.remaining>0&&!s.automatic);
 if(m.kind==='frostBlade'&&endure&&ready(g,p,m)){
  spend(g,p,m);charge(g,p);p.statuses=p.statuses.filter(s=>s!==endure);h.refresh();
 }else if(m.kind==='venomRiposte'&&endure)charge(g,p);
 else if(m.kind==='tauntBond'&&!source.boss&&currentCharge(g)&&p.summon&&!p.summon.dead&&ready(g,p,m)){
  const pet=p.summon,share=Math.min(pet.hp,Math.round(amount*.15),Math.round(pet.maxHp*.03));
  if(share>0){spend(g,p,m);state(g).charge=undefined;pet.hp-=share;amount-=share;g.events.push({type:'summonHurt',playerId:p.id,petId:pet.id,x:pet.x,z:pet.z,amount:share,origin:'mix'});if(pet.hp<=0){pet.dead=true;p.summon=undefined;g.events.push({type:'summonEnd',playerId:p.id,petId:pet.id,x:pet.x,z:pet.z,reason:'mix-redirect'});}}
 }
 return amount;
}
export function mixBeforeDamage(g:Game,e:Enemy,skill:Skill,third:boolean):Skill{
 const p=g.p,s=state(g),m=selectedMasteryMix(g);s.pending=undefined;if(!m)return skill;
 const c=currentCharge(g),sword=['sword1h','sword2h'].includes(p.stats.weaponType)&&skill.type==='physical';
 if(m.kind==='frostBlade'&&c&&sword||m.kind==='sealedForce'&&c&&skill.id==='boxer_16'&&ready(g,p,m)){
  s.pending={id:m.id,target:e.id,at:g.time,base:p.stats.atk*skill.percent/100};return {...skill,percent:skill.percent*.85};
 }
 if(m.kind==='mercyCombo'&&skill.type==='physical'&&skill.id==='basic'&&third&&ready(g,p,m)){s.pending={id:m.id,target:e.id,at:g.time,base:p.stats.atk};return {...skill,comboThirdPercent:100};}
 return skill;
}
export function mixAfterDamage(g:Game,e:Enemy,skill:Skill,actual:number,third:boolean,h:MixHooks){
 const p=g.p,s=state(g),m=selectedMasteryMix(g);if(!m||actual<=0||e.hp<=0&&!['mercyCombo','petRetreat'].includes(m.kind))return;
 const c=currentCharge(g),pending=s.pending?.target===e.id&&s.pending.at===g.time?s.pending:undefined;
 const arrow=skill.type==='physical'&&skill.id.startsWith('archer_'),sword=skill.type==='physical'&&['sword1h','sword2h'].includes(p.stats.weaponType);
 const poison=e.masteryPoisons?.find(d=>d.owner===p.id&&d.remaining>0&&!d.automatic);
 const magic=(base:number)=>withMasteryOrigin(g,'mix',()=>h.damage(e,base,true,m.id));
 if(m.kind==='frostBlade'&&pending&&c){s.charge=undefined;s.pending=undefined;magic(pending.base*.15+p.stats.matk*.4);}
 else if(m.kind==='sealedForce'&&pending&&c&&ready(g,p,m)){spend(g,p,m,e);s.charge=undefined;s.pending=undefined;magic(pending.base*.15+Math.min(p.maxHp*.03,c.value*.3));}
 else if(m.kind==='venomRiposte'&&c&&sword&&poison&&ready(g,p,m)){const value=poison.damage*.7;e.masteryPoisons=e.masteryPoisons!.filter(v=>v!==poison);spend(g,p,m,e);s.charge=undefined;withMasteryOrigin(g,'mix',()=>h.damage(e,value,false,m.id));}
 else if(m.kind==='shatterArrow'&&c&&arrow&&ready(g,p,m)){
  const slow=e.statuses.find(v=>v.id==='slow'&&v.sourceId===p.id&&v.skillId==='mage_04'&&!v.automatic);if(slow&&c.target===e.id){e.statuses=e.statuses.filter(v=>v!==slow);spend(g,p,m,e);s.charge=undefined;magic(p.stats.matk*.3);}
 }else if(m.kind==='venomTrap'&&c&&arrow&&poison&&ready(g,p,m)){
  const budget=Math.floor(poison.damage*.5),targets=g.enemies.filter(v=>!v.dead&&Math.hypot(v.x-e.x,v.z-e.z)<=2).sort((a,b)=>Number(b.id===e.id)-Number(a.id===e.id)||a.id-b.id).slice(0,3);
  if(targets.length){spend(g,p,m,e);s.charge=undefined;e.masteryPoisons=e.masteryPoisons!.filter(v=>v!==poison);e.statuses=e.statuses.filter(v=>v.id!=='slow'||v.sourceId!==p.id||v.skillId!=='archer_16');let left=budget;for(const [i,target]of targets.entries()){const amount=Math.floor(left/(targets.length-i));left-=amount;withMasteryOrigin(g,'mix',()=>h.damage(target,amount,false,m.id));}}
 }else if(m.kind==='commandArrow'&&c&&arrow&&p.summon&&!p.summon.dead&&Math.hypot(p.summon.x-e.x,p.summon.z-e.z)<=1.6&&ready(g,p,m)){
  spend(g,p,m,e);s.charge=undefined;if(p.summon.command)p.summon.command.nextBonus=0;s.busy=g.time+.35;withMasteryOrigin(g,'mix',()=>h.petHit(e,100));
 }else if(m.kind==='pulseSpell'&&c&&skill.id==='mage_01'&&ready(g,p,m)){spend(g,p,m,e);s.charge=undefined;s.busy=g.time+.25;magic(p.stats.matk*.35);}
 else if(m.kind==='veilDagger'&&skill.id==='rogue_05'&&s.moved===g.time&&(p.x-e.x)*e.fx+(p.z-e.z)*e.fz<0&&ready(g,p,m)){
  const ward=p.statuses.find(v=>v.id==='magic_shield'&&v.remaining>0&&!v.automatic);if(ward&&ward.value>0){const consume=ward.value*.25;ward.value-=consume;spend(g,p,m,e);magic(Math.min(consume,p.maxHp*.015));}
 }else if(m.kind==='mercyCombo'&&pending&&skill.type==='physical'&&skill.id==='basic'&&third&&ready(g,p,m)){spend(g,p,m);charge(g,p,p.stats.atk*.35);p.boxerCombo=undefined;}
 else if(m.kind==='petRetreat'&&skill.type==='physical'&&skill.id==='basic'&&third&&p.summon&&!p.summon.dead&&ready(g,p,m)){spend(g,p,m);grantMasteryPetRest(g,p,2,.5);}
 if(m.kind==='shatterArrow'&&skill.id==='mage_04')charge(g,p,0,e.id);
 if(m.kind==='elementBond'&&skill.id==='mage_01'&&p.summon&&!p.summon.dead)charge(g,p,0,e.id);
}
export function mixPetSkill(g:Game,e:Enemy,skill:Skill){const m=selectedMasteryMix(g),c=currentCharge(g);return m?.kind==='elementBond'&&c&&ready(g,g.p,m)?{...skill,percent:skill.percent*.75}:skill;}
export function mixPetHit(g:Game,e:Enemy,actual:number,h:MixHooks){const p=g.p,m=selectedMasteryMix(g);if(m?.kind==='elementBond'&&currentCharge(g)&&actual>0&&ready(g,p,m)){spend(g,p,m,e);state(g).charge=undefined;withMasteryOrigin(g,'mix',()=>h.damage(e,p.stats.matk*.25,true,m.id));}}
export function mixHealAmount(g:Game,caster:Player,target:Player,amount:number,skill?:Skill){
 const m=selectedMasteryMix(g,caster);if(!m||!skill||!skill.id.startsWith('healer_'))return amount;
 const p=caster,s=state(g,p),c=currentCharge(g,p),actual=Math.max(0,Math.min(amount,target.maxHp-target.hp));if(actual<=0)return amount;
 const direct=!['healer_03','healer_06','healer_10'].includes(skill.id);
 if(m.kind==='frontlineTriage'&&(s.bulwarkUntil??0)>g.time&&p.statuses.some(v=>v.id==='guard'&&v.sourceId===p.id)&&ready(g,p,m)){
  const part=Math.min(actual*.2,target.maxHp*.04);spend(g,p,m,target);grantMasteryBarrier(g,target,part,3);return actual-part;
 }
 if(m.kind==='retreatMedicine'&&c&&skill.id==='healer_03'&&ready(g,p,m)){
  const part=Math.min(actual*.2,target.maxHp*.03);spend(g,p,m,target);s.charge=undefined;grantMasteryBarrier(g,target,part,4);return actual-part;
 }
 if(m.kind==='guardianThread'&&p.summon&&!p.summon.dead&&p.summon.hp<p.summon.maxHp&&ready(g,p,m)){
  const pet=p.summon,part=Math.min(actual*.25,pet.maxHp*.08,pet.maxHp-pet.hp);spend(g,p,m,target);pet.hp+=part;g.events.push({type:'summonHeal',playerId:p.id,petId:pet.id,x:pet.x,z:pet.z,amount:part,origin:'mix'});return actual-part;
 }
 if(m.kind==='pulseSpell'&&direct&&!c&&ready(g,p,m)&&s.healSerial!==s.serial&&actual*.9>=target.maxHp*.02){s.healSerial=s.serial;if(++s.healCount>=3){s.healCount=0;charge(g,p);}return actual*.9;}
 if(m.kind==='venomMedicine'&&direct&&c&&s.serial>c.serial){s.charge=undefined;return amount+Math.min(p.stats.matk*.12,target.maxHp*.01);}
 if(m.kind==='mercyCombo'&&direct&&c){s.charge=undefined;grantMasteryBarrier(g,target,Math.min(c.value,target.maxHp*.04),3);}
 return amount;
}
