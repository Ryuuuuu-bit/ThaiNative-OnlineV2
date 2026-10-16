import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../public/assets/env-painted/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
const pngSize=file=>{const b=readFileSync(new URL(file,root));assert.equal(b.toString('ascii',1,4),'PNG');return[b.readUInt32BE(16),b.readUInt32BE(20)];};
test('painted environment manifest keeps every asset in non-overlapping atlas bounds',()=>{
 assert.equal(manifest.assets.length,35);assert.equal(new Set(manifest.assets.map(a=>a.name)).size,35);
 assert.ok(manifest.atlases.length<=3);
 for(const atlas of manifest.atlases){
  assert.deepEqual(atlas.size,[2048,2048]);assert.deepEqual(pngSize(atlas.file),atlas.size);
  const entries=manifest.assets.filter(a=>a.atlas===atlas.file);
  for(const [i,a]of entries.entries()){
   const[x,y,w,h]=a.rect;assert.ok(x>=8&&y>=8&&x+w<=2040&&y+h<=2040);
   assert.deepEqual(a.pixelSize,[w,h]);assert.deepEqual(a.uvRect,[x/2048,1-(y+h)/2048,w/2048,h/2048]);
   assert.ok(a.anchor.every(v=>v>=0&&v<=1));
   assert.deepEqual(a.worldSize,a.sourcePixelSize.map(v=>v/113));
   assert.ok(a.pixelSize.every((v,i)=>Math.abs(v-a.sourcePixelSize[i]*.5)<=.5));
   for(const b of entries.slice(i+1)){const[bx,by,bw,bh]=b.rect;assert.ok(x+w<=bx||bx+bw<=x||y+h<=by||by+bh<=y,`${a.name} overlaps ${b.name}`);}
  }
 }
});
test('all five painted surface maps are 1024 square and the bridge/base are flat decals',()=>{
 assert.deepEqual(Object.keys(manifest.tiles).sort(),['dirt','grass','stone','transition','water']);
 for(const tile of Object.values(manifest.tiles))assert.deepEqual(pngSize(tile.file),[1024,1024]);
 assert.equal(manifest.assets.find(a=>a.name==='bridge').flat,true);
 assert.equal(manifest.assets.find(a=>a.name==='stone-circle').flat,true);
});
