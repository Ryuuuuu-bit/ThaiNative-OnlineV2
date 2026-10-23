import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO_ATTACHMENTS,modularLayers} from '../src/modular-hero.ts';
import {MODULAR_MOTIONS,MODULAR_IMPACT_FRAME,MODULAR_BOW,modularPose,animateModularLayers,transformPoint} from '../src/modular-hero-motion.ts';

test('all animated poses keep reachable joints, rigid limb lengths, and held equipment attached',()=>{
 for(const outfit of ['base','traveler','guardian'])for(const motion of ['walk','attack','cast','heal'])for(let frame=0;frame<MODULAR_MOTIONS[motion].frames;frame++){
  for(const sword of ['iron','falchion','bow'])for(const shield of [false,true]){
   const look={outfit,sword,shield},mount=HERO_ATTACHMENTS[outfit];
   const {pose,layers}=animateModularLayers(look,motion,frame,mount,modularLayers(look));
   for(const leg of pose.legs){
    assert.ok(leg.reachable,JSON.stringify({outfit,motion,frame,leg}));
    assert.ok(Math.abs(Math.hypot(leg.knee[0]-leg.hip[0],leg.knee[1]-leg.hip[1])-leg.upperLength)<1e-7);
    assert.ok(Math.abs(Math.hypot(leg.ankle[0]-leg.knee[0],leg.ankle[1]-leg.knee[1])-leg.lowerLength)<1e-7);
    if(leg.planted)assert.equal(leg.lift,0);
   }
   const weapon=layers.find(l=>l.asset===sword),grip=transformPoint(weapon.transform,weapon.target);
   assert.deepEqual(grip,pose.arms[sword==='bow'?'left':'right'].grip,'weapon uses the holding hand transform and socket');
   if(shield&&sword!=='bow'){const layer=layers.at(-1);assert.equal(layer.asset,'shield');assert.deepEqual(transformPoint(layer.transform,layer.target),pose.arms.left.grip);}
   assert.equal(layers.some(l=>l.asset==='shield'),shield&&sword!=='bow');
   for(const layer of layers){
    if(layer.transform){assert.ok(layer.transform.every(Number.isFinite));const [a,b,c,d]=layer.transform;assert.ok(Math.abs(a*d-b*c-1)<1e-10,'rig does not stretch artwork');}
    if(layer.clip)assert.ok(layer.clip.length>=3);
   }
  }
 }
});

test('pose sampling rejects invalid frame values and the attack recovers before looping',()=>{
 for(const motion of Object.keys(MODULAR_MOTIONS)){
  const mount=HERO_ATTACHMENTS.traveler;
  assert.deepEqual(modularPose(motion,NaN,mount),modularPose(motion,0,mount));
 }
 const mount=HERO_ATTACHMENTS.guardian,first=modularPose('attack',0,mount),last=modularPose('attack',11,mount);
 for(const side of ['right','left'])assert.ok(Math.hypot(first.arms[side].grip[0]-last.arms[side].grip[0],first.arms[side].grip[1]-last.arms[side].grip[1])<1,'attack recovers before looping');
});

test('bow draws from the right hand, releases its string, and keeps its left-hand grip across both outfits',()=>{
 for(const outfit of ['traveler','guardian']){
  const mount=HERO_ATTACHMENTS[outfit],look={outfit,sword:'bow',shield:true};
  const before=modularPose('attack',MODULAR_IMPACT_FRAME.bow-1,mount,'bow'),release=modularPose('attack',MODULAR_IMPACT_FRAME.bow,mount,'bow');
  assert.deepEqual(before.bow.nock,before.arms.right.grip);
  assert.deepEqual(before.bow.arrow.tail,before.arms.right.grip);
  assert.ok(before.bow.nock[0]<before.arms.left.grip[0]-180,'draw has a visible pull');
  assert.equal(before.bow.released,false);assert.equal(release.bow.released,true);
  assert.ok(release.bow.nock[0]-release.arms.right.grip[0]>80,'released string separates from the drawing hand');
  assert.ok(release.bow.arrow.tail[0]>release.bow.nock[0],'arrow travels away from the bow');
  for(const motion of Object.keys(MODULAR_MOTIONS))for(let frame=0;frame<MODULAR_MOTIONS[motion].frames;frame++){
   const {layers,pose}=animateModularLayers(look,motion,frame,mount,modularLayers(look));
   assert.equal(layers.filter(l=>l.asset==='bow').length,1);
   assert.ok(!layers.some(l=>['iron','falchion','shield'].includes(l.asset)));
   const bow=layers.find(l=>l.asset==='bow'),hand=bow.transform??[1,0,0,1,0,0];
   const globalAngle=Math.atan2(hand[1],hand[0])+bow.rotation;
   assert.ok(Math.abs(globalAngle-MODULAR_BOW.rotation)<1e-9,'string tip orientation follows the drawn bow art');
   assert.deepEqual(transformPoint(hand,bow.target),pose.arms.left.grip);
   for(const p of [pose.bow.top,pose.bow.bottom,pose.bow.nock,...Object.values(pose.bow.arrow??{})]){
    assert.ok(p.every(Number.isFinite));assert.ok(p[0]>-170&&p[0]<1427&&p[1]>-323&&p[1]<1277,'bow and arrow fit the fixed atlas cell');
   }
  }
 }
});

test('cast and heal move the free hand while retaining held equipment and return to standing',()=>{
 for(const sword of ['iron','bow'])for(const outfit of ['traveler','guardian'])for(const motion of ['cast','heal']){
  const mount=HERO_ATTACHMENTS[outfit],first=modularPose(motion,0,mount,sword),peak=modularPose(motion,5,mount,sword),last=modularPose(motion,11,mount,sword);
  assert.ok(Math.hypot(peak.arms.right.grip[0]-first.arms.right.grip[0],peak.arms.right.grip[1]-first.arms.right.grip[1])>100);
  for(const side of ['right','left'])assert.ok(Math.hypot(first.arms[side].grip[0]-last.arms[side].grip[0],first.arms[side].grip[1]-last.arms[side].grip[1])<1);
  assert.equal(peak.bow?.arrow,undefined,'casting does not fire a bow arrow');
 }
});
