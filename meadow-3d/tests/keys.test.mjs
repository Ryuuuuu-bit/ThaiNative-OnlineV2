import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {KEYS,isKey} from '../src/keys.ts';
test('every action has a binding and no keyboard code is shared',()=>{
 const seen=new Set();for(const codes of Object.values(KEYS)){assert.ok(codes.length);for(const code of codes){assert.equal(seen.has(code),false,`${code} bound twice`);seen.add(code);}}
});
test('WASD-friendly bindings preserve J/T and remove the old F meteor/Space dodge',()=>{
 for(const [action,primary]of Object.entries({attack:'Space',slot1:'Digit1',slot2:'Digit2',slot10:'Digit0',dash:'ShiftLeft',potion:'KeyR',auto:'KeyF',nextTarget:'Tab'}))assert.equal(KEYS[action][0],primary);
 assert.ok(isKey('attack','KeyJ'));assert.ok(isKey('auto','KeyT'));assert.ok(isKey('dash','ShiftRight'));
 assert.equal(isKey('dash','Space'),false);assert.equal(Object.values(KEYS).flat().includes('KeyQ'),false);assert.equal(Object.values(KEYS).flat().includes('KeyE'),false);assert.equal(isKey('dash','KeyE'),false);
});
test('hotbar is rendered from the server ten-slot state with touch expansion',()=>{const html=readFileSync(new URL('../play.html',import.meta.url),'utf8');assert.match(html,/id="job-hotbar"/);assert.match(html,/id="skills-more"/);assert.match(html,/id="skills-window"/);});
