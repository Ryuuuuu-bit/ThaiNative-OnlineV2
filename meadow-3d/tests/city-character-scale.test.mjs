import test from 'node:test';
import assert from 'node:assert/strict';
import {heroBodyCalibration,HERO_WALK_CALIBRATION} from '../src/city-character-calibration.ts';
import {HERO_METRES} from '../src/world-scale.ts';
test('hero calibration keeps a fixed size per facing while ground contact follows each walking pose',()=>{
 assert.equal(HERO_METRES,2.1);
 for(const [direction,facing]of Object.keys(HERO_WALK_CALIBRATION).entries()){
  const scales=new Set(),feet=new Set();
  for(let frame=0;frame<12;frame++){
   const slot=direction*12+frame,c=heroBodyCalibration('walk',facing,slot%8,Math.floor(slot/8));
   scales.add(c.scale);feet.add(c.feet);assert.ok(c.feet>220&&c.feet<260);
  }
  assert.equal(scales.size,1);assert.ok(feet.size>1);
 }
 assert.equal(heroBodyCalibration('attack','SE',0,0),undefined);
});
