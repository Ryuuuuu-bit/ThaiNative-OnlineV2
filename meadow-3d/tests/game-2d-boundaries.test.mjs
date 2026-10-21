import test from 'node:test';
import assert from 'node:assert/strict';
import {LAYOUTS,GATES,CITY_SPAWN,MEADOW_ENTRY,FOREST_ENTRY,cityWalkable,meadowWalkable,forestWalkable} from '@the-beginning-online/shared/maps';
import {gridPath,gateApproach} from '../src/hud-path.ts';
import {boundaryRoads,boundaryPlants,outsideRoadClearance} from '../src/game-2d-boundaries.ts';
import {project2D,unproject2D} from '../src/game-2d-projection.ts';

test('2D projection round trips at map corners and outside the playable boundary',()=>{
 for(const x of [-160,-60,0,60,160])for(const z of [-130,-48,0,48,130]){
  const p=project2D(x,z),v=unproject2D(p.x,p.y);assert.ok(Math.abs(v.x-x)<1e-9&&Math.abs(v.z-z)<1e-9);
 }
});
test('minimap routes reach walkable positions within every gate activation radius',()=>{
 for(const [id,start,walk]of [['city_plaza',CITY_SPAWN,cityWalkable],['meadow',MEADOW_ENTRY,meadowWalkable],['forest',FOREST_ENTRY,forestWalkable]])for(const gate of Object.values(GATES[id])){
  const goal=gateApproach(gate),path=gridPath(start,goal,(x,z)=>walk(x,z,.3));assert.ok(path.length,`${id} has a route to its gate`);const last=path.at(-1);assert.ok(walk(last.x,last.z,.3));assert.ok(Math.hypot(last.x-gate.x,last.z-gate.z)<1.25,`${id} can trigger travel`);
 }
});
for(const id of ['city_plaza','meadow','forest'])test(`${id}: scenery surrounds every side without obstructing playable space or outward roads`,()=>{
 const l=LAYOUTS[id],roads=boundaryRoads(id),plants=boundaryPlants(id);
 assert.ok(plants.length>200);
 for(const p of plants){assert.ok(Math.abs(p.x)>=l.halfX+2||Math.abs(p.z)>=l.halfZ+2);assert.ok(outsideRoadClearance(p.x,p.z,roads));}
 for(const axis of ['x','z'])for(const side of [-1,1])assert.ok(plants.some(p=>p[axis]*side>(axis==='x'?l.halfX:l.halfZ)+20));
 for(const r of roads)for(const distance of [1,10,40])assert.equal(outsideRoadClearance(r.x+r.dx*distance,r.z+r.dz*distance,roads),false);
 assert.deepEqual(boundaryPlants(id),plants,'stable placement across loads');
});
