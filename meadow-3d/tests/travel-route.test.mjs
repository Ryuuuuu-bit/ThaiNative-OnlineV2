import test from 'node:test';
import assert from 'node:assert/strict';
import {createTravelRoute} from '../src/hud-path.ts';

test('navigation advances through waypoints and completes once at the destination',()=>{
 const route=createTravelRoute(()=>[{x:1,z:0},{x:2,z:0}]);
 assert.ok(route.start({x:0,z:0},{x:2,z:0},0));
 assert.equal(route.update({x:1,z:0},1000),'moving');
 assert.deepEqual(route.points,[{x:2,z:0}]);
 assert.equal(route.update({x:2,z:0},2000),'arrived');
 assert.equal(route.update({x:2,z:0},3000),'idle');
});
test('navigation retries stalled movement twice, then stops; a new route resets recovery',()=>{
 let searches=0;const route=createTravelRoute((_,goal)=>{searches++;return [goal];});
 route.start({x:0,z:0},{x:2,z:0},0);
 assert.equal(route.update({x:0,z:0},3100),'moving');
 assert.equal(route.update({x:0,z:0},6200),'moving');
 assert.equal(searches,3);
 assert.equal(route.update({x:0,z:0},9300),'blocked');
 assert.deepEqual(route.points,[]);
 assert.ok(route.start({x:0,z:0},{x:4,z:0},10000));
 assert.equal(route.update({x:1,z:0},14000),'moving');
 assert.equal(searches,4,'real movement prevents an unnecessary repath');
 route.clear();assert.equal(route.update({x:1,z:0},18000),'idle');
});
test('unreachable routes never report arrival or keep resending movement',()=>{
 const route=createTravelRoute(()=>[]);
 assert.equal(route.start({x:0,z:0},{x:2,z:0},0),false);
 assert.equal(route.update({x:0,z:0},4000),'idle');
});
