import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameData,createGame,expShares,grantExp,monsterExpMultiplier,CharacterSchema,canEnterConfluence,CONFLUENCE_ACCESS_QUEST,spawn,action,step} from '../src/index.node.js';
const data=loadGameData();
test('Lv100 world raid requires the completed invitation and accepts a real zero timestamp',()=>{
 assert.equal(canEnterConfluence({level:99,quests:{done:{[CONFLUENCE_ACCESS_QUEST]:1}}}),false);
 assert.equal(canEnterConfluence({level:100}),false);assert.equal(canEnterConfluence({level:100,quests:{done:{}}}),false);
 assert.equal(canEnterConfluence({level:100,quests:{done:{[CONFLUENCE_ACCESS_QUEST]:0}}}),true);
});
test('level gap is symmetric, smooth at the boundary, and applies to both EXP tracks',()=>{
 for(let gap=0;gap<=15;gap++){
  assert.equal(monsterExpMultiplier(50,50+gap),monsterExpMultiplier(50,50-gap));
  assert.equal(monsterExpMultiplier(50,50+gap),gap<=5?1:[.7,.5,.3,.15,.05][gap-6]??0);
 }
});
test('monster EXP locks recipients and levels at defeat; excludes late joins, dead and offline peers',()=>{
 const g=createGame(),a=g.p,b=Object.assign(createGame().p,{id:'peer'}),late=Object.assign(createGame().p,{id:'late'});g.players.set(b.id,b);g.players.set(late.id,late);
 const source={level:60,ownerLevel:60,recipients:[{id:a.id,level:60},{id:b.id,level:66},{id:'offline',level:60}]};
 g.partyMembers=()=>[a.id,b.id,late.id];a.level=70;
 const shares=expShares(g,a,1000,500,source);
 assert.deepEqual(shares.map(s=>[s.player.id,s.xp,s.jobExp]),[[a.id,400,200],[b.id,280,140]]);
 b.dead=true;assert.deepEqual(expShares(g,a,1000,500,source).map(s=>s.player.id),[a.id]);
 assert.deepEqual(expShares(g,late,1000,500,{...source,ownerLevel:100}).map(s=>s.xp),[0]);
});
test('Lv100 validates, final level grants points once and cannot accumulate unbounded base EXP',()=>{
 assert.equal(data.stats.maxLevel,100);assert.equal(data.stats.expToNext.length,100);assert.equal(data.stats.maxStat,99);
 assert.ok(CharacterSchema.safeParse({...data.stats.defaultBuild,level:100}).success);
 assert.equal(CharacterSchema.safeParse({...data.stats.defaultBuild,level:101}).success,false);
 const g=createGame(),p=g.p;p.level=99;p.xp=0;p.nextXp=data.stats.expToNext[98];const points=p.statPoints;p.autoAllocate=false;
 grantExp(g,p,p.nextXp,0);assert.equal(p.level,100);assert.equal(p.xp,0);assert.equal(p.statPoints,points+data.stats.pointsPerLevel);
 grantExp(g,p,1e9,0);assert.equal(p.level,100);assert.equal(p.xp,0);
});
test('regular same-level hunting remains bounded through Lv99',()=>{
 for(const m of data.monsters.monsters.filter(m=>m.level>10&&!m.boss&&!m.tags.includes('hazard'))){
  const kills=data.stats.expToNext[m.level-1]/m.exp;
  assert.ok(kills<200,`${m.id}: ${kills} kills`);
 }
});


test('a disconnected high-level damage owner cannot launder a low-level finisher EXP',()=>{
 const g=createGame(2269,{...data.stats.defaultBuild,level:60},'finisher',data,'desert');g.enemies=[];const p=g.p;p.god=true;p.stats.hit=10000;p.stats.atk=100000;g.random=()=>0;
 const e=spawn(g,p.x,p.z+1,false,'pink',false,'desert_01');e.hp=1;e.maxHp=1000000;e.damageBy={offline:900000};e.damageLevels={offline:100};
 p.target=e.id;assert.ok(action(g,'attack'));assert.ok(e.dead);assert.equal(e.rewardSource!.ownerLevel,100);
 for(let i=0;i<50;i++)step(g,.05);const drop=g.drops.find(d=>d.source);assert.ok(drop);assert.equal(drop.source!.ownerLevel,100);
 const shares=expShares(g,p,1000,500,{...drop.source!,recipients:[{id:p.id,level:60}]});assert.equal(shares[0].xp,0);assert.equal(shares[0].jobExp,0);
});
