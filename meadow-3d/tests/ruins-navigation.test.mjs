import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,moveTo,step} from '@the-beginning-online/shared';
import {LAYOUTS,RUINS,MAP_ENTRY,FIELD_BOSS,ruinsWalkable,onPath} from '@the-beginning-online/shared/maps';
import {gridPath} from '../src/hud-path.ts';
import {readFileSync} from 'node:fs';
const previous=JSON.parse(readFileSync(new URL('../art/ruins-painted-v1/previous-layout.json',import.meta.url)));
const data=loadGameData();
function crossing(obstacles){const failures=[];let count=0;for(const rock of obstacles)for(const axis of ['x','z']){
 const start={x:rock.x,z:rock.z},goal={...start};start[axis]-=rock.r+3;goal[axis]+=rock.r+3;
 if(!ruinsWalkable(start.x,start.z,.4)||!ruinsWalkable(goal.x,goal.z,.4))continue;
 const g=createGame(7,undefined,'click-regression',data,'ruins');g.enemies=[];g.p.x=start.x;g.p.z=start.z;
 const route=gridPath(start,goal,(x,z)=>ruinsWalkable(x,z,.3),LAYOUTS.ruins);let next=0,reached=false;
 for(let t=0;t<30;t+=.05){if(route.length){if(Math.hypot(g.p.x-route[0].x,g.p.z-route[0].z)<.3){route.shift();next=0;}else if(t>=next){moveTo(g,route[0].x,route[0].z);next=t+.6;}}step(g,.05);if(Math.hypot(g.p.x-goal.x,g.p.z-goal.z)<.35){reached=true;break;}}
 count++;if(!reached)failures.push({obstacle:[rock.x,rock.z],axis,final:[g.p.x,g.p.z]});
 }return {count,failures};}
test('click routes clear corners on the old ruins layout, including all three reported failures',()=>{
 const original=[...LAYOUTS.ruins.obstacles],bounds={...RUINS},water=[...LAYOUTS.ruins.water];try{Object.assign(RUINS,{halfX:previous.halfX,halfZ:previous.halfZ});Object.assign(LAYOUTS.ruins,RUINS);LAYOUTS.ruins.water.splice(0,Infinity,...previous.water);LAYOUTS.ruins.obstacles.splice(0,Infinity,...previous.obstacles);const r=crossing(previous.obstacles);assert.ok(r.count>=140);assert.deepEqual(r.failures,[]);}finally{LAYOUTS.ruins.obstacles.splice(0,Infinity,...original);Object.assign(RUINS,bounds);Object.assign(LAYOUTS.ruins,bounds);LAYOUTS.ruins.water.splice(0,Infinity,...water);}
});
test('click routes cross the new city-ruin footprints without corner stalls',()=>{const r=crossing(LAYOUTS.ruins.obstacles);assert.ok(r.count>=70);assert.deepEqual(r.failures,[]);});
test('ruin masonry keeps the original roads and every camp connected',()=>{
 const l=LAYOUTS.ruins;assert.deepEqual(l.obstacles.filter(o=>onPath(l.paths,o.x,o.z,o.r+.3)),[]);
 for(const p of [...l.camps,FIELD_BOSS.ruins])assert.ok(gridPath(MAP_ENTRY.ruins,p,(x,z)=>ruinsWalkable(x,z,.3),l).length,JSON.stringify(p));
});
