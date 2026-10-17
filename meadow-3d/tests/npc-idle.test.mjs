import test from 'node:test';
import assert from 'node:assert/strict';
import {NPC_IDLE_PROFILES,npcIdleFrame} from '../src/npc-idle.ts';

test('occupational idles hold, gesture and loop without stepping outside the four-frame atlas',()=>{
 for(const [row,profile] of NPC_IDLE_PROFILES.entries()){
  let elapsed=0;
  for(const [frame,hold] of profile.holds.entries()){
   assert.equal(npcIdleFrame(row,elapsed+hold/2),frame,profile.role);
   elapsed+=hold;
  }
  assert.equal(npcIdleFrame(row,elapsed+.01),0);
  assert.equal(npcIdleFrame(row,1.2,2.3),npcIdleFrame(row,3.5));
 }
});

test('citizens have different cadences and remain safe across clock resets',()=>{
 assert.equal(new Set(NPC_IDLE_PROFILES.map(p=>p.holds.join(','))).size,5);
 const patterns=NPC_IDLE_PROFILES.map((_,row)=>Array.from({length:100},(_,i)=>npcIdleFrame(row,i*.1,row*.73)).join(''));
 assert.equal(new Set(patterns).size,5);
 for(const time of [-10,0,10000,NaN,Infinity])assert.ok([0,1,2,3].includes(npcIdleFrame(4,time)));
});
