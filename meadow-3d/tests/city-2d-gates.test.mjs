import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_GATES,gateTransform,fortificationTransform} from '../src/city-2d-gates.ts';
import {project} from '../src/city-2d-sim.ts';

test('four gates use the facade for their wall axis without stretching or shearing',()=>{
 assert.deepEqual(CITY_GATES.map(g=>g.id).sort(),['east','north','south','west']);
 for(const gate of CITY_GATES){
  assert.equal(gate.axis,Math.abs(gate.z)===47?'x':'z');
  const t=gateTransform(gate.axis);
  assert.equal(t.sx,t.sy,'retain source aspect ratio');
  assert.equal(t.skew,0,'retain verticals and natural roof shapes');
  assert.ok(t.sx>0);
  const sourceAngle=Math.atan2(t.b[1]-t.a[1],t.b[0]-t.a[0]);
  const wallAngle=Math.atan2(t.to.y-t.from.y,t.to.x-t.from.x);
  assert.ok(Math.abs(sourceAngle-wallAngle)<6*Math.PI/180,'painted baseline follows wall direction');
  assert.ok(Math.abs(t.tx+t.sx*(t.a[0]+t.b[0])/2)<1e-10);
  assert.ok(Math.abs(t.ty+t.sy*(t.a[1]+t.b[1])/2)<1e-10);
 }
});

test('repeating walls join on both world axes in all four facings',()=>{
 for(const facing of [0,1,2,3]){
  const length=42.2/6,t=fortificationTransform('wall',facing,length);
  const apply=([x,y])=>({x:t.sx*x+t.tx,y:t.skew*x+t.sy*y+t.ty});
  for(const [actual,expected] of [[apply(t.a),t.from],[apply(t.b),t.to]]){
   assert.ok(Math.abs(actual.x-expected.x)<1e-10);
   assert.ok(Math.abs(actual.y-expected.y)<1e-10);
  }
  assert.equal(apply([t.a[0],t.a[1]-100]).x,apply(t.a).x,'vertical masonry stays upright');
  const next=facing%2?project(0,-length):project(length,0);
  assert.ok(Math.abs(t.from.x+next.x-t.to.x)<1e-10);
  assert.ok(Math.abs(t.from.y+next.y-t.to.y)<1e-10,'adjacent wall endpoints have no stair step');
 }
 for(const length of [0,-1,NaN,Infinity])assert.throws(()=>fortificationTransform('wall',0,length));
});

test('painted gate roofs and towers retain proportions in every facing',()=>{
 for(const facing of [0,1,2,3]){
  const t=fortificationTransform('gate',facing,6.8);
  assert.equal(t.sx,t.sy,'do not squeeze tower widths independently of their height');
  assert.equal(t.skew,0,'do not shear roofs or arches to force their baseline onto the wall');
  assert.ok(t.sx>0);
  assert.ok(Math.abs(t.tx+t.sx*(t.a[0]+t.b[0])/2)<1e-10,'keep the gate centered on its layout point');
  assert.ok(Math.abs(t.ty+t.sy*(t.a[1]+t.b[1])/2)<1e-10);
  for(const [p,target] of [[t.a,t.from],[t.b,t.to]]){
   assert.ok(Math.hypot(t.sx*p[0]+t.tx-target.x,t.sy*p[1]+t.ty-target.y)<.9,'tower bases still overlap the wall ends');
  }
  if(facing%2){
   const paintedAngle=Math.atan2(t.b[1]-t.a[1],t.b[0]-t.a[0]);
   const mapAngle=Math.atan2(t.to.y-t.from.y,t.to.x-t.from.x);
   assert.ok(Math.abs(paintedAngle-mapAngle)<Math.PI/180,'side artwork follows the wall axis before rendering, without shear');
  }
 }
});
