import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCity} from '../src/city-scene.ts';
import jobs from '../../shared/data/jobs.json' with {type:'json'};
import {CITY_BUILDINGS,CITY_HOUSES} from '@the-beginning-online/shared/maps';
import {canopyGeometry} from '../src/city-paving.ts';

test('Angel billboard clears the tower and both steps at desktop and mobile default cameras',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 let city;
 try{city=buildCity(new T.Scene(),{load:()=>new T.Texture()});}finally{globalThis.document=previous;}
 const angel=city.npcActors.at(-1);
 assert.deepEqual(angel.position.toArray(),[jobs.angel.x,.05,jobs.angel.z]);
 const obstacles=[
  new T.Box3(new T.Vector3(-2,.12,-2),new T.Vector3(2,10.12,2)),
  new T.Box3(new T.Vector3(-2.5,.08,2.1),new T.Vector3(2.5,.23,3.1)),
  new T.Box3(new T.Vector3(-3,.04,3),new T.Vector3(3,.12,4)),
 ];
 for(const [width,height] of [[1440,900],[390,844]]){
  const camera=new T.OrthographicCamera(-width/height,width/height,1,-1,.1,120);
  camera.position.set(9,16,13);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  // Sprite vertex shader: scaled corners rotate with the camera around the anchor.
  const corners=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>new T.Vector3((x-angel.center.x)*angel.scale.x,(y-angel.center.y)*angel.scale.y,0).applyQuaternion(camera.quaternion).add(angel.position));
  const triangles=[new T.Triangle(corners[0],corners[1],corners[2]),new T.Triangle(corners[0],corners[2],corners[3])];
  for(const box of obstacles)assert.ok(triangles.every(t=>!box.intersectsTriangle(t)),`${width}x${height}: Angel intersects tower or steps`);
 }
});

test('all fifteen building envelopes preserve the authoritative footprint, including roofs and porches',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 let city;try{city=buildCity(new T.Scene(),{load:()=>new T.Texture()});}finally{globalThis.document=previous;}
 assert.equal(city.buildingBounds.length,15);
 for(const [i,b]of [...CITY_BUILDINGS,...CITY_HOUSES].entries()){
  const visual=city.buildingBounds.find(v=>v.name===(i<3?b.id:'house-'+(i-3)));assert.ok(visual);
  const expected=[b.x-b.w/2,b.z-b.d/2,b.x+b.w/2,b.z+b.d/2];
  visual.bounds.forEach((value,j)=>assert.ok(Math.abs(value-expected[j])<1e-5,`${visual.name}: footprint ${j}`));
 }
 assert.ok(city.buildingBounds.some(b=>b.storeys===2));assert.ok(city.buildingBounds.some(b=>b.storeys===1));
 const batches=[];city.root.traverse(o=>{if(o instanceof T.BatchedMesh)batches.push(o);});assert.ok(batches.length>0);assert.ok(batches.every(b=>b.userData.artTile&&b.perObjectFrustumCulled));
 city.setQuality(false);assert.equal(city.snapshot().fogCards,0);assert.deepEqual(city.snapshot().openGates,['south','east']);
});

test('awning UVs retain physical metres at both stall sizes instead of sampling roof atlas cells',()=>{
 for(const [w,d]of [[7,8],[3,2.1]]){const g=canopyGeometry(w,d),p=g.attributes.position,uv=g.attributes.uv;
  for(let i=0;i<p.count;i++){assert.ok(Math.abs(uv.getX(i)-(p.getX(i)+w/2))<1e-6);assert.ok(Math.abs(uv.getY(i)-(p.getZ(i)+d/2))<1e-6);}
  g.computeBoundingBox();assert.ok(g.boundingBox.max.y>0);assert.ok(g.boundingBox.max.x<=w/2+1e-6);assert.ok(g.boundingBox.max.z<=d/2+1e-6);
 }
});

test('polish 4 gate geometry, boundary walks and requested booth footprints',async()=>{
 const {CITY_ART_SOLIDS}=await import('../src/city-scene.ts');
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 let city;try{city=buildCity(new T.Scene(),{load:()=>new T.Texture()});}finally{globalThis.document=previous;}
 const bounds=label=>city.artBounds.filter(p=>p.label===label).map(p=>p.bounds);
 const lintelTop=Math.max(...bounds('gatehouse').map(b=>b[4]));
 assert.ok(bounds('portcullis').length>=28);
 for(const b of bounds('portcullis')){assert.ok(b[4]<=lintelTop+1e-5);assert.ok(b[1]>=4.4-1e-5);}
 for(const p of CITY_ART_SOLIDS.filter(p=>p.label.startsWith('guard'))){
  assert.ok(bounds(p.label).length>0);
  for(const b of bounds(p.label)){
   assert.ok(b[0]>=p.x-p.w/2-1e-5&&b[3]<=p.x+p.w/2+1e-5);
   assert.ok(b[2]>=p.z-p.d/2-1e-5&&b[5]<=p.z+p.d/2+1e-5);
   assert.ok(Math.min(Math.abs(p.x)-p.w/2,Math.abs(p.z)-p.d/2)>=3.4);
   for(const [x,z]of [[0,47],[47,0]])assert.ok(Math.hypot(Math.max(b[0]-x,0,x-b[3]),Math.max(b[2]-z,0,z-b[5]))>1.5);
   for(const [x,z]of [[-4.5,49.6],[4.5,49.6],[49.6,-4.5],[49.6,4.5]])assert.ok(b[3]<x-1||b[0]>x+1||b[5]<z-1.1||b[2]>z+1.1);
  }
 }
 for(const label of ['walkway','stair-0','stair-1','stair-2','stair-3']){
  assert.ok(bounds(label).length>0);
  for(const b of bounds(label))assert.ok(b[0]>=47.3-1e-5||b[3]<=-47.3+1e-5||b[2]>=47.3-1e-5||b[5]<=-47.3+1e-5,label);
 }
 const snap=city.snapshot();assert.equal(snap.gateLanterns.length,4);assert.equal(snap.guardPosts.length,2);assert.equal(snap.wallStairs,4);assert.equal(snap.pigeons,'removed');assert.equal(snap.realLights,4);
 assert.equal(city.root.getObjectByName('gate-lantern-halos').count,4);
});
