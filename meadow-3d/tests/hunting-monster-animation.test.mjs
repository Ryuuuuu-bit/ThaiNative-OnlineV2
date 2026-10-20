import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {huntingCell} from '../src/hunting-monster-animation.ts';
import {LAYOUTS,FIELD_BOSS} from '@the-beginning-online/shared/maps';
const state={motion:'attack',motionTime:0,motionDuration:.85,fx:1,fz:0};
test('attack contact aligns with authoritative damage thresholds',()=>{
 for(const windup of [.4,.5,.55,.7,.75]){
  assert.equal(huntingCell({...state,motionTime:windup-.0001},windup).column,2);
  assert.equal(huntingCell({...state,motionTime:windup},windup).column,3);
 }
 for(const [motion,threshold] of Object.entries({slam:.85,sweep:.7,charge:.8,spit:.8,summon:.9})){
  assert.equal(huntingCell({...state,motion,motionDuration:1.8,motionTime:threshold-.001}).column,2);
  assert.equal(huntingCell({...state,motion,motionDuration:1.8,motionTime:threshold}).column,3);
 }
});
test('death wins over hurt and holds last pose; movement loops all six frames',()=>{
 assert.deepEqual(huntingCell({...state,dead:true,hurt:.18,motionTime:3}).motion,'death');
 assert.equal(huntingCell({...state,dead:true,motionTime:3}).column,5);
 assert.equal(huntingCell({...state,motion:'hop',motionTime:.6}).column,0);
 assert.equal(huntingCell({...state,motion:'hop',motionTime:.55}).column,5);
 assert.equal(huntingCell({...state,motion:'idle',hurt:.18}).motion,'hit');
 assert.equal(huntingCell({...state,motionTime:.6,hurt:.18}).motion,'attack','hurt must not hide contact');
});
test('every map spawn, boss and summoned minion has a shipped atlas',()=>{
 const base=new URL('../public/assets/monsters-hunting/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)));
 for(const map of ['ruins','canyon'])for(const id of [...LAYOUTS[map].spawns.map(s=>s.dataId),FIELD_BOSS[map].dataId,FIELD_BOSS[map].minion]){
  const m=manifest.species[id];assert.ok(m,id);
  for(const name of ['idle','move','attack','hit','death']){
   const clip=m.motions[name];assert.ok(existsSync(new URL(clip.file,base)));
   assert.equal(clip.directions.length,4);assert.ok(clip.directions.every(r=>r.length===6));
  }
 }
});
