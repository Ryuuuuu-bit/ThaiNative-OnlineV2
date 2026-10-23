import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawn,setAuto,step,DEFAULT_AUTO,loadGameData} from '../src/index.node.js';
import {LAYOUTS} from '../src/game/maps.js';
const data=loadGameData(),dt=1/60;
const field=()=>{const g=createGame(8);g.enemies=[];g.p.x=0;g.p.z=4;return g;};
test('bow AUTO uses ranged basic attacks even with no MP and no enabled skills',()=>{
 const g=field();g.p.stats.weaponType='bow';g.p.skills={basic:1};g.p.hotbar=[];g.p.mp=0;g.p.autoCfg={...DEFAULT_AUTO,basic:true};
 const e=spawn(g,0,10);e.hp=e.maxHp=1e6;e.cooldown=e.wander=999;e.wx=e.x;e.wz=e.z;
 setAuto(g,true);step(g,dt);assert.equal(g.p.moving,false);assert.equal(g.p.x,0);assert.equal(g.p.z,4);assert(g.events.some(v=>v.type==='bowShot'));assert(e.hp<e.maxHp);
});
test('AUTO skips unreachable scouting targets outside hunt range and reaches the next one',()=>{
 const g=field();g.p.x=-50;g.p.z=20;
 const bad=spawn(g,-LAYOUTS.meadow.halfX-10,20),good=spawn(g,-30,-5);
 for(const e of g.enemies){e.cooldown=999;e.wander=999;e.wx=e.x;e.wz=e.z;e.hp=e.maxHp=1e6;}
 setAuto(g,true);step(g,dt);
 assert.ok((g.p.autoUnreachable?.[bad.id]??0)>g.time);
 for(let i=0;i<1800&&good.hp===good.maxHp;i++)step(g,dt);
 assert.ok(good.hp<good.maxHp);
});
test('with no monsters AUTO waits in place instead of walking to the map centre',()=>{
 const g=field(),start={x:g.p.x,z:g.p.z};setAuto(g,true);
 for(let i=0;i<120;i++)step(g,dt);
 assert.equal(g.p.autoState,'idle');assert.equal(g.p.moving,false);
 assert.deepEqual({x:g.p.x,z:g.p.z},start);assert.equal(g.destination,null);
});
test('AUTO repaths a stalled pursuit once, then temporarily skips that target',()=>{
 const g=field();const e=spawn(g,0,10);e.cooldown=e.wander=999;e.wx=e.x;e.wz=e.z;
 g.p.stats.moveSpeed=0;setAuto(g,true);
 for(let i=0;i<400;i++)step(g,dt);
 assert.ok((g.p.autoUnreachable?.[e.id]??0)>g.time);assert.equal(g.target,null);
});
test('a mage casts from spell range, waits there on cooldown, and falls back when SP is insufficient',()=>{
 const g=field();g.p.jobId='mage';g.p.skills={basic:1,fire_bolt:1};g.p.hotbar=[];g.p.mp=12;g.p.maxMp=100;g.p.stats.spRegen=0;
 const e=spawn(g,0,10);e.hp=e.maxHp=1e6;e.cooldown=e.wander=999;e.wx=e.x;e.wz=e.z;
 g.p.autoCfg={...DEFAULT_AUTO,off:[]};setAuto(g,true);step(g,dt);
 assert.ok(g.events.some(e=>e.type==='skill'&&e.skillId==='fire_bolt'),'casts without running into melee');
 assert.equal(g.p.x,0);assert.equal(g.p.z,4);
 g.p.castRemaining=0;g.p.mp=100;g.p.cd.fire_bolt=2;step(g,dt);
 assert.equal(g.p.moving,false,'holds spell range during cooldown');
 g.p.mp=0;g.p.stats.spRegen=0;step(g,dt);
 assert.equal(g.p.autoState,'seek');assert.equal(g.p.moving,true,'no affordable spell: move into basic attack range');
});
test('disabled or unlearned ranged skills do not make AUTO wait out of melee range',()=>{
 for(const learned of [false,true]){
  const g=field();g.p.jobId='mage';g.p.skills={basic:1,...(learned?{fire_bolt:1}:{})};g.p.hotbar=[];g.p.mp=100;
  g.p.autoCfg={...DEFAULT_AUTO,off:learned?['fire_bolt']:[]};spawn(g,0,10);
  setAuto(g,true);step(g,dt);assert.equal(g.p.moving,true);
 }
});
test('AUTO can cast a survival buff while retreating without a combat target',()=>{
 const g=field();g.p.hp=g.p.maxHp*.2;g.p.potions=0;g.p.skills={basic:1,endure:1};g.p.stats.hpRegen=0;
 setAuto(g,true);step(g,dt);
 assert.equal(g.p.autoState,'retreat');assert.ok(g.events.some(e=>e.type==='skill'&&e.skillId==='endure'));
});
