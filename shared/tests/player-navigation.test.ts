import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,moveTo,step,walkable} from '../src/index.node.js';
import {LAYOUTS} from '../src/game/maps.js';
import {createPathfinder,createPlayerPathfinder,pathSegmentWalkable} from '../src/game/pathfinding.js';

const start={x:-35.896,z:-13.529},goal=LAYOUTS.meadow.camps[0];
const body=(x:number,z:number)=>walkable(x,z,.3,'meadow');
const margin=(x:number,z:number)=>walkable(x,z,.4,'meadow');

test('player navigation leaves a movement-valid obstacle edge and reaches camp without clipping',()=>{
 assert.ok(body(start.x,start.z));assert.equal(margin(start.x,start.z),false);
 assert.deepEqual(createPathfinder(margin,LAYOUTS.meadow).findPath(start,goal),[]);
 const path=createPlayerPathfinder('meadow').findPath(start,goal);
 assert.ok(path.length>1);assert.deepEqual(path.at(-1),goal);
 const g=createGame(7);g.enemies=[];g.p.x=start.x;g.p.z=start.z;
 let previous=start;
 for(const [index,point] of path.entries()){
  assert.ok(pathSegmentWalkable(previous,point,index===0?body:margin));
  assert.ok(margin(point.x,point.z));
  moveTo(g,point.x,point.z);
  for(let i=0;i<1000&&Math.hypot(g.p.x-point.x,g.p.z-point.z)>=.18;i++){
   step(g,.025);assert.ok(body(g.p.x,g.p.z));
  }
  assert.ok(Math.hypot(g.p.x-point.x,g.p.z-point.z)<.18);
  previous=point;
 }
 assert.ok(Math.hypot(g.p.x-goal.x,g.p.z-goal.z)<.18);
});

test('movement-safe starts do not permit blocked destinations, solid starts or wall crossing',()=>{
 const nav=createPlayerPathfinder('meadow'),rock=LAYOUTS.meadow.obstacles[0];
 assert.deepEqual(nav.findPath(rock,goal),[]);
 assert.deepEqual(nav.findPath(goal,start),[]);
 assert.deepEqual(nav.findPath(start,{x:NaN,z:0}),[]);
 const bodyWalk=(x:number,z:number)=>Math.abs(x)<5&&Math.abs(z)<5&&!(x>.35&&x<.65);
 const routeWalk=(x:number,z:number)=>bodyWalk(x,z)&&x<.25;
 assert.deepEqual(createPathfinder(routeWalk,{halfX:5,halfZ:5},bodyWalk).findPath({x:.8,z:0},{x:-2,z:0}),[]);
});
