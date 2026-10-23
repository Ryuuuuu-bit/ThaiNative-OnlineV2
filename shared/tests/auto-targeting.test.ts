import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawn,addPlayer,setAuto,step,action,DEFAULT_AUTO,loadGameData,normalizeAuto,MAP_ENTRY} from '../src/index.node.js';
const data=loadGameData(),dt=1/30;
function field(){const g=createGame(29);g.enemies=[];g.p.x=0;g.p.z=4;return g;}

test('AUTO starts with the nearest monster despite old boss priority, attackers and a preselected far target',()=>{
 for(const range of ['mid','map'] as const){
  const g=field(),near=spawn(g,2,4),attacker=spawn(g,5,4),boss=spawn(g,0,-9,true);
  attacker.aggro=10;attacker.engaged=true;attacker.cooldown=999;
  g.p.autoCfg={...DEFAULT_AUTO,elites:true,range};g.target=boss.id;
  setAuto(g,true);step(g,dt);assert.equal(g.target,near.id);
 }
});
test('AUTO finishes its target before choosing the next nearest, even when a closer attacker and boss appear',()=>{
 const g=field(),first=spawn(g,1,4);g.p.god=true;g.p.skills={basic:1};g.p.stats.hit=10000;
 first.hp=first.maxHp=1e6;g.p.autoCfg={...DEFAULT_AUTO,elites:true};setAuto(g,true);step(g,dt);
 assert.equal(g.target,first.id);
 const closer=spawn(g,.4,4);closer.aggro=10;closer.engaged=true;closer.hp=closer.maxHp=1e6;
 const boss=spawn(g,0,-9,true);
 for(const e of g.enemies){e.cooldown=e.wander=999;e.wx=e.x;e.wz=e.z;}
 for(let i=0;i<30;i++){step(g,dt);assert.equal(g.target,first.id);}
 assert.ok(first.hp<first.maxHp);assert.equal(boss.hp,boss.maxHp);
 first.hp=1;
 for(let i=0;i<150&&!first.dead;i++)step(g,dt);
 assert.equal(first.dead,true);g.autoTimer=0;step(g,dt);assert.equal(g.target,closer.id);
});
test('AUTO retains a living target outside its acquisition radius and through dodge or dash skills',()=>{
 const g=field(),first=spawn(g,2,4);first.hp=first.maxHp=1e6;
 g.p.autoCfg={...DEFAULT_AUTO,range:'near'};setAuto(g,true);step(g,dt);
 first.z=12;first.cooldown=first.wander=999;first.wx=first.x;first.wz=first.z;
 spawn(g,1,4);g.autoTimer=0;step(g,dt);assert.equal(g.target,first.id);
 assert.equal(action(g,'dodge'),true);assert.equal(g.target,first.id);
 g.p.dash=0;g.p.skills.dash_strike=1;g.p.mp=100;
 assert.equal(action(g,'dash_strike'),true);assert.equal(g.target,first.id);
});
test('AUTO does not mistake a monster taunted by another player for its own attacker',()=>{
 const g=field(),ally=addPlayer(g,'ally');ally.x=4.2;ally.z=4;
 const near=spawn(g,1,4),other=spawn(g,4,4);
 other.aggro=10;other.engaged=true;other.cooldown=999;other.statuses=[{id:'taunt',sourceId:ally.id,remaining:10,value:1}];
 setAuto(g,true);step(g,dt);
 assert.equal(g.target,near.id);
});
test('AUTO skips the sealed Confluence boss and can select it after all pillars are destroyed',()=>{
 const g=createGame(29,{...data.stats.defaultBuild,level:100},'raid-auto',data,'confluence');g.p.god=true;
 g.p.autoCfg={...DEFAULT_AUTO,elites:true};const boss=g.enemies.find(e=>e.boss)!;
 setAuto(g,true);step(g,dt);
 assert.notEqual(g.target,boss.id,'hunt the pillars instead of hitting the sealed boss forever');
 assert.ok(g.autoGoal&&Math.hypot(g.autoGoal.x-boss.x,g.autoGoal.z-boss.z)>1);
 for(const e of g.enemies)if(!e.boss)e.dead=true;
 g.p.x=boss.x;g.p.z=boss.z-4;
 g.autoTimer=0;step(g,dt);assert.equal(g.target,boss.id);
});
test('removed monster filters cannot leave a newly authored map with no huntable species',()=>{
 const cfg=normalizeAuto({...DEFAULT_AUTO,mobs:{desert:['retired_desert_monster'],meadow:['retired_jelly','jelly_pink']}});
 assert.equal(cfg.mobs.desert,undefined);assert.deepEqual(cfg.mobs.meadow,['jelly_pink']);
 const g=createGame(29,{...data.stats.defaultBuild,level:100},'desert-auto',data,'desert');Object.assign(g.p,MAP_ENTRY.desert,{god:true});g.p.autoCfg=cfg;
 setAuto(g,true);step(g,dt);assert.equal(g.p.autoState,'seek');assert.ok(g.autoPath.length);
});
