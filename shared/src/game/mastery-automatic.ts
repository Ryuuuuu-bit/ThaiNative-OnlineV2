import type {Game,Player,Enemy} from './sim.js';
import type {GameData,Skill} from '../schema.js';
import {masteryAutoRank,masteryTriggerSlots,masteryUseLock,resolveMasteryAction,isMasteryAction,type MasteryCatalog} from '../mastery.js';
type Cause='hp'|'incoming'|'skills';
interface Automatic {map:string;damage:{at:number;amount:number}[];skills:number;last:number;busy:number;pending?:{cause:Cause;target?:number};}
const automatic=new WeakMap<Player,Automatic>();
function state(g:Game,p=g.p){let s=automatic.get(p);if(!s||s.map!==g.mapId){s={map:g.mapId,damage:[],skills:0,last:s?.last??-Infinity,busy:0};automatic.set(p,s);}return s;}
export function automaticCause(s:MasteryCatalog['skills'][number]):Cause{
 return s.autoEvent??(s.school==='Healer'?'hp':['endure','archer_04','rogue_04','shaman_04','boxer_02','boxer_04'].includes(s.id)?'incoming':'skills');
}
export function resolveAutomaticSkill(data:GameData,id:string,level:number):Skill{
 const plan=data.mastery.skills.find(s=>s.id===id),r=plan?.autoRanks[level-1];if(!plan||!r)throw Error('Auto Spell rank unavailable');
 const base=isMasteryAction(id)?resolveMasteryAction(data,id,level):data.skills.skills.find(s=>s.id===id);if(!base)throw Error('Auto Spell handler unavailable');
 return {...base,jobId:'common',maxLevel:3,percent:r.params.damage??r.params.heal??r.params.petBurst??0,sp:r.mp,cooldown:r.cooldown,cast:r.cast,hits:r.params.hits??1,duration:r.params.duration??base.duration,values:Object.fromEntries([...new Set(plan.autoRanks.flatMap(r=>Object.keys(r.params)))].map(key=>[key,plan.autoRanks.map(r=>r.params[key]??0)]))};
}
export function normalMasteryCast(g:Game,id:string,target?:number){
 if(['basic','attack','dodge','dash','potion'].includes(id)||id.startsWith('item:'))return;
 const s=state(g);if(++s.skills>=3){s.skills=0;s.pending={cause:'skills',target};}
}
export function incomingMasteryHit(g:Game,before:number,lost:number,enemy:Enemy|undefined){
 const p=g.p;if(!enemy||!g.enemies.includes(enemy)||lost<=0||p.dead)return;
 const s=state(g);s.damage=s.damage.filter(d=>g.time-d.at<=6);s.damage.push({at:g.time,amount:lost});
 if(before>p.maxHp*.4&&p.hp<=p.maxHp*.4)s.pending={cause:'hp',target:enemy.id};
 else if(s.damage.reduce((n,d)=>n+d.amount,0)>=p.maxHp*.15){s.damage=[];s.pending={cause:'incoming',target:enemy.id};}
}
export function automaticBusy(g:Game){return state(g).busy>g.time;}
export function markAutomaticCast(g:Game,seconds:number){const s=state(g);s.last=g.time;s.busy=g.time+seconds;}
export function stepAutomaticMastery(g:Game,cast:(id:string,target?:number)=>boolean){
 const p=g.p,s=state(g);if(p.dead){s.pending=undefined;s.damage=[];s.skills=0;s.busy=0;return;}
 if(!s.pending||s.last+1>g.time||p.castRemaining>0||s.busy>g.time)return;
 const event=s.pending;s.pending=undefined;
 const slots=p.hotbar.filter(s=>s.mode==='autoSpell').slice(0,masteryTriggerSlots(p.masteries));
 for(const slot of slots){
  const id=slot.skill,plan=g.data.mastery.skills.find(s=>s.id===id);
  if(!id||!plan||automaticCause(plan)!==event.cause||!masteryAutoRank(p,id,g.data.mastery)||masteryUseLock(p,id,p.stats.weaponType,g.data.mastery))continue;
  if(cast(id,event.target))break;
 }
}
