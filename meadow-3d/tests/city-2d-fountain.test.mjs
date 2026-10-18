import test from 'node:test';
import assert from 'node:assert/strict';
import {drawFountainWater} from '../src/city-2d-fountain.ts';

function frame(time){
 const commands=[];
 const context=new Proxy({}, {
  get:(_,key)=>(...args)=>commands.push([key,...args]),
  set:(_,key,value)=>{commands.push([key,value]);return true;},
 });
 drawFountainWater(context,0,0,28,time);
 return commands;
}
test('water moves with simulation time and remains stable when paused',()=>{
 assert.notDeepEqual(frame(1),frame(1.1));
 assert.deepEqual(frame(1),frame(1));
 for(const time of [0,1,1e5]){
  const commands=frame(time);
  assert.equal(commands.filter(c=>c[0]==='save').length,commands.filter(c=>c[0]==='restore').length);
  for(const command of commands)for(const value of command)if(typeof value==='number')assert.ok(Number.isFinite(value));
 }
});
