import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCity} from '../src/city-scene.ts';
import jobs from '../../shared/data/jobs.json' with {type:'json'};

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
