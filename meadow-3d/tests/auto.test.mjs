import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawn,step,setAuto,moveTo,action,revive,nearestCamp,walkable,OBSTACLES,DEFAULT_AUTO} from '@the-beginning-online/shared';
const tick=(g,seconds=1/60)=>{for(let t=0;t<seconds-1e-8;t+=1/60)step(g,1/60);};
function field(){const g=createGame();g.random=()=>.5;g.enemies=[];g.p.x=0;g.p.z=4;return g;}
test('AUTO selects nearest, preserves clicked preference, then prioritises living King once bosses are enabled',()=>{
 const g=field(),near=spawn(g,1,4),far=spawn(g,5,4);setAuto(g,true);tick(g);assert.equal(g.target,near.id);
 g.target=far.id;tick(g,.2);assert.equal(g.target,far.id);
 const boss=spawn(g,1,-9,true);g.bossSpawned=true;tick(g,.2);assert.equal(g.target,far.id,'untouched settings ignore a boss outside the hunt range');
 g.p.autoCfg={...DEFAULT_AUTO,elites:true};tick(g,.2);assert.equal(g.target,boss.id);
});
test('untouched AUTO hunts the nearest monster, not the boss across the map',()=>{
 const g=createGame();const first=g.enemies.filter(e=>!e.boss).sort((a,b)=>Math.hypot(a.x-g.p.x,a.z-g.p.z)-Math.hypot(b.x-g.p.x,b.z-g.p.z))[0];
 // Start inside a hunting area; the Tiled meadow deliberately leaves its arrival road clear.
 g.p.x=first.x;g.p.z=first.z;setAuto(g,true);tick(g,.1);const t=g.enemies.find(e=>e.id===g.target);assert.ok(t&&!t.boss);
 const nearest=g.enemies.filter(e=>!e.dead&&!e.boss).sort((a,b)=>Math.hypot(a.x-g.p.x,a.z-g.p.z)-Math.hypot(b.x-g.p.x,b.z-g.p.z))[0];assert.equal(t.id,nearest.id);
});
test('AUTO seeks then fights inside the combo reach',()=>{
 const g=field(),e=spawn(g,3,4);e.wander=100;e.wx=e.x;e.wz=e.z;setAuto(g,true);tick(g);assert.equal(g.p.autoState,'seek');tick(g,1);
 assert.ok(e.hp<e.maxHp);assert.ok(g.events.some(e=>e.type==='slash'));
});
test('AUTO Q requires two nearby enemies and sufficient MP; F requires boss or cluster',()=>{
 const cast=(g,id)=>g.events.some(e=>e.type==='skill'&&e.skillId===id);
 // First decision only: Q needs 2 in reach, F needs 3 (or a boss); SP is checked.
 for(const [count,mp,spin,meteor]of[[1,80,false,false],[2,14,false,false],[2,15,true,false],[2,80,true,false]]){
  const g=field();for(let i=0;i<count;i++)spawn(g,.6+i*.2,4);g.p.mp=mp;setAuto(g,true);tick(g);
  assert.equal(cast(g,'whirlwind'),spin,`${count}/${mp} Q`);assert.equal(cast(g,'earth_break'),meteor,`${count}/${mp} F`);
 }
 // A cluster of 3 qualifies both; AUTO follows the player's cycle, so both land within a few decisions.
 {const g=field();for(let i=0;i<3;i++)spawn(g,.6+i*.2,4).hp=1e5;g.p.mp=80;setAuto(g,true);tick(g,1);assert.ok(cast(g,'whirlwind')&&cast(g,'earth_break'));}
 // A single boss is always worth the area skills.
 const g=field();spawn(g,1,4,true);setAuto(g,true);tick(g,1);assert.ok(cast(g,'earth_break'));
});
test('AUTO potions use strict 45% threshold and obey cooldown',()=>{
 const g=field();g.p.hp=g.p.maxHp*.45;setAuto(g,true);tick(g);assert.equal(g.p.potions,5);
 g.p.hp=g.p.maxHp*.45-1;tick(g,.2);assert.equal(g.p.potions,4);g.p.hp=20;tick(g,.2);assert.equal(g.p.potions,4);
});
test('AUTO retreats below 25%, heals at camp until 90%, and fights followers',()=>{
 const g=field();g.p.potions=0;g.p.hp=20;setAuto(g,true);tick(g);assert.equal(g.p.autoState,'retreat');
 const camp=nearestCamp('meadow',g.p.x,g.p.z);tick(g,9);assert.ok(Math.hypot(g.p.x-camp.x,g.p.z-camp.z)<2);assert.equal(g.p.autoState,'retreat');
 const follower=spawn(g,g.p.x+.5,g.p.z);tick(g,.2);assert.ok(follower.hp<follower.maxHp);
 g.enemies=[];g.p.hp=g.p.maxHp*.89;g.autoTimer=0;tick(g);assert.equal(g.p.autoState,'retreat');
 tick(g,.5);assert.notEqual(g.p.autoState,'retreat');
});
test('AUTO dodges a slam 0.15 seconds before impact and evades damage',()=>{
 const g=field(),e=spawn(g,0,2,true);setAuto(g,true);e.engaged=true;e.motion='slam';e.motionTime=.71;e.motionDuration=1.3;e.aimX=0;e.aimZ=4;e.startX=0;e.startZ=2;e.windup=.14;
 tick(g);assert.ok(g.p.dash>0);tick(g,.2);assert.equal(g.p.hp,g.p.maxHp);assert.ok(g.events.some(e=>e.type==='evade'));
});
test('AUTO reacts once at start of aimed charge with lateral escape',()=>{
 const g=field(),e=spawn(g,0,0,true);setAuto(g,true);e.engaged=true;e.motion='charge';e.motionTime=0;e.motionDuration=1.4;e.startX=0;e.startZ=0;e.aimX=0;e.aimZ=6;e.fx=0;e.fz=1;e.patternIndex=3;
 tick(g);assert.ok(g.p.dash>0);assert.ok(Math.abs(g.p.fx)>.9);tick(g,1);assert.equal(g.events.filter(e=>e.type==='dash').length,1);
});
test('manual movement/ground commands cancel; skills do not; death and revive stay off',()=>{
 const g=field();setAuto(g,true);action(g,'spin');assert.equal(g.p.auto,true);step(g,1/60,{x:1,z:0});assert.equal(g.p.auto,false);
 setAuto(g,true);moveTo(g,3,3);assert.equal(g.p.auto,false);assert.deepEqual(g.destination,{x:3,z:3});
 setAuto(g,true);g.p.hp=1;g.p.cd.potion=10;g.projectiles.push({id:90,owner:1,x:g.p.x,z:g.p.z,vx:0,vz:0,life:1,damage:99,phase:1});tick(g);assert.equal(g.p.dead,true);assert.equal(g.p.auto,false);revive(g);assert.equal(g.p.auto,false);
});
test('AUTO routes around a blocking rock and waits idle without targets',()=>{
 const g=field();g.p.x=3;g.p.z=3;const e=spawn(g,7,3);e.wander=100;e.wx=7;e.wz=3;setAuto(g,true);tick(g,4);assert.ok(e.hp<e.maxHp);
 assert.ok(walkable(g.p.x,g.p.z));g.enemies=[];tick(g,8);assert.equal(g.p.autoState,'idle');assert.equal(g.p.moving,false);
});
test('deterministic AUTO hunt with bosses enabled unlocks and engages King without steering',()=>{
 const g=createGame();g.p.autoCfg={...DEFAULT_AUTO,elites:true};setAuto(g,true);tick(g,60);assert.ok(g.kills>=6);assert.ok(g.enemies.some(e=>e.boss&&e.engaged));assert.equal(g.p.dead,false);
});
// A boulder with open ground on its west side, so the test does not depend on the generated layout.
const rock=OBSTACLES.find(o=>o.kind==='boulder'&&[...Array(8)].every((_,i)=>walkable(o.x-o.r-.6-i*.4,o.z,.4)&&walkable(o.x+o.r+.5,o.z,.3)));
test('AUTO reaches a jelly standing between collision and route clearances beside a rock',()=>{
 const g=field();g.p.x=rock.x-rock.r-3;g.p.z=rock.z;const e=spawn(g,rock.x+rock.r+.35,rock.z);e.wander=100;e.wx=e.x;e.wz=e.z;
 assert.equal(walkable(e.x,e.z),true);assert.equal(walkable(e.x,e.z,.4),false);
 setAuto(g,true);tick(g,4);assert.ok(e.hp<e.maxHp);
});
