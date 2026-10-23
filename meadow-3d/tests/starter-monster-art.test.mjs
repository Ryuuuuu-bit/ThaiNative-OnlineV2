import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
test('12 original starter designs have approved native animation frames, transparent atlases and source receipts',()=>{
 const root='meadow-3d/public/assets/monsters-expansion-v1/',manifest=json(root+'manifest.json'),art='meadow-3d/art/starter-monsters-v1/',provenance=json(art+'provenance.json');
 assert.equal(provenance.sources.length,12);assert.equal(provenance.files.length,60);assert.deepEqual(provenance.externalBaseImageReferences,[]);
 for(const src of provenance.sources){const report=json(art+src.id+'/base-report.json');assert.equal(report.provider,'codex');assert.deepEqual(report.refs,[]);assert.equal(json(art+src.id+'/motion-qa.json').accepted,true);
  const def=manifest.species[src.id];assert.ok(def,src.id);
  for(const motion of ['idle','move','attack','hit','death']){const clip=def.motions[motion];assert.equal(clip.columns,4);assert.equal(clip.rows,4);assert.ok(clip.directions.every(row=>row.length===4));}
  const frameHashes=new Set();for(let i=0;i<4;i++)frameHashes.add(createHash('sha256').update(readFileSync(art+src.id+`/curated/down45_attack-frame-${i}.png`)).digest('hex'));assert.ok(frameHashes.size>=3,src.id+' attack must have authored windup, contact and recovery');
 }
 for(const file of provenance.files)assert.equal(createHash('sha256').update(readFileSync(root+file.file)).digest('hex'),file.sha256);
});
