import test from 'node:test';
import assert from 'node:assert/strict';
import {SwordVfxModel,swordEffectKind} from '../src/sword-vfx-model.ts';

test('only sword swings and their hit contacts replace the old effect path',()=>{
 assert.equal(swordEffectKind({type:'slash'}),'slash');
 assert.equal(swordEffectKind({type:'skill',skillId:'slash'}),'slash');
 assert.equal(swordEffectKind({type:'hit',skillId:'basic'}),'hit');
 assert.equal(swordEffectKind({type:'hit',skillId:'slash'}),'hit');
 for(const event of [{type:'warning'},{type:'heal'},{type:'hit',skillId:'earth_break'},{type:'hit',reflect:true},{type:'skillImpact',skillId:'slash'}])
  assert.equal(swordEffectKind(event),null);
});

test('heavy combat has bounded state and expired particles are released',()=>{
 const model=new SwordVfxModel();
 for(let i=0;i<500;i++){
  model.event({type:'slash',x:i,z:0,dx:0,dz:-2});
  model.event({type:'hit',x:i,z:0,skillId:'basic',crit:true});
 }
 assert.equal(model.arcs.length,24);assert.equal(model.sparks.length,384);
 assert.equal(model.arcs.at(-1).dz,-1);
 for(let i=0;i<10;i++)model.update(.1);
 assert.equal(model.arcs.length+model.sparks.length,0);
});

test('visual state is deterministic across 30/60 FPS and never mutates combat events',()=>{
 const event=Object.freeze({type:'hit',x:-3,z:4,skillId:'basic',crit:true});
 const a=new SwordVfxModel(),b=new SwordVfxModel();a.event(event);b.event(event);
 for(let i=0;i<6;i++)a.update(1/60);
 for(let i=0;i<3;i++)b.update(1/30);
 assert.equal(a.sparks.length,b.sparks.length);
 for(let i=0;i<a.sparks.length;i++){
  assert.ok(Math.abs(a.sparks[i].age-b.sparks[i].age)<1e-10);
  assert.equal(a.sparks[i].vx,b.sparks[i].vx);assert.equal(a.sparks[i].vz,b.sparks[i].vz);
 }
});

test('reduced motion reduces the burst and clearing a map removes all particles',()=>{
 const a=new SwordVfxModel(),b=new SwordVfxModel();const e={type:'hit',x:0,z:0,crit:true};
 a.event(e);b.event(e,true);assert.equal(a.sparks.length,18);assert.equal(b.sparks.length,4);
 a.event({type:'slash',x:0,z:0});a.clear();assert.equal(a.arcs.length+a.sparks.length,0);
 assert.equal(a.event({type:'hit',x:NaN,z:0}),false);
});
