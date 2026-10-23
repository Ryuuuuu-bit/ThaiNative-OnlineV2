import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawn,addPlayer,setAuto,step,DEFAULT_AUTO,loadGameData,normalizeAuto,MAP_ENTRY} from '../src/index.node.js';
const data=loadGameData(),dt=1/30;
function field(){const g=createGame(29);g.enemies=[];g.p.x=0;g.p.z=4;return g;}

test('AUTO interrupts a distant target to defend against a monster attacking this player',()=>{
 const g=field(),far=spawn(g,7,4),attacker=spawn(g,1,4);
 attacker.aggro=10;attacker.engaged=true;attacker.cooldown=999;
 setAuto(g,true);g.target=far.id;step(g,dt);
 assert.equal(g.target,attacker.id);
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
 g.autoTimer=0;step(g,dt);assert.equal(g.target,boss.id);
});
test('removed monster filters cannot leave a newly authored map with no huntable species',()=>{
 const cfg=normalizeAuto({...DEFAULT_AUTO,mobs:{desert:['retired_desert_monster'],meadow:['retired_jelly','jelly_pink']}});
 assert.equal(cfg.mobs.desert,undefined);assert.deepEqual(cfg.mobs.meadow,['jelly_pink']);
 const g=createGame(29,{...data.stats.defaultBuild,level:100},'desert-auto',data,'desert');Object.assign(g.p,MAP_ENTRY.desert,{god:true});g.p.autoCfg=cfg;
 setAuto(g,true);step(g,dt);assert.equal(g.p.autoState,'seek');assert.ok(g.autoPath.length);
});
