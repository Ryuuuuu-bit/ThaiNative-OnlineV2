import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {chunkInstances,artQuality,followSun} from '../src/world-art.ts';

test('16m art tiles retain transforms, vertex flips, colours and quality density across negative boundaries',()=>{
 const root=new T.Group(),g=new T.PlaneGeometry(1,1);
 g.setAttribute('forestFlip',new T.InstancedBufferAttribute(new Float32Array([0,1,0,1]),1));
 const source=new T.InstancedMesh(g,new T.MeshBasicMaterial(),4);source.userData.groundCover=true;source.userData.shadowCaster=true;
 [-.1,.1,15.9,16.1].forEach((x,i)=>{source.setMatrixAt(i,new T.Matrix4().makeTranslation(x,0,0));source.setColorAt(i,new T.Color(i/4,.5,1));});root.add(source);chunkInstances(root);
 assert.equal(root.children.length,3);assert.equal(root.children.reduce((n,o)=>n+o.count,0),4);
 const restored=[];for(const tile of root.children){assert.ok(tile.boundingSphere.radius<9);for(let i=0;i<tile.count;i++){const m=new T.Matrix4(),c=new T.Color();tile.getMatrixAt(i,m);tile.getColorAt(i,c);restored.push([m.elements[12],tile.geometry.attributes.forestFlip.getX(i),c.r]);}}
 restored.sort((a,b)=>a[0]-b[0]);assert.deepEqual(restored.map(v=>v[1]),[0,1,0,1]);assert.deepEqual(restored.map(v=>v[2]),[0,.25,.5,.75]);
 artQuality(root,false);assert.equal(root.children.reduce((n,o)=>n+o.count,0),3);assert.ok(root.children.every(o=>!o.castShadow));artQuality(root,true);assert.equal(root.children.reduce((n,o)=>n+o.count,0),4);assert.ok(root.children.every(o=>o.castShadow));
});
test('sun follows in snapped light coordinates, covers maximum zoom, and preserves key direction',()=>{
 const sun=new T.DirectionalLight(),offset=new T.Vector3(-14,24,9),focus=new T.Vector3(12,0,23);sun.shadow.mapSize.set(2048,2048);
 followSun(sun,focus,offset,27.5,16/9);assert.ok(sun.shadow.camera.right>=27.5);assert.ok(sun.position.clone().sub(sun.target.position).distanceTo(offset)<1e-8);
 const before=sun.target.position.clone(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),offset.clone().normalize()).normalize();
 followSun(sun,focus.clone().addScaledVector(right,1e-7),offset,27.5,16/9);assert.ok(sun.target.position.distanceTo(before)<1e-6);
});
