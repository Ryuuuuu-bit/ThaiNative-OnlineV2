import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MODULAR_ART,MODULAR_CANVAS,MODULAR_FEET,HERO_ATTACHMENTS,modularLayers,drawModularHero} from '../src/modular-hero.ts';

test('every supported outfit / sword / shield combination keeps body registration and grip order',()=>{
 for(const outfit of ['base','traveler','guardian'])for(const sword of ['none','iron','falchion','bow'])for(const shield of [false,true]){
  const look={outfit,sword,shield},layers=modularLayers(look);
  assert.ok(layers.some(l=>l.asset==='body'));
  assert.equal(layers.filter(l=>l.asset===outfit&&outfit!=='base').length,outfit==='base'?0:1);
  assert.equal(layers.some(l=>l.asset==='shield'),shield&&sword!=='bow');
  assert.equal(layers.filter(l=>l.rotation!==undefined).length,sword==='none'?0:1);
  for(const l of layers){
   assert.ok(MODULAR_ART[l.asset]);
   assert.ok(l.source.every(Number.isFinite)&&l.target.every(Number.isFinite));
   assert.ok(l.source[0]>=0&&l.source[1]>=0);
   assert.ok(l.source[0]+l.source[2]<=MODULAR_CANVAS);
   assert.ok(l.source[1]+l.source[3]<=MODULAR_CANVAS);
  }
  if(sword!=='none'){
   const weapon=layers.findIndex(l=>l.asset===sword);
   assert.ok(layers.slice(weapon+1).some(l=>l.asset==='body'),'hand must cover the grip');
  }
  if(shield&&sword!=='bow')assert.equal(layers.at(-1).asset,'shield');
 }
 assert.equal(MODULAR_FEET,1127);
});

test('equipment and guides use the actual hand grips after each outfit registration',()=>{
 for(const outfit of ['base','traveler','guardian']){
  const mount=HERO_ATTACHMENTS[outfit],layers=modularLayers({outfit,sword:'iron',shield:true});
  const sword=layers.find(l=>l.asset==='iron'),shield=layers.at(-1);
  assert.deepEqual(sword.target.slice(0,2),mount.rightGrip);
  assert.deepEqual(shield.target.slice(0,2),mount.leftGrip);
  assert.deepEqual(sword.origin,[627,245]);assert.deepEqual(shield.origin,[565,610]);
  for(const [sourcePoint,source,target,grip]of [
   [[450,630],[410,540,75,110],mount.rightHand,mount.rightGrip],
   [[790,657],[744,604,90,90],mount.leftHand,mount.leftGrip],
  ])for(let axis=0;axis<2;axis++){
   const actual=target[axis]+(sourcePoint[axis]-source[axis])*target[axis+2]/source[axis+2];
   assert.ok(Math.abs(actual-grip[axis])<1,outfit+' hand grip must not drift');
  }
  if(outfit!=='base'){
   const garment=layers.findIndex(l=>l.asset===outfit),face=layers.findIndex(l=>l.clip);
   assert.ok(garment>layers.findIndex(l=>l.asset==='body'),'skin goes inside the garment');
   assert.ok(face>garment,'jaw covers the rear collar');
   assert.ok(layers[face].clip.some(p=>p[1]>315),'jaw edge is not a horizontal crop');
  }
 }
});

test('compositor scales source regions and keeps jaw masks local to the face',()=>{
 const calls=[],context={
  save(){},restore(){},translate(...a){calls.push(['translate',...a]);},
  scale(...a){calls.push(['scale',...a]);},rotate(){},
  drawImage(...a){calls.push(['draw',...a]);},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){calls.push(['clip']);},
 };
 const image={width:768,height:768},assets={get:()=>image};
 drawModularHero(context,assets,{outfit:'guardian',sword:'iron',shield:true},110,190,168);
 assert.deepEqual(calls[0],['translate',110-1254/2*.168,190-1127*.168]);
 const draws=calls.filter(c=>c[0]==='draw');
 assert.equal(draws.length,7);
 for(const [i,value]of [515,105,230,275].entries())assert.ok(Math.abs(draws[1][i+2]-value*768/1254)<1e-9);
 assert.equal(calls.filter(c=>c[0]==='clip').length,1);
});

test('all shipped images have verified alpha, bounds, and source provenance',()=>{
 const report=JSON.parse(readFileSync(new URL('../public/assets/hero-modular-v1/validation.json',import.meta.url)));
 assert.deepEqual(Object.keys(report).sort(),Object.keys(MODULAR_ART).sort());
 for(const [name,entry]of Object.entries(report)){
  assert.deepEqual(entry.size,[768,768],name);
  assert.deepEqual(entry.alpha,[0,255],name);
  const bytes=readFileSync(new URL('../public'+MODULAR_ART[name].url,import.meta.url));
  assert.ok(bytes.length>1000,name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,name);
  assert.ok(entry.sourceSha256.length===64,name);
  const source=readFileSync(new URL('../art/texture-sources/modular-hero-v1/'+entry.source,import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'),entry.sourceSha256,name);
  if(name==='traveler'||name==='guardian'){
   assert.equal(entry.openingAlpha.length,3);
   assert.ok(entry.openingAlpha.every(alpha=>alpha<16),name+' neck and cuffs are transparent');
  }
 }
});
