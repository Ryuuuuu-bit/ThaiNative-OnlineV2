import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_BUILDINGS,CITY_HOUSES as ORIGINAL_HOUSES,CITY_BENCHES,CITY_STALLS,CITY_PLANTERS} from '@the-beginning-online/shared/maps';
import {CITY_HOUSES,CITY_ART_SOLIDS,DECOR,GARDEN_TREES,CITY2D_FOUNTAIN,city2dWalkable,route} from '../src/city-2d-layout.ts';

const boxes=[
 ...CITY_BUILDINGS.map(b=>({...b,label:b.id})),
 ...CITY_HOUSES.map((b,i)=>({...b,label:'house '+i})),
 ...CITY_BENCHES.map((b,i)=>({...b,label:'bench '+i})),
 ...CITY_STALLS.map((b,i)=>({...b.solid,label:'stall '+i})),
 ...CITY_ART_SOLIDS.filter(b=>b.kind==='box'),
 ...DECOR.filter(b=>b.solid).map((b,i)=>({...b,label:b.label||b.kind+' '+i})),
];
test('flowerbeds leave breathing room between groups and around the fountain',()=>{
 const beds=DECOR.filter(p=>p.kind==='flowerbed');
 for(let i=0;i<beds.length;i++){
  const a=beds[i];
  const dx=Math.max(0,Math.abs(a.x-CITY2D_FOUNTAIN.x)-a.w/2),dz=Math.max(0,Math.abs(a.z-CITY2D_FOUNTAIN.z)-a.d/2);
  assert.ok(Math.hypot(dx,dz)>6.3,'keep beds outside the fountain walking ring');
  for(const b of beds.slice(i+1)){
   const gapX=Math.max(0,Math.abs(a.x-b.x)-(a.w+b.w)/2),gapZ=Math.max(0,Math.abs(a.z-b.z)-(a.d+b.d)/2);
   assert.ok(Math.hypot(gapX,gapZ)>=4,'avoid consecutive packed flowerbeds');
  }
 }
});
test('environment footprints do not intersect buildings or other solid props',()=>{
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];
  const ox=(a.w+b.w)/2-Math.abs(a.x-b.x),oz=(a.d+b.d)/2-Math.abs(a.z-b.z);
  assert.ok(ox<=0||oz<=0,`${a.label} overlaps ${b.label}`);
 }
 for(const t of [...GARDEN_TREES,...CITY_PLANTERS])for(const b of boxes){
  assert.ok(Math.abs(t.x-b.x)>=b.w/2+.55||Math.abs(t.z-b.z)>=b.d/2+.55,`tree at ${t.x},${t.z} overlaps ${b.label}`);
 }
});
test('shared live layout includes the relocated garden cottage and open fountain approach',()=>{
 assert.ok(ORIGINAL_HOUSES.some(b=>b.x===-28&&b.z===40));
 assert.ok(CITY_HOUSES.some(b=>b.x===-28&&b.z===40));
 assert.equal(CITY_HOUSES.length,ORIGINAL_HOUSES.length);
 assert.equal(city2dWalkable(-28,40),false);
 assert.equal(city2dWalkable(-22,34),true);
 assert.ok(route({x:-15,z:32},{x:-22,z:34}).length);
});
