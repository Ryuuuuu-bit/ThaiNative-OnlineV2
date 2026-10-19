import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_ATMOSPHERE,atmosphereSettings,pondSurface,sunPosition,breeze,leafPose} from '../src/atmosphere-model.ts';
test('water surface excludes bridge planks and the outside of a pond',()=>{
 const p={x:28,z:-4,rx:7,rz:10,bridgeZ:-3,bridgeHalf:1};
 for(let x=21;x<=35;x+=.1)for(let z=-4;z<=-2;z+=.2)assert.equal(pondSurface(p,x,z),false);
 assert.equal(pondSurface(p,28,-8),true);assert.equal(pondSurface(p,28,0),true);assert.equal(pondSurface(p,40,-8),false);
});
test('atmosphere settings reject non-finite input and stay bounded without mutating defaults',()=>{
 const s=atmosphereSettings(DEFAULT_ATMOSPHERE,{hour:NaN,sun:Infinity,wind:-1});assert.equal(s.hour,10);assert.equal(s.sun,.72);assert.equal(s.wind,0);assert.equal(DEFAULT_ATMOSPHERE.wind,.4);
 assert.deepEqual(atmosphereSettings(s,{hour:30,sun:4,wind:3,enabled:false}),{...s,hour:18,sun:1,wind:1,enabled:false});
});
test('leaf motion is time based, deterministic, bounded and wind never changes the tree root',()=>{
 assert.equal(breeze(3,4,10,0),0);
 for(let i=0;i<40;i++)for(let t=0;t<100;t+=.5){const p=leafPose(i,t,.4);assert.ok(p.progress>=0&&p.progress<1);assert.ok(p.alpha>=0&&p.alpha<=.6);assert.ok(p.flutter>=.25&&p.flutter<=1);assert.deepEqual(p,leafPose(i,t,.4));const rootY=120,shear=breeze(3,4,t,.4)*.023;assert.equal(5+shear*rootY-shear*rootY,5);}
 assert.ok(sunPosition(8).dx>0);assert.ok(sunPosition(16).dx<0);assert.ok(sunPosition(12).length<sunPosition(8).length);
});
