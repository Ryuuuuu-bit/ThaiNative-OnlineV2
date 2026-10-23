import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadGameData} from '@the-beginning-online/shared';
import {itemIconCell} from '../src/item-icon.ts';
import {MATERIAL_ITEM_ART} from '../src/material-art-data.ts';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const hash=p=>createHash('sha256').update(read(p)).digest('hex');
const manifest=JSON.parse(read('meadow-3d/public/assets/item-art-v3/manifest.json'));

test('all remaining material and scroll placeholders use individual verified paintings',()=>{
 const data=loadGameData();
 assert.equal(manifest.files.length,100);
 assert.equal(manifest.files.filter(f=>f.kind==='material').length,95);
 assert.equal(manifest.files.filter(f=>f.kind==='consumable').length,5);
 assert.equal(new Set(manifest.files.map(f=>f.sha256)).size,100);
 assert.deepEqual(Object.keys(MATERIAL_ITEM_ART).sort(),manifest.files.map(f=>f.id).sort());
 for(const item of data.items.items)assert.ok(!itemIconCell(item.id).image?.startsWith('/assets/starter-loot/'),item.id+' still uses a placeholder');
 for(const entry of manifest.files){
  assert.ok(data.items.items.some(i=>i.id===entry.id&&i.type===entry.kind));
  assert.equal(itemIconCell(entry.id).image,'/assets/item-art-v3/'+entry.file);
  const path='meadow-3d/public/assets/item-art-v3/'+entry.file,png=read(path);
  assert.equal(hash(path),entry.sha256);assert.equal(hash(entry.source),entry.sourceSha256);
  assert.equal(hash(entry.sourceReceipt),entry.receiptSha256);
  const receipt=JSON.parse(read(entry.sourceReceipt));
  assert.equal(receipt.provider,'built-in image_gen');assert.equal(receipt.transparent_background,true);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),192);assert.equal(png.readUInt32BE(20),192);assert.equal(png[25],6);
  const [x,y,r,b]=entry.bounds;assert.ok(x>=8&&y>=8&&r<=184&&b<=184,entry.id);
  assert.equal(entry.clippedPixels,0);
 }
});
