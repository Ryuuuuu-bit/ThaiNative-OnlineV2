import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MAP_IDS} from '@the-beginning-online/shared/maps';
import {fieldPalette} from '../src/field-palette.ts';
import {fieldRoadTexture,groundWear,meadowTrees} from '../src/field-ground.ts';

test('outdoor roads resolve to packaged art and city keeps its approved paving',()=>{
 for(const id of MAP_IDS){const file=fieldRoadTexture(id);assert.ok(existsSync(new URL('../public'+file,import.meta.url)),`${id}: ${file}`);}
 assert.equal(fieldRoadTexture('city_plaza'),'/assets/city-sprite-v2/ground-road.webp');
 assert.deepEqual(fieldPalette('city_plaza'),{filter:'none',tint:'#00000000',wear:'95,119,39'});
 const source=JSON.parse(readFileSync(new URL('../public/assets/field-painted-v2/provenance.json',import.meta.url)));
 assert.equal(source.assets.length,5);for(const a of source.assets){assert.ok(a.prompt.length>100);assert.equal(createHash('sha256').update(readFileSync(new URL('../public/assets/field-painted-v2/'+a.file,import.meta.url))).digest('hex'),a.runtimeSha256);}
});

test('meadow reuses only leafy tree sheets and their authored foot anchors',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/city-sprite-v2/manifest.json',import.meta.url))),loaded=[];
 const trees=await meadowTrees({async json(){return manifest;},async image(url){loaded.push(url);return {url};}});
 assert.equal(loaded.length,3);
 for(const [name,tree]of trees){const a=manifest.assets[name];assert.deepEqual(tree.rect,a.views[0].rect);assert.deepEqual(tree.anchor,a.views[0].anchor);assert.equal(tree.image.url,a.image);}
 assert.ok(!loaded.some(url=>/building|npc|wall/.test(url)));
});

test('snow, astral and ocean wear stay in their own palette and restore canvas state',()=>{
 for(const id of MAP_IDS.filter(id=>id!=='city_plaza')){
  const palette=fieldPalette(id);assert.match(palette.tint,/^#[0-9a-f]{8}$/i);assert.ok(palette.filter);
  const stops=[];let depth=0,fills=0;
  const c={save(){depth++;},restore(){depth--;},createRadialGradient(){return{addColorStop(at,colour){stops.push(colour);}};},fillRect(){fills++;}};
  groundWear(c,12,12,id);assert.equal(depth,0);assert.ok(fills>0);assert.ok(stops.includes(`rgba(${palette.wear},.1)`));
 }
 assert.notEqual(fieldPalette('frost').wear,fieldPalette('meadow').wear);
 assert.notEqual(fieldPalette('astral').wear,fieldPalette('meadow').wear);
});
