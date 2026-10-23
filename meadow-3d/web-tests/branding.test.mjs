import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

test('public game pages use the new game name and current wordmark',()=>{
 for(const file of ['index.html','login.html','characters.html','play.html','monsters.html']){
  const html=readFileSync('meadow-3d/'+file,'utf8');
  assert.match(html,/<title>[^<]*The Beginning Online/,file);
  assert.doesNotMatch(html,/Thai\s*Native/i,file);
  assert.match(html,/logo-v3-512\.webp/,file);
  if(html.includes('property="og:image"'))assert.match(html,/og-image-v4\.jpg/,file);
 }
 assert.match(readFileSync('meadow-3d/character.html','utf8'),/<title>[^<]*The Beginning Online/);
 for(const file of ['logo-v3-512.webp','og-image-v4.jpg'])assert.ok(existsSync('meadow-3d/public/assets/brand/'+file),file);
});

test('installed app name changes without changing its identity or saved-game origin',()=>{
 const app=JSON.parse(readFileSync('meadow-3d/public/site.webmanifest','utf8'));
 assert.equal(app.name,'The Beginning Online');assert.equal(app.short_name,'The Beginning');assert.equal(app.start_url,'/');
 assert.ok(app.icons.every(icon=>existsSync('meadow-3d/public'+icon.src)));
});
