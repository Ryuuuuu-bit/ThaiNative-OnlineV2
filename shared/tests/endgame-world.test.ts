import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,loadGameData,LAYOUTS,MAP_ENTRY,FIELD_PLACES,FIELD_BOSS,walkable,type MapId} from '../src/index.node.js';
import {createPathfinder,pathSegmentWalkable} from '../src/game/pathfinding.js';
const regions=['dragon','volcano','fae','ocean','astral','abyss','confluence'] as const,data=loadGameData();
test('all seven endgame regions admit exactly their own52 species, own loot and safe natural habitat positions',()=>{
 const admitted=new Set<string>();
 for(const map of regions){const l=LAYOUTS[map];assert.equal(l.exploration,false,map);const g=createGame(2269,{...data.stats.defaultBuild,level:100},'hunter',data,map),natural=g.enemies.filter(e=>!e.summoned),ids=new Set(natural.map(e=>e.dataId));assert.equal(ids.size,map==='confluence'?4:8,map);
  for(const id of ids){assert.ok(!admitted.has(id),id+' duplicated between regions');admitted.add(id);const m=data.monsters.monsters.find(m=>m.id===id)!;assert.equal(m.tags[0],map);assert.ok(m.drops.some(d=>d.item==='card_'+id));assert.ok(m.drops.some(d=>d.item===id+'_material'));}
  assert.ok(natural.some(e=>e.dataId===FIELD_BOSS[map]!.dataId&&e.boss));for(const e of natural){assert.ok(walkable(e.x,e.z,.4,map),map+'/'+e.dataId+' blocked');assert.ok(l.camps.every(c=>Math.hypot(e.x-c.x,e.z-c.z)>6));}
 }assert.equal(admitted.size,52);
});
test('every endgame habitat, camp, landmark and boss arena has a continuous path from the public entrance',()=>{
 for(const map of regions){const l=LAYOUTS[map],clear=(x:number,z:number)=>walkable(x,z,.4,map),nav=createPathfinder(clear,l),points=[...FIELD_PLACES[map],...l.camps,l.arena!,...l.spawns];
  for(const p of points){assert.ok(clear(p.x,p.z),map+' blocked destination');const path=nav.findPath(MAP_ENTRY[map],p);assert.ok(path.length,map+' unreachable '+JSON.stringify(p));for(let i=1;i<path.length;i++)assert.ok(pathSegmentWalkable(path[i-1],path[i],clear));}
 }
});
