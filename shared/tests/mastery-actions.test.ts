import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawn,step,action,addPlayer,loadGameData,newJob,learnSkill,resolveSkill,validateHotbar,IntentSchema,DEFAULT_AUTO,computeDamage,monsterStats} from '../src/index.node.js';
const data=loadGameData();
function fixture(){
 const g=createGame(71,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.x=0;p.z=4;p.stats.matk=100;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=p.maxMp=100;
 p.skills={mage_01:1,healer_01:1};
 return {g,p};
}
function advance(g:ReturnType<typeof createGame>,seconds:number){for(let n=0;n<Math.round(seconds/.05);n++)step(g,.05);}

test('root action ranks resolve accepted costs, timings and MATK percentages without potion scaling',()=>{
 for(const id of ['mage_01','healer_01','archer_01','rogue_01','boxer_01','shaman_01']){
  const planned=data.mastery.skills.find(s=>s.id===id)!;
  for(const rank of planned.ranks){
   const actual=resolveSkill(data,id,rank.rank);
   assert.equal(actual.sp,rank.mp);assert.equal(actual.cast,rank.cast);assert.equal(actual.cooldown,rank.cooldown);
   assert.equal(actual.percent,rank.params.damage??rank.params.heal??0);assert.equal(actual.range,planned.range);
   assert.equal(actual.heal,undefined);assert.equal(actual.jobId,'common');
  }
 }
});
test('classless root learning spends points immutably, gates higher ranks by local Mastery and validates the bar',()=>{
 const before=newJob();before.skillPoints=5;
 let p=learnSkill(before,'mage_01',data);assert.equal(before.skills.mage_01,undefined);assert.equal(p.skillPoints,4);
 p=learnSkill(learnSkill(p,'mage_01',data),'mage_01',data);
 assert.throws(()=>learnSkill(p,'mage_01',data),/Mastery 25/);
 p.masteries.Swordsman=100;assert.throws(()=>learnSkill(p,'mage_01',data),/Mastery 25/);
 p.masteries.Mage=25;p=learnSkill(p,'mage_01',data);assert.equal(p.skills.mage_01,4);
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'mage_01':null}));assert.equal(validateHotbar(p,slots,data)[0].skill,'mage_01');
 assert.throws(()=>validateHotbar(before,slots,data));assert.throws(()=>learnSkill(p,'mage_99',data),/ไม่พบสกิล/);
});
test('Mage spends MP and cooldown at cast start and hits only the locked enemy after the accepted cast delay',()=>{
 const {g,p}=fixture(),target=spawn(g,1,4),other=spawn(g,1.2,4);
 for(const e of [target,other]){e.hp=e.maxHp=10000;e.cooldown=999;}
 g.target=target.id;const s=resolveSkill(data,'mage_01'),mp=p.mp;
 assert(action(g,'mage_01'));assert.equal(p.mp,mp-s.sp);assert.equal(p.cd.mage_01,s.cooldown);
 advance(g,s.cast-.05);assert.equal(target.hp,10000);advance(g,.05);
 assert(target.hp<10000);assert.equal(other.hp,10000);assert.equal(g.meteors.length,0);
 assert.equal(g.events.filter(e=>e.type==='skillImpact'&&e.skillId==='mage_01').length,1);
 assert((target.masteryDamage?.[p.id].Mage??0)>0);
});
test('Mage rejects invalid starts and cancels impact on death, stun, lost target or range without retarget/refund',()=>{
 for(const reason of ['unlearned','mp','range','stun','dead','ally']){
  const {g,p}=fixture(),e=spawn(g,1,4);g.target=e.id;
  if(reason==='unlearned')delete p.skills.mage_01;if(reason==='mp')p.mp=0;if(reason==='range')e.x=100;
  if(reason==='stun')p.statuses.push({id:'stun',remaining:1,value:0,sourceId:'test'});if(reason==='dead')p.dead=true;
  const mp=p.mp;assert.equal(action(g,'mage_01',reason==='ally'?p.id:undefined),false,reason);assert.equal(p.mp,mp);assert.equal(g.meteors.length,0);
 }
 for(const reason of ['dead','stun','target','range']){
  const {g,p}=fixture(),e=spawn(g,1,4);e.hp=e.maxHp=10000;e.cooldown=999;g.target=e.id;
  assert(action(g,'mage_01'));const mp=p.mp;
  if(reason==='dead')p.dead=true;if(reason==='stun')p.statuses.push({id:'stun',remaining:.1,value:0,sourceId:'test'});
  if(reason==='target'){e.dead=true;e.respawn=999;}if(reason==='range')p.x=100;
  advance(g,1.1);assert.equal(e.hp,10000,reason);assert.equal(p.mp,mp);assert.equal(g.meteors.length,0);
 }
});
test('Heal uses MATK, caps at missing HP, rejects full HP and confirms party/range/life at impact',()=>{
 const {g,p}=fixture();p.hp=p.maxHp-10;const mp=p.mp,s=resolveSkill(data,'healer_01');
 assert(action(g,'healer_01'));advance(g,s.cast-.05);assert.equal(p.hp,p.maxHp-10);advance(g,.05);
 assert.equal(p.hp,p.maxHp);assert.equal(p.mp,mp-s.sp);assert.equal(g.events.find(e=>e.type==='heal')?.amount,10);
 p.cd.healer_01=0;assert.equal(action(g,'healer_01'),false);
 for(const invalid of ['stranger','range','dead','leave','move','die']){
  const {g,p}=fixture(),ally=addPlayer(g,'ally');ally.x=1;ally.z=4;ally.hp=1;ally.stats.hpRegen=0;
  g.partyMembers=()=>invalid==='stranger'?[p.id]:[p.id,ally.id];
  if(invalid==='range')ally.x=100;if(invalid==='dead')ally.dead=true;
  const started=action(g,'healer_01',ally.id);assert.equal(started,!['stranger','range','dead'].includes(invalid),invalid);
  if(invalid==='leave')g.partyMembers=()=>[p.id];if(invalid==='move')ally.x=100;if(invalid==='die')ally.dead=true;
  advance(g,.5);assert.equal(ally.hp,1,invalid);assert.equal(g.events.filter(e=>e.type==='heal').length,0);
 }
});
test('Heal reaches an actual ally at canonical range and AUTO can cast learned roots',()=>{
 const {g,p}=fixture(),ally=addPlayer(g,'ally');ally.x=resolveSkill(data,'healer_01').range-.1;ally.z=4;ally.hp=1;ally.stats.hpRegen=0;
 g.partyMembers=()=>[p.id,ally.id];assert(action(g,'healer_01',ally.id));advance(g,.4);assert(ally.hp>1);
 for(const id of ['mage_01','healer_01','archer_01','rogue_01','boxer_01','shaman_01']){
  const {g,p}=fixture(),e=spawn(g,1,4);e.hp=e.maxHp=10000;e.cooldown=999;
  p.skills={[id]:1};p.auto=true;p.hp=Math.round(p.maxHp*.2);p.autoCfg={...DEFAULT_AUTO,basic:false,order:[id]};
  p.stats.weaponType=id==='archer_01'?'bow':id==='rogue_01'?'dagger':id==='boxer_01'?'unarmed':'sword1h';
  advance(g,.1);assert((p.cd[id]??0)>0,id);
 }
});

test('physical roots require their actual weapon, local Mastery and rank; learning and bars stay classless',()=>{
 for(const [id,weapon] of [['archer_01','bow'],['rogue_01','dagger'],['boxer_01','unarmed']] as const){
  const learned=learnSkill(newJob(),id,data);assert.equal(learned.skills[id],1);
  const slots=learned.hotbar.map((s,i)=>({...s,skill:i===0?id:null}));assert.equal(validateHotbar(learned,slots,data)[0].skill,id);
  const {g,p}=fixture(),e=spawn(g,1,4);e.hp=e.maxHp=10000;e.cooldown=999;p.skills={[id]:1};g.target=e.id;
  const mp=p.mp;assert.equal(action(g,id),false);assert.equal(p.mp,mp);p.stats.weaponType=weapon;
  p.skills[id]=4;assert.equal(action(g,id),false);p.skills[id]=1;assert(action(g,id));assert(p.mp<mp);
 }
});
test('Archer releases two hits on one target with one cost/cast event and shared cast identity',()=>{
 const {g,p}=fixture(),e=spawn(g,3,4),other=spawn(g,3.3,4);for(const foe of [e,other]){foe.hp=foe.maxHp=10000;foe.cooldown=999;}
 p.stats.weaponType='bow';p.stats.hit=1000;p.stats.crit=0;p.skills={archer_01:1};g.target=e.id;
 const skill=resolveSkill(data,'archer_01'),mp=p.mp;assert(action(g,'archer_01'));const first=e.hp;
 assert(first<10000);assert.equal(p.mp,mp-skill.sp);assert.equal(p.cd.archer_01,skill.cooldown);
 advance(g,.15);assert.equal(e.hp,first);advance(g,.05);assert(e.hp<first);assert.equal(other.hp,10000);
 const hits=g.events.filter(v=>v.type==='hit'&&v.skillId==='archer_01');assert.equal(hits.length,2);
 assert.deepEqual(hits.map(v=>v.hitIndex),[1,2]);assert.equal(hits[0].cast,hits[1].cast);
 assert.equal(g.events.filter(v=>v.type==='skill'&&v.skillId==='archer_01').length,1);
 assert.equal(e.masteryDamage![p.id].Archer,10000-e.hp);
});
test('Archer keeps miss slots and drops follow-up hits after death, interruption, weapon swap or lost range',()=>{
 for(const invalid of ['miss','dead-target','stun','knockup','weapon','dead-caster','range']){
  const {g,p}=fixture(),e=spawn(g,3,4);e.hp=e.maxHp=10000;e.cooldown=999;p.skills={archer_01:1};p.stats.weaponType='bow';p.stats.hit=invalid==='miss'?-1000:1000;g.target=e.id;
  assert(action(g,'archer_01'));const hp=e.hp;
  if(invalid==='dead-target'){e.dead=true;e.respawn=999;}if(invalid==='dead-caster')p.dead=true;
  if(invalid==='stun'||invalid==='knockup')p.statuses.push({id:invalid,remaining:.05,value:0,sourceId:'test'});
  if(invalid==='weapon')p.stats.weaponType='sword1h';if(invalid==='range')e.x=100;
  advance(g,.05);if(invalid==='weapon')p.stats.weaponType='bow';advance(g,.2);
  assert.equal(e.hp,hp,invalid);assert.equal(p.whirlwindHits?.length??0,0);
  if(invalid==='miss')assert.deepEqual(g.events.filter(v=>v.type==='miss').map(v=>v.hitIndex),[1,2]);
 }
});
test('Assassin rear bonus uses the server target facing, with no bonus from the front or side',()=>{
 for(const facing of [-1,0,1]){
  const {g,p}=fixture(),e=spawn(g,1,4);e.hp=e.maxHp=10000;e.fx=facing;e.fz=facing===0?1:0;e.cooldown=999;
  p.skills={rogue_01:1};p.stats.weaponType='dagger';p.stats.atk=100;p.stats.hit=1000;p.stats.crit=0;g.target=e.id;
  const base=resolveSkill(data,'rogue_01'),skill={...base,percent:base.percent*(facing===1?1.15:1)},defender=monsterStats(data.monsters.monsters.find(s=>s.id===e.dataId)!,data);
  const expected=computeDamage(p.stats,defender,skill,{rng:()=>.5},data).damage;
  assert(action(g,'rogue_01'));assert.equal(10000-e.hp,expected);assert.equal(e.masteryDamage![p.id].Assassin,expected);
 }
});
test('Boxer gains one bounded combo step only on effective hits and clears it on expiry, death or weapon swap',()=>{
 const {g,p}=fixture(),e=spawn(g,1,4);e.hp=e.maxHp=100000;e.cooldown=999;p.skills={boxer_01:1};p.stats.weaponType='unarmed';p.stats.hit=1000;g.target=e.id;
 for(let n=1;n<=4;n++){p.cd.boxer_01=0;assert(action(g,'boxer_01'));assert.equal(p.boxerCombo!.steps,Math.min(3,n));}
 p.stats.hit=-1000;p.cd.boxer_01=0;assert(action(g,'boxer_01'));assert.equal(p.boxerCombo!.steps,3);
 advance(g,4.05);assert.equal(p.boxerCombo,undefined);
 const original=g.data;p.stats.weaponElement='neutral';g.data={...g.data,elements:{...g.data.elements,table:{...g.data.elements.table,neutral:{...g.data.elements.table.neutral,neutral:0}}}};
 p.stats.hit=1000;p.cd.boxer_01=0;assert(action(g,'boxer_01'));assert.equal(p.boxerCombo,undefined);g.data=original;
 p.stats.hit=1000;p.cd.boxer_01=0;assert(action(g,'boxer_01'));assert.equal(p.boxerCombo!.steps,1);
 p.stats.weaponType='bow';advance(g,.05);assert.equal(p.boxerCombo,undefined);
 p.boxerCombo={steps:3,until:g.time+4};p.dead=true;advance(g,.05);assert.equal(p.boxerCombo,undefined);
});
test('act accepts canonical numeric IDs and an ally UUID while rejecting client-authored results',()=>{
 const base={t:'act',a:'healer_01',ally:'550e8400-e29b-41d4-a716-446655440000',seq:1};
 assert(IntentSchema.safeParse(base).success);
 for(const extra of [{amount:999},{rank:10},{masteries:{Healer:100}},{ally:'stranger'},{a:'mage_01;bad'}])assert(!IntentSchema.safeParse({...base,...extra}).success);
});
