import catalog from '../../shared/data/mastery.json' with {type:'json'};
import paintedIcons from '../art/mastery-icons/manifest.json' with {type:'json'};

const indices=[1,2,3,4,5,6,10,11,12,13,16,17,18,19];
const families:Record<string,string[]>={
 archer:['arrow','mark','fan','speed','retreat','knockback','aim','focus','pierce','countershot','trap','rain','roottrap','recall'],
 mage:['fire','ward','flameburst','ice','teleport','seal','meteor','chain','firezone','infuse','frostzone','silence','castzone','reflect'],
 healer:['heal','compress','hot','cleanse','transfer','channel','healzone','purify','link','emergency','corrode','coat','mist','react'],
 shaman:['summon','wisp','command','intercept','recall','reveal','redirect','duo','haste','guardian','banishzone','dispel','summonseal','talisman'],
 rogue:['stab','poison','knifefan','smoke','shadowstep','stealth','ambush','weakpoint','execute','shadowreturn','poisonknife','evasion','poisonburst','decoy'],
 boxer:['punch','chi','combo','push','approach','parry','elbow','finisher','sweep','flurry','palm','guard','counter','force'],
};
const colors:Record<string,string>={archer:'#c3dfa0',mage:'#a6bbec',healer:'#9fe0ba',shaman:'#a1d8d0',rogue:'#c7a0d9',boxer:'#edbd7d'};
export const MASTERY_VISUALS=Object.fromEntries(catalog.skills.map(s=>{
 const prefix=s.id.split('_')[0],index=Number(s.id.split('_')[1]),family=s.passive?'passive':s.school==='Swordsman'?'legacy-sword':families[prefix]?.[indices.indexOf(index)];
 if(!family)throw new Error(`Missing visual contract: ${s.id}`);
 const color=['fire','flameburst','meteor','firezone'].includes(family)?'#ffac53':['ice','frostzone'].includes(family)?'#a8e2ef':['poison','poisonknife','poisonburst','corrode','react'].includes(family)?'#bad785':colors[prefix]??'#dfca91';
 return [s.id,{id:s.id,name:s.nameTh,school:s.school,passive:s.passive,family,color,range:s.range,motion:['archer','rogue','boxer'].includes(prefix)?'attack':'cast'}];
}));
export const masteryVisual=(id?:string)=>id?MASTERY_VISUALS[id]:undefined;
const statusSkills:Record<string,string>={magic_shield:'mage_02',slow_resist:'healer_02',archer_mark:'archer_02',poison_coat:'rogue_02',push_resist:'boxer_02',finisher_ready:'boxer_03',spirit_intercept:'shaman_04'};
export function masteryStatusArt(id:string,sourceId?:string){
 const skill=(sourceId&&masteryVisual(sourceId)?.passive?sourceId:undefined)??statusSkills[id]??(id==='speed'&&sourceId==='archer_04'?'archer_04':undefined),v=masteryVisual(skill);
 return v?{name:v.name,file:(paintedIcons.icons as Record<string,{file:string}>)[v.id]?.file}:undefined;
}
export function masteryMotion(id?:string){const v=masteryVisual(id);return v&&!v.passive&&v.family!=='legacy-sword'?v.motion as 'cast'|'attack':undefined;}

/** Every transient is an authoritative event, never a fabricated hit or delayed damage. */
export function masteryVisualEvent(e:any){
 if(e?.type==='masteryPassive'&&masteryVisual(e.skillId)?.passive&&Number.isFinite(e.x)&&Number.isFinite(e.z))return {v:{...masteryVisual(e.skillId)!,passive:false,family:'passiveproc'},phase:'impact',life:.7};
 if(e?.visual==='medical_needle'&&e.type==='hit'&&Number.isFinite(e.x)&&Number.isFinite(e.z))return {v:{...masteryVisual('healer_07')!,passive:false,family:'medical'},phase:'hit',life:.42};
 if(e?.type==='masteryMix'&&catalog.mixes.some(m=>m.id===e.mixId)&&Number.isFinite(e.x)&&Number.isFinite(e.z)){const m=catalog.mixes.find(m=>m.id===e.mixId)!;return {v:{id:m.id,name:m.nameTh,school:'Mix',passive:false,family:'mix',color:'#e5c987',range:3,motion:'cast'},phase:'impact',life:1.1};}
 if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.z))return null;
 const id=e.learnedSkill??e.skillId??(['summonAttack','summonEnd','summonHurt'].includes(e.type)?'shaman_01':['wispEnd'].includes(e.type)?'shaman_02':e.type==='spiritIntercept'?'shaman_04':undefined),v=masteryVisual(id);
 if(!v||v.passive||v.family==='legacy-sword')return null;
 if(e.type==='skillDisplace'&&(!Number.isFinite(e.fromX)||!Number.isFinite(e.fromZ)||e.resisted))return null;
 const phase=e.type==='skill'?'start':e.type==='hit'?'hit':e.type==='skillDisplace'?'displace':e.type==='heal'&&e.amount>0?'impact':['skillImpact','shieldAbsorb','spiritIntercept','summonHurt','masteryGuard','masteryReflect','skillReveal'].includes(e.type)?'impact':['summonEnd','wispEnd','healOverTimeEnd','masteryZoneEnd','decoyEnd'].includes(e.type)?'end':['summon','wisp','healOverTime','summonAttack','masteryZone'].includes(e.type)?'state':null;
 if(!phase)return null;
 // Damage rays come from confirmed hits; utility and area shapes come from their impact.
 if(e.type==='skillImpact'&&['arrow','fire','stab','punch','aim','pierce','countershot','ambush','execute','poisonknife','elbow','finisher','palm','counter','flurry'].includes(v.family))return {v,phase:'handled',life:0};
 return {v,phase,life:phase==='start'?.24:phase==='end'?.45:phase==='hit'?.42:.7};
}

export function summonPose(pet:any,time:number,attackStarted?:number){
 const age=attackStarted===undefined?Infinity:Math.max(0,time-attackStarted);
 const attack=age<.56||pet.attack>0,motion=attack?'attack':pet.state==='chase'?'move':'idle';
 return {motion,time:attack?Math.max(age===Infinity?0:age,pet.attack>0?.3-pet.attack:0):time,duration:attack?.56:motion==='move'?.6:1.8,windup:.3};
}
