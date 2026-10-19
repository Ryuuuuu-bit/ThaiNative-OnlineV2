import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,spawn,setAuto,step,loadGameData,walkable,DEFAULT_AUTO} from '../src/index.node.js';
import {LAYOUTS,type MapId} from '../src/game/maps.js';
import {createPathfinder,pathSegmentWalkable} from '../src/game/pathfinding.js';
const data=loadGameData();
const dt=1/60;

// Hold enemies in place so successful pursuit must come from the player, not approaching AI.
function tickFixed(g:ReturnType<typeof createGame>,enemy:ReturnType<typeof spawn>,goal:{x:number;z:number}) {
 enemy.x=goal.x;enemy.z=goal.z;enemy.wx=goal.x;enemy.wz=goal.z;enemy.wander=100;enemy.cooldown=100;
 step(g,dt);
 assert.ok(walkable(g.p.x,g.p.z,.3,g.mapId),'player remains outside collision');
}

test('AUTO uses obstacle detours to reach stationary monsters in every field, across interleaved rooms',()=>{
 const scenarios=[];
 for(const mapId of ['meadow','forest','ruins','canyon'] as MapId[]) {
  const walk=(x:number,z:number)=>walkable(x,z,.4,mapId),nav=createPathfinder(walk,LAYOUTS[mapId]);
  let scenario;
  for(const o of LAYOUTS[mapId].obstacles) {
   const start={x:o.x-o.r-2,z:o.z},goal={x:o.x+o.r+2,z:o.z};
   if(!walk(start.x,start.z)||!walk(goal.x,goal.z)||pathSegmentWalkable(start,goal,walk))continue;
   if(!nav.findPath(start,goal).length)continue;
   const g=createGame(7,undefined,`auto-${mapId}`,data,mapId);g.enemies=[];g.p.x=start.x;g.p.z=start.z;
   g.p.autoCfg={...DEFAULT_AUTO,range:'far',elites:false};
   const enemy=spawn(g,goal.x,goal.z);enemy.hp=enemy.maxHp=1e6;setAuto(g,true);
   scenario={g,enemy,goal,mapId};break;
  }
  assert.ok(scenario,`${mapId}: requires a blocked pursuit fixture`);scenarios.push(scenario);
 }
 for(let i=0;i<1800;i++)for(const s of scenarios)if(s.enemy.hp===s.enemy.maxHp)tickFixed(s.g,s.enemy,s.goal);
 for(const s of scenarios)assert.ok(s.enemy.hp<s.enemy.maxHp,`${s.mapId}: AUTO reaches and attacks around the obstacle`);
});

test('AUTO recalculates its route when a pursued monster moves to the other side',()=>{
 const g=createGame(7);g.enemies=[];g.p.x=3;g.p.z=3;
 const enemy=spawn(g,7,3);enemy.hp=enemy.maxHp=1e6;g.p.autoCfg={...DEFAULT_AUTO,range:'far'};setAuto(g,true);
 for(let i=0;i<12;i++)tickFixed(g,enemy,{x:7,z:3});
 const previous={...g.autoGoal!},goal={x:0,z:4};
 for(let i=0;i<600&&enemy.hp===enemy.maxHp;i++)tickFixed(g,enemy,goal);
 assert.ok(enemy.hp<enemy.maxHp,'reaches the moved target');
 assert.ok(Math.hypot(g.autoGoal!.x-previous.x,g.autoGoal!.z-previous.z)>.65,'route goal was refreshed');
});

test('AUTO skips an unreachable monster and resumes hunting a reachable one',()=>{
 const g=createGame(8);g.enemies=[];g.p.x=0;g.p.z=4;
 const blocked=spawn(g,LAYOUTS.meadow.halfX+10,0,true),near=spawn(g,3,4);
 blocked.hp=blocked.maxHp=1e6;near.hp=near.maxHp=1e6;setAuto(g,true);
 step(g,dt);
 assert.ok((g.p.autoUnreachable?.[blocked.id]??0)>g.time,'unreachable boss is temporarily skipped');
 for(let i=0;i<600&&near.hp===near.maxHp;i++)tickFixed(g,near,{x:3,z:4});
 assert.ok(near.hp<near.maxHp,'reachable target is attacked');
});
