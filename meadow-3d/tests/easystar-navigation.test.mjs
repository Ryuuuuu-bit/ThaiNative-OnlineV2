import test from 'node:test';
import assert from 'node:assert/strict';
import {createPathfinder,gridPath} from '../src/hud-path.ts';
import {createGame,loadGameData,moveTo,step} from '@the-beginning-online/shared';
import {LAYOUTS,MAP_ENTRY,cityWalkable,meadowWalkable,forestWalkable,ruinsWalkable,canyonWalkable,groveWalkable,summitWalkable,templeWalkable,himmapanWalkable} from '@the-beginning-online/shared/maps';
import {walkable} from '@the-beginning-online/shared/collision';
const walkers=Object.fromEntries(Object.keys(LAYOUTS).map(id=>[id,(x,z,r)=>walkable(x,z,r,id)]));

function validate(start,path,walk){
 let previous=start;
 for(const point of path){
  const count=Math.max(1,Math.ceil(Math.hypot(point.x-previous.x,point.z-previous.z)/.025));
  for(let i=0;i<=count;i++)assert.ok(walk(previous.x+(point.x-previous.x)*i/count,previous.z+(point.z-previous.z)*i/count),`blocked segment ${JSON.stringify([previous,point])}`);
  previous=point;
 }
}

test('fractional start beside an obstacle connects without snapping through it',()=>{
 const walk=(x,z)=>Math.abs(x)<7&&Math.abs(z)<7&&Math.hypot(x,z)>1.2;
 const start={x:1.25,z:.1},goal={x:-4.3,z:.15},path=gridPath(start,goal,walk);
 assert.ok(path.length>1);assert.deepEqual(path.at(-1),goal);validate(start,path,walk);
});

test('valid endpoints cannot cross a thin wall between grid cells',()=>{
 const walk=(x,z)=>Math.abs(x)<5&&Math.abs(z)<5&&!(x>.35&&x<.65&&z<2.5);
 const start={x:-2,z:0},goal={x:3,z:0},path=gridPath(start,goal,walk);
 assert.ok(path.length>1);validate(start,path,walk);
});

test('a sealed diagonal corner is unreachable and repeated requests stay independent',()=>{
 const walk=(x,z)=>x>=0&&x<=3&&z>=0&&z<=3&&!(x>=.5&&x<=1.5)&&!(z>=.5&&z<=1.5);
 const nav=createPathfinder(walk,{halfX:4,halfZ:4});
 assert.deepEqual(nav.findPath({x:0,z:0},{x:2,z:2}),[]);
 assert.deepEqual(nav.findPath({x:0,z:0},{x:0,z:.3}),[{x:0,z:.3}]);
 assert.deepEqual(nav.findPath({x:0,z:0},{x:NaN,z:0}),[]);
 assert.deepEqual(nav.findPath({x:0,z:0},{x:9,z:0}),[]);
});

test('open ground keeps the exact destination and avoids staircase waypoints',()=>{
 assert.deepEqual(gridPath({x:-3.23,z:-2.67},{x:4.21,z:3.73},()=>true),[{x:4.21,z:3.73}]);
});

test('fractional destinations in the same grid cell can detour via their shared anchor',()=>{
 const walk=(x,z)=>Math.abs(x)<4&&Math.abs(z)<4&&Math.hypot(x,z-.4)>.12;
 const start={x:-.25,z:.4},goal={x:.25,z:.4},path=gridPath(start,goal,walk);
 assert.ok(path.length>1);assert.deepEqual(path.at(-1),goal);validate(start,path,walk);
});

test('all maps: the real simulation follows routed segments around representative obstacles',()=>{
 const data=loadGameData();let routes=0;
 for(const map of Object.keys(LAYOUTS)){
  let mapRoutes=0;const walk=(x,z)=>walkers[map](x,z,.4),nav=createPathfinder(walk,LAYOUTS[map]);
  const candidates=map==='city_plaza'?[{x:0,z:0,r:3},{x:-23,z:23,r:4}]:LAYOUTS[map].obstacles.slice(0,12);
  for(const obstacle of candidates){
   const start={x:obstacle.x-obstacle.r-2,z:obstacle.z},goal={x:obstacle.x+obstacle.r+2,z:obstacle.z};
   if(!walk(start.x,start.z)||!walk(goal.x,goal.z))continue;
   const path=nav.findPath(start,goal);if(!path.length)continue;
   validate(start,path,walk);
   const g=createGame(7,undefined,'easy-star-test',data,map);g.enemies=[];g.p.x=start.x;g.p.z=start.z;
   for(const point of path){moveTo(g,point.x,point.z);for(let i=0;i<1000&&Math.hypot(g.p.x-point.x,g.p.z-point.z)>=.18;i++)step(g,.025);assert.ok(Math.hypot(g.p.x-point.x,g.p.z-point.z)<.18,`${map} stuck before ${JSON.stringify(point)}`);}
   assert.ok(Math.hypot(g.p.x-goal.x,g.p.z-goal.z)<.18);routes++;mapRoutes++;
  }
  assert.ok(mapRoutes>0,`${map} needs at least one simulated route`);const entry=MAP_ENTRY[map];assert.ok(walk(entry.x,entry.z));
 }
 assert.ok(routes>=15,`only tested ${routes} routes`);
});
