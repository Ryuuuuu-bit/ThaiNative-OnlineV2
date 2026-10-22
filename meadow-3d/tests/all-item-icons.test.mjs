import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameData} from '@the-beginning-online/shared';
import {itemIconCell} from '../src/item-icon.ts';
import {createHash} from 'node:crypto';

test('every item template resolves to its declared atlas frame or original SVG',()=>{
 const pages=['v1','v2'].map(v=>JSON.parse(readFileSync(new URL(`../public/assets/items/items-${v}.json`,import.meta.url))));
 for(const item of loadGameData().items.items){
  const resolved=itemIconCell(item.id);
  if(resolved.image){
   if(/^\/assets\/item-art-v[23]\//.test(resolved.image)){
    const directory=resolved.image.slice(0,resolved.image.lastIndexOf('/'));
    const manifest=JSON.parse(readFileSync(new URL('../public'+directory+'/manifest.json',import.meta.url),'utf8'));
    const file=manifest.files.find(f=>f.id===item.id)??manifest.files.find(f=>f.id===item.icon);assert.ok(file,item.id);
    const bytes=readFileSync(new URL('../public'+resolved.image,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,item.id);
    continue;
   }
   const source=readFileSync(new URL('../public'+resolved.image,import.meta.url),'utf8');
   assert.match(source,/<svg[^>]+viewBox="0 0 96 96"/);
   const geometry=source.replace(/<image\b[^>]*\bhref="data:image\/png;base64,([A-Za-z0-9+/=]+)"[^>]*\/?>/g,(_tag,base64)=>{const png=Buffer.from(base64,'base64');assert.ok(png.length>8&&png.length<1024*1024);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(item.id.startsWith('card_'));return '';});
   assert.doesNotMatch(geometry,/<(?:script|image|foreignObject)|(?:href|on\w+)\s*=/i);
   const receipt=JSON.parse(readFileSync(new URL('../public/assets/starter-loot/provenance.json',import.meta.url),'utf8'));
   assert.ok(receipt.files.includes(item.icon+'.svg'));continue;
  }
  const page=pages.findIndex(p=>Object.hasOwn(p.frames,item.icon));
  assert.notEqual(page,-1,`${item.id}: missing frame ${item.icon}`);
  const frame=pages[page].frames[item.icon];
  assert.deepEqual(itemIconCell(item.id),{v2:page===1,position:`${frame.x/64*25}% ${frame.y/64*25}%`},item.id);
 }
});

test('ruins, canyon and boss icons occupy slots 5 through 17 in order',()=>{
 const names=['stone_spore','relic_fang','rune_shard','ancient_vine','temple_seal','ore_slime','crag_fur','amber_dust','crag_root','titan_core','card_mist_warden','card_relic_warden','card_crag_titan'];
 const atlas=JSON.parse(readFileSync(new URL('../public/assets/items/items-v2.json',import.meta.url)));
 const items=loadGameData().items.items;
 names.forEach((id,i)=>{
  assert.equal(items.find(t=>t.id===id)?.icon,id);
  const slot=i+5;
  assert.deepEqual(atlas.frames[id],{index:25+slot,slot,x:slot%5*64,y:Math.floor(slot/5)*64,w:64,h:64});
 });
 assert.equal(atlas.reservedTransparentSlots,7);
 assert.equal(Object.keys(atlas.frames).length,18);
});
