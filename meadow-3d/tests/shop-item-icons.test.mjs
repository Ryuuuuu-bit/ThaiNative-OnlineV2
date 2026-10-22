import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {loadGameData} from '@the-beginning-online/shared';
import {itemIconCell} from '../src/item-icon.ts';
test('all shop items use real atlas frames, including level 99 and reused potion icons',()=>{
 const data=loadGameData();
 const pages=['v1','v2'].map(v=>JSON.parse(readFileSync(new URL(`../public/assets/items/items-${v}.json`,import.meta.url))).frames);
 for(const id of new Set(Object.values(data.economy.shops).flatMap(shop=>Object.keys(shop)))){
  const item=data.items.items.find(t=>t.id===id),cell=itemIconCell(id),frame=pages[Number(cell.v2)][item.icon];
  if(cell.image){assert.match(cell.image,/^\/assets\/(?:starter-loot|item-art-v2)\//);assert.ok(existsSync(new URL('../public'+cell.image,import.meta.url)));continue;}
  assert.ok(frame,`${id}: ${item.icon}`);assert.equal(cell.position,`${frame.x/64*25}% ${frame.y/64*25}%`);
 }
 assert.deepEqual(itemIconCell('eternal_sword'),itemIconCell('training_sword'));
 assert.deepEqual(itemIconCell('red_supreme'),itemIconCell('red_medium'));
});
