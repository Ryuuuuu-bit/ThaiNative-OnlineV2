import {cityPaving,cityCanvas,canopyGeometry} from './city-paving.ts';
import {chunkInstances,artQuality,artStats,contactShadows} from './world-art.ts';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY, CITY_BUILDINGS, CITY_HOUSES, CITY_FOUNTAIN, CITY_PLANTERS, CITY_BENCHES, CITY_STALLS, HEALER, GATE_CAPTAIN } from '@thainative/shared/maps';
/** Plaza size and wall line (1 m outside the walkable edge). */
const S=CITY.halfX*2,H=CITY.halfX+1,F=CITY_FOUNTAIN,K=S/60;
import type { PaintedLoader } from './assets';
import jobs from '../../shared/data/jobs.json' with {type:'json'};

/** Visual-only dressing. Shared map footprints, navigation and interaction anchors are authoritative. */
export function buildCity(scene:T.Scene,loader:PaintedLoader){
 const root=new T.Group();root.name='city_plaza';scene.add(root);
 const eastSign=new T.Sprite(new T.SpriteMaterial({map:loader.load('/assets/env-forest/signpost-v1.png'),transparent:true,alphaTest:.08,depthWrite:true,toneMapped:false}));eastSign.center.set(.5,0);eastSign.scale.set(1.2,1.8,1);eastSign.position.set(H-3,.04,2.2);root.add(eastSign);
 const atlas=loader.load('/assets/city/city-trim-v1.png');
 const paint=new T.MeshStandardMaterial({map:atlas,roughness:1,side:T.DoubleSide,vertexColors:true});
 const glow=new T.MeshBasicMaterial({map:atlas,color:'#ffcf87'});
 const water=new T.MeshStandardMaterial({color:'#739da3',roughness:.3,metalness:.15,transparent:true,opacity:.87});
 const canvasPaint=cityCanvas();
 const buildingBounds:{name:string;x:number;z:number;w:number;d:number;storeys:number;bounds:number[]}[]=[];let buildingParts:T.BufferGeometry[]|null=null;
 const batches=new Map<string,{material:T.Material;geometries:T.BufferGeometry[]}>();
 const scaleSamples:{name:string;root:T.Group}[]=[],sampleOrigin=new T.Vector3();let sample:T.Group|null=null;
 function beginSample(name:string,x=0,z=0){sample=new T.Group();sampleOrigin.set(x,0,z);scaleSamples.push({name,root:sample});}function endSample(){sample=null;}
 const matrix=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3();
 function uv(g:T.BufferGeometry,cell:number){if(!g.getAttribute('color'))g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*3).fill(1),3));const a=g.getAttribute('uv');for(let i=0;i<a.count;i++)a.setXY(i,(cell%4+.015+a.getX(i)*.97)/4,(2-Math.floor(cell/4)+.015+a.getY(i)*.97)/3);return g;}
 function add(g:T.BufferGeometry,x:number,y:number,z:number,sx:number,sy:number,sz:number,cell:number,material:T.Material=paint,ry=0,rx=0){
  if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}if(material!==canvasPaint)uv(g,cell);q.setFromEuler(new T.Euler(rx,ry,0));matrix.compose(v.set(x,y,z),q,new T.Vector3(sx,sy,sz));g.applyMatrix4(matrix);if(buildingParts)buildingParts.push(g);if(sample){const copy=new T.Mesh(g.clone().translate(-sampleOrigin.x,0,-sampleOrigin.z),material);sample.add(copy);}const key=material.uuid+':'+Math.floor(x/32)+','+Math.floor(z/32);if(!batches.has(key))batches.set(key,{material,geometries:[]});batches.get(key)!.geometries.push(g);
 }
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c=2,m=paint)=>add(new T.BoxGeometry(1,1,1),x,y+h/2,z,w,h,d,c,m);
 const cyl=(x:number,y:number,z:number,r:number,h:number,c=2,m:T.Material=paint)=>add(new T.CylinderGeometry(1,1,1,16),x,y+h/2,z,r,h,r,c,m);
 function plane(x:number,y:number,z:number,w:number,h:number,c:number,ry=0,m:T.Material=paint){add(new T.PlaneGeometry(1,1),x,y,z,w,h,1,c,m,ry);}
 function roof(x:number,y:number,z:number,w:number,d:number,c:number,height=2){
  const vertices:number[]=[],coords:number[]=[];
  function quad(a:number[],b:number[],c:number[],d:number[]){vertices.push(...a,...b,...c,...a,...c,...d);coords.push(0,0,1,0,1,1,0,0,1,1,0,1);}
  const nx=Math.ceil(w/2/1.2),nz=Math.ceil(d/1.5);
  for(const side of [-1,1])for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=side*i/nx*w/2,b=side*(i+1)/nx*w/2,za=-d/2+j/nz*d,zb=za+d/nz;quad([a,height*(1-Math.abs(a)/(w/2)),za],[b,height*(1-Math.abs(b)/(w/2)),za],[b,height*(1-Math.abs(b)/(w/2)),zb],[a,height*(1-Math.abs(a)/(w/2)),zb]);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(coords,2));g.computeVertexNormals();
  // Both winding directions are intentionally supported by the painted roof material.
  add(g,x,y,z,1,1,1,c);
  for(const side of [-1,1]){const face=new T.BufferGeometry();face.setAttribute('position',new T.Float32BufferAttribute([-w/2,0,side*d/2,0,height,side*d/2,w/2,0,side*d/2],3));face.setAttribute('uv',new T.Float32BufferAttribute([0,0,.5,1,1,0],2));face.computeVertexNormals();add(face,x,y,z,1,1,1,3);box(x+side*(w/2-.07),y-.13,z,.14,.15,d,10);}
  box(x,y+height-.14,z,.18,.18,d,10);
 }
 const paving=cityPaving(atlas,S);
 const ground=new T.Mesh(new T.PlaneGeometry(S+48,S+48).rotateX(-Math.PI/2),paving);ground.position.y=.005;ground.receiveShadow=true;root.add(ground);
 // Exactly one medallion on the existing circular apron; the tower and steps stay fixed.
 cyl(0,.02,0,5,.08,1);
 const medallion=new T.Mesh(uv(new T.CircleGeometry(4.9,48).rotateX(-Math.PI/2),0),paint);medallion.position.y=.105;medallion.receiveShadow=true;root.add(medallion);
 beginSample('clock-tower');box(0,.12,0,4,7.5,4);box(0,7.62,0,4.8,.5,4.8);box(0,8.12,0,3.5,2,3.5,3);roof(0,10.12,0,5.2,5.2,4,3);
 for(const [x,z,ry]of [[0,2.025,0],[2.025,0,Math.PI/2],[0,-2.025,Math.PI],[-2.025,0,-Math.PI/2]])plane(x,6.3,z,2.3,2.3,8,ry);
 for(const x of [-1.8,1.8])box(x,.12,2.04,.22,6,.12,3);
 box(0,.08,2.6,5,.15,1);box(0,.04,3.5,6,.08,1);plane(.55,.55,2.031,.12,.9,10);
 endSample();
 function house(x:number,z:number,w:number,d:number,storeys=1,c=4,name='house'){
  const h=3.0*storeys,capture=scaleSamples.every(s=>s.name!=='house-door-window-roof');if(capture)beginSample('house-door-window-roof',x,z);buildingParts=[];
  box(x,0,z,w,.25,d,2);box(x,.25,z-.15,w-.3,h-.25,d-.6,3);roof(x,h,z,w,d,c,storeys===2?1.8:1.55);
  // Framing and recessed porch remain inside the shared rectangle, including eaves.
  for(const dx of [-w/2+.19,0,w/2-.19])box(x+dx,.25,z,.12,h-.25,d-.25,10);
  for(let level=0;level<storeys;level++){
   const base=level*3;
   box(x,base+2.82,z,w-.2,.14,d-.22,10);
   for(const dx of [-w*.28,w*.28]){plane(x+dx,base+1.82,z+d/2-.28,.95,1.1,7,0,glow);box(x+dx,base+1.12,z+d/2-.16,1.04,.18,.25,10);}
  }
  plane(x,1.2,z+d/2-.275,1.15,2.2,6);
  for(const dx of [-.76,.76])box(x+dx,0,z+d/2-.12,.12,2.4,.12,10);
  add(canopyGeometry(2.1,.62),x,2.25,z+d/2-.32,1,1,1,0,canvasPaint);
  box(x-w*.28,h+.4,z-d*.22,.65,1.5,.75,2);box(x-w*.28,h+1.9,z-d*.22,.82,.16,.9,2);
  // Icon sign: the atlas crest is a clock-and-mist symbol, with no lettering.
  plane(x+w*.29,2.35,z+d/2-.1,.65,.8,9);
  const bounds=new T.Box3();for(const g of buildingParts){g.computeBoundingBox();bounds.union(g.boundingBox!);}buildingBounds.push({name,x,z,w,d,storeys,bounds:[bounds.min.x,bounds.min.z,bounds.max.x,bounds.max.z]});buildingParts=null;
  if(capture)endSample();
 }
 function stall(x:number,z:number,w:number,d:number,main=false){
  if(main)buildingParts=[];const top=main?2.6:2.15;
  box(x,0,z,w-.3,.8,d-.35,10);
  for(const dx of [-w/2+.12,w/2-.12])for(const dz of [-d/2+.12,d/2-.12])box(x+dx,0,z+dz,.12,top,.12,10);
  add(canopyGeometry(w,d),x,top,z,1,1,1,0,canvasPaint);
  const valance=new T.PlaneGeometry(w,.25,16,1);const pos=valance.getAttribute('position'),uvs=valance.getAttribute('uv');for(let i=0;i<pos.count;i++){uvs.setXY(i,(pos.getX(i)+w/2),pos.getY(i));if(pos.getY(i)<0)pos.setY(i,pos.getY(i)+.06*Math.cos(pos.getX(i)*Math.PI/.4));}
  add(valance,x,top-.08,z+d/2,1,1,1,0,canvasPaint);if(main){const bounds=new T.Box3();for(const g of buildingParts!){g.computeBoundingBox();bounds.union(g.boundingBox!);}buildingBounds.push({name:'market',x,z,w,d,storeys:1,bounds:[bounds.min.x,bounds.min.z,bounds.max.x,bounds.max.z]});buildingParts=null;}
 }
 for(const b of CITY_BUILDINGS){if(b.id==='market')stall(b.x,b.z,b.w,b.d,true);else house(b.x,b.z,b.w,b.d,b.id==='storage'?2:1,b.id==='forge'?5:4,b.id);}
 CITY_HOUSES.forEach((h,i)=>house(h.x,h.z,h.w,h.d,i%3===0?2:1,i%3===1?5:4,'house-'+i));
 const forgeBuilding=CITY_BUILDINGS.find(b=>b.id==='forge')!;
 plane(forgeBuilding.x+forgeBuilding.w/2-.14,1.4,forgeBuilding.z,2,1.6,7,Math.PI/2,glow);
 const stalls=CITY_STALLS.map(s=>[s.x,s.z]);
 for(const s of CITY_STALLS)stall(s.x,s.z,s.w,s.d);
 cyl(F.x,0,F.z,F.r,.65);cyl(F.x,.65,F.z,F.r-.4,.08,11,water);cyl(F.x,.73,F.z,.45,1.4);cyl(F.x,2.13,F.z,1,.12);cyl(F.x,2.25,F.z,.75,.04,11,water);
 for(const axis of ['x','z']as const)for(const side of [-1,1]){
  // Wall runs from each gate tower (4.5 m out) to the corner.
  const len=H-4.5,mid=4.5+len/2;
  for(const offset of [-mid,mid]){
   const x=axis==='x'?side*H:offset,z=axis==='z'?side*H:offset;
   box(x,0,z,axis==='x'?1:len,4.3,axis==='z'?1:len);box(x-side*(axis==='x'?.5:0),4.1,z-side*(axis==='z'?.5:0),axis==='x'?2:len,.3,axis==='z'?2:len);
   for(let i=-len/2+1;i<=len/2-1;i+=2)box(x+(axis==='z'?i:0),4.3,z+(axis==='x'?i:0),1,.7,1);
  }
  // South (meadow) and east (forest) gates are open.
  const x=axis==='x'?side*H:0,z=axis==='z'?side*H:0,open=side===1;
  box(x,5,z,axis==='x'?2:7,1.2,axis==='z'?2:7);if(!open)box(x,0,z,axis==='x'?1:6,5,axis==='z'?1:6,6);
  for(const offset of [-4.5,4.5]){const a=x+(axis==='z'?offset:0),b=z+(axis==='x'?offset:0);box(a,0,b,2,4.8,2);roof(a,4.8,b,2.5,2.5,4,1.7);}
  if(open)for(const offset of [-3.8,3.8])plane(x+(axis==='z'?offset:-1.06),2.8,z+(axis==='x'?offset:-1.06),.42,.65,7,axis==='z'?Math.PI:-Math.PI/2,glow);
  if(open)for(let i=-2.5;i<=2.5;i+=.5)box(x+(axis==='z'?i:0),5.25,z+(axis==='x'?i:0),axis==='x'?.12:.08,1.8,axis==='x'?.08:.12,10);
 }
 for(const x of [-H,H])for(const z of [-H,H]){box(x,0,z,3.1,5.3,3.1);roof(x,5.3,z,3.1,3.1,4,1.2);}
 for(const [x,z]of [[-6,H-.7],[H-.7,-6]]){box(x,0,z,1.6,2.6,1.6,3);roof(x,2.6,z,1.6,1.6,4,1);}
 // Repeated tiny props are instanced; no additional collision shapes.
 const props=new Map<string,{g:T.BufferGeometry;m:T.Material;transforms:T.Matrix4[]}>();
 function prop(key:string,g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,c:number){if(!props.has(key))props.set(key,{g:uv(g,c),m,transforms:[]});props.get(key)!.transforms.push(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion(),new T.Vector3(sx,sy,sz)));}
 function tint(g:T.BufferGeometry,colour:string){const c=new T.Color(colour),values=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(values,3));return g;}
 function planter(x:number,z:number){
  prop('planter',new T.CylinderGeometry(1,1,1,10),paint,x,.35,z,.8,.7,.8,2);prop('trunk',new T.CylinderGeometry(1,1,1,6),paint,x,1.65,z,.16,2.6,.16,10);
  for(const [dx,dy,dz,size]of [[-.65,3.1,0,1.1],[.65,3.3,.1,1.15],[0,4,-.2,1.2]])prop('tree',tint(new T.IcosahedronGeometry(1,1),'#f3ffd9'),paint,x+dx,dy,z+dz,size,size,size,4);
 }
 function bench(x:number,z:number){prop('bench-seat',new T.BoxGeometry(1,1,1),paint,x,.45,z,2.2,.18,.65,10);for(const dx of [-.8,.8])prop('bench-leg',new T.BoxGeometry(1,1,1),paint,x+dx,.18,z,.14,.36,.55,10);prop('bench-back',new T.BoxGeometry(1,1,1),paint,x,1,z+.27,2.2,.7,.12,10);}
 // Low clutter stays off the six-metre roads and the merchant approach.
 for(const [x,z]of stalls){
  prop('crate',new T.BoxGeometry(1,1,1),paint,x-1.8,.4,z+.5,.8,.8,.8,10);prop('barrel',new T.CylinderGeometry(1,1,1,10),paint,x-1.1,.5,z+.9,.4,1,.4,10);
  for(let i=0;i<3;i++){const bx=x-.9+i*.85;prop('basket',new T.CylinderGeometry(.55,.8,.45,8),paint,bx,.94,z,.55,.55,.55,10);for(let j=0;j<3;j++)prop('produce',tint(new T.IcosahedronGeometry(1,0),i%2?'#d5ad63':'#87ad72'),paint,bx+(j-1)*.13,1.12,z+(j%2)*.12,.16,.15,.16,i%2?5:4);}
 }
 // Planters and benches are solid in the shared layout: ring islands that never pinch a road, plus the quarters.
 // Window gardens are fitted into the original house perimeter.
 for(const h of CITY_HOUSES)for(const dx of [-h.w*.28,h.w*.28]){prop('flower-box',new T.BoxGeometry(1,1,1),paint,h.x+dx,1.1,h.z+h.d/2-.16,.9,.22,.25,10);for(let j=0;j<3;j++)prop('flowers',tint(new T.IcosahedronGeometry(1,0),'#d9ae9a'),paint,h.x+dx+(j-1)*.22,1.34,h.z+h.d/2-.16,.16,.18,.14,5);}
 // Wall banners and pigeons are decorative and have no collision or interaction hooks; no banner hangs in an open gateway.
 for(const side of [-1,1])for(let d=-36;d<=36;d+=12){if(side===1&&d===0)continue;plane(d,3,side*(H-.55),.9,1.6,9,side===1?Math.PI:0);plane(side*(H-.55),3,d,.9,1.6,9,side===1?-Math.PI/2:Math.PI/2);}
 const birdMat=new T.MeshStandardMaterial({color:'#777c79',roughness:1});
 for(let i=0;i<38;i++){const a=i*2.4,d=6+(i%7)*.65,x=14+Math.cos(a)*d,z=11+Math.sin(a)*d;if(Math.abs(z)<3.5)continue;prop('pigeon',new T.SphereGeometry(1,6,4),birdMat,x,.09,z,.11,.09,.22,0);prop('pigeon-head',new T.SphereGeometry(1,6,4),birdMat,x,.19,z-.12,.075,.075,.075,0);}
 // Lamp posts: around the tower and every ~12 m along both main roads.
 const lamps=[[-4,-5],[4,-5],[-5,5],[5,5]];for(let d=12;d<H-3;d+=12)for(const sgn of [-1,1]){lamps.push([3.6,sgn*d],[-3.6,sgn*d+6],[sgn*d,3.6],[sgn*d+6,-3.6]);}
 const clear=(x:number,z:number)=>![...CITY_BUILDINGS,...CITY_HOUSES].some(b=>Math.abs(x-b.x)<b.w/2+1&&Math.abs(z-b.z)<b.d/2+1)&&Math.hypot(x-F.x,z-F.z)>F.r+1;
 for(const [x,z]of lamps.filter(([x,z])=>clear(x,z))){
  prop('post',new T.BoxGeometry(1,1,1),paint,x,1.2,z,.12,2.4,.12,10);prop('lantern',new T.BoxGeometry(1,1,1),glow,x,2.5,z,.34,.5,.34,7);
  prop('banner',new T.BoxGeometry(1,1,1),paint,x+.45,2.25,z,.65,1.1,.08,9);
 }
 for(const [x,z]of [[-3,-22],[3,-22],[-23,3],[22,3],[23,-3],[24,3]].map(([x,z])=>[x*K,z*K])){
  prop('crate',new T.BoxGeometry(1,1,1),paint,x,.4,z,.8,.8,.8,10);prop('barrel',new T.CylinderGeometry(1,1,1,10),paint,x+1,.5,z,.4,1,.4,10);
 }
 for(const p of CITY_PLANTERS)planter(p.x,p.z);
 for(const b of CITY_BENCHES)bench(b.x,b.z);
 box(GATE_CAPTAIN.x-9,0,GATE_CAPTAIN.z,.14,2,.14,10);box(GATE_CAPTAIN.x-9,1,GATE_CAPTAIN.z,2,1.2,.15,10);
 const marketBuilding=CITY_BUILDINGS.find(b=>b.id==='market')!;plane(marketBuilding.x-marketBuilding.w/2+.12,2,marketBuilding.z+2,.7,.85,9,-Math.PI/2);
 function kit(name:string,keys:string[]){
  const base=props.get(keys[0]);if(!base)return;const count=base.transforms.length;if(keys.some(k=>!props.has(k)||props.get(k)!.m!==base.m||props.get(k)!.transforms.length%count))return;
  const origin=new T.Vector3().setFromMatrixPosition(base.transforms[0]),geometries:T.BufferGeometry[]=[];
  for(const key of keys){const p=props.get(key)!,ratio=p.transforms.length/count;for(let i=0;i<ratio;i++)geometries.push((p.g.index?p.g.toNonIndexed():p.g.clone()).applyMatrix4(p.transforms[i]).translate(-origin.x,0,-origin.z));}
  const g=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const transforms=base.transforms.map(m=>{const p=new T.Vector3().setFromMatrixPosition(m);return new T.Matrix4().makeTranslation(p.x,0,p.z);});
  for(const key of keys){props.get(key)!.g.dispose();props.delete(key);}props.set(name,{g,m:base.m,transforms});
 }
 kit('planter-kit',['planter','trunk','tree']);kit('bench-kit',['bench-seat','bench-leg','bench-back']);kit('lamp-kit',['post','banner']);kit('wares-kit',['crate','barrel']);kit('pigeon-kit',['pigeon','pigeon-head']);
 // Heterogeneous instancing: one material batch per 16m tile, with per-instance culling.
 const propTiles=new Map<string,{material:T.Material;entries:{geometry:T.BufferGeometry;matrix:T.Matrix4}[]}>();
 for(const p of props.values())for(const transform of p.transforms){const v=new T.Vector3().setFromMatrixPosition(transform),key=p.m.uuid+':'+Math.floor(v.x/16)+','+Math.floor(v.z/16);if(!propTiles.has(key))propTiles.set(key,{material:p.m,entries:[]});propTiles.get(key)!.entries.push({geometry:p.g,matrix:transform});}
 for(const [key,{material,entries}]of propTiles){const unique=new Map<T.BufferGeometry,T.BufferGeometry>();for(const entry of entries)if(!unique.has(entry.geometry))unique.set(entry.geometry,entry.geometry.index?entry.geometry.toNonIndexed():entry.geometry.clone());
  const vertices=[...unique.values()].reduce((n,g)=>n+g.getAttribute('position').count,0),mesh=new T.BatchedMesh(entries.length,vertices,0,material);mesh.name='city-props@'+key;mesh.userData.nonCastingDecor=true;mesh.userData.artTile=true;
  const ids=new Map([...unique].map(([source,g])=>[source,mesh.addGeometry(g)]));for(const entry of entries){const id=mesh.addInstance(ids.get(entry.geometry)!);mesh.setMatrixAt(id,entry.matrix);}mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.receiveShadow=true;root.add(mesh);unique.forEach(g=>g.dispose());
 }
 props.forEach(p=>p.g.dispose());

 for(const {material,geometries}of batches.values()){const mesh=new T.Mesh(mergeGeometries(geometries),material);mesh.receiveShadow=true;mesh.castShadow=material===paint||material===canvasPaint;root.add(mesh);geometries.forEach(g=>g.dispose());}
 // Five fixed front-facing, four-frame idle sprites share one atlas and one material.
 const npcMap=loader.load('/assets/city/city-npcs-v1.png');const npcMaterial=new T.MeshBasicMaterial({map:npcMap,transparent:true,alphaTest:.05,side:T.DoubleSide,depthWrite:true,toneMapped:false});
 const npcs=[...CITY_BUILDINGS.map(b=>b.talk),HEALER,GATE_CAPTAIN].map((p,row)=>{
  const height=row===4?2.1:2.0;const g=new T.PlaneGeometry(2.6*height/3.5,height);g.translate(0,height*(.5-8/320),0);const mesh=new T.Mesh(g,npcMaterial);mesh.position.set(p.x,.035,p.z);mesh.onBeforeRender=(_r,_s,c)=>mesh.quaternion.copy(c.quaternion);root.add(mesh);return{mesh,row};
 });
 const townGeo=new T.PlaneGeometry(1.45,1.95);townGeo.translate(0,.94,0);
 const townMat=new T.MeshBasicMaterial({map:npcMap,transparent:true,alphaTest:.08,side:T.DoubleSide,toneMapped:false});const townFrame={value:0};
 townMat.onBeforeCompile=shader=>{shader.uniforms.cityIdleFrame=townFrame;shader.vertexShader='attribute float cityNpcRow;uniform float cityIdleFrame;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv=vec2((uv.x+cityIdleFrame)/4.,(uv.y+4.-cityNpcRow)/5.);');};townMat.customProgramCacheKey=()=> 'city-idle-residents-v1';
 const townsfolk=new T.InstancedMesh(townGeo,townMat,12),dummy=new T.Object3D();townsfolk.name='city-townsfolk';const rows=new Float32Array(12);
 for(let i=0;i<12;i++){const anchor=stalls[i%4];dummy.position.set(anchor[0]-2.5+(i%3)*1.3,.04,anchor[1]+(i%2?2.4:-2.5));dummy.quaternion.setFromRotationMatrix(new T.Matrix4().lookAt(new T.Vector3(9,16,13),new T.Vector3(),new T.Vector3(0,1,0)));dummy.updateMatrix();townsfolk.setMatrixAt(i,dummy.matrix);rows[i]=i%5;}
 townGeo.setAttribute('cityNpcRow',new T.InstancedBufferAttribute(rows,1));root.add(townsfolk);
 // South of the bottom step: the camera-facing upper edge tilts north toward the tower.
 const angel=new T.Sprite(new T.SpriteMaterial({map:loader.load('/assets/skills-painted/angel-v1.png'),transparent:true,alphaTest:.04,depthWrite:false,toneMapped:false}));angel.center.set(.5,.025);angel.scale.set(2.6,3.9,1);angel.position.set(jobs.angel.x,.05,jobs.angel.z);root.add(angel);
 function fogTexture(size:number){const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d')!,grad=ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);grad.addColorStop(0,'#bacbd4aa');grad.addColorStop(1,'#bacbd400');ctx.fillStyle=grad;ctx.fillRect(0,0,size,size);return new T.CanvasTexture(c);}
 const fogHQ=fogTexture(128),fogLOW=fogTexture(64);
 // The existing painted mist/castle cell fills both the horizon and the ground outside the walls.
 const backdropMaterial=new T.MeshBasicMaterial({map:atlas,color:'#bacbd7',side:T.DoubleSide,fog:false});
 const outside=new T.Mesh(uv(new T.PlaneGeometry(S*4,S*4).rotateX(-Math.PI/2),11),backdropMaterial);outside.position.y=-.17;root.add(outside);
 for(const side of [-1,1])for(const axis of [0,1]){
  const horizon=new T.Mesh(uv(new T.PlaneGeometry(S*2.6,65),11),backdropMaterial);horizon.position.set(axis?side*(H+28):0,13,axis?0:side*(H+28));horizon.rotation.y=axis?Math.PI/2:0;root.add(horizon);
 }
 const fogMaterial=new T.ShaderMaterial({uniforms:{painted:{value:atlas},softness:{value:fogHQ}},transparent:true,side:T.DoubleSide,depthWrite:false,
  vertexShader:`varying vec2 mistUV;void main(){mistUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D painted;uniform sampler2D softness;varying vec2 mistUV;
   void main(){vec3 brush=texture2D(painted,vec2((3.02+mistUV.x*.96)/4.,(.02+mistUV.y*.96)/3.)).rgb;
   float alpha=texture2D(softness,mistUV).a;
   gl_FragColor=vec4(mix(vec3(.64,.73,.79),brush,.45),alpha*.92);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const curtains=new T.Group();root.add(curtains);
 // Layer-major order keeps one complete four-sided mist bank on LOW.
 for(let layer=0;layer<2;layer++)for(const side of [-1])for(const axis of [0,1]){
  // Split the east bank around the open passage to the forest, rather than hanging fog in the doorway.
  const bank=S*1.6,half=bank/2-6;
  for(const offset of side===1?[-(half/2+5),half/2+5]:[0]){
   const f=new T.Mesh(new T.PlaneGeometry(offset?half:bank,30),fogMaterial);f.position.set(axis?side*(H+layer*2):0,6+layer,axis?offset:side*(H+layer*2));f.rotation.set(-Math.PI/4,axis?Math.PI/2:0,0);f.userData.forestFogLayer=layer;curtains.add(f);
  }
 }
 // Flat banks make the plaza boundary visibly hazy even from the top-down overview.
 const edgeBanks=new T.Group();root.add(edgeBanks);
 for(const side of [-1])for(const axis of [0,1]){
  const len=S*1.42,part=len/2-6;
  for(const offset of side===1?[-(part/2+5),part/2+5]:[0]){const f=new T.Mesh(new T.PlaneGeometry(axis?16:len,axis?(offset?part:len):16).rotateX(-Math.PI/2),fogMaterial);f.position.set(axis?side*(H-1):0,.22,axis?offset:side*(H-1));edgeBanks.add(f);}
 }
  const seam=new T.Sprite(new T.SpriteMaterial({map:fogHQ,transparent:true,opacity:.45,depthWrite:false}));seam.position.set(.55,.35,2.2);seam.scale.set(2,.7,1);root.add(seam);
 const forge=CITY_BUILDINGS.find(b=>b.id==='forge')!;
 const smokePositions=new Float32Array(6*3),smokeGeo=new T.BufferGeometry();smokeGeo.setAttribute('position',new T.BufferAttribute(smokePositions,3));
 const smoke=new T.Points(smokeGeo,new T.PointsMaterial({map:fogHQ,color:'#737b79',size:1.8,transparent:true,opacity:.2,depthWrite:false}));root.add(smoke);
 const mistPositions=new Float32Array(36*3);for(let i=0;i<36;i++){mistPositions[i*3]=Math.sin(i*17.1)*(H-4);mistPositions[i*3+1]=.2+(i%5)*.13;mistPositions[i*3+2]=Math.cos(i*13.7)*(H-4);}
 const mistGeo=new T.BufferGeometry();mistGeo.setAttribute('position',new T.BufferAttribute(mistPositions,3));const mist=new T.Points(mistGeo,new T.PointsMaterial({map:fogHQ,color:'#d4e0e3',size:1.8,transparent:true,opacity:.19,depthWrite:false}));root.add(mist);
 // Four local candidates; the shared camera selector activates only nearby points.
 for(const [x,z]of [[CITY_BUILDINGS[1].x+CITY_BUILDINGS[1].w/2+1,0],[4,5],[-4,45],[45,-4]]){const l=new T.PointLight('#ffc681',2,8,2);l.position.set(x,2.5,z);root.add(l);}
 contactShadows(root,[...CITY_HOUSES,...CITY_BUILDINGS].map(b=>({x:b.x,z:b.z,w:b.w*1.5,d:b.d*1.5})).concat([{x:0,z:0,w:7,d:7},{x:F.x,z:F.z,w:6,d:6}]));chunkInstances(root);let high=true,frame=-1;
 return{root,buildingBounds,scaleSamples,npcActors:[...npcs.map(n=>n.mesh),angel],setQuality(hq:boolean){high=hq;seam.visible=hq;smoke.visible=hq;mist.visible=hq;fogMaterial.uniforms.softness.value=hq?fogHQ:fogLOW;seam.material.map=hq?fogHQ:fogLOW;curtains.visible=hq;edgeBanks.visible=hq;artQuality(root,hq);root.traverse(o=>{if(o instanceof T.InstancedMesh&&o.name.startsWith('city-contact'))o.visible=!hq;if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh))o.castShadow=hq&&(o.material===paint||o.material===canvasPaint)&&!o.userData.nonCastingDecor;});},snapshot:()=>({...artStats(root),ready:!!atlas.userData.ready&&!!npcMap.userData.ready,mapId:'city_plaza',size:[S,S],quality:high?'HQ':'LOW',mistParticles:high?36:0,fogResolution:high?128:64,groundTileMetres:.25,canvasStripeMetres:.8,additionalStalls:4,townsfolk:12,buildings:buildingBounds,openGates:['south','east'],compassMedallions:1,paintedBackdrop:true,fogCards:high?curtains.children.length+edgeBanks.children.length:0,npcFrames:4,npcCount:5,realLights:4}),update(time:number){
  const next=Math.floor(time*4)%4;townFrame.value=next;if(next!==frame){frame=next;for(const {mesh,row}of npcs){const a=mesh.geometry.getAttribute('uv');a.setXY(0,(frame+.02)/4,(5-row-.02)/5);a.setXY(1,(frame+.98)/4,(5-row-.02)/5);a.setXY(2,(frame+.02)/4,(4-row+.02)/5);a.setXY(3,(frame+.98)/4,(4-row+.02)/5);a.needsUpdate=true;}}
  for(let i=0;i<6;i++){smokePositions[i*3]=forge.x-forge.w*.28+Math.sin(time*.5+i)*.25;smokePositions[i*3+1]=5.1+(i*.5+time*.35)%3;smokePositions[i*3+2]=forge.z-forge.d*.22;}smokeGeo.attributes.position.needsUpdate=true;smokeGeo.computeBoundingSphere();mist.position.x=Math.sin(time*.07)*.7;mist.position.z=Math.cos(time*.05)*.6;seam.material.opacity=.32+Math.sin(time*.8)*.08;
 }};
}
