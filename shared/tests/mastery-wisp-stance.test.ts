import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,createSummon,createWisp,addPlayer,DEFAULT_AUTO,type BossTelegraph} from '../src/index.node.js';
import {clearMasteryEncounter} from '../src/game/mastery-training.js';
import {combatTargets} from '../src/game/summons.js';
const data=loadGameData();
function fixture(){
 const g=createGame(581,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Boxer=25;p.masteries.Summoner=25;
 Object.assign(p.skills,{boxer_01:1,boxer_02:1,shaman_01:1,shaman_02:1});p.x=0;p.z=4;p.stats.matk=100;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=p.maxMp=300;p.hp=p.maxHp=100000;
 return {g,p};
}
function advance(g:ReturnType<typeof createGame>,seconds:number){for(let n=0;n<Math.round(seconds/.05);n++)step(g,.05);}
function foe(g:ReturnType<typeof createGame>){const e=spawn(g,4,4);e.hp=e.maxHp=10000;e.cooldown=999;return e;}
const wispHits=(g:ReturnType<typeof createGame>)=>g.events.filter(v=>v.type==='hit'&&v.skillId==='shaman_02');

test('stance and wisp learn classlessly through local Mastery/prerequisites and retain all rank resource values',()=>{
 for(const id of ['boxer_02','shaman_02']){
  const school=id==='boxer_02'?'Boxer':'Summoner',root=id==='boxer_02'?'boxer_01':'shaman_01';let progress=newJob();progress.skillPoints=3;progress.masteries[school]=10;
  assert.throws(()=>learnSkill(progress,id,data));progress=learnSkill(learnSkill(progress,root,data),id,data);
  assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?id:null})),data)[0].skill,id);
  for(const rank of data.mastery.skills.find(s=>s.id===id)!.ranks){
   const {g,p}=fixture(),e=foe(g);p.skills[id]=rank.rank;g.target=e.id;const mp=p.mp,s=resolveSkill(data,id,rank.rank);
   assert.equal(s.sp,rank.mp);assert.equal(s.cast,rank.cast);assert.equal(s.cooldown,rank.cooldown);assert(action(g,id));assert.equal(p.mp,mp-rank.mp);assert.equal(p.cd[id],rank.cooldown);g.target=null;
   if(id==='boxer_02'){assert.equal(p.statuses.find(s=>s.id==='push_resist')!.value,rank.params.pushResist/100);assert.equal(p.statuses.find(s=>s.id==='push_resist')!.remaining,rank.params.duration);}
   else{advance(g,.5);assert.equal(p.wisp!.hitsLeft,3);assert.equal(p.wisp!.until-g.time,6);advance(g,2);assert.equal(wispHits(g)[0].breakdown.base,rank.params.damage);}
  }
 }
});

test('stance cleanses one strongest Slow, leaves Root/Stun and DEF alone and rejects ally/stunned casts',()=>{
 const {g,p}=fixture(),stats={...p.stats};p.statuses=[{id:'slow',sourceId:'weak',remaining:8,value:.2},{id:'slow',sourceId:'strong',remaining:2,value:.8},{id:'root',sourceId:'root',remaining:5,value:1}];
 assert.equal(action(g,'boxer_02',p.id),false);assert(action(g,'boxer_02'));assert(p.statuses.some(s=>s.sourceId==='weak'));assert(!p.statuses.some(s=>s.sourceId==='strong'));assert(p.statuses.some(s=>s.id==='root'));assert.deepEqual(p.stats,stats);
 const f=fixture();f.p.statuses=[{id:'stun',sourceId:'stun',remaining:2,value:1}];const mp=f.p.mp;assert.equal(action(f.g,'boxer_02'),false);assert.equal(f.p.mp,mp);assert(f.p.statuses.some(s=>s.id==='stun'));
});

test('stance reduces actual crab displacement at every rank while walking speed remains unchanged',()=>{
 for(const rank of data.mastery.skills.find(s=>s.id==='boxer_02')!.ranks){
  const {g,p}=fixture();p.skills.boxer_02=rank.rank;assert(action(g,'boxer_02'));const e=spawn(g,1.4,4,false,'pink',false,'iron_pincer_crab');e.aggro=10;e.motion='attack';e.motionTime=0;e.cooldown=999;step(g,.05);
  assert(Math.abs(p.x-.05*(1-rank.params.pushResist/100))<1e-8);
 }
 const plain=fixture(),protectedPlayer=fixture();assert(action(protectedPlayer.g,'boxer_02'));advance(plain.g,.5);advance(protectedPlayer.g,.5);
 step(plain.g,.05,{x:1,z:0});step(protectedPlayer.g,.05,{x:1,z:0});assert.equal(protectedPlayer.p.x,plain.p.x);
});

test('Yokai and ocean pull controllers use the same bounded displacement resistance',()=>{
 for(const [id,key,part]of [['yokai_01','yokai',.22],['ocean_whirlpool_lanternfish','endgame',.25]] as const){
  const {g,p}=fixture();p.skills.boxer_02=5;assert(action(g,'boxer_02'));const e=spawn(g,2.4,4,false,'pink',true,id);e.cooldown=0;e.aggro=10;step(g,.05);
  const a=e[key]?.action;assert(a,id);const area:BossTelegraph={id:'fixture',nameTh:'fixture',x:p.x,z:p.z,radius:.35,shape:'circle',inner:0,angle:0,fx:1,fz:0,left:.01};
  a.left=.01;a.areas=[area];a.target={x:p.x,z:p.z};e.telegraph=area;p.invulnerable=0;const start=p.x,distance=e.x-start;
  step(g,.05);const expected=distance*(1-Math.pow(1-part*.65/distance,5));assert(Math.abs(p.x-start-expected)<1e-8,id);
 }
});

test('wisp waits for cast completion, hits at two/four/six seconds and spends resources only once',()=>{
 const {g,p}=fixture(),e=foe(g);g.target=e.id;const mp=p.mp;assert(action(g,'shaman_02'));g.target=null;assert.equal(p.wisp,undefined);advance(g,.45);assert.equal(p.wisp,undefined);advance(g,.05);assert(p.wisp);const id=g.players.get(p.id)!.wisp!.id;
 advance(g,1.95);assert.equal(wispHits(g).length,0);advance(g,.05);assert.equal(wispHits(g).length,1);advance(g,2);assert.equal(wispHits(g).length,2);advance(g,2);assert.equal(wispHits(g).length,3);assert.equal(p.wisp,undefined);
 assert.equal(p.mp,mp-18);assert(wispHits(g).every(v=>v.wispId===id&&v.petId===undefined));assert.equal(e.masteryDamage![p.id].Summoner,10000-e.hp);
 assert.equal(g.events.filter(v=>v.type==='wispEnd').length,1);
});

test('wisp is independent of the main pet, uses current MATK and suppresses owner hit passives/lifesteal',()=>{
 const {g,p}=fixture(),e=foe(g);assert(createSummon(g,p,1));const pet=p.summon!;assert(createWisp(g,p,1,e.id));assert.equal(p.summon,pet);assert(!combatTargets(g).some(t=>t.id===p.wisp!.id));
 p.skills.bloodlust=10;p.hp=100;p.stats.matk=200;const hp=p.hp;advance(g,2);assert.equal(wispHits(g)[0].breakdown.base,80);assert.equal(p.hp,hp);assert.equal(p.summon,pet);
});

test('wisp keeps its target, skips spent out-of-range hit slots and does not retarget after death',()=>{
 const {g,p}=fixture(),e=foe(g),other=spawn(g,4.2,4);other.hp=other.maxHp=10000;other.cooldown=999;assert(createWisp(g,p,1,e.id));
 e.x=20;advance(g,2);assert.equal(wispHits(g).length,0);assert.equal(p.wisp!.hitsLeft,2);e.x=4;advance(g,4);assert.equal(wispHits(g).length,2);assert.equal(other.hp,10000);assert.equal(p.wisp,undefined);
 assert(createWisp(g,p,1,e.id));e.dead=true;step(g,.05);assert.equal(p.wisp,undefined);assert.equal(other.hp,10000);
});

test('wisp cast interruption keeps spent cost and prior batch, while valid replacement keeps one batch',()=>{
 for(const invalid of ['stun','owner-death','target-death','range']){
  const {g,p}=fixture(),e=foe(g);assert(createWisp(g,p,1,e.id));const old=p.wisp;g.target=e.id;assert(action(g,'shaman_02'));g.target=null;const mp=p.mp;
  if(invalid==='stun')p.statuses.push({id:'stun',sourceId:'test',remaining:1,value:0});if(invalid==='owner-death')p.dead=true;if(invalid==='target-death'){e.dead=true;e.respawn=999;}if(invalid==='range')e.x=20;
  advance(g,.5);assert.equal(p.mp,mp);if(invalid==='stun'||invalid==='range')assert.equal(p.wisp,old,invalid);else assert.equal(p.wisp,undefined,invalid);
 }
 const {g,p}=fixture(),e=foe(g);assert(createWisp(g,p,1,e.id));const old=p.wisp;g.target=e.id;assert(action(g,'shaman_02'));g.target=null;advance(g,.5);assert.notEqual(p.wisp,old);assert.equal(g.events.filter(v=>v.type==='wispEnd'&&v.reason==='replaced').length,1);
});

test('wisp invalid owner/rank/map and encounter reset remove transient state; AUTO avoids live batch refresh',()=>{
 for(const invalid of ['rank','map','reset']){
  const {g,p}=fixture(),e=foe(g);assert(createWisp(g,p,1,e.id));if(invalid==='rank')delete p.skills.shaman_02;if(invalid==='map')p.mapId='forest';if(invalid==='reset')clearMasteryEncounter(g,e);step(g,.05);assert.equal(p.wisp,undefined,invalid);
 }
 const {g,p}=fixture(),e=foe(g);assert(createWisp(g,p,1,e.id));p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:['shaman_02'],off:Object.keys(p.skills).filter(s=>s!=='shaman_02')};const mp=p.mp;advance(g,.1);assert.equal(p.mp,mp);
});


test('wisp rejects invalid cast starts and cannot create a second player or bypass target/rank checks',()=>{
 for(const invalid of ['mp','cooldown','unlearned','range','target','ally']){
  const {g,p}=fixture(),e=foe(g);g.target=e.id;
  if(invalid==='mp')p.mp=0;if(invalid==='cooldown')p.cd.shaman_02=1;if(invalid==='unlearned')delete p.skills.shaman_02;if(invalid==='range')e.x=20;if(invalid==='target')g.enemies=[];
  const mp=p.mp;assert.equal(action(g,'shaman_02',invalid==='ally'?p.id:undefined),false,invalid);assert.equal(p.mp,mp);assert.equal(p.wisp,undefined);
 }
 const {g,p}=fixture(),e=foe(g);assert.equal(createWisp(g,{...p},1,e.id),false);assert.equal(createWisp(g,p,6,e.id),false);assert.equal(createWisp(g,p,1,999999),false);
});

test('actual wisp defeat grants one authoritative reward/training budget and ends its batch once',()=>{
 const {g,p}=fixture(),e=foe(g);e.hp=e.maxHp=1;const kills=g.kills;assert(createWisp(g,p,1,e.id));advance(g,2.05);
 assert(e.dead);assert.equal(g.kills,kills+1);assert(p.masteryExp.Summoner>0);assert.equal(p.wisp,undefined);assert.equal(g.events.filter(v=>v.type==='kill'&&v.id===e.id).length,1);assert.equal(g.events.filter(v=>v.type==='wispEnd').length,1);
});
