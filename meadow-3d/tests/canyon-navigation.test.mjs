import {createGame,loadGameData,setAuto,step,moveTo,DEFAULT_AUTO} from '@the-beginning-online/shared';
import {LAYOUTS,canyonWalkable} from '@the-beginning-online/shared/maps';
import {gridPath} from '../src/hud-path.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
const data=loadGameData(),rows=[];
for(const rock of LAYOUTS.canyon.obstacles.filter(o=>o.kind==='canyon-crag'))for(const axis of ['x','z']){
 const start={x:rock.x,z:rock.z},goal={...start};start[axis]-=rock.r+3;goal[axis]+=rock.r+3;
 if(!canyonWalkable(start.x,start.z,.4)||!canyonWalkable(goal.x,goal.z,.4))continue;
 for(const mode of ['click','auto']){
  const g=createGame(7,undefined,'nav-test',data,'canyon');g.p.x=start.x;g.p.z=start.z;
  const enemy=g.enemies.find(e=>!e.boss);g.enemies=mode==='auto'?[enemy]:[];
  if(mode==='auto'){Object.assign(enemy,{x:goal.x,z:goal.z,homeX:goal.x,homeZ:goal.z,wx:goal.x,wz:goal.z,wander:999,cooldown:999,aggro:0});enemy.behavior={...enemy.behavior,speed:0,aggroRange:0};g.p.hotbar=[];g.p.autoCfg={...DEFAULT_AUTO,basic:false,elites:false,range:'far'};setAuto(g,true);}else moveTo(g,goal.x,goal.z);
  let route=mode==='click'?gridPath(start,goal,(x,z)=>canyonWalkable(x,z,.4)):[],next=0;let seconds=0;for(;seconds<20;seconds+=.05){if(route.length){if(Math.hypot(g.p.x-route[0].x,g.p.z-route[0].z)<.3){route.shift();next=0;}else if(seconds>=next){moveTo(g,route[0].x,route[0].z);next=seconds+.6;}}step(g,.05);if(Math.hypot(g.p.x-goal.x,g.p.z-goal.z)<(mode==='auto'?1.8:.2))break;}
  rows.push({rock:[rock.x,rock.z],axis,mode,seconds:+seconds.toFixed(2),reached:seconds<20,final:[g.p.x,g.p.z]});
 }
}
test('canyon click routing and AUTO reach the far side of every testable large crag',()=>{assert.ok(rows.length>=26);assert.deepEqual(rows.filter(r=>!r.reached),[]);});