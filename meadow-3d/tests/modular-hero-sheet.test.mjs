import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimatedSprite,BufferImageSource,Spritesheet,Texture} from 'pixi.js';
import {HERO_SHEET,modularSheetData} from '../src/modular-hero-sheet.ts';
import {MODULAR_MOTIONS} from '../src/modular-hero-motion.ts';

test('Pixi parses all atlas frames with a fixed canvas and plays, seeks, pauses, and loops at clip timing',()=>{
 for(const motion of Object.keys(MODULAR_MOTIONS)){
  const data=modularSheetData(motion),{w:width,h:height}=data.meta.size,clip=MODULAR_MOTIONS[motion];
  const texture=new Texture({source:new BufferImageSource({resource:new Uint8Array(width*height*4),width,height})});
  const sheet=new Spritesheet({texture,data});sheet.parseSync();
  assert.equal(sheet.animations[motion].length,clip.frames);
  for(const frame of sheet.animations[motion]){
   assert.equal(frame.width,HERO_SHEET.size);assert.equal(frame.height,HERO_SHEET.size);
   assert.ok(frame.frame.right<=width&&frame.frame.bottom<=height);
  }
  const sprite=new AnimatedSprite({textures:sheet.animations[motion].map(texture=>({texture,time:clip.seconds*1000/clip.frames})),autoUpdate:false,loop:true});
  sprite.play();
  sprite.update({deltaTime:clip.seconds*60*.51});assert.equal(sprite.currentFrame,Math.floor(clip.frames*.51));
  sprite.gotoAndStop(clip.frames-1);sprite.update({deltaTime:60});assert.equal(sprite.currentFrame,clip.frames-1);
  sprite.play();sprite.update({deltaTime:clip.seconds*60/clip.frames*1.1});assert.equal(sprite.currentFrame,0);
  sprite.destroy();sheet.destroy(true);assert.equal(texture.destroyed,true);
 }
});
