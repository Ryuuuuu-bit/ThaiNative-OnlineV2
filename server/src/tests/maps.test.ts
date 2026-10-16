import {CITY_SPAWN} from '@thainative/shared/maps';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MemoryStore } from '../store/memory.js';

test('legacy map migration runs once and preserves subsequent map and position',async()=>{
 const store=new MemoryStore(),account=await store.createGuest('maps'),c=await store.createCharacter(account.id,'MapsHero','mapshero');
 assert.equal(c.mapId,'city_plaza');assert.equal(c.posZ,CITY_SPAWN.z);
 await store.saveProgress(account.id,c.id,{...c,mapId:undefined,posX:12,posZ:11});
 const first=(await store.character(account.id,c.id))!;assert.equal(first.mapId,'city_plaza');assert.equal(first.posX,0);assert.equal(first.posZ,CITY_SPAWN.z);
 await store.saveProgress(account.id,c.id,{...first,mapId:'meadow',posX:2,posZ:-10,healerReadyAt:60000});
 for(let i=0;i<2;i++){const next=(await store.character(account.id,c.id))!;assert.equal(next.mapId,'meadow');assert.equal(next.posX,2);assert.equal(next.posZ,-10);assert.equal(next.healerReadyAt,60000);}
 const sql=await readFile(new URL('../../sql/008_maps.sql',import.meta.url),'utf8');
 assert.match(sql,/ADD COLUMN IF NOT EXISTS map_id text;/);assert.match(sql,/UPDATE tn2_characters SET map_id='city_plaza',pos_x=0,pos_z=5 WHERE map_id IS NULL;/);
 assert.match(sql,/ALTER COLUMN map_id SET DEFAULT 'city_plaza'/);
});
