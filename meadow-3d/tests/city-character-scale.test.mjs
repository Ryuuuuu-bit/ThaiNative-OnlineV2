import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO_METRES} from '../src/world-scale.ts';
import {CITIZEN_PROFILES} from '../src/city-2d-citizens.ts';
import {CITIZEN_CALIBRATION,HERO_WALK_CALIBRATION,heroBodyCalibration} from '../src/city-character-calibration.ts';
import {CITY_NPC_CLIPS} from '../src/city-npc-clips.ts';
import {CITY_SPRITEGEN_CLIPS} from '../src/city-spritegen-clips.ts';
import {cityNpcSprite} from '../src/city-npc-sprite.ts';

test('adults share hero stature, while the two named children keep their own size',()=>{
 for(const p of CITIZEN_PROFILES){
  assert.equal(p.height,[30,33].includes(p.id)?1.45:HERO_METRES);
  const c=CITIZEN_CALIBRATION[p.key];
  assert.ok(c.bodyPixels>80);assert.equal(c.feet.length,4);
  assert.ok(c.feet.every(f=>f>c.bodyPixels*.8));
 }
 for(const [id,c] of Object.entries({...CITY_NPC_CLIPS,...CITY_SPRITEGEN_CLIPS})){
  assert.equal(c.worldHeight,HERO_METRES,id);
  const s=cityNpcSprite({},id);
  assert.ok(Math.abs(s.height*(c.bodyBounds[3]-c.bodyBounds[1])/c.cell[1]-HERO_METRES)<1e-10,id);
 }
});

test('weapons and feathers do not shrink the body, and every hero facing has a fixed calibration',()=>{
 assert.ok(CITY_NPC_CLIPS.guard.bodyBounds[1]>30);
 assert.ok(CITY_SPRITEGEN_CLIPS.minstrel.bodyBounds[1]>=44);
 assert.equal(Object.keys(HERO_WALK_CALIBRATION).length,8);
 for(const c of Object.values(HERO_WALK_CALIBRATION)){
  assert.ok(c.scale>.9&&c.scale<1.1);assert.ok(c.feet>230&&c.feet<250);
 }
});

test('walk registration follows the correct facing and frame without changing its body scale',()=>{
 const directions=Object.keys(HERO_WALK_CALIBRATION);
 for(const [direction,facing]of directions.entries()){
  const scales=new Set(),feet=new Set();
  for(let frame=0;frame<12;frame++){
   const index=direction*12+frame,c=heroBodyCalibration('walk',facing,index%8,Math.floor(index/8));
   scales.add(c.scale);feet.add(c.feet);assert.ok(c.feet>220&&c.feet<260);
  }
  assert.equal(scales.size,1);assert.ok(feet.size>1);
 }
 assert.equal(heroBodyCalibration('attack','SE',0,0),undefined);
 assert.equal(heroBodyCalibration('death','NW',0,0),undefined);
});
