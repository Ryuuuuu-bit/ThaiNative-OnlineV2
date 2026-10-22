import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {importTiledMap} from '../src/game/tiled-map.js';
import {MEADOW,MEADOW_ENTRY,MEADOW_PLACES,MEADOW_HABITATS,MEADOW_SPAWNS,LAYOUTS,GATES,FIELD_BOSS,FIELD_HABITATS,FIELD_PLACES,MAP_ENTRY,meadowWalkable,meadowHabitatAt,fieldHabitatAt,type FieldMapId} from '../src/game/maps.js';
import {walkable} from '../src/game/collision.js';
import generated from '../data/maps/meadow.generated.json' with {type:'json'};
// Tests run from shared/dist/tests after the shared build.
const source=()=>JSON.parse(readFileSync(new URL('../../../maps/south-meadow.tmj',import.meta.url),'utf8'));
test('Tiled source generates the exact geometry used by the shared game',()=>{
 const data=importTiledMap(source());assert.deepEqual(data,generated);
 assert.deepEqual(MEADOW,{halfX:56,halfZ:50});assert.deepEqual(MEADOW_ENTRY,data.entry);
 assert.deepEqual(LAYOUTS.meadow.paths,data.paths);assert.deepEqual(LAYOUTS.meadow.obstacles,data.obstacles);
 assert.deepEqual(GATES.meadow.north,{x:data.gates.north.x,z:data.gates.north.z});assert.equal(MEADOW_SPAWNS.length,42);
 for(const s of MEADOW_SPAWNS)assert.ok(meadowWalkable(s.x,s.z,.5));
});
test('Tiled importer converts ellipse centres and relative polylines without altering the source',()=>{
 const input=source(),before=structuredClone(input),data=importTiledMap(input);
 assert.deepEqual(input,before);assert.equal(data.water[0].x,28);assert.equal(data.water[0].z,-3);
 assert.equal(data.water[0].bridgeZ,-3);assert.deepEqual(data.paths[0].points[0],[0,-50]);
});
test('unsupported or ambiguous Tiled geometry fails instead of producing invisible collision',()=>{
 const mutate=(fn:(m:ReturnType<typeof source>)=>void)=>{const m=source();fn(m);assert.throws(()=>importTiledMap(m));};
 mutate(m=>m.layers[0].objects[0].rotation=15);
 mutate(m=>m.layers[0].offsetx=32);
 mutate(m=>m.layers[0].objects[0].polygon=[{x:0,y:0},{x:1,y:2}]);
 mutate(m=>m.layers[0].objects[0].polyline[1].x=Infinity);
 mutate(m=>m.layers[0].objects.push(m.layers[0].objects[0]));
 mutate(m=>m.layers.find((l:any)=>l.name.startsWith('03')).objects=m.layers.find((l:any)=>l.name.startsWith('03')).objects.filter((o:any)=>o.type!=='entry'));
 mutate(m=>m.layers[0].objects[0].properties.find((p:any)=>p.name==='pathWidth').value=-1);
});
test('both meadow loops, every camp, the bridge, POIs and the boss are reachable from the city gate',()=>{
 const queue=[{x:0,z:-46}],seen=new Set(['0,-46']);
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,key=`${x},${z}`;if(!seen.has(key)&&meadowWalkable(x,z,.4)){seen.add(key);queue.push({x,z});}}}
 for(const p of [...LAYOUTS.meadow.camps,...MEADOW_PLACES,...MEADOW_HABITATS,FIELD_BOSS.meadow,{x:18,z:-3},{x:38,z:-3},{x:-36,z:4},{x:40,z:-12}])assert.ok(seen.has(`${Math.round(p.x)},${Math.round(p.z)}`),`unreachable ${JSON.stringify(p)}`);
 assert.equal(meadowWalkable(28,-3,.4),true,'bridge can be crossed');assert.equal(meadowWalkable(28,0,.4),false,'water beside the bridge blocks movement');
 assert.equal(meadowWalkable(28,-1.5,.4),false,'the whole player footprint must fit on the bridge');
});
test('meadow separates jellies, lotus rabbits and elite beetles across its routes',()=>{
 const jelly=MEADOW_SPAWNS.filter(s=>s.dataId==='jelly_pink'),rabbit=MEADOW_SPAWNS.filter(s=>s.dataId==='lotus_rabbit'),beetle=MEADOW_SPAWNS.filter(s=>s.dataId==='dew_beetle');
 assert.equal(jelly.length,22);assert.equal(rabbit.length,16);assert.equal(beetle.length,4);
 assert.ok(jelly.every(s=>s.z<0));assert.ok(rabbit.every(s=>s.x<0));assert.ok(beetle.every(s=>s.x>37));
 assert.equal(meadowHabitatAt(-30,13)?.dataId,'lotus_rabbit');assert.equal(meadowHabitatAt(45,9)?.dataId,'dew_beetle');
 for(const p of MEADOW_SPAWNS)assert.ok(Math.hypot(p.x-MEADOW_ENTRY.x,p.z-MEADOW_ENTRY.z)>10);
});

for(const [map,file]of [['forest','east-forest'],['ruins','north-ruins'],['canyon','west-quarry']] as const){
 test(`${map}: authored Tiled data drives live scenery, gates and species counts`,()=>{
  const source=JSON.parse(readFileSync(new URL(`../../../maps/${file}.tmj`,import.meta.url),'utf8'));
  const data=importTiledMap(source),generated=JSON.parse(readFileSync(new URL(`../../data/maps/${map}.generated.json`,import.meta.url),'utf8'));
  assert.deepEqual(data,generated);assert.deepEqual(LAYOUTS[map].obstacles,data.obstacles);assert.deepEqual(LAYOUTS[map].paths,data.paths);
  assert.equal(LAYOUTS[map].spawns.length,data.spawnZones.reduce((n,h)=>n+h.count,0));
  for(const h of FIELD_HABITATS[map]){
   assert.equal(LAYOUTS[map].spawns.filter(s=>s.dataId===h.dataId).length,h.count);
   assert.equal(fieldHabitatAt(map,h.x,h.z)?.name,h.name);
  }
  for(const [direction,g]of Object.entries(data.gates))assert.deepEqual((GATES[map] as Record<string,{x:number;z:number}>)[direction],{x:g.x,z:g.z});
  for(const s of LAYOUTS[map].spawns){assert.ok(walkable(s.x,s.z,.5,map));assert.ok(Math.hypot(s.x-MAP_ENTRY[map].x,s.z-MAP_ENTRY[map].z)>7.9);}
 });
 test(`${map}: every habitat, sign, camp, landmark and boss has a connected walking route`,()=>{
  const entry=MAP_ENTRY[map],start={x:Math.round(entry.x),z:Math.round(entry.z)},queue=[start],seen=new Set([`${start.x},${start.z}`]);
  for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,z=p.z+dz,key=`${x},${z}`;if(!seen.has(key)&&walkable(x,z,.4,map)){seen.add(key);queue.push({x,z});}}}
  for(const p of [...LAYOUTS[map].camps,...FIELD_HABITATS[map],...FIELD_PLACES[map],FIELD_BOSS[map]])assert.ok(seen.has(`${Math.round(p.x)},${Math.round(p.z)}`),`unreachable ${map}: ${JSON.stringify(p)}`);
 });
}

test('moving an authored ruin wall moves both its artwork and all collision feet',()=>{
 const input=JSON.parse(readFileSync(new URL('../../../maps/north-ruins.tmj',import.meta.url),'utf8'));
 const wall=input.layers.flatMap((l:any)=>l.objects).find((o:any)=>o.type==='structure'&&o.name==='ruins-wall-x');
 const before=importTiledMap(input);wall.x+=32*2;wall.y+=32*3;const after=importTiledMap(input);
 assert.deepEqual(after.structures[0],{...before.structures[0],x:before.structures[0].x+2,z:before.structures[0].z+3});
 const feet=(data:ReturnType<typeof importTiledMap>)=>data.obstacles.filter(o=>o.kind==='ruins-foot').slice(0,5);
 for(const [i,p]of feet(after).entries()){assert.ok(Math.abs(p.x-feet(before)[i].x-2)<1e-10);assert.ok(Math.abs(p.z-feet(before)[i].z-3)<1e-10);assert.equal(p.r,feet(before)[i].r);}
});

test('Tiled authoring rejects gates that do not exist in the implemented world',()=>{
 const input=source(),gate=input.layers.flatMap((l:any)=>l.objects).find((o:any)=>o.type==='gate');
 gate.name='south';assert.throws(()=>importTiledMap(input),/connections/);
});
