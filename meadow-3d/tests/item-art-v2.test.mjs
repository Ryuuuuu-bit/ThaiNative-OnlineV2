import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadGameData} from '@the-beginning-online/shared';
import {PAINTED_ITEM_ART} from '../src/item-art-data.ts';
import {CLASS_ITEM_ART} from '../src/class-item-art-data.ts';
import {itemIconCell} from '../src/item-icon.ts';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root)),json=p=>JSON.parse(read(p)),hash=p=>createHash('sha256').update(read(p)).digest('hex');
const manifest=json('meadow-3d/public/assets/item-art-v2/manifest.json'),data=loadGameData();

test('every field base, Unique and card has a matching verified original icon',()=>{
 const expected=data.items.items.filter(i=>/^(?:field_|unique_|card_)/.test(i.id));
 assert.equal(manifest.files.length,191);assert.equal(Object.keys(PAINTED_ITEM_ART).length,191);
 assert.equal(new Set(manifest.files.map(f=>f.id)).size,191);
 for(const item of expected){
  const entry=manifest.files.find(f=>f.id===item.id);
  if(entry)assert.equal(itemIconCell(item.id).image,'/assets/item-art-v2/'+entry.file);
  else if(CLASS_ITEM_ART[item.id])assert.equal(itemIconCell(item.id).image,'/assets/class-items-v1/'+CLASS_ITEM_ART[item.id]);
  else {const source=data.items.items.find(i=>i.id===item.icon);assert.ok(source&&source.id!==item.id,item.id);assert.deepEqual(itemIconCell(item.id),itemIconCell(source.id),item.id);}
 }
 assert.equal(manifest.files.filter(f=>f.kind==='material').length,11);
 for(const entry of manifest.files){
  assert.ok(data.items.items.some(i=>i.id===entry.id),entry.id);
  assert.equal(hash('meadow-3d/public/assets/item-art-v2/'+entry.file),entry.sha256,entry.id);
  assert.equal(hash(entry.source),entry.sourceSha256,entry.id);
  const receipt=json(entry.sourceReceipt);assert.equal(receipt.provider,'codex');assert.deepEqual(receipt.refs,[]);
 }
 assert.deepEqual(manifest.externalReferences,[]);
 assert.notEqual(itemIconCell('card_grove_crown').image,itemIconCell('card_crag_titan').image);
 assert.notEqual(itemIconCell('card_moon_titan').image,itemIconCell('card_crag_titan').image);
 for(const source of manifest.sources){assert.equal(hash(source.source),source.sha256);assert.equal(hash(source.receipt),source.receiptSha256);}
});

test('painted gear is distinct across levels, and raster cuts are RGBA with safe margins',()=>{
 const gear=manifest.files.filter(f=>f.kind==='gear');assert.equal(gear.length,56);
 assert.equal(new Set(gear.map(f=>f.sha256)).size,56);
 for(const entry of manifest.files.filter(f=>f.kind!=='card')){
  const png=read('meadow-3d/public/assets/item-art-v2/'+entry.file);
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(png.readUInt32BE(16),192);assert.equal(png.readUInt32BE(20),192);assert.equal(png[25],6);
  assert.equal(entry.clippedPixels,0);const [x,y,r,b]=entry.bounds;assert.ok(x>0&&y>0&&r<192&&b<192,entry.id);
 }
});

test('cards retain the actual drop owner, readable creature art and safe inline SVG',()=>{
 for(const entry of manifest.files.filter(f=>f.kind==='card')){
  const owner=data.monsters.monsters.find(m=>m.id===entry.monster);assert.ok(owner.drops.some(d=>d.item===entry.id),entry.id);
  assert.equal(entry.boss,owner.boss);assert.equal(entry.element,owner.element);
  const svg=read('meadow-3d/public/assets/item-art-v2/'+entry.file).toString('utf8');assert.match(svg,/<svg[^>]+viewBox="0 0 96 96"/);
  let images=0;const geometry=svg.replace(/<image\b[^>]*\bhref="data:image\/png;base64,([A-Za-z0-9+/=]+)"[^>]*\/?>/g,(_tag,base64)=>{const png=Buffer.from(base64,'base64');assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(png.length<1024*1024);images++;return '';});
  assert.equal(images,1,entry.id);assert.doesNotMatch(geometry,/<(?:script|image|foreignObject)|(?:href|on\w+)\s*=/i);
 }
});
