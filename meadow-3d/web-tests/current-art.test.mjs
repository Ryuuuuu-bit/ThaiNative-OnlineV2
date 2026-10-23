import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';

test('public artwork uses existing game captures and every shipped scene fits the web budget',()=>{
 const root='meadow-3d/', folder='public/assets/web/current-world-v1/';
 const provenance=JSON.parse(readFileSync(root+folder+'provenance.json','utf8'));
 for(const id of Object.keys(provenance.sources)){
  const bytes=statSync(root+folder+id+'.webp').size;
  assert.ok(bytes>1000&&bytes<600_000,id);
 }
 for(const file of ['index.html','login.html','play.html','src/web.css','src/web-glass.css','src/web-modern.css','src/web/characters.css','src/web/portal-expansion.ts']){
  const source=readFileSync(root+file,'utf8');
  assert.doesNotMatch(source,/city-mist-|meadow-dawn-|loading-dusk-/,file);
  for(const [,url] of source.matchAll(/(\/assets\/web\/current-world-v1\/[\w-]+\.(?:webp|jpg))/g))assert.ok(statSync(root+'public'+url).size,url);
 }
 const gallery=readFileSync(root+'src/web/portal-expansion.ts','utf8');
 for(const [,id] of gallery.matchAll(/'(meadow|yokai|dragon|ocean|astral|confluence)'/g))assert.ok(statSync(root+folder+id+'.webp').size,id);
});
