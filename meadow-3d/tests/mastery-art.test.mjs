import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const manifest=JSON.parse(read('meadow-3d/art/mastery-icons/manifest.json'));
const catalog=JSON.parse(read('shared/data/mastery.json'));
const hash=b=>createHash('sha256').update(b).digest('hex');

test('admitted painted mastery icons have real, unique runtime files and unchanged source provenance',()=>{
 const hashes=new Set();
 for(const[id,art]of Object.entries(manifest.icons)){
  assert.ok(catalog.skills.some(s=>s.id===id),id);
  assert.match(art.file,new RegExp(`^${id}-icon-v\\d+-[a-f0-9]{12}\\.webp$`));
  const runtime=read('meadow-3d/public/assets/mastery-painted/'+art.file);
  assert.equal(runtime.toString('ascii',8,12),'WEBP',id);
  assert.equal(hash(runtime),art.sha256,id);
  assert.equal(hashes.has(art.sha256),false,`${id} must not silently reuse another skill icon`);hashes.add(art.sha256);
  assert.equal(art.width,128);assert.equal(art.height,128);
  const source=read(art.source.includes('/')?art.source:'meadow-3d/art/mastery-icons/'+art.source);
  assert.equal(hash(source),art.sourceSha256,id);
  assert.equal(art.provenance.externalPaidProvider,false,id);
 }
});
