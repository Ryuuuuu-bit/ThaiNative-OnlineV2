import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimatedSprite,BufferImageSource,Spritesheet,Texture} from 'pixi.js';
import {FULLBODY_LOOKS,parseFullBodyManifest,fullBodyLayout,fullBodyFrame,fullBodySheetData,drawFullBodyFrame} from '../src/fullbody-hero.ts';

const clip={url:'/assets/hero-shadow-v1/test.webp',cell:[32,40],columns:4,frames:11,seconds:.8,anchor:[16,36],bodyHeight:30,impactFrame:5};
test('full-body manifest requires all four looks, valid anchors, local assets and authored action contacts',()=>{
 const look={label:'นักเดินทาง',clips:Object.fromEntries(['idle','walk','attack','cast','heal'].map(m=>[m,{...clip}]))};
 const manifest={version:2,looks:Object.fromEntries(FULLBODY_LOOKS.map(key=>[key,structuredClone(look)]))};
 assert.equal(parseFullBodyManifest(manifest).looks['male-iron'].clips.walk.frames,11);
 for(const patch of [{anchor:[16,45]},{impactFrame:11},{frames:0},{seconds:0},{bounds:[8,4,8,35]},{bounds:[8,4,33,35]},{url:'/assets/hero-shadow-v1/../other.webp'}]){
  const invalid=structuredClone(manifest);Object.assign(invalid.looks['male-bow'].clips.attack,patch);
  assert.throws(()=>parseFullBodyManifest(invalid));
 }
 const missing=structuredClone(manifest);delete missing.looks['female-bow'];assert.throws(()=>parseFullBodyManifest(missing));
 const noContact=structuredClone(manifest);delete noContact.looks['female-iron'].clips.cast.impactFrame;assert.throws(()=>parseFullBodyManifest(noContact));
});
test('whole authored cells preserve a single scale and anchor at every frame, without limb transforms',()=>{
 const calls=[],ctx={drawImage:(...args)=>calls.push(args)},image={};
 for(let i=0;i<clip.frames;i++)drawFullBodyFrame(ctx,image,clip,i,100,200,60);
 for(const [i,call]of calls.entries()){
  assert.deepEqual(call,[image,i%4*32,Math.floor(i/4)*40,32,40,68,128,64,80]);
 }
 assert.deepEqual(fullBodyFrame(clip,NaN),fullBodyFrame(clip,0));
 assert.deepEqual(fullBodyFrame(clip,999),fullBodyFrame(clip,10));
 assert.throws(()=>fullBodySheetData(clip,127,120));assert.throws(()=>fullBodySheetData(clip,128,119));
});
test('all looks and motions share one display height and ground anchor despite different cell padding',()=>{
 const clips=[clip,{...clip,cell:[64,60],anchor:[30,50]},{...clip,cell:[128,120],anchor:[60,100],bodyHeight:60}];
 const look={label:'test',clips:Object.fromEntries(['idle','walk','attack','cast','heal'].map((motion,i)=>[motion,clips[i%3]]))};
 const manifest={version:2,looks:Object.fromEntries(FULLBODY_LOOKS.map(key=>[key,look]))};
 for(const [width,height]of [[560,460],[320,340]]){
  const {bodyHeight,x,feetY}=fullBodyLayout(manifest,width,height);
  const calls=[],ctx={drawImage:(...args)=>calls.push(args)};
  for(const current of clips)drawFullBodyFrame(ctx,{},current,0,x,feetY,bodyHeight);
  for(const [index,call]of calls.entries()){
   const current=clips[index],scale=call[7]/current.cell[0];
   assert.ok(Math.abs(scale*current.bodyHeight-bodyHeight)<1e-9,'same display body height across clips');
   assert.ok(Math.abs(call[5]+current.anchor[0]*scale-x)<1e-9,'same ground anchor x');
   assert.ok(Math.abs(call[6]+current.anchor[1]*scale-feetY)<1e-9,'same ground anchor y');
   assert.ok(call[5]>=12-1e-9&&call[5]+call[7]<=width-12+1e-9,'whole cell fits horizontally');
   assert.ok(call[6]>=40-1e-9&&call[6]+call[8]<=height-16+1e-9,'whole cell fits vertically');
  }
 }
});
test('clip-wide visible bounds use the available stage without transparent padding shrinking the body',()=>{
 const first={...clip,cell:[512,512],anchor:[256,446],bodyHeight:272,bounds:[100,170,420,449]};
 const second={...first,bounds:[70,160,400,446]};
 const clips=[first,second],look={label:'test',clips:Object.fromEntries(['idle','walk','attack','cast','heal'].map((motion,i)=>[motion,clips[i%2]]))};
 const manifest={version:2,looks:Object.fromEntries(FULLBODY_LOOKS.map(key=>[key,look]))};
 assert.deepEqual(parseFullBodyManifest(manifest).looks['male-iron'].clips.idle.bounds,first.bounds);
 for(const [width,height]of [[640,400],[320,340]]){
  const {bodyHeight,x,feetY}=fullBodyLayout(manifest,width,height);
  if(width===640)assert.equal(bodyHeight,260,'art reaches the shared target height despite large transparent padding');
  for(const current of clips){
   const scale=bodyHeight/current.bodyHeight,[left,top,right,bottom]=current.bounds;
   assert.ok(x+(left-current.anchor[0])*scale>=12-1e-9);
   assert.ok(x+(right-current.anchor[0])*scale<=width-12+1e-9);
   assert.ok(feetY+(top-current.anchor[1])*scale>=40-1e-9);
   assert.ok(feetY+(bottom-current.anchor[1])*scale<=height-16+1e-9);
  }
 }
});
test('Pixi plays variable-length authored strips, seeks, pauses and releases the atlas',()=>{
 for(const frames of [1,6,11,25]){
  const current={...clip,frames,impactFrame:Math.min(5,frames-1)},data=fullBodySheetData(current),{w:width,h:height}=data.meta.size;
  const texture=new Texture({source:new BufferImageSource({resource:new Uint8Array(width*height*4),width,height})});
  const sheet=new Spritesheet({texture,data});sheet.parseSync();assert.equal(sheet.animations.clip.length,frames);
  const sprite=new AnimatedSprite({textures:sheet.animations.clip.map(texture=>({texture,time:clip.seconds*1000/frames})),autoUpdate:false});
  sprite.play();sprite.update({deltaTime:clip.seconds*60*.51});assert.equal(sprite.currentFrame,Math.floor(frames*.51));
  sprite.gotoAndStop(frames-1);sprite.update({deltaTime:60});assert.equal(sprite.currentFrame,frames-1);
  sprite.play();sprite.update({deltaTime:clip.seconds*60/frames*1.1});assert.equal(sprite.currentFrame,0);
  sprite.destroy();sheet.destroy(true);assert.equal(texture.destroyed,true);
 }
});
