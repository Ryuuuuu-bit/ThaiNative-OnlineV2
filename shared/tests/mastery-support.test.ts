import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,addPlayer,spawn,step,action,resolveSkill,clearMasteryWounds,refreshStats,revive} from '../src/index.node.js';
import {recordMasteryWound,restoreMasteryHp,clearMasteryEncounter,awardMasteryTraining} from '../src/game/mastery-training.js';
import {healPartyMember,applyPotionEffect} from '../src/game/loot-effects.js';
const data=loadGameData();
function fixture(){
 const g=createGame(91,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.skills={healer_01:1};p.x=0;p.z=4;p.stats.hpRegen=0;p.stats.spRegen=0;p.stats.matk=100;p.mp=p.maxMp=100;
 const ally=addPlayer(g,'ally');ally.x=1;ally.z=4;ally.stats.hpRegen=0;ally.stats.spRegen=0;ally.skills={};
 g.partyMembers=()=>[p.id,ally.id];
 const e=spawn(g,1,4);e.maxHp=e.hp=100;e.cooldown=999;
 const spec={...g.data.monsters.monsters.find(s=>s.id===e.dataId)!,jobExp:100};
 return {g,p,ally,e,spec};
}
function wound(f:ReturnType<typeof fixture>,amount:number){f.ally.hp-=amount;recordMasteryWound(f.g,f.ally,f.e,amount);}
function heal(f:ReturnType<typeof fixture>,amount:number){return healPartyMember(f.g,f.p,f.ally,amount,resolveSkill(f.g.data,'healer_01'));}

test('first aid credits only real missing enemy HP, once, and shares the monster budget with damage',()=>{
 const f=fixture(),{g,p,ally,e,spec}=f;wound(f,20);
 assert.equal(heal(f,1000),20);assert.equal(e.masterySupport![p.id].Healer,20);assert.equal(heal(f,1000),0);
 assert.equal(p.masteryExp.Healer,0);assert.equal(p.masteries.Healer,0);
 e.hp=0;e.damageBy={[ally.id]:100};e.masteryDamage={[ally.id]:{Swordsman:100}};
 awardMasteryTraining(g,e,spec,1);
 assert.equal(p.masteryExp.Healer,16);assert.equal(ally.masteryExp.Swordsman,83);
 assert(p.masteryExp.Healer+ally.masteryExp.Swordsman<=100);assert.equal(e.masterySupport,undefined);
 awardMasteryTraining(g,e,spec,1);assert.equal(p.masteryExp.Healer,16);
});
test('potions, passive/shared healing and regeneration consume wounds without granting Healer credit',()=>{
 for(const recovery of ['potion','party-item','regen','passive']){
  const f=fixture();wound(f,20);
  if(recovery==='potion')applyPotionEffect(f.g,f.ally,'hp',20);
  if(recovery==='party-item')healPartyMember(f.g,f.p,f.ally,20);
  if(recovery==='passive')restoreMasteryHp(f.ally,20);
  if(recovery==='regen'){f.ally.stats.hpRegen=400;step(f.g,.05);}
  f.ally.hp-=20; // A later HP cost must not recreate the healed enemy wound.
  heal(f,20);assert.equal(f.e.masterySupport?.[f.p.id]?.Healer??0,0,recovery);
 }
 const f=fixture();f.ally.hp-=20;heal(f,20);assert.equal(f.e.masterySupport,undefined);
});
test('support has a per-encounter HP cap and never increases total training above one monster budget',()=>{
 const f=fixture(),{g,p,ally,e,spec}=f;
 for(let n=0;n<20;n++){wound(f,10);heal(f,10);}
 assert.equal(e.masterySupport![p.id].Healer,100);
 e.hp=0;e.damageBy={[ally.id]:100};e.masteryDamage={[ally.id]:{Swordsman:100,Mage:100}};
 awardMasteryTraining(g,e,spec,1);
 assert.equal(p.masteryExp.Healer,50);assert.equal(ally.masteryExp.Swordsman,25);assert.equal(ally.masteryExp.Mage,25);
});
test('encounter reset, explicit player cleanup, revive and max-HP changes cannot leave old wounds',()=>{
 for(const clear of ['reset','player','revive','stats','boss-reset']){
  const f=fixture();wound(f,20);
  if(clear==='reset')clearMasteryEncounter(f.g,f.e);
  if(clear==='player')clearMasteryWounds(f.ally);
  if(clear==='stats'){f.ally.maxHp+=10;refreshStats(f.g,f.ally);}
  if(clear==='revive'){f.g.p=f.ally;f.ally.dead=true;f.ally.reviveRemaining=0;revive(f.g);f.ally.mapId='meadow';f.ally.x=1;f.ally.z=4;f.ally.hp-=20;}
  if(clear==='boss-reset'){f.e.boss=true;f.e.damageBy={[f.p.id]:100};f.e.lastEngagedAt=-100;step(f.g,.05);}
  heal(f,20);assert.equal(f.e.masterySupport,undefined);
 }
 const f=fixture();wound(f,20);heal(f,10);clearMasteryEncounter(f.g,f.e);assert.equal(f.e.masterySupport,undefined);
 heal(f,10);assert.equal(f.e.masterySupport,undefined);
});
test('unknown, summoned, dead, out-of-map and unlearned sources cannot create training',()=>{
 for(const invalid of ['unknown','summoned','dead','map','unlearned']){
  const f=fixture();f.ally.hp-=20;
  if(invalid==='summoned')f.e.summoned=true;if(invalid==='dead')f.e.dead=true;
  recordMasteryWound(f.g,f.ally,invalid==='unknown'?undefined:f.e,20);
  if(invalid==='map')f.p.mapId='forest';if(invalid==='unlearned')delete f.p.skills.healer_01;
  heal(f,20);assert.equal(f.e.masterySupport?.[f.p.id]?.Healer??0,0,invalid);
 }
});
test('support still obeys alive/present/distance and existing level-gap/anti-carry rules at defeat',()=>{
 for(const invalid of ['dead','absent','distant','trivial','carry']){
  const f=fixture();wound(f,20);heal(f,20);f.e.hp=0;f.e.damageBy={[f.ally.id]:100};
  if(invalid==='dead')f.p.dead=true;if(invalid==='absent')f.g.players.delete(f.p.id);if(invalid==='distant')f.p.x=100;if(invalid==='trivial')f.p.level=100;
  awardMasteryTraining(f.g,f.e,f.spec,invalid==='carry'?100:1);assert.equal(f.p.masteryExp.Healer,0,invalid);
 }
});
test('actual enemy melee, first-aid cast and monster defeat train a healer without requiring their own damage',()=>{
 const f=fixture(),{g,p,ally,e}=f;g.p=ally;
 g.data={...g.data,monsters:{...g.data.monsters,monsters:g.data.monsters.monsters.map(s=>s.id===e.dataId?{...s,jobExp:100}:s)}};
 e.motion='attack';e.motionTime=e.behavior!.windup;e.attackApplied=false;e.fx=-1;e.fz=0;
 const hp=ally.hp;step(g,.05);assert(ally.hp<hp);const lost=hp-ally.hp;e.motion='idle';e.cooldown=999;
 g.p=p;assert(action(g,'healer_01',ally.id));for(let n=0;n<8;n++)step(g,.05);
 assert.equal(ally.hp,hp);assert.equal(e.masterySupport![p.id].Healer,lost);assert.equal(p.masteryExp.Healer,0);
 ally.skills={basic:1};ally.stats.atk=10000;ally.stats.hit=1000;ally.fx=1;ally.fz=0;g.p=ally;
 assert(action(g,'attack'));assert(e.dead);assert(p.masteryExp.Healer>0);assert.equal(e.damageBy[p.id],undefined);
});
test('precomputed enemy bolts preserve HP-loss provenance without replacing their damage calculation',()=>{
 const f=fixture(),{g,ally,e,p}=f;ally.stats.softMdef=0;
 g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:ally.x,z:ally.z,vx:0,vz:0,life:1,damage:10,phase:1});
 const hp=ally.hp;step(g,.05);assert.equal(hp-ally.hp,10);
 heal(f,10);assert.equal(e.masterySupport![p.id].Healer,10);
});
