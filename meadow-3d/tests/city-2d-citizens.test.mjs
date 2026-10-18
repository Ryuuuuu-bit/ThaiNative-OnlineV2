import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CITIZEN_PROFILES,citizenWalkFrame} from '../src/city-2d-citizens.ts';
import {createCityLife} from '../src/city-2d-life.ts';
test('every walking citizen has their own named painted identity',()=>{
 assert.equal(CITIZEN_PROFILES.length,40);
 for(const key of ['key','name','speech'])assert.equal(new Set(CITIZEN_PROFILES.map(p=>p[key])).size,40,key);
 const life=createCityLife();
 for(const n of life.citizens)for(const other of life.citizens)if(n.id!==other.id)assert.ok(Math.hypot(n.x-other.x,n.z-other.z)>.85);
});
test('all identities resolve to four nonempty frames inside the shipped image',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/city-painted-v1/citizens-manifest.json',import.meta.url)));
 for(const p of CITIZEN_PROFILES){
  const atlas=manifest.atlases.find(a=>a.id===p.atlas),row=atlas.rows[p.row];
  const bytes=readFileSync(new URL('../public'+atlas.image,import.meta.url)),w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
  assert.equal(row.frames.length,4);assert.ok(row.height>0);
  for(const [x,y,fw,fh] of row.frames){assert.ok(fw>30&&fh>80);assert.ok(x>=0&&y>=0&&x+fw<=w&&y+fh<=h);assert.ok(fh<=row.height);}
 }
});
test('walking cycle advances by distance and freezes while citizens rest',()=>{
 assert.deepEqual([0,.24,.48,.72].map(d=>citizenWalkFrame(d,true)),[0,1,2,3]);
 const life=createCityLife(),n=life.citizens[0];n.wait=1;const start=n.walk;life.step(.05);assert.equal(n.walk,start);assert.equal(n.moving,false);
 assert.equal(citizenWalkFrame(12,false),1);
});
