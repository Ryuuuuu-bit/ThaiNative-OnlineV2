import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';
import {MONSTERS} from '../src/web/bestiary-model.ts';import {monsterVisual,monsterSpecies} from '../src/monster-animation.ts';
const base=new URL('../',import.meta.url),json=p=>JSON.parse(readFileSync(new URL(p,base),'utf8'));
const art='art/monster-origin-rebuild-v1/',digest=p=>createHash('sha256').update(readFileSync(new URL(p,base))).digest('hex');
test('retired monster artwork is preserved outside public and absent from runtime atlases',()=>{
 const retired=json(art+'retired-inventory.json'),hashes=new Set(retired.files.map(f=>f.sha256));
 assert.equal(retired.status,'archived-outside-public');assert.equal(retired.files.length,190);
 for(const file of retired.files){const relative=file.archivePath.replace('meadow-3d/','');assert.equal(digest(relative),file.sha256);}
 const inspect=dir=>{for(const file of readdirSync(new URL(dir,base),{withFileTypes:true})){const p=dir+'/'+file.name;if(file.isDirectory())inspect(p);else assert.equal(hashes.has(digest(p)),false,'retired bytes in shipping output: '+p);}};
 for(const group of ['monsters-painted','monsters-hunting'])inspect('public/assets/'+group);
 const textures=json('public/texture-manifest.json');assert.ok(Object.keys(textures).every(key=>!/^\/assets\/monsters-(painted|hunting)\//.test(key)));
});
test('all live monsters resolve to documented original sources and verified packed files',()=>{
 const provenance=json(art+'provenance.json'),basic=json('public/assets/monsters-painted/manifest.json'),hunting=json('public/assets/monsters-hunting/manifest.json'),expansion=json('public/assets/monsters-expansion-v1/manifest.json');
 assert.deepEqual(provenance.externalBaseImageReferences,[]);
 for(const [id,source]of Object.entries(provenance.sources)){
  assert.deepEqual(source.externalBaseImageReferences,[]);const report=json(art+'sources/'+id+'/base-report.json');assert.equal(report.provider,'codex');assert.deepEqual(report.refs,[]);
  assert.equal(digest(art+'sources/'+id+'/base.png'),source.baseSha256);
  assert.equal(json(art+'sources/'+id+'/motion-qa.json').accepted,true);
 }
 for(const file of provenance.files){
  assert.equal(digest('public/assets/'+file.group+'/'+file.file),file.sha256);
  for(const input of file.inputs??[])assert.equal(digest(art+'sources/'+file.sourceId+'/run/curated/'+input.file.split('/').at(-1)),input.sha256);
 }
 for(const m of MONSTERS){
  const id=monsterVisual(m.id).id,def=expansion.species[id]??hunting.species[id]??basic.species[monsterSpecies(m.id,m.boss)];assert.ok(def,m.id);
  if(!expansion.species[id])assert.ok(provenance.sources[def.sourceId],m.id+' lacks original source');
  for(const clip of Object.values(def.motions)){assert.equal(clip.frames,4);assert.equal(clip.directions.length,4);for(const row of clip.directions){assert.equal(row.length,4);for(const f of row){const [x,y,r,b]=f.bounds;assert.ok(x>=0&&y>=0&&r<=def.cellSize[0]&&b<=def.cellSize[1],m.id);}}}
 }
});
