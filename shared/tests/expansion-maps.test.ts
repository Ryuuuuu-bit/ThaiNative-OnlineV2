import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,loadGameData,huntList,step,action,buildForLevel} from '../src/index.node.js';
import {FIELD_HABITATS,FIELD_PLACES,FIELD_BOSS,LAYOUTS,GATES,MAP_ENTRY,travelDestination,gateRoute} from '../src/game/maps.js';
import {walkable} from '../src/game/collision.js';
import {createPathfinder} from '../src/game/pathfinding.js';
import {importTiledMap} from '../src/game/tiled-map.js';
const data=loadGameData();
for(const [map,levels] of [['grove',[31,33,35]],['summit',[36,38,40]]] as const){
 test(`${map}: Tiled geometry, spawn progression and every destination agree`,()=>{
  const source=JSON.parse(readFileSync(new URL(`../../../maps/${map}.tmj`,import.meta.url),'utf8'));
  const authored=importTiledMap(source),live=LAYOUTS[map];
  assert.deepEqual(live.paths,authored.paths);assert.deepEqual(live.water,authored.water);
  assert.equal(live.spawns.length,40);assert.deepEqual(huntList(map,data).map(m=>m.level).sort((a,b)=>a-b),[...levels]);
  const path=createPathfinder((x,z)=>walkable(x,z,.4,map),live),entry=MAP_ENTRY[map];
  const approaches=Object.values(GATES[map]).map(p=>({x:p.x-Math.sign(p.x),z:p.z-Math.sign(p.z)}));
  for(const p of [...live.camps,...FIELD_HABITATS[map],...FIELD_PLACES[map],FIELD_BOSS[map],...approaches]){
   assert.ok(walkable(p.x,p.z,.4,map),`blocked ${JSON.stringify(p)}`);
   assert.ok(path.findPath(entry,p).length,`no route ${JSON.stringify(p)}`);
  }
  for(const s of live.spawns){assert.ok(walkable(s.x,s.z,.5,map));assert.ok(Math.hypot(s.x-entry.x,s.z-entry.z)>8);}
  const g=createGame(73,undefined,'test',data,map);assert.equal(g.enemies.filter(m=>!m.boss).length,40);
  assert.equal(g.enemies.find(m=>m.boss)?.dataId,FIELD_BOSS[map].dataId);
 });
 test(`${map}: an appropriately equipped entry-level swordsman can defeat the first regular enemy`,()=>{
  const g=createGame(73,buildForLevel('swordsman',levels[0],data),'test',data,map);
  const id=FIELD_HABITATS[map][0].dataId,e=g.enemies.find(e=>e.dataId===id)!;
  g.enemies=[e];g.random=()=>.5;g.p.x=e.x;g.p.z=e.z+1.2;
  for(let i=0;i<2400&&!e.dead&&!g.p.dead;i++){action(g,'attack');step(g,.05);}
  assert.ok(e.dead,`${id} survives entry-level combat`);assert.equal(g.p.dead,false);
 });
}
test('western expansion gates round-trip and reject dead or remote requests',()=>{
 for(const [from,gate,to]of [['canyon','west','grove'],['grove','east','canyon'],['grove','west','summit'],['summit','east','grove']] as const){
  const p=(GATES[from] as Record<string,{x:number;z:number}>)[gate],dest=travelDestination(from,gate,p)!;
  assert.equal(dest.mapId,to);assert.ok(walkable(dest.x,dest.z,.4,to));
  assert.equal(travelDestination(from,gate,{...p,dead:true}),null);assert.equal(travelDestination(from,gate,{x:0,z:0}),null);
 }
 assert.deepEqual(gateRoute('city_plaza','summit'),[{map:'city_plaza',gate:'west'},{map:'canyon',gate:'west'},{map:'grove',gate:'west'}]);
});
