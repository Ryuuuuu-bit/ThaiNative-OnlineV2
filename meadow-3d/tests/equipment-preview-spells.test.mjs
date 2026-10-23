import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimatedSprite,BufferImageSource,Texture} from 'pixi.js';
import {EquipmentPreviewSpells,previewBowPath,previewArrowPosition} from '../src/equipment-preview-spells.ts';

test('Auto Spell preserves authored sword/bow frames and timing for different clip lengths and speeds',()=>{
 for(const weapon of ['iron','bow'])for(const [frames,seconds,impact] of [[6,.9,3],[11,.8,6],[25,2,17]])for(const speed of [1,.25]){
  const texture=new Texture({source:new BufferImageSource({resource:new Uint8Array(4),width:1,height:1})});
  const sprite=new AnimatedSprite({textures:Array.from({length:frames},()=>({texture,time:seconds*1000/frames})),autoUpdate:false});sprite.animationSpeed=speed;
  const preview=new EquipmentPreviewSpells();sprite.play();let previous=0,procs=0;
  for(let i=0;i<frames*4;i++){
   sprite.update({deltaTime:seconds*60/frames/speed});
   const frame=sprite.currentFrame,playing=sprite.playing;
   if(preview.frame('attack',weapon,previous,frame,true,impact)==='auto')procs++;
   assert.equal(sprite.currentFrame,frame);assert.equal(sprite.playing,playing);
   previous=frame;preview.vfx.advance(seconds/frames);
  }
  assert.equal(preview.attacks,4);assert.equal(procs,2);assert.equal(sprite.currentFrame,0);
  sprite.destroy();texture.destroy(true);
 }
});
test('authored release crossings, manual spells and disabled procs produce only the expected effects',()=>{
 const preview=new EquipmentPreviewSpells();
 assert.equal(preview.frame('walk','bow',4,6,true,5),null);
 assert.equal(preview.frame('attack','iron',4,6,false,5),null);
 assert.equal(preview.frame('attack','iron',6,6,true,5),null);
 assert.equal(preview.frame('attack','bow',6,8,true,7),'auto');
 assert.equal(preview.attacks,2);assert.equal(preview.procs,1);
 preview.start('heal');assert.equal(preview.frame('heal','bow',3,5,true,4),'heal');
 assert.ok(preview.vfx.effects.some(f=>f.id==='healer_01'&&f.phase==='impact'));
 preview.start('cast');assert.equal(preview.frame('cast','iron',16,20,true,17),'cast');
 assert.equal(preview.attacks,2);
 assert.equal(preview.frame('attack','iron',20,3,false,2),null);assert.equal(preview.attacks,3,'wrapped frame crossing is counted');
 assert.equal(preview.frame('attack','iron',2,4,true,undefined),null);assert.equal(preview.attacks,3);
 for(let i=0;i<12;i++)preview.vfx.advance(.1);
 assert.equal(preview.vfx.snapshot().effects,0);
});

test('bow projectiles start at each authored grip and follow the aim line to the target at every preview size',()=>{
 for(const outfit of ['male','female'])for(const width of [320,640]){
  const clip={cell:[384,384],anchor:outfit==='male'?[195,302.25]:[210,306],bodyHeight:outfit==='male'?239.25:251.25};
  const layout={x:width/2,feetY:300,bodyHeight:168},path=previewBowPath(outfit,clip,layout,width);
  const socket=outfit==='male'?[374,154]:[376,156],scale=168/clip.bodyHeight;
  assert.deepEqual(path.from,{x:layout.x+(socket[0]*.75-clip.anchor[0])*scale,y:layout.feetY+(socket[1]*.75-clip.anchor[1])*scale});
  assert.ok(path.to.x>path.from.x&&path.to.x<=width-18);
  for(const progress of [0,.25,.5,.75,1]){
   const arrow=previewArrowPosition(path,progress);
   assert.ok(Math.abs((arrow.y-path.from.y)-(arrow.x-path.from.x)*.32)<1e-9,'trajectory follows the sprite aim');
   assert.ok(Math.abs(arrow.angle-Math.atan2(.32,1))<1e-9);
   if(progress===0)assert.deepEqual({x:arrow.x,y:arrow.y},path.from);
   if(progress===1)assert.deepEqual({x:arrow.x,y:arrow.y},path.to);
  }
 }
});

test('arrow flight has its own clock and Auto Spell uses the same target without a body-centred arrow ray',()=>{
 const preview=new EquipmentPreviewSpells(),path={from:{x:20,y:30},to:{x:120,y:62}};
 preview.target={x:1.4,z:-1.2};
 preview.frame('attack','bow',13,14,false,14);preview.shoot(path);
 assert.equal(preview.attacks,1);assert.equal(preview.vfx.effects.length,0);
 path.from.x=999;assert.equal(preview.arrow.from.x,20,'flight keeps the release origin');
 preview.advance(.1);preview.advance(.1);assert.ok(preview.arrow);
 assert.equal(preview.frame('attack','bow',13,14,true,14),'auto');
 assert.ok(preview.vfx.effects.every(f=>f.id!=='archer_01'));
 const hit=preview.vfx.effects.find(f=>f.id==='mage_01');assert.equal(hit.e.x,1.4);assert.equal(hit.e.z,-1.2);
 preview.advance(.1);preview.advance(.1);preview.advance(.1);assert.equal(preview.arrow,undefined);
});
