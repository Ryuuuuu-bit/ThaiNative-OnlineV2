import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_GATES,gateTransform} from '../src/city-2d-gates.ts';

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
