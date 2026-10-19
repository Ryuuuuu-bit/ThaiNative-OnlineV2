import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LAYOUTS} from '@thainative/shared/maps';
import {canyonRockVariants,canyonRockProps} from '../src/canyon-rock-art.ts';
const manifest=JSON.parse(readFileSync(new URL('../public/assets/canyon-painted-v1/manifest.json',import.meta.url)));
test('canyon art preserves obstacle positions and fits high-resolution source rectangles',async()=>{
 const points=LAYOUTS.canyon.obstacles;
 const props=await canyonRockProps(points,{json:async()=>manifest,image:async()=>({})});
 assert.equal(props.length,points.length);
 for(let i=0;i<points.length;i++){
  const p=props[i];assert.deepEqual([p.x,p.z],[points[i].x,points[i].z]);
  assert.ok(p.rect[2]>=280&&p.rect[3]>=260);
  assert.ok(p.rect[0]+p.rect[2]<=manifest.size[0]&&p.rect[1]+p.rect[3]<=manifest.size[1]);
  assert.ok(Math.abs(p.w/p.h-p.rect[2]/p.rect[3])<1e-9);
  assert.ok(p.w<=8.5,'bounded landmark size');
 }
});
test('all nine silhouettes are used, deterministic, with no identical nearest neighbours',()=>{
 const points=LAYOUTS.canyon.obstacles,variants=canyonRockVariants(points);
 assert.equal(new Set(variants).size,9);assert.deepEqual(canyonRockVariants(points),variants);
 let repeats=0;
 for(let i=0;i<points.length;i++){
  let nearest=-1,distance=Infinity;
  for(let j=0;j<points.length;j++)if(i!==j){const d=Math.hypot(points[i].x-points[j].x,points[i].z-points[j].z);if(d<distance){distance=d;nearest=j;}}
  if(variants[i]===variants[nearest])repeats++;
 }
 assert.equal(repeats,0);
});
