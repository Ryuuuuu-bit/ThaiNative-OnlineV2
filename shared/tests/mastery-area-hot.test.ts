import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,addPlayer,DEFAULT_AUTO,clearMasteryHeals} from '../src/index.node.js';
import {recordMasteryWound,awardMasteryTraining,clearMasteryEncounter} from '../src/game/mastery-training.js';
import {applyPotionEffect} from '../src/game/loot-effects.js';
const data=loadGameData();
function fixture(){
 const g=createGame(681,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Mage=75;p.masteries.Healer=75;Object.assign(p.skills,{mage_01:1,mage_03:1,healer_01:1,healer_03:1});
 p.x=0;p.z=4;p.stats.matk=101;p.stats.hpRegen=0;p.stats.spRegen=0;p.hp=p.maxHp=10000;p.mp=p.maxMp=400;
 const ally=addPlayer(g,'ally');ally.x=1;ally.z=4;ally.hp=5000;ally.maxHp=10000;ally.stats.hpRegen=0;ally.stats.spRegen=0;
 g.partyMembers=()=>[p.id,ally.id];return {g,p,ally};
}
function foe(g:ReturnType<typeof createGame>,x=4,z=4){const e=spawn(g,x,z);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',value:1,remaining:99}];return e;}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
function castHot(f:ReturnType<typeof fixture>){assert(action(f.g,'healer_03',f.ally.id));advance(f.g,.4);}

test('area and HoT preserve all accepted ranks/resources, Mastery/prerequisite gates and saved bar validation',()=>{
 for(const id of ['mage_03','healer_03']){
  const school=id==='mage_03'?'Mage':'Healer',root=id==='mage_03'?'mage_01':'healer_01';let progress=newJob();progress.skillPoints=3;assert.throws(()=>learnSkill(progress,id,data));
  progress=learnSkill(progress,root,data);assert.throws(()=>learnSkill(progress,id,data),/Mastery 25/);progress.masteries[school]=25;progress=learnSkill(progress,id,data);
  assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?id:null})),data)[0].skill,id);
  for(const rank of data.mastery.skills.find(s=>s.id===id)!.ranks){
   const f=fixture(),e=foe(f.g);f.p.skills[id]=rank.rank;const mp=f.p.mp,s=resolveSkill(data,id,rank.rank);f.g.target=e.id;
   assert.equal(s.sp,rank.mp);assert.equal(s.cast,rank.cast);assert.equal(s.cooldown,rank.cooldown);assert(action(f.g,id,id==='healer_03'?f.ally.id:undefined));f.g.target=null;
   assert.equal(f.p.mp,mp-rank.mp);assert.equal(f.p.cd[id],rank.cooldown);advance(f.g,rank.cast);
   if(id==='mage_03'){assert.equal(s.radius,2.5);assert.equal(s.kind,'area');assert.equal(s.type,'magic');assert.equal(s.element,'fire');assert.equal(f.g.events.find(v=>v.type==='hit'&&v.skillId===id)!.breakdown.base,101*rank.params.damage/100);}
   else{assert.equal(f.ally.healingOverTime!.amount,Math.round(101*rank.params.heal/100));advance(f.g,5);assert.equal(f.ally.hp,5000+Math.round(101*rank.params.heal/100));}
  }
 }
});

test('fire area explodes once after casting at its fixed center and hits all enemies in the 2.5m radius',()=>{
 const {g,p}=fixture(),enemies=[[4,4],[4.5,4],[4,5],[3.5,3.5],[6.5,4],[6.51,4]].map(([x,z])=>foe(g,x,z));g.target=enemies[0].id;const mp=p.mp;
 assert(action(g,'mage_03'));g.target=null;advance(g,.65);assert(enemies.every(e=>e.hp===10000));advance(g,.05);
 assert(enemies.slice(0,5).every(e=>e.hp<10000));assert.equal(enemies[5].hp,10000);assert.equal(p.mp,mp-20);
 const impact=g.events.filter(v=>v.type==='skillImpact'&&v.skillId==='mage_03');assert.equal(impact.length,1);assert.equal(impact[0].x,4);assert.equal(impact[0].r,2.5);
 assert.equal(g.events.filter(v=>v.type==='hit'&&v.skillId==='mage_03').length,5);
});

test('area does not home onto moved/dead/removed anchors and interrupted/out-of-range casters lose their paid cast',()=>{
 for(const anchor of ['moved','dead','removed']){
  const {g}=fixture(),e=foe(g),near=foe(g,4.2,4);g.target=e.id;assert(action(g,'mage_03'));g.target=null;
  if(anchor==='moved')e.x=12;if(anchor==='dead'){e.dead=true;e.respawn=999;}if(anchor==='removed')g.enemies=g.enemies.filter(v=>v!==e);
  advance(g,.7);assert(near.hp<10000,anchor);if(anchor==='moved')assert.equal(e.hp,10000);
 }
 for(const invalid of ['stun','dead','range']){
  const {g,p}=fixture(),e=foe(g);g.target=e.id;assert(action(g,'mage_03'));g.target=null;const mp=p.mp;
  if(invalid==='stun')p.statuses.push({id:'stun',sourceId:'test',value:0,remaining:1});if(invalid==='dead')p.dead=true;if(invalid==='range')p.x=-10;
  advance(g,.7);assert.equal(e.hp,10000,invalid);assert.equal(p.mp,mp);
 }
});

test('HoT waits for cast completion and five one-second ticks share one exact MATK pool without immediate healing',()=>{
 const f=fixture(),{g,p,ally}=f,mp=p.mp;assert(action(g,'healer_03',ally.id));advance(g,.35);assert.equal(ally.healingOverTime,undefined);advance(g,.05);assert.equal(ally.hp,5000);
 advance(g,.95);assert.equal(ally.hp,5000);advance(g,.05);assert.equal(ally.hp,5020);advance(g,4);assert.equal(ally.hp,5101);assert.equal(ally.healingOverTime,undefined);assert.equal(p.mp,mp-14);
 const ticks=g.events.filter(v=>v.type==='heal'&&v.skillId==='healer_03');assert.deepEqual(ticks.map(v=>v.amount),[20,20,20,20,21]);assert(ticks.every(v=>v.hot===true));
});

test('same-name HoT refreshes one target pool even across casters, discarding old pending ticks',()=>{
 const f=fixture(),{g,p,ally}=f;castHot(f);const other=addPlayer(g,'other');Object.assign(other,newJob());other.masteries.Healer=25;other.skills.healer_01=1;other.skills.healer_03=1;other.x=0;other.z=4;other.stats.matk=200;other.stats.hpRegen=0;other.stats.spRegen=0;other.mp=100;
 g.partyMembers=()=>[p.id,ally.id,other.id];g.p=other;assert(action(g,'healer_03',ally.id));advance(g,.4);assert.equal(ally.healingOverTime!.casterId,other.id);
 clearMasteryHeals(g,p.id);assert.equal(ally.healingOverTime!.casterId,other.id);advance(g,.6);assert.equal(ally.hp,5000);advance(g,4.4);assert.equal(ally.hp,5200);
 assert.equal(g.events.filter(v=>v.type==='healOverTimeEnd'&&v.reason==='refreshed').length,1);
});

test('HoT training uses only effective recovery of real wounds; full HP, potions/HP-cost recycling and resets grant none',()=>{
 const f=fixture(),{g,p,ally}=f,e=foe(g);e.hp=e.maxHp=100;ally.hp=ally.maxHp-30;recordMasteryWound(g,ally,e,30);castHot(f);advance(g,5);
 assert.equal(ally.hp,ally.maxHp);assert.equal(e.masterySupport![p.id].Healer,30);assert.equal(p.masteryExp.Healer,0);
 e.hp=0;e.damageBy={[ally.id]:100};e.masteryDamage={[ally.id]:{Swordsman:100}};awardMasteryTraining(g,e,{...data.monsters.monsters.find(s=>s.id===e.dataId)!,jobExp:100},1);assert(p.masteryExp.Healer>0);assert(p.masteryExp.Healer+ally.masteryExp.Swordsman<=100);
 for(const blocked of ['potion','reset','full']){
  const h=fixture(),source=foe(h.g);h.ally.hp=h.ally.maxHp-30;recordMasteryWound(h.g,h.ally,source,30);
  if(blocked==='potion'){applyPotionEffect(h.g,h.ally,'hp',30);h.ally.hp-=30;}if(blocked==='reset')clearMasteryEncounter(h.g,source);if(blocked==='full')h.ally.hp=h.ally.maxHp;
  castHot(h);advance(h.g,5);assert.equal(source.masterySupport,undefined,blocked);
 }
});

test('HoT rechecks party/range/life at completion and cancels invalid source/recipient states while ticking',()=>{
 for(const invalid of ['party','range','dead','caster-dead','unlearned']){
  const f=fixture();assert(action(f.g,'healer_03',f.ally.id));if(invalid==='party')f.g.partyMembers=()=>[f.p.id];if(invalid==='range')f.ally.x=20;if(invalid==='dead')f.ally.dead=true;if(invalid==='caster-dead')f.p.dead=true;if(invalid==='unlearned')delete f.p.skills.healer_03;
  advance(f.g,.4);assert.equal(f.ally.healingOverTime,undefined,invalid);
 }
 for(const invalid of ['party','range','dead','caster-dead','unlearned','map','absent']){
  const f=fixture();castHot(f);const hp=f.ally.hp;if(invalid==='party')f.g.partyMembers=()=>[f.p.id];if(invalid==='range')f.ally.x=20;if(invalid==='dead')f.ally.dead=true;if(invalid==='caster-dead')f.p.dead=true;if(invalid==='unlearned')delete f.p.skills.healer_03;if(invalid==='map')f.p.mapId='forest';if(invalid==='absent')f.g.players.delete(f.p.id);
  advance(f.g,1);assert.equal(f.ally.hp,hp,invalid);assert.equal(f.ally.healingOverTime,undefined,invalid);
 }
});

test('HoT can prepare a full-health target, zero ticks have no feedback/procs and the pool never banks overheal',()=>{
 const f=fixture();f.p.stats.matk=1;f.ally.hp=f.ally.maxHp;castHot(f);advance(f.g,4);assert.equal(f.g.events.filter(v=>v.type==='heal'&&v.skillId==='healer_03').length,0);
 f.ally.hp--;advance(f.g,1);assert.equal(f.ally.hp,f.ally.maxHp);assert.equal(f.g.events.filter(v=>v.type==='heal'&&v.skillId==='healer_03').length,1);
 const h=fixture();h.ally.hp=h.ally.maxHp;castHot(h);advance(h.g,4);h.ally.hp-=100;advance(h.g,1);assert.equal(h.ally.hp,h.ally.maxHp-79);
});

test('AUTO waits for an area group, and avoids refreshing a live HoT while allowing missing-HP self healing',()=>{
 const f=fixture(),e=foe(f.g,1,4);f.p.auto=true;f.p.autoCfg={...DEFAULT_AUTO,basic:false,order:['mage_03'],off:Object.keys(f.p.skills).filter(s=>s!=='mage_03')};advance(f.g,.1);assert.equal(f.p.cd.mage_03??0,0);
 foe(f.g,1.5,4);f.p.autoTimer=0;advance(f.g,.1);assert((f.p.cd.mage_03??0)>0);
 const h=fixture();foe(h.g,1,4);h.p.hp=5000;h.p.auto=true;h.p.autoCfg={...DEFAULT_AUTO,basic:false,order:['healer_03'],off:Object.keys(h.p.skills).filter(s=>s!=='healer_03')};advance(h.g,.6);assert(h.p.healingOverTime);h.p.cd.healer_03=0;const mp=h.p.mp;advance(h.g,.1);assert.equal(h.p.mp,mp);
});
