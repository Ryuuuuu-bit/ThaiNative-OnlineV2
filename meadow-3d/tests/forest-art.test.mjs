import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {monsterSpecies,monsterFrame,SPECIES_SCALE,SPECIES_HIT_COLOUR} from '../src/monster-animation.ts';
import {MONSTER_MOTIONS} from '../src/monster-motion-data.ts';
const read=p=>JSON.parse(readFileSync('meadow-3d/'+p,'utf8'));
test('forest species preserve jelly selection and use their own size, hit colour and wind-up',()=>{
 const cases=[['mist_shroom','shroom',.6,.72],['shade_wolf','wolf',.4,.85],['lantern_wisp','wisp',.7,.7],['stump_guard','stump',.8,1]];
 for(const[id,sp,windup,scale]of cases){assert.equal(monsterSpecies(id),sp);assert.equal(SPECIES_SCALE[sp],scale);assert.ok(MONSTER_MOTIONS[sp].attack.duration>=windup);assert.equal(monsterFrame(sp,'attack',windup-.001),0);assert.equal(monsterFrame(sp,'attack',windup+.001),1);assert.equal(monsterFrame(sp,'death',10),2);}
 assert.equal(monsterSpecies('mist_warden',true),'warden');assert.equal(monsterSpecies('jelly_mint'),'slime');assert.equal(monsterSpecies('king_jelly',true),'king');assert.equal(new Set(Object.values(SPECIES_HIT_COLOUR)).size,7);
 assert.deepEqual(MONSTER_MOTIONS.warden,MONSTER_MOTIONS.king);
});
test('forest replacement art has traceable sources, complete poses and stable ground anchors',()=>{
 const m=read('public/assets/monsters-painted/manifest.json');assert.equal(m.originRevision,'original-rebuild-v1');
 for(const sp of ['shroom','wolf','wisp','stump','warden']){
  const s=m.species[sp];assert.ok(s.sourceId);assert.deepEqual(s.anchor,[.5,30/320]);
  assert.equal(new Set(Object.values(s.motions).map(m=>m.file)).size,5);
  for(const def of Object.values(s.motions)){
   assert.equal(def.frames,4);assert.equal(def.rows,4);assert.equal(def.holdLast,!def.loop);
   const bytes=readFileSync('meadow-3d/public/assets/monsters-painted/'+def.file);assert.equal(bytes.toString('ascii',0,4),'RIFF');
   for(const row of def.directions){assert.equal(row.length,4);for(const f of row){const[x,y,r,b]=f.bounds;assert.ok(x>=3&&y>=3&&r<=s.cellSize[0]-3&&b<=s.cellSize[1]-3);assert.equal(f.faceRect,null);assert.ok(Math.abs(f.groundContact[1]-s.baseline)<=1);}}
  }
 }
 assert.equal(m.forestPhase2.expressionOverlay,null);assert.equal(m.forestPhase2.fullFrameCopies,0);
 assert.equal(m.projectiles.bolt.frames,4);const bolt=readFileSync('meadow-3d/public/assets/monsters-painted/wisp-bolt-v1.png');assert.equal(bolt.readUInt32BE(16),768);assert.equal(bolt.readUInt32BE(20),192);
});

test('forest environment atlas rectangles, alpha gutters and tree footprint metadata are valid',()=>{
 const m=read('public/assets/env-forest/manifest.json');assert.equal(m.assets.length,18);assert.equal(m.atlases.length,1);assert.deepEqual(m.atlases[0].size,[2048,2048]);
 for(const a of m.assets){const[x,y,w,h]=a.rect;assert.ok(x>=8&&y>=8&&x+w<=2040&&y+h<=2040);assert.ok(a.worldSize.every(v=>v>0));assert.ok(a.anchor.every(v=>v>=0&&v<=1));assert.deepEqual(a.uvRect,[x/2048,1-(y+h)/2048,w/2048,h/2048]);if(['pine','oak','silver','hollow'].includes(a.name))assert.ok(a.trunkWidth>0);}
 for(let i=0;i<m.assets.length;i++)for(let j=i+1;j<m.assets.length;j++){const[a,b,c,d]=m.assets[i].rect,[e,f,g,h]=m.assets[j].rect;assert.ok(a+c+8<=e||e+g+8<=a||b+d+8<=f||f+h+8<=b);}
 assert.equal(Object.keys(m.tiles).length,4);assert.deepEqual(read('art/painted-forest/environment-packing-report.json').clippingWarnings,[]);
});
test('item atlas v2 preserves forest indices 25–29 and reserves seven transparent cells',()=>{
 const m=read('public/assets/items/items-v2.json');assert.equal(m.width,320);assert.equal(m.height,320);assert.equal(m.reservedTransparentSlots,7);assert.deepEqual(m.cellSize,[64,64]);
 assert.deepEqual(Object.keys(m.frames).slice(0,5),['mist_spore','wolf_fur','wisp_tear','mist_wood','warden_heart']);Object.values(m.frames).slice(0,5).forEach((v,i)=>{assert.equal(v.index,i+25);assert.equal(v.x,i*64);assert.equal(v.y,0);});assert.ok(existsSync('meadow-3d/public/assets/items/items-v2.webp'));
 assert.deepEqual(read('art/painted-forest/icon-packing-report.json').clippingWarnings,[]);
});
