import test from 'node:test';
import assert from 'node:assert/strict';
import {gridPath} from '../src/hud-path.ts';
import {KEYS,isKey} from '../src/keys.ts';
test('H and Z are distinct return and pickup actions',()=>{assert.equal(KEYS.returnCity[0],'KeyH');assert.equal(KEYS.pickupAll[0],'KeyZ');assert.ok(isKey('returnCity','KeyH'));assert.equal(isKey('pickupAll','KeyH'),false);});
test('grid route goes around a wall and never enters a blocked cell',()=>{const walk=(x,z)=>Math.abs(x)<6&&Math.abs(z)<6&&!(x>1&&x<3&&z<2);const path=gridPath({x:0,z:0},{x:4,z:0},walk);assert.ok(path.length>4);for(const p of path)assert.ok(walk(p.x,p.z));assert.deepEqual(path.at(-1),{x:4,z:0});assert.deepEqual(gridPath({x:0,z:0},{x:30,z:0},walk),[]);});
