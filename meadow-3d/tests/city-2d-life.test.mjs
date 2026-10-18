import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityLife} from '../src/city-2d-life.ts';
import {city2dWalkable,route,TOUR_STOPS,NEW_BUILDINGS,CITY2D_FOUNTAIN} from '../src/city-2d-layout.ts';

test('new buildings and relocated fountain block movement',()=>{
 for(const b of NEW_BUILDINGS)assert.equal(city2dWalkable(b.x,b.z,.3),false,b.kind);
 assert.equal(city2dWalkable(CITY2D_FOUNTAIN.x,CITY2D_FOUNTAIN.z,.3),false);
 assert.equal(city2dWalkable(-14,14,.38),true,'old fountain position is now walkable');
});
test('all six districts remain connected to the arrival plaza',()=>{
 for(const d of TOUR_STOPS){const path=route({x:0,z:14},d);assert.ok(path.length>0,d.name);for(const p of path)assert.ok(city2dWalkable(p.x,p.z,.38),d.name);}
});
test('40 citizens traverse the city for five minutes without entering solids',()=>{
 const life=createCityLife(),moved=new Set(),start=life.citizens.map(n=>[n.x,n.z]);assert.equal(life.citizens.length,40);
 for(let frame=0;frame<6000;frame++){
  life.step(.05);
  for(const n of life.citizens){assert.ok(city2dWalkable(n.x,n.z,.29),`citizen ${n.id} in ${n.role} at ${n.x},${n.z}`);if(Math.hypot(n.x-start[n.id][0],n.z-start[n.id][1])>3)moved.add(n.id);}
 }
 assert.equal(moved.size,40,'each resident must be able to leave their spawn');
});
