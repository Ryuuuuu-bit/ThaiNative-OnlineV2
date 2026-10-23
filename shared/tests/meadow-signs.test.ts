import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameData} from '../src/index.node.js';
import {FIELD_PLACES} from '../src/game/maps.js';
import {importTiledMap} from '../src/game/tiled-map.js';

test('meadow route signs retain current monster names and levels through Tiled import',()=>{
 const source=importTiledMap(JSON.parse(readFileSync(new URL('../../../maps/south-meadow.tmj',import.meta.url),'utf8')));
 const monsters=loadGameData().monsters.monsters;
 for(const [prefix,id] of [['← สวนเก่า','lotus_rabbit'],['ข้ามสะพาน →','dew_beetle']]){
  const monster=monsters.find(m=>m.id===id)!;
  const sign=source.pois.find(p=>p.kind==='sign'&&p.name.startsWith(prefix));
  assert.ok(sign);assert.ok(sign.name.includes(monster.nameTh));assert.ok(sign.name.endsWith('Lv.'+monster.level));
  assert.deepEqual(FIELD_PLACES.meadow.find(p=>p.x===sign.x&&p.z===sign.z),sign);
 }
});
