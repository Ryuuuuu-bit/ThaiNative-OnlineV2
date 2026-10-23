import test from'node:test';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';import{readFileSync}from'node:fs';import{resolve}from'node:path';
test('Vite builds the portal, login, character select, play and public atelier pages',()=>{
 const out=resolve('.codex-run/web-build-test');const build=spawnSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build','meadow-3d','--outDir',out],{encoding:'utf8',env:{...process.env,VITE_BUILD_ID:'web-test'}});
 assert.equal(build.status,0,build.stdout+build.stderr);
 for(const page of ['index','login','characters','play','character','monsters','world','items']){const html=readFileSync(resolve(out,page+'.html'),'utf8');assert.match(html,/<html lang="th">/);assert.match(html,/<script type="module"[^>]+src="\/assets\//);}
 const portal=readFileSync(resolve(out,'index.html'),'utf8');assert.match(portal,/guest-play/);assert.doesNotMatch(portal,/id="world"/);assert.match(readFileSync(resolve(out,'play.html'),'utf8'),/id="world"/);
});
