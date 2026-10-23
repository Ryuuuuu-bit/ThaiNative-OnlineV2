import test from 'node:test';
import assert from 'node:assert/strict';
import {NetworkWorld} from '../src/net/world.ts';
const snap=(ms,x,options={})=>({mapId:'meadow',tick:ms/50,time:ms/1000,ack:0,players:[{id:'p',x,z:-38,fx:1,fz:0,auto:true,dead:false,dash:0,attack:0,castRemaining:0,statuses:[],moving:true,moveSpeed:1,...options}],enemies:[],drops:[],projectiles:[],kills:0});
function motion(hz=60){
 const w=new NetworkWorld(),rows=[];w.receive(snap(0,0),'p',0);
 for(let i=1;i<=hz*2;i++){
  const ms=i*1000/hz;
  if(Math.round(ms/100)>w.lastTick/2&&Math.abs(ms/100-Math.round(ms/100))<1e-6)w.receive(snap(ms,ms*.0045),'p',ms);
  w.update(ms,1/hz,{x:0,z:0},0);rows.push({ms,x:w.game.p.x});
 }
 return rows.filter(r=>r.ms>=300);
}
test('AUTO walking at 10 Hz snapshots has constant visible speed between and across snapshots',()=>{
 for(const hz of [60,120,200]){
  const rows=motion(hz),speeds=rows.slice(1).map((r,i)=>(r.x-rows[i].x)/((r.ms-rows[i].ms)/1000));
  assert.ok(Math.max(...speeds)<4.51,`${hz} Hz spikes to ${Math.max(...speeds)} m/s`);
  assert.ok(Math.min(...speeds)>4.49,`${hz} Hz slows to ${Math.min(...speeds)} m/s`);
 }
});
test('AUTO map changes start at destination without interpolating across maps',()=>{
 const w=new NetworkWorld();w.receive(snap(0,0),'p',0);w.update(0,0,{x:0,z:0},0);
 w.receive({...snap(100,40),mapId:'forest'},'p',100);w.update(100,.016,{x:0,z:0},0);
 assert.equal(w.game.p.x,40);
});
test('manual steering remains locally predicted',()=>{
 const w=new NetworkWorld();w.receive(snap(0,0,{auto:false}),'p',0);w.update(16,.016,{x:1,z:0},1);
 assert.ok(w.game.p.x>0);
});

test('AUTO packet gap holds the authoritative endpoint instead of extrapolating into terrain',()=>{
 const w=new NetworkWorld();w.receive(snap(0,0),'p',0);w.receive(snap(100,.45),'p',100);
 for(let ms=100;ms<=600;ms+=10){w.update(ms,.01,{x:0,z:0},0);assert.ok(w.game.p.x<=.45+1e-9);}
 assert.equal(w.game.p.x,.45);
});
test('disabling AUTO preserves displayed position while manual reconciliation takes over',()=>{
 const w=new NetworkWorld();w.receive(snap(0,0),'p',0);w.receive(snap(100,.45),'p',100);w.update(150,.05,{x:0,z:0},0);
 const before=w.game.p.x;
 w.receive(snap(200,.9,{auto:false}),'p',200);w.update(200,0,{x:0,z:0},0);
 assert.ok(Math.abs(w.game.p.x-before)<1e-9);
});
test('AUTO large relocations snap instead of sliding through intervening terrain',()=>{
 const w=new NetworkWorld();w.receive(snap(0,0),'p',0);w.receive(snap(100,20),'p',100);w.update(100,.01,{x:0,z:0},0);
 assert.equal(w.game.p.x,20);
});


test('manual prediction respects Root and authoritative zero movement speed instead of falling back to normal speed',()=>{
 for(const options of [{moveSpeed:0},{moveSpeed:1.2,statuses:[{id:'root',remaining:2}]}]){const w=new NetworkWorld();w.receive(snap(0,0,{auto:false,...options}),'p',0);w.update(50,.05,{x:1,z:0},1);assert.equal(w.game.p.x,0);}
});

test('manual prediction uses the authoritative speed multiplier for movement buffs',()=>{
 const w=new NetworkWorld();w.receive(snap(0,0,{auto:false,moveSpeed:1.2}),'p',0);w.update(50,.05,{x:1,z:0},1);assert(Math.abs(w.game.p.x-.27)<1e-8);
});
