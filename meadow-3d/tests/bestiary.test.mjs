import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {MONSTERS,FIELDS,monsterMaps,filterMonsters,itemName,dropPercent,respawnMinutes} from '../src/web/bestiary-model.ts';
import {monsterSpecies,monsterVisual} from '../src/monster-animation.ts';
test('bestiary covers every monster and boss with a real habitat and readable drop names',()=>{
 assert.equal(new Set(MONSTERS.map(m=>m.id)).size,MONSTERS.length);
 assert.equal(filterMonsters('','all','boss').length,FIELDS.length+1);
 assert.deepEqual(monsterMaps('thorn_nest_mother'),['forest']);
 for(const m of MONSTERS){assert.ok(monsterMaps(m.id).length,m.id);for(const d of m.drops)assert.notEqual(itemName(d.item),d.item);if(m.boss)assert.ok(respawnMinutes(m.id)>0);}
 assert.equal(dropPercent(.0002),'0.02%');assert.equal(dropPercent(.8),'80%');
});
test('search finds Thai names and real drop items while map and boss filters intersect',()=>{
 assert.equal(filterMonsters('ราชาวุ้น')[0].id,'king_jelly');assert.ok(filterMonsters('การ์ดราชาวุ้น').some(m=>m.id==='king_jelly'));
 assert.equal(filterMonsters('ราชาวุ้น','forest').length,0);assert.equal(filterMonsters('','canyon','boss')[0].id,'crag_titan');assert.equal(filterMonsters('ไม่พบชื่อนี้').length,0);
 const hp=filterMonsters('','all','all','hp');assert.ok(hp.every((m,i)=>!i||hp[i-1].hp>=m.hp));
});
test('every bestiary portrait uses a valid first-frame crop from the actual game atlas',()=>{
 const basic=JSON.parse(readFileSync('meadow-3d/public/assets/monsters-painted/manifest.json','utf8')),hunting=JSON.parse(readFileSync('meadow-3d/public/assets/monsters-hunting/manifest.json','utf8'));
 const expansion=JSON.parse(readFileSync('meadow-3d/public/assets/monsters-expansion-v1/manifest.json','utf8'));
 for(const m of MONSTERS){const id=monsterVisual(m.id).id,def=expansion.species[id]??hunting.species[id]??basic.species[monsterSpecies(m.id,m.boss)],bounds=def.motions.idle.directions[0][0].bounds;assert.ok(bounds[0]>=0&&bounds[1]>=0&&bounds[2]>bounds[0]&&bounds[3]>bounds[1],m.id);assert.ok(bounds[2]<=def.cellSize[0]&&bounds[3]<=def.cellSize[1],m.id);}
});
