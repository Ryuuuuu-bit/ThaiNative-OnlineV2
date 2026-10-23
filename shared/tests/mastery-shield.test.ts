import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,revive,DEFAULT_AUTO} from '../src/index.node.js';
import {awardMasteryTraining,recordMasteryWound,restoreMasteryHp} from '../src/game/mastery-training.js';
const data=loadGameData();
function fixture(){
 const g=createGame(281,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Mage=25;p.skills={mage_01:1,mage_02:1,healer_01:1};
 p.x=0;p.z=4;p.stats.matk=100;p.stats.hpRegen=0;p.stats.spRegen=0;p.stats.softMdef=0;p.mp=p.maxMp=200;
 const e=spawn(g,4,4);e.cooldown=999;e.hp=e.maxHp=100;
 return {g,p,e};
}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
function bolt(f:ReturnType<typeof fixture>,damage:number,attack='bolt'){
 f.p.invulnerable=0;f.g.projectiles.push({id:f.g.nextId++,owner:f.e.id,attack,x:f.p.x,z:f.p.z,vx:0,vz:0,life:1,damage,phase:1});step(f.g,.05);
}
const ward=(f:ReturnType<typeof fixture>)=>f.p.statuses.find(s=>s.id==='magic_shield');

test('magic ward resolves all accepted ranks, classless prerequisite/Mastery/points/bar and exact costs',()=>{
 let progress=newJob();progress.skillPoints=10;
 assert.throws(()=>learnSkill(progress,'mage_02',data));progress=learnSkill(progress,'mage_01',data);
 assert.throws(()=>learnSkill(progress,'mage_02',data),/Mastery 10/);progress.masteries.Mage=10;
 progress=learnSkill(progress,'mage_02',data);assert.equal(progress.skills.mage_02,1);
 assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?'mage_02':null})),data)[0].skill,'mage_02');
 for(const rank of data.mastery.skills.find(s=>s.id==='mage_02')!.ranks){
  const f=fixture();f.p.skills.mage_02=rank.rank;const skill=resolveSkill(data,'mage_02',rank.rank),mp=f.p.mp;
  assert.equal(skill.kind,'utility');assert.equal(skill.sp,rank.mp);assert.equal(skill.cooldown,rank.cooldown);assert.equal(skill.cast,rank.cast);
  assert(action(f.g,'mage_02'));assert.equal(f.p.mp,mp-rank.mp);assert.equal(f.p.cd.mage_02,rank.cooldown);
  assert.equal(ward(f)!.value,Math.round(rank.params.shield));assert.equal(ward(f)!.remaining,rank.params.duration);
  assert.equal(ward(f)!.sourceId,f.p.id);assert.equal(f.e.hp,100);assert.equal(action(f.g,'mage_02'),false);
 }
});

test('magic ward absorbs only explicit magic, spends finite capacity and credits effective prevention to Mage',()=>{
 const f=fixture(),{p,g,e}=f;assert(action(g,'mage_02'));const hp=p.hp;
 bolt(f,50);assert.equal(p.hp,hp);assert.equal(ward(f)!.value,70);assert.equal(e.masterySupport![p.id].Mage,50);assert.equal(e.masterySupport![p.id].Healer,undefined);
 bolt(f,100);assert.equal(p.hp,hp-30);assert.equal(ward(f),undefined);assert.equal(e.masterySupport![p.id].Mage,100);
 bolt(f,10);assert.equal(p.hp,hp-40);assert.equal(g.events.filter(v=>v.type==='shieldAbsorb').length,2);
});

test('physical ranged attacks and unattributed poison/bleed do not consume the magic-only ward',()=>{
 const f=fixture();assert(action(f.g,'mage_02'));const hp=f.p.hp;
 bolt(f,999,'spit');assert(f.p.hp<hp);assert.equal(ward(f)!.value,120);assert.equal(f.e.masterySupport,undefined);
 f.p.invulnerable=0;f.p.lootEffects={cooldowns:{},shield:0,shieldFor:0,bleed:{damage:3,remaining:2,tick:.99,map:f.g.mapId}};step(f.g,.05);
 assert.equal(ward(f)!.value,120);assert.equal(f.e.masterySupport,undefined);
});

test('other barriers absorb first, invulnerability/god do not spend ward and lethal excess cannot over-credit',()=>{
 for(const blocked of ['item','invulnerable','god']){
  const f=fixture();assert(action(f.g,'mage_02'));const hp=f.p.hp;
  if(blocked==='item')f.p.lootEffects={cooldowns:{},shield:0,shieldFor:0,partyShields:[{amount:100,remaining:4,source:'test',owner:f.p.id,map:f.g.mapId}]};if(blocked==='god')f.p.god=true;
  if(blocked==='invulnerable'){f.p.invulnerable=2;f.g.projectiles.push({id:f.g.nextId++,owner:f.e.id,attack:'bolt',x:0,z:4,vx:0,vz:0,life:1,damage:10,phase:1});step(f.g,.05);}else bolt(f,10);
  assert.equal(f.p.hp,hp);assert.equal(ward(f)!.value,120);assert.equal(f.e.masterySupport,undefined);
 }
 const f=fixture();f.p.hp=5;assert(action(f.g,'mage_02'));bolt(f,120);
 assert.equal(f.e.masterySupport![f.p.id].Mage,5);assert.equal(f.p.hp,5);
});

test('ward expires, replacement never stacks, death/revive clear it and AUTO avoids refreshing a live ward',()=>{
 const f=fixture();assert(action(f.g,'mage_02'));bolt(f,10);f.p.cd.mage_02=0;assert(action(f.g,'mage_02'));
 assert.equal(f.p.statuses.filter(s=>s.id==='magic_shield').length,1);assert.equal(ward(f)!.value,120);
 f.p.auto=true;f.p.autoCfg={...DEFAULT_AUTO,basic:false,order:['mage_02'],off:['mage_01']};f.p.cd.mage_02=0;const mp=f.p.mp;advance(f.g,.1);assert.equal(f.p.mp,mp);
 f.p.auto=false;advance(f.g,4);assert.equal(ward(f),undefined);assert(action(f.g,'mage_02'));f.p.hp=1;bolt(f,999);assert(f.p.dead);assert.equal(ward(f),undefined);
 f.p.statuses.push({id:'magic_shield',sourceId:f.p.id,value:10,remaining:4});f.p.reviveRemaining=0;revive(f.g);assert.equal(ward(f),undefined);
});

test('shield and healing share the same support cap, preserve school attribution and cannot multiply EXP',()=>{
 const f=fixture(),{g,p,e}=f;assert(action(g,'mage_02'));bolt(f,40);
 p.hp-=30;recordMasteryWound(g,p,e,30);restoreMasteryHp(p,30,g,p);bolt(f,80);
 assert.deepEqual(e.masterySupport![p.id],{Mage:70,Healer:30});e.hp=0;e.damageBy={[p.id]:100};e.masteryDamage={[p.id]:{Swordsman:100}};
 const spec={...data.monsters.monsters.find(s=>s.id===e.dataId)!,jobExp:100};awardMasteryTraining(g,e,spec,1);
 assert.equal(p.masteryExp.Mage,35);assert.equal(p.masteryExp.Healer,15);assert.equal(p.masteryExp.Swordsman,50);
});
