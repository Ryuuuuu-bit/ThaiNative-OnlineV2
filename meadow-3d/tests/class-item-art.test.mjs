import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadGameData} from '@the-beginning-online/shared';
import {CLASS_ITEM_ART} from '../src/class-item-art-data.ts';
import {itemIconCell} from '../src/item-icon.ts';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url));
const json=p=>JSON.parse(read(p).toString('utf8').replace(/^\uFEFF/,''));
const hash=p=>createHash('sha256').update(read(p)).digest('hex');
const plan=json('meadow-3d/art/class-items-v1/catalog.json');
const manifest=json('meadow-3d/public/assets/class-items-v1/manifest.json');
const data=loadGameData();

test('all 208 new class items, including seven Unique items, resolve to their own original illustration',()=>{
 assert.equal(plan.length,208);assert.equal(manifest.files.length,208);assert.equal(Object.keys(CLASS_ITEM_ART).length,208);
 assert.equal(manifest.files.filter(f=>f.kind==='unique').length,7);
 assert.deepEqual(new Set(manifest.files.map(f=>f.id)),new Set(plan.map(i=>i.id)));
 assert.equal(new Set(manifest.files.map(f=>f.sha256)).size,208);
 for(const item of plan){
  const record=manifest.files.find(f=>f.id===item.id);assert.ok(record,item.id);
  assert.equal(data.items.items.find(i=>i.id===item.id)?.icon,item.id,item.id);
  assert.equal(itemIconCell(item.id).image,'/assets/class-items-v1/'+record.file,item.id);
  assert.equal(CLASS_ITEM_ART[item.id],item.id+'.png');
 }
});

test('class icons retain alpha, safe framing, source provenance and verified bytes',()=>{
 assert.equal(hash(manifest.styleReference.source),manifest.styleReference.sha256);
 assert.deepEqual(manifest.externalReferences,[]);
 for(const record of manifest.files){
  const file='meadow-3d/public/assets/class-items-v1/'+record.file,png=read(file);
  assert.equal(hash(file),record.sha256,record.id);
  assert.equal(hash(record.source),record.sourceSha256,record.id);
  assert.equal(hash(record.receipt),record.receiptSha256,record.id);
  const receipt=json(record.receipt);assert.equal(receipt.provider,'image_gen');assert.equal(receipt.id,record.id);assert.equal(receipt.transparentRequested,true);assert.ok(receipt.prompt.length>100);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),192);assert.equal(png.readUInt32BE(20),192);assert.equal(png[25],6);
  const [x,y,r,b]=record.bounds;assert.ok(x>=8&&y>=8&&r<=184&&b<=184,record.id);
 }
});
