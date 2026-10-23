import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {huntingCell} from '../src/hunting-monster-animation.ts';
import {monsterVisual,monsterSpecies} from '../src/monster-animation.ts';
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
  const visual=monsterVisual(id),m=manifest.species[visual.id];
  if(!m){
   const basicBase=new URL('../public/assets/monsters-painted/',import.meta.url),basic=JSON.parse(readFileSync(new URL('manifest.json',basicBase))),def=basic.species[monsterSpecies(id)];
   assert.ok(def,id);assert.ok(visual.scale>0&&visual.scale<=1);
   const textures=JSON.parse(readFileSync(new URL('../public/texture-manifest.json',import.meta.url)));
   for(const clip of Object.values(def.motions)){const url=textures['/assets/monsters-painted/'+clip.file]?.webp??('/assets/monsters-painted/'+clip.file);assert.ok(existsSync(new URL('../public'+url,import.meta.url)),id);}
   continue;
  }
  for(const name of ['idle','move','attack','hit','death']){
   const clip=m.motions[name];assert.ok(existsSync(new URL(clip.file,base)));
   assert.equal(clip.directions.length,4);assert.ok(clip.directions.every(r=>r.length===4));
  }
 }
});

test('all endgame sprite attacks hold anticipation until the authoritative long warning resolves',()=>{
 for(const region of ['dragon','volcano','fae','ocean','astral','abyss','confluence'])for(const windup of [1.4,2.2,3.2]){
  const e={...state,dataId:region+'_qa',motionDuration:windup+.7};
  assert.equal(huntingCell({...e,motionTime:windup-.001},.5,4).column,1);
  assert.equal(huntingCell({...e,motionTime:windup},.5,4).column,2);
 }
});
