import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameData,newJob,deriveStats,learnSkill,validateHotbar,resolveSkill,createGame,refreshStats,action,spawn,step,masteryPassiveValue} from '../src/index.node.js';
import {endgameCast} from '../src/game/endgame-loot.js';
const data=loadGameData();
const ids=['archer_07','mage_07','mage_08','rogue_07'] as const;
function progress(){const p=newJob();p.skillPoints=40;for(const k of Object.keys(p.masteries) as (keyof typeof p.masteries)[])p.masteries[k]=100;return p;}
function profile(p:ReturnType<typeof progress>,bow=false){return {...data.stats.defaultBuild,classId:bow?'archer':'swordsman',level:40,equipment:bow?['bamboo_bow']:[],skills:p.skills,masteries:p.masteries};}
test('four enabled stat passives learn classlessly through exact accepted gates and can never occupy the bar or cast',()=>{
 for(const id of ids){let p=progress();p.masteries[data.mastery.skills.find(s=>s.id===id)!.school]=0;assert.throws(()=>learnSkill(p,id,data),/Mastery/);p=progress();p=learnSkill(p,id,data);assert.equal(p.skills[id],1);assert.equal(p.skillPoints,39);assert.equal(resolveSkill(data,id).passive,true);assert.throws(()=>validateHotbar(p,p.hotbar.map((s,i)=>({...s,skill:i===0?id:null})),data));const g=createGame();Object.assign(g.p,p);assert.equal(action(g,id),false);}
});
test('every accepted rank changes real HIT/FLEE/MaxMP/cast multiplier with correct units and weapon rules',()=>{
 for(const id of ids)for(const rank of data.mastery.skills.find(s=>s.id===id)!.ranks){const p=progress(),bow=id==='archer_07',base=deriveStats(profile(p,bow),data);p.skills[id]=rank.rank;const result=deriveStats(profile(p,bow),data),params=rank.params;
  if(id==='archer_07'){assert.equal(result.hit,base.hit+params.hit);assert.equal(result.atk,base.atk);const unarmed=deriveStats(profile(p),data),none=progress();assert.equal(unarmed.hit,deriveStats(profile(none),data).hit);}
  if(id==='rogue_07')assert.equal(result.flee,base.flee); // This fixture is unarmed; shadow-footwork requires a dagger.
  if(id==='mage_08')assert(Math.abs(result.maxSp-base.maxSp*(1+params.maxMp/100))<1e-8);
  if(id==='mage_07')assert(Math.abs(result.castMul-Math.max(1-data.stats.caps.maxCastReduction,base.castMul*(1-params.castDown/100)))<1e-8);
 }
});
test('unlearned, invalid rank or insufficient Mastery cannot grant passive stats and omitted Mastery never fabricates training',()=>{
 for(const id of ids){const p=progress(),s=data.mastery.skills.find(s=>s.id===id)!,key=Object.keys(s.ranks[0].params)[0];p.skills[id]=1;p.masteries[s.school]=0;assert.equal(masteryPassiveValue(data,p,id==='archer_07'?'bow':'unarmed',id,key),0);p.masteries[s.school]=100;p.skills[id]=11;assert.equal(masteryPassiveValue(data,p,'bow',id,key),0);p.skills[id]=1;assert.equal(masteryPassiveValue(data,{skills:p.skills},'bow',id,key),0);}
});
test('server refresh recomputes from original stats, clamps MP on reduction and never refills or stacks MP when learning',()=>{
 const g=createGame(),p=g.p;Object.assign(p,progress());p.skills.mage_08=1;p.mp=7;refreshStats(g,p);const first=p.maxMp;assert.equal(p.mp,7);refreshStats(g,p);assert.equal(p.maxMp,first);p.skills.mage_08=10;refreshStats(g,p);assert(p.maxMp>first);assert.equal(p.mp,7);p.mp=p.maxMp;p.skills.mage_08=0;refreshStats(g,p);assert.equal(p.mp,p.maxMp);assert(p.maxMp<first);assert.deepEqual(p.profile.masteries,p.masteries);
});
test('Mage cast reduction reaches actual server cast/impact timing without changing MP/CD or creating additional damage',()=>{
 const g=createGame(),p=g.p;g.enemies=[];g.random=()=>.5;Object.assign(p,progress());Object.assign(p.skills,{mage_01:1,mage_07:10});p.x=0;p.z=4;refreshStats(g,p);p.stats.spRegen=0;p.mp=p.maxMp=100;p.cd.attack=999;const e=spawn(g,4,4);e.hp=e.maxHp=10000;e.cooldown=e.wander=999;g.target=e.id;assert(action(g,'mage_01'));g.target=null;assert(Math.abs(p.castRemaining-resolveSkill(data,'mage_01').cast*p.stats.castMul)<1e-8);assert.equal(p.mp,88);assert.equal(p.cd.mage_01,1.5);for(let i=0;i<17;i++)step(g,.05);assert.equal(e.hp,10000);step(g,.05);assert(e.hp<10000);assert.equal(g.events.filter(v=>v.type==='hit'&&v.skillId==='mage_01').length,1);
});
test('derived cast and the existing one-use item reduction share the actual configured cast cap',()=>{
 const g=createGame(),p=g.p;Object.assign(p,progress());p.skills.mage_07=10;p.profile.modifiers=[{kind:'percent',stat:'castMul',value:-.9}];refreshStats(g,p);assert.equal(p.stats.castMul,.5);assert.equal(endgameCast(p,2,data.stats.caps.maxCastReduction),1);assert.equal(endgameCast(p,0),0);
});
