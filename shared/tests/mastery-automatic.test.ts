import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,spawn,step,action,validateHotbar,IntentSchema,createSummon} from '../src/index.node.js';
import {MASTERY_SCHOOLS} from '../src/mastery.js';
import {automaticCause,resolveAutomaticSkill,markAutomaticCast} from '../src/game/mastery-automatic.js';
const data=loadGameData();
test('basic sword and bow attacks continue during Auto Spell while manual casts stay locked',()=>{
 for(const weapon of ['sword1h','bow'] as const){
  const f=fixture('mage_01');f.p.stats.weaponType=weapon;f.p.skills.basic=1;f.p.cd.attack=0;
  markAutomaticCast(f.g,2);const hp=f.e.hp;
  assert.equal(action(f.g,'attack'),true);assert.ok(f.e.hp<hp);assert.equal(f.p.attackKind,'slash');
  assert.equal(action(f.g,'attack'),false,'cooldown still applies');
  assert.equal(action(f.g,'mage_01'),false,'manual casting lock remains');
  f.p.cd.attack=0;f.p.dead=true;assert.equal(action(f.g,'attack'),false,'death validation remains');
 }
});
test('bow basic attacks select one ranged target and reject targets beyond range',()=>{
 const f=fixture('archer_01');f.p.skills.basic=1;f.p.cd.attack=0;f.e.x=6;const second=spawn(f.g,5.8,4);second.hp=10000;
 const hp=f.e.hp;assert(action(f.g,'basic'));assert(f.e.hp<hp);assert.equal(second.hp,10000);
 const shot=f.g.events.find(e=>e.type==='bowShot');assert.equal(shot?.id,f.e.id);assert.equal(shot?.targetX,6);
 f.p.cd.attack=0;f.e.x=999;second.x=999;f.g.events=[];assert(action(f.g,'attack'));assert.equal(f.g.events.some(e=>e.type==='hit'),false);
});
function fixture(id:string){
 const g=createGame(984,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;const p=g.p;Object.assign(p,newJob());p.masteries=Object.fromEntries(MASTERY_SCHOOLS.map(s=>[s,100])) as typeof p.masteries;p.skills=Object.fromEntries(data.mastery.skills.map(s=>[s.id,s.passive&&s.school!=='Swordsman'&&!['archer_07','mage_07','mage_08','rogue_07'].includes(s.id)?0:s.maxRank]));p.skills[id]=1;
 p.x=0;p.z=4;p.fx=1;p.fz=0;p.hp=p.maxHp=1000;p.mp=p.maxMp=10000;p.cd={attack:999};p.stats.hpRegen=p.stats.spRegen=0;p.stats.atk=p.stats.matk=100;p.stats.hit=1000;p.stats.crit=0;p.stats.softMdef=0;
 const s=data.mastery.skills.find(s=>s.id===id)!;p.stats.weaponType=s.weapon==='sword'?'sword1h':s.weapon==='any'?'unarmed':s.weapon;
 p.hotbar=p.hotbar.map((s,i)=>({...s,skill:i===0?id:null,...(i===0?{mode:'autoSpell' as const}:{})}));
 const e=spawn(g,1.3,4);e.hp=e.maxHp=10000;e.cooldown=e.wander=999;g.target=e.id;
 if(id==='shaman_03'){assert(createSummon(g,p,1));p.summon!.x=.7;p.summon!.z=4;p.summon!.cooldown=999;}
 return {g,p,e,s};
}
function advance(g:ReturnType<typeof createGame>,seconds:number){for(let i=0;i<Math.round(seconds/.05);i++)step(g,.05);}
function fire(f:ReturnType<typeof fixture>){
 const {g,p,e,s}=f,cause=automaticCause(s);
 if(cause==='skills'){
  for(const id of ['archer_04','rogue_02','boxer_02','shaman_04'].filter(v=>v!==s.id).slice(0,3))assert(action(g,id));
 }else{
  p.hp=cause==='hp'?450:1000;if(s.id==='healer_04')p.statuses.push({id:'burn',sourceId:'fixture',remaining:6,value:.03,tick:0});
  g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:p.x,z:p.z,vx:0,vz:0,life:1,damage:cause==='hp'?100:200,phase:1});
 }
 advance(g,.1);
}

test('all21 Auto Spells run through real trigger rules and pay the separate automatic rank costs and timing',()=>{
 const eligible=data.mastery.skills.filter(s=>s.triggerEligible);assert.equal(eligible.length,21);
 for(const plan of eligible){const f=fixture(plan.id);fire(f);advance(f.g,2);
  const events=f.g.events.filter(e=>e.type==='skill'&&e.autoSpell&&e.skillId===plan.id);assert.equal(events.length,1,plan.id);
  assert(f.p.cd[plan.id]>0,plan.id);assert.equal(events[0].duration,plan.autoRanks[0].cast*Math.max(1-data.stats.caps.maxCastReduction,f.p.stats.castMul)||.4,plan.id);
  assert(f.g.events.some(e=>e.skillId===plan.id&&e.type!=='skill'),plan.id+' must have a real effect');
 }
});

test('trigger slots stay within ten, unlock at50/75 and reject ineligible, duplicated or injected modes',()=>{
 const f=fixture('mage_01');f.p.masteries=Object.fromEntries(MASTERY_SCHOOLS.map(s=>[s,0])) as typeof f.p.masteries;f.p.masteries.Mage=25;
 assert.throws(()=>validateHotbar(f.p,f.p.hotbar,data),/Trigger/);f.p.masteries.Archer=50;assert.equal(validateHotbar(f.p,f.p.hotbar,data)[0].mode,'autoSpell');
 const slots=f.p.hotbar.map((s,i)=>i===1?{...s,skill:'mage_04',mode:'autoSpell' as const}:s);assert.throws(()=>validateHotbar(f.p,slots,data),/Trigger/);f.p.masteries.Archer=75;assert.equal(validateHotbar(f.p,slots,data).length,10);
 assert.throws(()=>validateHotbar(f.p,slots.map((s,i)=>i===1?{...s,skill:'mage_01'}:s),data));
 assert.equal(IntentSchema.safeParse({t:'hotbar',slots:f.p.hotbar.map((s,i)=>i===0?{...s,mode:'free',rank:10}:s)}).success,false);
});

test('Auto Spell does not restart a body attack, ignores additional trigger chains and spends cast time before the next action',()=>{
 const f=fixture('mage_01');for(const id of ['archer_04','rogue_02','boxer_02'])assert(action(f.g,id));f.p.attack=.3;f.p.attackKind='slash';advance(f.g,.1);
 assert.equal(f.p.attackKind,'slash');assert.equal(action(f.g,'boxer_01'),false);advance(f.g,8);
 assert.equal(f.g.events.filter(e=>e.type==='skill'&&e.autoSpell).length,1);
});

test('automatic HoT caps the full five-second sequence after received-healing bonuses',()=>{
 const f=fixture('healer_03');f.p.maxHp=1000;f.p.stats.matk=10000;fire(f);const hp=f.p.hp;advance(f.g,7);
 const healed=f.g.events.filter(e=>e.type==='heal'&&e.skillId==='healer_03').reduce((n,e)=>n+e.amount,0);
 assert(healed<=40);assert(healed>0);assert.equal(f.p.hp-hp,healed);
});


test('automatic water seal uses its own capped rank for both damage and Slow when the manual rank exceeds the automatic cap',()=>{
 const f=fixture('mage_04');f.p.skills.mage_04=f.s.maxRank;fire(f);advance(f.g,2);
 const hit=f.g.events.find(e=>e.type==='hit'&&e.skillId==='mage_04');assert(hit);assert.equal(hit.breakdown.base,100*f.s.autoRanks[2].params.damage/100);
 assert.equal(f.e.statuses.find(s=>s.id==='slow')!.value,f.s.autoRanks[2].params.slow/100);
});
