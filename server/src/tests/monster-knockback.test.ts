import test from 'node:test';
import assert from 'node:assert/strict';
import {KnockbackScene,monsterKnockbackFor,knockbackGeometry} from '../realtime/monster-knockback.js';
import {createGame,spawn,action,walkable,LAYOUTS,loadGameData} from '@thainative/shared';
import type {MapId} from '@thainative/shared/maps';

test('swept monster disc stops at a rock instead of tunnelling through it',()=>{
 const scene=new KnockbackScene({circles:[{x:0,z:0,r:1}],boxes:[]},()=>true);
 try{
  const from={x:-3,z:0},next=scene.resolve(from,{x:6,z:0});
  assert.ok(next.x<-1.3&&next.x>-1.31,JSON.stringify(next));assert.equal(next.z,0);assert.deepEqual(from,{x:-3,z:0});
  const away=scene.resolve(next,{x:-.23,z:0});assert.ok(away.x<next.x-.22,'can move away from contact');
 }finally{scene.free();}
});

test('oblique knockback stops along its original direction at a wall, without axis sliding',()=>{
 const scene=new KnockbackScene({circles:[],boxes:[{x:0,z:0,w:.1,d:10}]},()=>true);
 try{
  const next=scene.resolve({x:-2,z:-1},{x:4,z:2});
  assert.ok(next.x<-.35&&next.x>-.36);assert.ok(Math.abs(next.z-next.x/2)<1e-6,'stops on the original ray');
 }finally{scene.free();}
});

test('open ground preserves the full distance; invalid impulses remain stationary',()=>{
 const scene=new KnockbackScene({circles:[],boxes:[]},()=>true),from={x:2,z:-3};
 try{
  assert.deepEqual(scene.resolve(from,{x:.138,z:.184}),{x:2.138,z:-2.816});
  assert.deepEqual(scene.resolve(from,{x:0,z:0}),from);
  assert.deepEqual(scene.resolve(from,{x:NaN,z:0}),from);
  assert.deepEqual(scene.resolve(from,{x:Infinity,z:0}),from);
 }finally{scene.free();}
});

test('all field maps use their canonical tree/rock/wall footprints and retain walkable endpoints',()=>{
 for(const map of ['meadow','forest','ruins','canyon'] as MapId[]){
  const resolve=monsterKnockbackFor(map),layout=LAYOUTS[map];let checked=0;
  assert.equal(resolve,monsterKnockbackFor(map),'same static world is reused');
  assert.ok(knockbackGeometry(map).circles.length>=layout.obstacles.length);
  for(const o of layout.obstacles)for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
   const from={x:o.x+Math.cos(a)*(o.r+.5),z:o.z+Math.sin(a)*(o.r+.5)};
   if(!walkable(from.x,from.z,.3,map))continue;
   const delta={x:-Math.cos(a)*.23,z:-Math.sin(a)*.23},next=resolve(from,delta);
   assert.ok(walkable(next.x,next.z,.3,map),`${map}: ends outside terrain`);
   assert.ok(Math.hypot(next.x-o.x,next.z-o.z)>=o.r+.3-1e-6);
   assert.ok(Math.hypot(next.x-from.x,next.z-from.z)<.205,'stops before the full .23 m impulse');checked++;
  }
  assert.ok(checked>20,`${map}: enough real obstacle contacts`);
 }
});

test('map borders and shared water rules still stop monster displacement',()=>{
 const resolve=monsterKnockbackFor('meadow');
 const from={x:LAYOUTS.meadow.halfX-1.5,z:0},next=resolve(from,{x:1,z:0});
 assert.ok(walkable(next.x,next.z,.3,'meadow'));assert.ok(next.x<LAYOUTS.meadow.halfX-1.3);
 const scene=new KnockbackScene({circles:[],boxes:[]},x=>x<.17);
 try{assert.ok(scene.resolve({x:0,z:0},{x:.23,z:0}).x<.17);}finally{scene.free();}
});

test('authoritative hit invokes Rapier for normal monsters and preserves boss immunity',()=>{
 const g=createGame(5,undefined,'knockback-test',loadGameData(),'meadow');g.enemies=[];g.p.x=0;g.p.z=4;g.random=()=>.5;
 let calls=0;const resolve=monsterKnockbackFor(g.mapId);
 g.resolveMonsterKnockback=(from,delta)=>{calls++;return resolve(from,delta);};
 const enemy=spawn(g,1.4,4);enemy.hp=enemy.maxHp=1e6;
 assert.equal(action(g,'attack'),true);assert.equal(calls,1);assert.ok(enemy.x>1.6&&enemy.x<1.64);assert.ok(enemy.hp<enemy.maxHp);
 g.enemies=[];const boss=spawn(g,1.4,4,true);boss.hp=boss.maxHp=1e6;g.p.cd.attack=0;g.p.attack=0;
 assert.equal(action(g,'attack'),true);assert.equal(calls,1);assert.equal(boss.x,1.4);
});
