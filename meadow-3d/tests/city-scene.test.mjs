import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCity} from '../src/city-scene.ts';
import jobs from '../../shared/data/jobs.json' with {type:'json'};
import {CITY_BUILDINGS,CITY_HOUSES} from '@thainative/shared/maps';
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
