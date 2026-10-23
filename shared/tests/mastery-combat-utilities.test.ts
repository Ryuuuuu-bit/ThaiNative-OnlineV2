import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,monsterStats,addPlayer,DEFAULT_AUTO,createSummon} from '../src/index.node.js';
import {clearMasteryEncounter} from '../src/game/mastery-training.js';
const data=loadGameData();
function fixture(){
 const g=createGame(481,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Archer=25;p.masteries.Assassin=25;
 Object.assign(p.skills,{archer_01:1,archer_02:1,rogue_01:1,rogue_02:1,mage_01:1,shaman_01:1});
 p.x=0;p.z=4;p.stats.atk=61;p.stats.matk=100;p.stats.hit=1000;p.stats.crit=0;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=p.maxMp=200;
 const e=spawn(g,1,4);e.hp=e.maxHp=10000;e.cooldown=999;g.target=e.id;
 return {g,p,e};
}
function advance(g:ReturnType<typeof createGame>,seconds:number){for(let n=0;n<Math.round(seconds/.05);n++)step(g,.05);}
const hasCoat=(p:ReturnType<typeof fixture>['p'])=>p.statuses.some(s=>s.id==='poison_coat');
function shoot(f:ReturnType<typeof fixture>){f.p.cd.archer_01=0;assert(action(f.g,'archer_01'));}

test('mark and poison ranks retain accepted costs, duration/window, classless gates and hotbar validation',()=>{
 for(const id of ['archer_02','rogue_02'] as const){
  const school=id==='archer_02'?'Archer':'Assassin',root=id==='archer_02'?'archer_01':'rogue_01';
  let progress=newJob();progress.skillPoints=3;progress.masteries[school]=10;assert.throws(()=>learnSkill(progress,id,data));
  progress=learnSkill(learnSkill(progress,root,data),id,data);assert.equal(progress.skills[id],1);
  assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?id:null})),data)[0].skill,id);
  for(const rank of data.mastery.skills.find(s=>s.id===id)!.ranks){
   const f=fixture();f.p.skills[id]=rank.rank;f.p.stats.weaponType=id==='archer_02'?'bow':'staff';const mp=f.p.mp;
   const skill=resolveSkill(data,id,rank.rank);assert.equal(skill.kind,'utility');assert.equal(skill.sp,rank.mp);assert.equal(skill.cast,rank.cast);
   assert(action(f.g,id));assert.equal(f.p.mp,mp-rank.mp);assert.equal(f.p.cd[id],rank.cooldown);
   const status=f.p.statuses.find(s=>s.id===(id==='archer_02'?'archer_mark':'poison_coat'))!;
   assert.equal(status.remaining,rank.params.window??rank.params.duration);assert.equal(status.value,rank.params.hit??rank.params.poison);
   assert.equal(f.e.hp,10000);
  }
 }
});

test('mark modifies only its caster against the chosen enemy, without changing base stats or the HIT cap',()=>{
 const f=fixture(),{g,p,e}=f;p.stats.weaponType='bow';const other=spawn(g,5,4);other.hp=other.maxHp=10000;other.cooldown=999;
 const defender=monsterStats(data.monsters.monsters.find(s=>s.id===e.dataId)!,data);p.stats.hit=defender.flee-20;const original=p.stats.hit;
 assert(action(g,'archer_02'));g.random=()=>.65;shoot(f);assert(e.hp<10000);assert.equal(p.stats.hit,original);
 const own=g.events.filter(v=>v.type==='hit'&&v.skillId==='archer_01');assert(Math.abs(own[0].breakdown.hitChance-.7)<1e-8);
 p.whirlwindHits=[];g.target=other.id;shoot(f);assert.equal(other.hp,10000);assert.equal(g.events.at(-1)!.type,'miss');
 const peer=addPlayer(g,'peer');Object.assign(peer,newJob());peer.skills.archer_01=1;peer.x=0;peer.z=4;peer.stats.weaponType='bow';peer.stats.hit=original;peer.stats.crit=0;g.p=peer;g.target=e.id;
 assert(action(g,'archer_01'));assert.equal(g.events.at(-1)!.type,'miss');g.p=p;
 p.stats.hit=1000;g.target=e.id;g.random=()=>.99;p.whirlwindHits=[];shoot(f);assert.equal(g.events.at(-1)!.type,'miss');assert.equal(g.events.at(-1)!.breakdown.hitChance,.95);
});

test('mark validates bow/range/life, replaces its target, expires and cannot survive encounter reset',()=>{
 const f=fixture(),{g,p,e}=f;assert.equal(action(g,'archer_02'),false);p.stats.weaponType='bow';e.x=9;assert.equal(action(g,'archer_02'),false);e.x=1;
 assert(action(g,'archer_02'));const other=spawn(g,5,4);other.cooldown=999;g.target=other.id;p.cd.archer_02=0;assert(action(g,'archer_02'));
 assert.equal(p.statuses.filter(s=>s.id==='archer_mark').length,1);assert.equal(p.statuses.find(s=>s.id==='archer_mark')!.targetId,other.id);
 clearMasteryEncounter(g,other);assert(!p.statuses.some(s=>s.id==='archer_mark'));
 p.cd.archer_02=0;assert(action(g,'archer_02'));advance(g,6);assert(!p.statuses.some(s=>s.id==='archer_mark'));
});

test('coating accepts every held weapon, is consumed once across a multi-hit/multi-target direct attack and preserves exact total',()=>{
 for(const weapon of ['sword1h','sword2h','bow','staff','dagger','unarmed'] as const){
  const f=fixture(),{g,p,e}=f;p.stats.weaponType=weapon;assert(action(g,'rogue_02'));assert(action(g,'attack'));assert(!hasCoat(p));
  const hp=e.hp,credit=e.masteryDamage?.[p.id].Assassin??0;g.target=null;assert.equal(e.masteryPoisons!.length,1);advance(g,.95);assert.equal(e.hp,hp);advance(g,3.05);
  assert.equal(hp-e.hp,37,weapon);assert.equal(e.masteryPoisons!.length,0);
  const ticks=g.events.filter(v=>v.type==='hit'&&v.skillId==='rogue_02');assert.equal(ticks.length,4);assert.equal(ticks.reduce((sum,v)=>sum+v.damage,0),37);
  assert.equal(e.masteryDamage![p.id].Assassin!-credit,37);assert(ticks.every(v=>v.dot===true));
 }
 const f=fixture(),other=spawn(f.g,1.1,4);other.hp=other.maxHp=10000;other.cooldown=999;
 assert(action(f.g,'rogue_02'));assert(action(f.g,'attack'));assert.equal(f.e.masteryPoisons!.length,1);assert.equal(other.masteryPoisons,undefined);
 const h=fixture();h.p.stats.weaponType='bow';assert(action(h.g,'rogue_02'));shoot(h);advance(h.g,.2);
 assert.equal(h.g.events.filter(v=>v.type==='poisonApplied').length,1);
});

test('misses, magic, zero effective damage and autonomous pet hits cannot spend coating or create a proc chain',()=>{
 for(const reason of ['miss','magic','zero','pet']){
  const f=fixture(),{g,p,e}=f;assert(action(g,'rogue_02'));
  if(reason==='miss'){g.random=()=>.99;assert(action(g,'attack'));}
  if(reason==='magic'){assert(action(g,'mage_01'));advance(g,.55);}
  if(reason==='zero'){g.data={...g.data,elements:{...g.data.elements,table:{...g.data.elements.table,neutral:{...g.data.elements.table.neutral,neutral:0}}}};assert(action(g,'attack'));}
  if(reason==='pet'){p.cd.attack=999;p.target=e.id;assert(createSummon(g,p,1));advance(g,1.6);assert(g.events.some(v=>v.type==='hit'&&v.petId));}
  assert(hasCoat(p),reason);assert.equal(e.masteryPoisons?.length??0,0,reason);
 }
});

test('coating expires, replaces rather than stacks and AUTO avoids refreshing either active utility',()=>{
 for(const id of ['rogue_02','archer_02']){
  const f=fixture(),{g,p}=f;p.stats.weaponType='bow';assert(action(g,id));p.cd[id]=0;p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:[id],off:Object.keys(p.skills).filter(s=>s!==id)};const mp=p.mp;
  advance(g,.1);assert.equal(p.mp,mp);p.auto=false;p.cd[id]=0;assert(action(g,id));assert.equal(p.statuses.filter(s=>s.id===(id==='rogue_02'?'poison_coat':'archer_mark')).length,1);
  g.target=null;advance(g,6.1);assert(!p.statuses.some(s=>s.id===(id==='rogue_02'?'poison_coat':'archer_mark')));
 }
});

test('poison ends on owner death, removal, map/rank invalidation or encounter reset without stale damage',()=>{
 for(const invalid of ['dead','absent','map','rank','reset']){
  const f=fixture(),{g,p,e}=f;assert(action(g,'rogue_02'));assert(action(g,'attack'));g.target=null;const hp=e.hp;
  if(invalid==='dead')p.dead=true;if(invalid==='absent')g.players.delete(p.id);if(invalid==='map')p.mapId='forest';if(invalid==='rank')delete p.skills.rogue_02;if(invalid==='reset')clearMasteryEncounter(g,e);
  advance(g,1.1);assert.equal(e.hp,hp,invalid);assert.equal(e.masteryPoisons?.length??0,0,invalid);
 }
});

test('poison can defeat a monster through authoritative rewards and caps training to effective HP loss',()=>{
 const f=fixture(),{g,p,e}=f;p.stats.weaponType='staff';assert(action(g,'rogue_02'));assert(action(g,'attack'));
 g.target=null;e.hp=1;e.damageBy={};e.masteryDamage=undefined;const kills=g.kills;advance(g,1);
 assert(e.dead);assert.equal(g.kills,kills+1);assert.equal(e.damageBy[p.id],1);assert.equal(e.masteryPoisons!.length,0);
 assert.equal(g.events.filter(v=>v.type==='kill'&&v.id===e.id).length,1);
});


test('reapplying poison refreshes only its owner while a second caster keeps independent credit',()=>{
 const f=fixture(),{g,p,e}=f;assert(action(g,'rogue_02'));assert(action(g,'attack'));g.target=null;
 const other=addPlayer(g,'other');Object.assign(other,newJob());other.masteries.Assassin=10;other.skills.rogue_01=1;other.skills.rogue_02=1;
 other.x=0;other.z=4;other.stats.atk=20;other.stats.hit=1000;other.stats.crit=0;other.mp=100;g.p=other;
 assert(action(g,'rogue_02'));assert(action(g,'attack'));assert.equal(e.masteryPoisons!.length,2);
 g.p=p;p.cd.rogue_02=0;p.cd.attack=0;assert(action(g,'rogue_02'));assert(action(g,'attack'));
 assert.equal(e.masteryPoisons!.length,2);assert.equal(e.masteryPoisons!.filter(s=>s.owner===p.id).length,1);
 assert.equal(e.masteryPoisons!.find(s=>s.owner===other.id)!.damage,12);
});
