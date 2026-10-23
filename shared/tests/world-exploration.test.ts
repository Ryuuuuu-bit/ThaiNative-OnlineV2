import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAYOUTS,MAP_IDS,BIOME_IDS,EXPLORATION_IDS,MAP_ENTRY,FIELD_PLACES,FIELD_BOSS,GATES,GATE_LINKS,travelDestination,gateRoute,isField,type MapId,type FieldMapId} from '../src/game/maps.js';
import {walkable} from '../src/game/collision.js';
import {createPathfinder,pathSegmentWalkable} from '../src/game/pathfinding.js';
import {IntentSchema} from '../src/game/protocol.js';
import {createGame,loadGameData,step,huntList} from '../src/index.node.js';
import {importTiledMap} from '../src/game/tiled-map.js';

test('Every regional scene retains exactly one real landmark collider, outside any active boss arena',()=>{for(const id of BIOME_IDS){const l=LAYOUTS[id],landmarks=l.obstacles.filter(o=>o.kind==='biome-landmark');assert.equal(landmarks.length,1,id+' requires its authored landmark');if(!l.exploration)assert.ok(Math.hypot(landmarks[0].x-l.arena!.x,landmarks[0].z-l.arena!.z)>l.arena!.r+landmarks[0].r+.4,id+' landmark intrudes into boss combat space');}});

test('Every world gate has a reachable reverse exit, rejects remote/dead travel and connects to the city',()=>{
 for(const map of MAP_IDS){
  const clear=(x:number,z:number)=>walkable(x,z,.4,map),nav=createPathfinder(clear,LAYOUTS[map]);
  if(map!=='city_plaza')assert.ok(gateRoute('city_plaza',map).length,map+' is disconnected');
  for(const [gate,to]of Object.entries(GATE_LINKS[map])){
   assert.ok(MAP_IDS.includes(to));const trigger=GATES[map][gate],destination=travelDestination(map,gate,trigger)!;
   assert.equal(destination.mapId,to);assert.ok(walkable(destination.x,destination.z,.4,to),`${map}/${gate} arrival blocked`);
   const approach={x:trigger.x+(gate==='west'?2:gate==='east'?-2:0),z:trigger.z+(gate==='north'?2:gate==='south'?-2:0)};
   assert.ok(clear(approach.x,approach.z),`${map}/${gate} approach blocked`);
   assert.ok(nav.findPath(MAP_ENTRY[map],approach).length,`${map}/${gate} approach unreachable`);
   assert.equal(travelDestination(map,gate,{x:0,z:0}),null);assert.equal(travelDestination(map,gate,{...trigger,dead:true}),null);
   assert.ok(Object.values(GATE_LINKS[to]).includes(map));
  }
 }
});
test('Remaining exploration maps load their own Tiled geometry without borrowing monsters or rewards',()=>{
 const data=loadGameData();
 for(const map of (EXPLORATION_IDS as readonly FieldMapId[])){
  const source=JSON.parse(readFileSync(new URL('../../../maps/'+map+'.tmj',import.meta.url),'utf8')),imported=importTiledMap(source),layout=LAYOUTS[map];
  assert.equal(imported.id,map);assert.equal(layout.exploration,true);assert.deepEqual(imported.paths,layout.paths);assert.deepEqual(imported.water,layout.water);assert.deepEqual(imported.obstacles,layout.obstacles);
  assert.ok(isField(map));assert.equal(FIELD_BOSS[map],undefined);assert.equal(huntList(map,data).length,0);
  assert.ok(IntentSchema.safeParse({t:'move',x:0,z:0,mapId:map,seq:1}).success,map+' network map validation');
  const g=createGame(59,undefined,'explorer',data,map);assert.equal(g.enemies.length,0);for(let i=0;i<100;i++)step(g,.1);assert.equal(g.p.dead,false);
 }
});
test('Exploration camps, landmarks and future arena have continuous collision-safe paths',()=>{
 for(const map of (EXPLORATION_IDS as readonly FieldMapId[])){
  const l=LAYOUTS[map],clear=(x:number,z:number)=>walkable(x,z,.4,map),nav=createPathfinder(clear,l);
  for(const p of [...FIELD_PLACES[map],...l.camps,l.arena!]){
   assert.ok(clear(p.x,p.z),map+' blocked '+JSON.stringify(p));const path=nav.findPath(MAP_ENTRY[map],p);assert.ok(path.length,map+' unreachable '+JSON.stringify(p));
   for(let i=1;i<path.length;i++)assert.ok(pathSegmentWalkable(path[i-1],path[i],clear));
  }
 }
});
