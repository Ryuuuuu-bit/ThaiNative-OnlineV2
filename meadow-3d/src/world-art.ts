import * as T from 'three';
import type {MapId} from '@thainative/shared/maps';

export const ART_TILE=16;
/** Split matrices and per-instance attributes together; each tile owns a tight culling sphere. */
export function chunkInstances(root:T.Group){
 const sources:T.InstancedMesh[]=[];root.traverse(o=>{if(o instanceof T.InstancedMesh&&!o.userData.artTile)sources.push(o);});
 for(const source of sources){const tiles=new Map<string,number[]>(),matrix=new T.Matrix4();
  for(let i=0;i<source.count;i++){source.getMatrixAt(i,matrix);const p=new T.Vector3().setFromMatrixPosition(matrix),key=`${Math.floor(p.x/ART_TILE)},${Math.floor(p.z/ART_TILE)}`;const list=tiles.get(key)||[];list.push(i);tiles.set(key,list);}
  for(const [key,indices]of tiles){const geometry=source.geometry.clone();
   for(const [name,attribute]of Object.entries(source.geometry.attributes))if(attribute instanceof T.InstancedBufferAttribute){const values=new Float32Array(indices.length*attribute.itemSize);indices.forEach((index,i)=>{for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=attribute.array[index*attribute.itemSize+c];});geometry.setAttribute(name,new T.InstancedBufferAttribute(values,attribute.itemSize));}
   const tile=new T.InstancedMesh(geometry,source.material,indices.length);tile.name=`${source.name||'art'}@${key}`;tile.userData={...source.userData,artTile:true,fullCount:indices.length};tile.castShadow=source.castShadow;tile.receiveShadow=source.receiveShadow;tile.customDepthMaterial=source.customDepthMaterial;
   indices.forEach((index,i)=>{source.getMatrixAt(index,matrix);tile.setMatrixAt(i,matrix);if(source.instanceColor){const colour=new T.Color();source.getColorAt(index,colour);tile.setColorAt(i,colour);}});tile.computeBoundingSphere();tile.computeBoundingBox();source.parent!.add(tile);
  }source.removeFromParent();source.dispose();source.geometry.dispose();
 }
}
export function artQuality(root:T.Group,hq:boolean){root.traverse(o=>{if(o instanceof T.InstancedMesh&&o.userData.artTile){o.count=o.userData.groundCover&&!hq?Math.ceil(o.userData.fullCount/2):o.userData.fullCount;if(o.userData.shadowCaster)o.castShadow=hq;if(o.userData.shadowOnly)o.visible=hq;}});}
export function artStats(root:T.Group){let tiles=0,instances=0;root.traverse(o=>{if(o instanceof T.InstancedMesh){tiles++;instances+=o.count;}else if(o instanceof T.BatchedMesh){tiles++;instances+=o.instanceCount;}});return{tileMetres:ART_TILE,tiles,instances};}

export const CITY_SUN_OFFSET=new T.Vector3(-24,22,14);
const RIGS={city_plaza:{sky:'#c8d1cd',key:'#ffd09b',fill:'#b9cde5',ground:'#737782',keyPower:2.2,fillPower:1.2,exposure:.96},meadow:{sky:'#c8d1bd',key:'#fff0d5',fill:'#e2f1f5',ground:'#889475',keyPower:1.85,fillPower:1.6,exposure:1.02},forest:{sky:'#9fb0a8',key:'#b8d2e4',fill:'#aabecb',ground:'#405951',keyPower:.85,fillPower:1.15,exposure:.94}};
export function mapLightRig(id:MapId,scene:T.Scene,renderer:T.WebGLRenderer,hemi:T.HemisphereLight,sun:T.DirectionalLight){const r=RIGS[id];hemi.color.set(r.fill);hemi.groundColor.set(r.ground);hemi.intensity=r.fillPower;sun.color.set(r.key);sun.intensity=r.keyPower;renderer.toneMappingExposure=r.exposure;scene.background=new T.Color(r.sky);}
/** Snap in light-space (world-axis rounding still shimmers under a diagonal sun). */
export function followSun(sun:T.DirectionalLight,focus:T.Vector3,offset:T.Vector3,height:number,aspect:number){
 const extent=Math.ceil(Math.max(18,height*Math.max(1,aspect)*.64+10));const cam=sun.shadow.camera;
 cam.left=cam.bottom=-extent;cam.right=cam.top=extent;cam.far=110;cam.updateProjectionMatrix();
 const direction=offset.clone().normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right);const step=extent*2/sun.shadow.mapSize.x;
 const target=focus.clone();target.addScaledVector(right,Math.round(target.dot(right)/step)*step-target.dot(right));target.addScaledVector(up,Math.round(target.dot(up)/step)*step-target.dot(up));sun.target.position.copy(target);sun.position.copy(target).add(offset);
}
/** Only visible-map candidates compete for the four nearest real local lights. */
export function nearestArtLights(root:T.Group,position:T.Vector3){const lights:T.PointLight[]=[];root.traverse(o=>{if(o instanceof T.PointLight)lights.push(o);});lights.sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position));lights.forEach((l,i)=>l.visible=i<4&&l.position.distanceToSquared(position)<24*24);}

/** Broad, soft brush patches break ground tiling without adding obstacles. */
export function groundPatches(root:T.Group,points:{x:number;z:number;size:number;colour:string}[]){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;
 const fade=c.createRadialGradient(64,64,8,64,64,62);fade.addColorStop(0,'#ffffffa0');fade.addColorStop(.6,'#ffffff60');fade.addColorStop(1,'#ffffff00');c.fillStyle=fade;c.fillRect(0,0,128,128);
 const mesh=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({map:new T.CanvasTexture(canvas),transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1}),points.length),dummy=new T.Object3D();
 points.forEach((p,i)=>{dummy.position.set(p.x,.009,p.z);dummy.rotation.set(-Math.PI/2,0,i*1.7);dummy.scale.set(p.size,p.size*.72,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color(p.colour));});mesh.receiveShadow=true;mesh.name='ground-brush-patches';root.add(mesh);
}

/** Layered textured silhouettes beyond the boundary; none enters walkable ground. */
export function meadowHorizon(root:T.Group,texture:T.Texture,halfX:number,halfZ:number){
 const colours=['#a2b4a2','#aebcad','#bdc8b7'];
 for(let layer=2;layer>=0;layer--)for(let side=0;side<4;side++){
  const width=(side<2?halfX:halfZ)*3.6,positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<=28;i++){const x=(i/28-.5)*width,height=6+layer*3+Math.sin(i*.65+layer*2)*2.3+Math.cos(i*1.3)*1.2;positions.push(x,-1,0,x,height,0);uvs.push(i/7,0,i/7,1);if(i<28){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();const hill=new T.Mesh(g,new T.MeshBasicMaterial({map:texture,color:colours[layer],side:T.DoubleSide}));
  if(side<2)hill.position.z=(side===0?-1:1)*(halfZ+20+layer*13);else{hill.position.x=(side===2?-1:1)*(halfX+20+layer*13);hill.rotation.y=Math.PI/2;}root.add(hill);
 }
}

export function contactShadows(root:T.Group,points:{x:number;z:number;w:number;d:number}[]){
 const material=new T.MeshBasicMaterial({color:'#283831',transparent:true,opacity:.24,depthWrite:false});
 material.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 contactUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncontactUV=uv;');shader.fragmentShader='varying vec2 contactUV;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=1.-smoothstep(.2,.5,length(contactUV-.5));\n#include <alphatest_fragment>');};
 material.customProgramCacheKey=()=> 'art-contact-v1';
 const batch=new T.InstancedMesh(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),material,points.length),dummy=new T.Object3D();batch.name='city-contact';
 points.forEach((p,i)=>{dummy.position.set(p.x,.03,p.z);dummy.scale.set(p.w,1,p.d);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});root.add(batch);
}
