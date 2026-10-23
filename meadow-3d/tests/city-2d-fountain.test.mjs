import test from 'node:test';
import assert from 'node:assert/strict';
import {drawFountainWater} from '../src/city-2d-fountain.ts';

function frame(time,gentle=false,x=0,y=0,scale=28){
 const commands=[];
 const context=new Proxy({}, {
  get:(_,key)=>(...args)=>commands.push([key,...args]),
  set:(_,key,value)=>{commands.push([key,value]);return true;},
 });
 drawFountainWater(context,x,y,scale,time,gentle);
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

test('reduced-motion fountain still flows gently with fewer draw commands and remains pause-safe',()=>{
 assert.notDeepEqual(frame(1,true),frame(1.5,true));assert.deepEqual(frame(1,true),frame(1,true));
 assert.ok(frame(1,true).length<frame(1).length);
});

test('water remains registered to the ground anchor when the camera or zoom changes',()=>{
 const local=frame(1),moved=frame(1,false,320,180,42);
 assert.deepEqual(local.find(c=>c[0]==='translate'),['translate',0,0]);
 assert.deepEqual(moved.find(c=>c[0]==='translate'),['translate',320,180]);
 assert.deepEqual(moved.find(c=>c[0]==='scale'),['scale',42,42]);
 assert.deepEqual(local.filter(c=>!['translate','scale'].includes(c[0])),moved.filter(c=>!['translate','scale'].includes(c[0])));
});

test('water paths and spray stay inside the six-metre fountain silhouette',()=>{
 const inside=(x,y)=>assert.ok(x>=-2.9&&x<=2.9&&y>=-3.9&&y<=.65,`${x}, ${y} leaves the fountain`);
 for(const gentle of[false,true])for(const time of[0,.1,.5,1,3,10,1e5])for(const command of frame(time,gentle)){
  if(command[0]==='ellipse'){
   const [,x,y,rx,ry]=command;
   inside(x-rx,y-ry);inside(x+rx,y+ry);
  }else if(['moveTo','lineTo','quadraticCurveTo'].includes(command[0])){
   for(let i=1;i<command.length;i+=2)inside(command[i],command[i+1]);
  }
 }
});

test('the seven painted waterfalls land in water without crossing the central pedestal',()=>{
 const paths=frame(0).filter(command=>command[0]==='quadraticCurveTo');
 assert.equal(paths.length,7);
 for(const [,controlX,controlY,endX,endY]of paths){
  assert.ok(endY>controlY,'water falls down toward its receiving basin');
  if(endY>-.5)assert.ok(Math.abs(endX)>.8,'front streams stay clear of the stone column');
 }
});
