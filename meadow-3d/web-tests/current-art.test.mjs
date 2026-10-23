import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('public artwork uses clean game-inspired scenery and every shipped scene fits the web budget',()=>{
 const root='meadow-3d/', folder='public/assets/web/world-wallpapers-v2/';
 const provenance=JSON.parse(readFileSync(root+folder+'provenance.json','utf8'));
 for(const id of Object.keys(provenance.sources)){
  const bytes=statSync(root+folder+id+'.webp').size;
  assert.ok(bytes>1000&&bytes<600_000,id);
  assert.equal(createHash('sha256').update(readFileSync(root+folder+id+'.webp')).digest('hex'),provenance.sources[id].sha256,id);
 }
 for(const file of ['index.html','login.html','characters.html','play.html','src/web.css','src/web-glass.css','src/web-modern.css','src/web-fantasy.css','src/web/characters.css','src/web/bestiary.css','src/web/world.css','src/web/loot-art-review.css','src/web/portal-expansion.ts']){
  const source=readFileSync(root+file,'utf8');
  assert.doesNotMatch(source,/city-mist-|meadow-dawn-|loading-dusk-|current-world-v1|og-image-v3/,file);
  for(const [,url] of source.matchAll(/(\/assets\/web\/world-wallpapers-v2\/[\w-]+\.(?:webp|jpg))/g))assert.ok(statSync(root+'public'+url).size,url);
 }
 const gallery=readFileSync(root+'src/web/portal-expansion.ts','utf8');
 for(const [,id] of gallery.matchAll(/'(meadow|yokai|dragon|ocean|astral|confluence)'/g))assert.ok(statSync(root+folder+id+'.webp').size,id);
});
