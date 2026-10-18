import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityExplorer,project,unproject} from '../src/city-2d-sim.ts';
import {cityWalkable,CITY_SPAWN} from '@thainative/shared/maps';

test('screen controls project back in the intended direction',()=>{
  for(const [x,z] of [[20,-10],[-32,5],[0,44]]){const p=project(x,z),q=unproject(p.x,p.y);assert.ok(Math.hypot(q.x-x,q.z-z)<1e-8);}
  const s=createCityExplorer();s.step(1,0,.05);const delta=project(s.player.x,s.player.z-14);assert.ok(delta.x>0);assert.ok(Math.abs(delta.y)<1e-8);
});
test('diagonal input does not increase world movement speed',()=>{
  for(const [h,v] of [[1,0],[0,1],[1,1]]){const s=createCityExplorer();s.step(h,v,.05);assert.ok(Math.abs(Math.hypot(s.player.x,s.player.z-14)-.3)<1e-8);}
});
test('walking into tower stops at its collision edge',()=>{
  const s=createCityExplorer();s.player.x=0;s.player.z=5;const toward=project(0,-1);
  for(let i=0;i<240;i++){s.step(toward.x,toward.y,1/60);assert.ok(cityWalkable(s.player.x,s.player.z,.38));}
  assert.ok(s.player.z>=2.38&&s.player.z<2.5);assert.equal(s.player.moving,false);
});
test('city boundary blocks walking and reset restores original spawn',()=>{
  const s=createCityExplorer();s.player.x=45;s.player.z=5;const toward=project(1,0);
  for(let i=0;i<240;i++)s.step(toward.x,toward.y,1/60);
  assert.ok(s.player.x<46.62);assert.ok(cityWalkable(s.player.x,s.player.z,.38));s.reset();assert.equal(s.player.x,CITY_SPAWN.x);assert.equal(s.player.z,CITY_SPAWN.z);
});
test('large delta is bounded and released input stops animation',()=>{
  const s=createCityExplorer();s.step(1,0,10);assert.ok(Math.hypot(s.player.x,s.player.z-14)<=.600001);s.step(0,0,.016);assert.equal(s.player.moving,false);assert.equal(s.player.clock,0);
});
