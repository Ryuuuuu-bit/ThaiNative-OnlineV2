import test from 'node:test';
import assert from 'node:assert/strict';
import {gridPath} from '../src/hud-path.ts';
import {KEYS,isKey} from '../src/keys.ts';
test('return city keeps its shortcut and Z is free for rebinding',()=>{assert.equal(KEYS.returnCity[0],'KeyH');assert.ok(isKey('returnCity','KeyH'));assert.equal(Object.values(KEYS).flat().includes('KeyZ'),false);});
test('grid route goes around a wall and never enters a blocked cell',()=>{const walk=(x,z)=>Math.abs(x)<6&&Math.abs(z)<6&&!(x>1&&x<3&&z<2);const path=gridPath({x:0,z:0},{x:4,z:0},walk);assert.ok(path.length>4);for(const p of path)assert.ok(walk(p.x,p.z));assert.deepEqual(path.at(-1),{x:4,z:0});assert.deepEqual(gridPath({x:0,z:0},{x:30,z:0},walk),[]);});
