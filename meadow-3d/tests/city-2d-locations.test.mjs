import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {city2dWalkable,route,FORTIFICATION_SOLIDS} from '../src/city-2d-layout.ts';
import {TOWN_NPCS,WAYPOINTS,CITY_EXITS,nearbyWaypoint,nearbyExit,waypointArrival} from '../src/city-2d-locations.ts';

test('all town NPCs have a valid art region and stand outside solids',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/city-painted-v1/manifest.json',import.meta.url)));
 const art=[...manifest.npcs.assets,...manifest.residents.assets];
 assert.equal(new Set(TOWN_NPCS.map(n=>n.art)).size,12);
 assert.equal(new Set(TOWN_NPCS.map(n=>n.id)).size,TOWN_NPCS.length);
 for(const n of TOWN_NPCS){assert.ok(art.some(a=>a.id===n.art),n.id);assert.ok(city2dWalkable(n.x,n.z,.3),n.id);assert.ok(route({x:0,z:14},n).length,n.id);}
});
test('every waypoint and its landing are connected and walkable',()=>{
 for(const p of WAYPOINTS){
   const dest=waypointArrival(p.id);assert.ok(dest);
   assert.ok(city2dWalkable(p.x,p.z,.5),p.id);
   assert.ok(city2dWalkable(dest.x,dest.z,.5),p.id);
   assert.ok(route({x:0,z:14},dest).length,p.id);
   assert.equal(nearbyWaypoint(p.x,p.z)?.id,p.id);
 }
 assert.equal(waypointArrival('missing'),undefined);
 assert.equal(nearbyWaypoint(0,14),undefined);
});
test('gate towers block movement but all four approach corridors stay open',()=>{
 assert.equal(CITY_EXITS.length,4);
 for(const p of FORTIFICATION_SOLIDS)assert.equal(city2dWalkable(p.x,p.z,.38),false);
 for(const gate of CITY_EXITS){assert.equal(nearbyExit(gate.x,gate.z)?.id,gate.id);assert.ok(route({x:0,z:14},gate).length);}
 for(let v=40;v<=46;v+=.25)for(const sign of [-1,1]){assert.ok(city2dWalkable(0,v*sign,.38),'north/south corridor');assert.ok(city2dWalkable(v*sign,0,.38),'east/west corridor');}
 assert.equal(city2dWalkable(-5,46,.38),false,'south tower inner edge');
 assert.equal(city2dWalkable(46,5,.38),false,'east tower inner edge');
});
