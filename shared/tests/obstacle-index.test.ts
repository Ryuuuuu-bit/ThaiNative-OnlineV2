import test from 'node:test';
import assert from 'node:assert/strict';
import {circleGrid,circleIndex,GRID_MAX_R,type ObstacleCircle} from '../src/game/obstacle-index.js';
import {LAYOUTS,MEADOW_LANDMARKS,CITY_PLANTERS,GARDEN_TREES} from '../src/game/maps.js';

const brute = (circles: readonly ObstacleCircle[], x:number,z:number,r:number) =>
 circles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r);

test('RBush broad phase rejects box-only overlaps and keeps strict circle tangency',()=>{
 const hits=circleIndex([{x:0,z:0,r:1}]);
 assert.equal(hits(.9,.9,0),false,'inside the box but outside the circle');
 assert.equal(hits(2,0,1),false,'exact tangent is walkable');
 assert.equal(hits(2-1e-8,0,1),true,'overlapping discs collide');
 assert.equal(hits(2+1e-8,0,1),false);
 assert.equal(hits(-.5,-.5,.3),true);
 assert.equal(circleIndex([])(0,0,100),false);
});

test('replacing a footprint list with a different-sized layout refreshes its index',()=>{
 const circles=[{x:0,z:0,r:1}],hits=circleIndex(circles);
 assert.equal(hits(0,0,.3),true);
 circles.splice(0,1,{x:10,z:10,r:1},{x:-10,z:-10,r:2});
 assert.equal(hits(0,0,.3),false);
 assert.equal(hits(-10,-10,.3),true);
 circles.splice(0,2,{x:0,z:0,r:1});
 assert.equal(hits(0,0,.3),true);
 assert.equal(hits(-10,-10,.3),false);
});

test('RBush matches brute force for every map, negative coordinates, varied radii and wide queries',()=>{
 const lists=[
  [...CITY_PLANTERS,...GARDEN_TREES.map(o=>({...o,r:.55}))],
  [...LAYOUTS.meadow.obstacles,...MEADOW_LANDMARKS.circles],
  LAYOUTS.forest.obstacles,LAYOUTS.ruins.obstacles,LAYOUTS.canyon.obstacles,
 ];
 let seed=49163;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(const circles of lists){
  const hits=circleIndex(circles);
  for(let i=0;i<10000;i++){
   const x=(random()*2-1)*80,z=(random()*2-1)*64,r=[0,.3,.4,.65,2.5,2.500001,4,8,100][i%9];
   assert.equal(hits(x,z,r),brute(circles,x,z,r),JSON.stringify({x,z,r}));
  }
  for(const o of circles)for(const r of [0,.3,4])for(const epsilon of [-1e-8,0,1e-8]){
   const x=o.x+o.r+r+epsilon;
   assert.equal(hits(x,o.z,r),brute(circles,x,o.z,r),'boundary precision is preserved');
  }
 }
});

test('existing small-radius grid and RBush agree on real meadow and forest movement queries',()=>{
 for(const circles of [[...LAYOUTS.meadow.obstacles,...MEADOW_LANDMARKS.circles],LAYOUTS.forest.obstacles]){
  const grid=circleGrid(circles),tree=circleIndex(circles);
  for(let x=-60;x<=60;x+=.7)for(let z=-48;z<=48;z+=.9)for(const r of [.3,.4,.65,GRID_MAX_R])
   assert.equal(grid(x,z,r),tree(x,z,r));
 }
});
