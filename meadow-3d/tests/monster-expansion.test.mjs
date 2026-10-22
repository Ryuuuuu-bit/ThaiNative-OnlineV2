import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {huntingCell} from '../src/hunting-monster-animation.ts';
import {monsterVisual} from '../src/monster-animation.ts';
import {LAYOUTS,FIELD_BOSS} from '@the-beginning-online/shared/maps';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const root='../public/assets/monsters-expansion-v1/';
test('new runtime creatures use reviewed original generation records and unchanged packed files',()=>{
 const manifest=json(root+'manifest.json'),groups=['monster-expansion-v1','starter-monsters-v1','greek-monsters-v1','himmapan-monsters-v1','desert-monsters-v1','frost-monsters-v1','yokai-monsters-v1','confluence-monsters-v1','abyss-monsters-v1','astral-monsters-v1','ocean-monsters-v1','fae-monsters-v1','volcano-monsters-v1','dragon-monsters-v1'];
 const claimed=[];
 for(const group of groups){const provenance=json(`../art/${group}/provenance.json`);assert.deepEqual(provenance.externalBaseImageReferences,[]);
  for(const source of provenance.sources){claimed.push(source.id);assert.equal(source.curatedOnly,true);const report=json(`../art/${group}/${source.id}/base-report.json`);assert.equal(report.provider,'codex');assert.deepEqual(report.refs,[]);assert.equal(json(`../art/${group}/${source.id}/motion-qa.json`).accepted,true);}
  for(const file of provenance.files)assert.equal(createHash('sha256').update(readFileSync(new URL(root+file.file,import.meta.url))).digest('hex'),file.sha256);
 }
 assert.equal(new Set(claimed).size,claimed.length);assert.deepEqual(Object.keys(manifest.species).sort(),claimed.sort());
 for(const def of Object.values(manifest.species))for(const clip of Object.values(def.motions))for(const row of clip.directions)for(const frame of row){
  const [x,y,right,bottom]=frame.bounds;assert.ok(x>=0&&y>=0&&right>x&&bottom>y);assert.ok(right<=def.cellSize[0]&&bottom<=def.cellSize[1],'hit-test bounds must be local to a frame');
 }
 for(const map of ['grove','summit','temple','himmapan','desert','frost','yokai'])for(const id of [...LAYOUTS[map].spawns.map(s=>s.dataId),FIELD_BOSS[map].dataId,FIELD_BOSS[map].minion]){
  const def=manifest.species[monsterVisual(id).id];assert.ok(def,id);
  for(const name of ['idle','move','attack','hit','death']){const clip=def.motions[name];assert.equal(clip.columns,4);assert.equal(clip.rows,4);assert.equal(clip.directions.length,4);assert.ok(clip.directions.every(row=>row.length===4));}
 }
 for(const [map,id]of [['forest','bud_shroom'],['ruins','clay_puff'],['canyon','pebble_puff']])for(const spawn of LAYOUTS[map].spawns.filter(s=>s.dataId.startsWith(map+'_young_')))assert.equal(monsterVisual(spawn.dataId).id,id);
});
test('four-frame sprites preserve server impact timing, movement loops and death hold',()=>{
 const base={motion:'attack',motionTime:0,motionDuration:1,fx:1,fz:0};
 for(const windup of [.4,.5,.7]){
  assert.equal(huntingCell({...base,motionTime:windup-.001},windup,4).column,1);
  assert.equal(huntingCell({...base,motionTime:windup},windup,4).column,2);
 }
 assert.equal(huntingCell({...base,dead:true,motionTime:20},.5,4).column,3);
 assert.equal(huntingCell({...base,motion:'hop',motionTime:.6},.5,4).column,0);
});

test('Regional attack animation contact uses the actual special-action windup, including phase2',()=>{for(const dataId of ['himmapan_08','desert_08','frost_08','yokai_08'])for(const windup of [1.1,1.2,1.4,1.6,1.8,2.1,2.3]){const state={dataId,motion:'attack',motionDuration:windup+.7,fx:1,fz:0};assert.equal(huntingCell({...state,motionTime:windup-.001},2.1,4).column,1);assert.equal(huntingCell({...state,motionTime:windup},2.1,4).column,2);}});
