import test from 'node:test';
import assert from 'node:assert/strict';
import {NetworkWorld} from '../src/net/world.ts';

function packet(ms,goal=10,options={}) {
 let x=0,destination={x:goal,z:-42};
 // Match the server's 50 ms movement step and 0.15 m arrival radius.
 for(let tick=50;tick<=ms;tick+=50){if(goal-x>.15)x+=4.5*.05;else destination=null;}
 return {mapId:'meadow',tick:ms/50,time:ms/1000,ack:1,players:[{id:'p',x,z:-42,fx:1,fz:0,auto:false,dead:false,dash:0,attack:0,castRemaining:0,statuses:[],moving:!!destination,moveSpeed:1,destination,...options}],enemies:[],drops:[],projectiles:[],kills:0};
}

test('click walking keeps constant speed through packet jitter and never recoils at arrival',()=>{
 for(const hz of [30,60,144])for(const goal of [1,10])for(const latency of [[80],[70,110,80,120,90,100]]){
  const w=new NetworkWorld(),start=latency[0];w.receive(packet(0,goal),'p',start);
  let next=100,index=0,previous=0;
  for(let frame=1;frame<=hz*4;frame++){
   const now=start+frame*1000/hz;
   while(now+1e-6>=next+latency[index%latency.length]){w.receive(packet(next,goal),'p',now);next+=100;index++;}
   w.update(now,1/hz,{x:0,z:0},1);
   const speed=(w.game.p.x-previous)*hz;
   assert.ok(speed>=-1e-8,`${hz} Hz: click arrival recoils at ${now}`);
   if(now>600&&now<goal/4.5*1000-300)assert.ok(Math.abs(speed-4.5)<1e-8,`${hz} Hz: click speed ${speed}`);
   previous=w.game.p.x;
  }
  assert.ok(Math.abs(previous-packet(4000,goal).players[0].x)<1e-8);
 }
});

test('click packet loss holds the confirmed endpoint and keyboard movement takes over immediately',()=>{
 const w=new NetworkWorld();w.receive(packet(0),'p',80);w.receive(packet(100),'p',180);
 w.update(600,.016,{x:0,z:0},1);assert.equal(w.game.p.x,.45);
 w.update(616,.016,{x:1,z:0},2);assert.ok(w.game.p.x>.45);
 assert.deepEqual(w.authoritativePosition,{x:.45,z:-42});
});

test('map transfers and large relocations clear click interpolation history',()=>{
 for(const mapId of ['meadow','forest']){
  const w=new NetworkWorld();w.receive(packet(0),'p',80);w.receive(packet(100),'p',180);w.update(200,.016,{x:0,z:0},1);
  w.receive({...packet(200,10,{x:20,destination:null}),mapId},'p',280);
  w.update(280,0,{x:0,z:0},1);assert.equal(w.game.p.x,20);
 }
});
