import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{createHash}from'node:crypto';import{BIOME_IDS}from'@the-beginning-online/shared/maps';
const read=url=>JSON.parse(readFileSync(url,'utf8')),sha=url=>createHash('sha256').update(readFileSync(url)).digest('hex');
test('Original biome artwork retains its source generation records and unchanged runtime bytes',()=>{
 for(const group of ['landmarks','surfaces','detail-props']){
  const base=new URL('../art/world-biome-'+group+'-v1/',import.meta.url),provenance=read(new URL('provenance.json',base));assert.ok(provenance.assets.length>0);assert.equal(new Set(provenance.assets.map(a=>a.id)).size,provenance.assets.length);
  for(const asset of provenance.assets){assert.deepEqual(asset.references,[]);assert.equal(sha(new URL(asset.id+'/base.png',base)),asset.sourceSha256);assert.equal(sha(new URL(asset.runtime,base)),asset.runtimeSha256);const reportUrl=new URL(asset.id+'/'+(existsSync(new URL(asset.id+'/report.json',base))?'report.json':'base-report.json'),base),report=read(reportUrl);assert.equal(report.provider,'codex');assert.deepEqual(report.refs,[]);assert.ok(readFileSync(new URL(asset.id+'/prompt.txt',base),'utf8').length>100);}
 }
});
test('Every biome has its own documented landmark, with distinct northern and Japanese forest details',()=>{
 const base=new URL('../art/',import.meta.url),landmarks=read(new URL('world-biome-landmarks-v1/provenance.json',base)),details=read(new URL('world-biome-detail-props-v1/provenance.json',base));assert.deepEqual(landmarks.assets.map(a=>a.id).sort(),[...BIOME_IDS].sort());for(const id of ['frost-pine','fjord-wreck','yokai-bamboo','yokai-lantern'])assert.ok(details.assets.some(a=>a.id===id));
});
