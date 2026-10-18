import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,step,setAuto,huntList,setBossTimer,bossTimer} from '../src/index.node.js';
import {LAYOUTS,MAP_ENTRY,FIELD_BOSS,GATES,travelDestination} from '../src/game/maps.js';
import {walkable} from '../src/game/collision.js';
const data=loadGameData();
for(const map of ['ruins','canyon'] as const){
 test(`${map}: population, progression and reachable destinations`,()=>{
  const g=createGame(7,undefined,'test',data,map),l=LAYOUTS[map];
  assert.equal(g.enemies.filter(e=>!e.boss).length,54);
  assert.equal(g.enemies.find(e=>e.boss)?.dataId,FIELD_BOSS[map].dataId);
  const list=huntList(map,data);assert.equal(list.length,5);
  for(const m of list)assert.ok(m.level>=(map==='ruins'?16:23)&&m.level<=(map==='ruins'?22:30));
  for(const e of g.enemies)assert.ok(walkable(e.x,e.z,.4,map),e.dataId);
  for(const s of l.spawns)for(const c of l.camps)assert.ok(Math.hypot(s.x-c.x,s.z-c.z)>6.8);
  // Flood the collision grid: camps, boss and both gate approaches must be connected.
  const start=MAP_ENTRY[map],queue=[start],seen=new Set([`${start.x},${start.z}`]);
  for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,k=`${x},${z}`;if(!seen.has(k)&&walkable(x,z,.4,map)){seen.add(k);queue.push({x,z});}}}
  for(const p of [...l.camps,FIELD_BOSS[map],...Object.values(GATES[map]).map(p=>({x:p.x>0?p.x-1:p.x+1,z:p.z}))])assert.ok(seen.has(`${Math.round(p.x)},${Math.round(p.z)}`),`unreachable ${p.x},${p.z}`);
  setAuto(g,true);assert.equal(g.p.auto,true);step(g,.05);
 });
 test(`${map}: restored boss timer respawns correct boss`,()=>{const g=createGame(1,undefined,'test',data,map);setBossTimer(g,1);assert.ok(g.enemies.find(e=>e.boss)!.dead);step(g,.5);step(g,.6);assert.equal(bossTimer(g),0);assert.equal(g.enemies.find(e=>e.boss)!.dead,false);});
}
test('new hunting route travels both ways and rejects remote/dead requests',()=>{
 for(const [map,gate,dest] of [['forest','east','ruins'],['ruins','west','forest'],['ruins','east','canyon'],['canyon','west','ruins']] as const){const p=(GATES[map] as Record<string,{x:number;z:number}>)[gate],arrival=travelDestination(map,gate,p)!;assert.equal(arrival.mapId,dest);assert.ok(walkable(arrival.x,arrival.z,.4,arrival.mapId));assert.equal(travelDestination(map,gate,{x:0,z:0}),null);assert.equal(travelDestination(map,gate,{...p,dead:true}),null);}
});
