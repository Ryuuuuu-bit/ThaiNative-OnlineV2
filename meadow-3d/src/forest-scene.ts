import {chunkInstances,artQuality,artStats} from './world-art.ts';
import * as T from 'three';
import type { PaintedLoader } from './assets';
import { FOREST, FOREST_TREES, FOREST_ARENA, GATES, LAYOUTS } from '@thainative/shared/maps';
const L=LAYOUTS.forest,W=FOREST.halfX*2,D=FOREST.halfZ*2,K=W/40;
import { walkable } from './sim';
import { uprightCard, TALL_PROP } from './upright-depth.ts';
import { label, random } from './scene';

interface Asset {name:string;atlas:string;worldSize:[number,number];anchor:[number,number];uvRect:[number,number,number,number];trunkWidth?:number}
interface Manifest {assets:Asset[];atlases:{file:string}[]}
const BASE='/assets/env-forest/';
const facing=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(new T.Vector3(9,16,13),new T.Vector3(),new T.Vector3(0,1,0)));

/** Visual dressing only: collision and all existing anchors remain in shared/maps. */
export function buildForest(scene:T.Scene,loader:PaintedLoader){
 const r=random(29),root=new T.Group();root.name='forest';scene.add(root);
 let high=true,ready=false,props=0,batches=0,scatter=0;
 const ripple={time:{value:0},quality:{value:1}};
 const tex=(name:string,repeat=1)=>{const t=loader.load(BASE+name);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;return t;};
 const floor=tex('tile-moss-v1.png',20*(W+150)/110),dirt=tex('tile-path-v1.png'),litter=tex('tile-litter-v1.png',18);dirt.repeat.set(12*K,12*K*D/W*40/32);
 const ground=new T.Mesh(new T.PlaneGeometry(W+150,D+150),new T.MeshStandardMaterial({map:floor,color:'#a9bcb1',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;root.add(ground);
 const pathCanvas=document.createElement('canvas');pathCanvas.width=2048;pathCanvas.height=Math.round(2048*D/W);const PX=2048/W;
 const ctx=pathCanvas.getContext('2d')!,mask=new T.CanvasTexture(pathCanvas);
 const segments=L.paths.flatMap(p=>p.points.slice(1).map((b,i)=>[p.points[i][0],p.points[i][1],b[0],b[1],p.width])),brush=loader.load(BASE+'brush-path-v1.png');let pathsPainted=false;
 function paintPaths(){if(pathsPainted||!brush.userData.ready)return;pathsPainted=true;ctx.fillStyle='#000';ctx.fillRect(0,0,pathCanvas.width,pathCanvas.height);ctx.globalCompositeOperation='screen';
  const stamp=document.createElement('canvas');stamp.width=stamp.height=128;const sc=stamp.getContext('2d')!;sc.drawImage(brush.image as HTMLImageElement,0,0,128,128);sc.globalCompositeOperation='source-in';sc.fillStyle='#fff';sc.fillRect(0,0,128,128);
  // Brush size follows each path's width (the original 88 px stamp at 25.6 px/m for a 2.4 m road).
  for(const[ax,az,bx,bz,w]of segments){const len=Math.hypot(bx-ax,bz-az),size=w/2.4*3.44*PX;for(let n=0;n<=len;n+=.22){const t=n/len,x=T.MathUtils.lerp(ax,bx,t),z=T.MathUtils.lerp(az,bz,t);ctx.drawImage(stamp,(x+FOREST.halfX)*PX-size/2,(z+FOREST.halfZ)*PX-size/2,size,size);}}
  ctx.globalCompositeOperation='source-over';mask.needsUpdate=true;
 }
 const path=new T.Mesh(new T.PlaneGeometry(W,D),new T.MeshStandardMaterial({map:dirt,alphaMap:mask,transparent:true,depthWrite:false,roughness:1,color:'#b9b6a5'}));path.rotation.x=-Math.PI/2;path.position.y=.006;root.add(path);
 // The meadow ripple shader, with an even smaller displacement; feathered UV edges in HQ/LOW.
 function soft(material:T.MeshStandardMaterial,animated=false){material.onBeforeCompile=shader=>{
  shader.uniforms.uForestTime=ripple.time;shader.uniforms.uForestQuality=ripple.quality;
  shader.vertexShader='varying vec2 vForestUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvForestUV=uv;');
  shader.fragmentShader='varying vec2 vForestUV;uniform float uForestTime;uniform float uForestQuality;\n'+shader.fragmentShader;
  if(animated)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replaceAll('vMapUv','(vMapUv+vec2(sin(vMapUv.y*70.+uForestTime*.6),cos(vMapUv.x*65.-uForestTime*.5))*.0006*uForestQuality)'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','float fr=length(vForestUV-.5)*2.;float fw=sin(vForestUV.x*51.)*sin(vForestUV.y*43.)*.022;diffuseColor.a*=1.-smoothstep(.82,1.,fr+fw);\n#include <alphatest_fragment>');
 };material.customProgramCacheKey=()=>`forest-soft-${animated}`;}
 function disc(material:T.MeshStandardMaterial,x:number,z:number,rx:number,rz:number,y:number){const o=new T.Mesh(new T.CircleGeometry(1,64),material);o.rotation.x=-Math.PI/2;o.scale.set(rx,rz,1);o.position.set(x,y,z);root.add(o);return o;}
 const shoreMat=new T.MeshStandardMaterial({map:litter,color:'#929d88',roughness:1,transparent:true,depthWrite:false});soft(shoreMat);for(const w of L.water)disc(shoreMat,w.x,w.z,w.rx*1.12,w.rz*1.19,.012);
 const waterMat=new T.MeshStandardMaterial({map:tex('tile-water-v1.png',3),color:'#6c9295',roughness:1,metalness:0,transparent:true,depthWrite:false});soft(waterMat,true);for(const w of L.water)disc(waterMat,w.x,w.z,w.rx,w.rz,.024);
 const clearingMat=new T.MeshStandardMaterial({map:floor,color:'#a2b6a0',roughness:1,transparent:true,depthWrite:false});soft(clearingMat);disc(clearingMat,FOREST_ARENA.x,FOREST_ARENA.z,3.4,3.4,.018);
 const treePlacements:{x:number;z:number;r:number;design:string;trunkWidth:number}[]=[];
 const mist=new T.Group();root.add(mist);
 const mistMat=new T.MeshBasicMaterial({map:loader.load(BASE+'mist-card-v1.png'),color:'#c6bfd4',transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide});
 const mistOrigins:{x:number;z:number}[]=[];
 // Mist hugs each pool, plus knee-height cards drifting across the forest floor.
 for(const w of L.water)for(let i=0;i<3;i++){const sheet=new T.Mesh(new T.PlaneGeometry(w.rx*1.2,1.1),mistMat);sheet.quaternion.copy(facing);const x=w.x+(i-1)*w.rx*.5,z=w.z+(i-1)*.7;sheet.position.set(x,.38,z);mist.add(sheet);mistOrigins.push({x,z});}
 for(let i=0;i<70;i++){const sheet=new T.Mesh(new T.PlaneGeometry(9,1.1),mistMat);sheet.quaternion.copy(facing);const x=(r()-.5)*(W-6),z=(r()-.5)*(D-6);sheet.position.set(x,.38,z);mist.add(sheet);mistOrigins.push({x,z});}
 loader.json<Manifest>(BASE+'manifest.json',manifest=>{
  const assets=new Map(manifest.assets.map(a=>[a.name,a])),atlases=new Map(manifest.atlases.map(a=>[a.file,loader.load(BASE+a.file)]));
  const instances=new Map<string,{x:number;z:number;sx:number;sy:number;flip:boolean}[]>(),contacts:{x:number;z:number;width:number}[]=[];
  function prop(name:string,x:number,z:number,sx=1,sy=sx,flip=false,foreground=false){const key=name+(foreground?':foreground':'')+(['fern','mushrooms','spores'].includes(name)?':cover':'');const list=instances.get(key)||[];list.push({x,z,sx,sy,flip});instances.set(key,list);props++;const a=assets.get(name)!;contacts.push({x,z,width:Math.min(a.worldSize[0]*sx*.65,3.5)});}
  const trees=['pine','oak','silver','hollow'],kindDesign:Record<string,string>={pine:'pine',oak:'oak',dead:'silver',hollow:'hollow'};
  for(const[i,t]of FOREST_TREES.entries()){const design=kindDesign[t.kind??'']??trees[i%4],a=assets.get(design)!,sx=(design==='hollow'?4/a.worldSize[0]:design==='pine'?(8+r()*4)/a.worldSize[1]:design==='oak'?(7+r()*3)/a.worldSize[1]:(8+r()*2)/a.worldSize[1]),sy=sx;prop(design,t.x,t.z,sx,sy,i%2===1);treePlacements.push({...t,design,trunkWidth:t.r*2});}
  // Treeline just outside the walkable edge (about one tree per 3.5 m), open at the west gate.
  const perSide=Math.round(W/3.5);
  for(let i=0;i<perSide*4;i++){const side=i%4,k=Math.floor(i/4)/perSide;let x=0,z=0;
   if(side<2){x=-FOREST.halfX-1+k*(W+2);z=(side===0?-1:1)*(FOREST.halfZ+1.6+r());}else{x=(side===2?1:-1)*(FOREST.halfX+1.6+r());z=-FOREST.halfZ-1+k*(D+2);if(side===3&&Math.abs(z)<3.8)continue;}
   const step=Math.floor(i/4),design=step%6===0?'silver':trees[(step+side)%2],a=assets.get(design)!,scale=(5.6+r()*2)/a.worldSize[1];prop(design,x,z,scale,scale,i%3===0,side===1||side===2);
  }
  prop('arch',GATES.forest.west.x,GATES.forest.west.z);
  for(const c of L.camps){prop('bedroll',c.x,c.z+.7,.9);prop('log-seat',c.x-1.3,c.z-.8,.65);prop('log-seat',c.x+2,c.z+.8,.65);prop('campfire',c.x+1.3,c.z-.7,1);prop('lantern',c.x-1.7,c.z+.8,1);}
  for(let i=0;i<11;i++){const a=i/11*Math.PI*2;prop('rock',FOREST_ARENA.x+Math.cos(a)*3.9,FOREST_ARENA.z+Math.sin(a)*3.9,.65,.65,i%2===0);}
  for(const w of L.water){const n=Math.round((w.rx+w.rz)*1.8);for(let i=0;i<n;i++){const a=i/n*Math.PI*2;prop('reeds',w.x+Math.cos(a)*(w.rx+.15),w.z+Math.sin(a)*(w.rz+.2),.6);}}
  // Same scatter density as the art pass (~0.19 per m²), kept off paths, camps and the clearing.
  const onPath=(x:number,z:number)=>segments.some(([ax,az,bx,bz,w])=>{const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-ax-dx*t,z-az-dz*t)<w/2+.5;});
  for(let i=0;i<W*D*.19;i++){const x=(r()-.5)*(W-2),z=(r()-.5)*(D-2);if(!walkable(x,z,.3,'forest')||Math.hypot(x-FOREST_ARENA.x,z-FOREST_ARENA.z)<4.2||L.camps.some(c=>Math.hypot(x-c.x,z-c.z)<3)||onPath(x,z))continue;prop(['fern','mushrooms','fallen-log','rock','spores'][i%5],x,z,.35+r()*.4,undefined,i%2===0);scatter++;}
  for(const [x,z,scale]of L.water.flatMap(w=>[[w.x-w.rx*.3,w.z-w.rz*.2,.65],[w.x+w.rx*.3,w.z+w.rz*.3,.55]])){const a=assets.get('lilies')!,g=new T.PlaneGeometry(a.worldSize[0]*scale,a.worldSize[1]*scale),uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,a.uvRect[0]+uv.getX(i)*a.uvRect[2],a.uvRect[1]+uv.getY(i)*a.uvRect[3]);const o=new T.Mesh(g,new T.MeshBasicMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:.08,depthWrite:false,toneMapped:false}));o.rotation.x=-Math.PI/2;o.position.set(x,.04,z);root.add(o);batches++;props++;}
  // Hanging lanterns on trees beside the paths so the roads glow at night.
  for(const t of FOREST_TREES.filter((t,i)=>i%9===0))prop('lantern',t.x+t.r*.5,t.z,.65);
  const dummy=new T.Object3D();
  // Physical trunk proxies match the authoritative collision circles, below painted roots.
  const trunks=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,8),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}),FOREST_TREES.length);trunks.userData.shadowCaster=true;trunks.userData.shadowOnly=true;trunks.castShadow=high;trunks.name='forest-trunk-proxies';
  FOREST_TREES.forEach((t,i)=>{dummy.position.set(t.x,.85,t.z);dummy.rotation.set(0,0,0);dummy.scale.set(t.r,1.7,t.r);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);});root.add(trunks);

  for(const[name,list]of instances){const foreground=name.includes(':foreground'),a=assets.get(name.split(':')[0])!,g=new T.PlaneGeometry(1,1);g.translate(.5-a.anchor[0],a.anchor[1]-.5,0);const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,a.uvRect[0]+uv.getX(i)*a.uvRect[2],a.uvRect[1]+uv.getY(i)*a.uvRect[3]);
   // The camera-side edge stays dense but does not hide the playable clearing.
   const material=new T.MeshBasicMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:foreground?.01:.08,depthWrite:!foreground,opacity:foreground?.24:1,side:T.DoubleSide,toneMapped:false,color:'#d8e3db'}),batch=new T.InstancedMesh(g,material,list.length);batch.name='forest-'+name;
   batch.userData.groundCover=name.includes(':cover');batch.userData.shadowCaster=['pine','oak','silver','hollow','arch'].includes(a.name);batch.castShadow=high&&batch.userData.shadowCaster;batch.customDepthMaterial=new T.MeshDepthMaterial({map:atlases.get(a.atlas),alphaTest:.2,depthPacking:T.RGBADepthPacking,side:T.DoubleSide});
   g.setAttribute('forestFlip',new T.InstancedBufferAttribute(new Float32Array(list.map(p=>p.flip?1:0)),1));
   material.onBeforeCompile=shader=>{shader.uniforms.uForestFlipBounds={value:new T.Vector3(a.uvRect[0]*2,a.uvRect[2],a.anchor[0]*2-1)};shader.vertexShader='attribute float forestFlip;uniform vec3 uForestFlipBounds;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv.x=mix(vMapUv.x,uForestFlipBounds.x+uForestFlipBounds.y-vMapUv.x,forestFlip);').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=forestFlip*uForestFlipBounds.z;');};material.customProgramCacheKey=()=> 'forest-prop-flip-v1';uprightCard(material,!foreground&&a.worldSize[1]>=TALL_PROP);
   list.forEach((p,i)=>{dummy.position.set(p.x,.045,p.z);dummy.quaternion.copy(facing);dummy.scale.set(a.worldSize[0]*p.sx,a.worldSize[1]*p.sy,1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.computeBoundingSphere();root.add(batch);batches++;
  }
  // One instanced draw for all soft contact ellipses.
  const shadowMat=new T.MeshBasicMaterial({color:'#243b3b',transparent:true,opacity:.25,depthWrite:false});
  shadowMat.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 vContactUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvContactUV=uv;');shader.fragmentShader='varying vec2 vContactUV;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=1.-smoothstep(.08,.5,length(vContactUV-.5));\n#include <alphatest_fragment>');};shadowMat.customProgramCacheKey=()=> 'forest-contact';
  const shadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),shadowMat,contacts.length);contacts.forEach((p,i)=>{dummy.position.set(p.x,.031,p.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(p.width,p.width*.62,1);dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);});shadows.computeBoundingSphere();root.add(shadows);batches++;chunkInstances(root);artQuality(root,high);ready=true;
 });
 const flames:T.Mesh[]=[],fireLights:T.PointLight[]=[];
 for(const c of L.camps){const flame=new T.Group();flame.position.set(c.x+1.3,.12,c.z-.7);root.add(flame);
 for(let i=0;i<3;i++){const f=new T.Mesh(new T.ConeGeometry(.09,.38,6),new T.MeshBasicMaterial({color:i%2?'#f8dfad':'#db9b65',transparent:true,opacity:.7,depthWrite:false}));f.position.set(Math.sin(i*2)*.08,.2,Math.cos(i*2)*.08);flame.add(f);flames.push(f);}
 const fireLight=new T.PointLight('#ffb36b',4,7,2);fireLight.position.set(flame.position.x,1,flame.position.z);root.add(fireLight);fireLights.push(fireLight);}
 const shafts=new T.Group();root.add(shafts);const shaftMat=new T.MeshBasicMaterial({map:loader.load(BASE+'mist-card-v1.png'),color:'#c4d9c8',transparent:true,opacity:.07,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
 for(const [x,z]of [[-44,0],[-5,1],[12,-23],[34,7],[40,18]]){const shaft=new T.Mesh(new T.PlaneGeometry(2.4,12),shaftMat);shaft.quaternion.copy(facing);shaft.rotateZ(-.35);shaft.position.set(x,5,z);shafts.add(shaft);}
 const gateName=label('← นครที่ถูกลืมเลือน');gateName.position.set(GATES.forest.west.x+1.5,3.2,GATES.forest.west.z);root.add(gateName);
 for(const c of L.camps){const campName=label('แคมป์ · พักฟื้น','#e5efd3');campName.position.set(c.x,2.1,c.z);root.add(campName);}
 return{root,setQuality(hq:boolean){high=hq;artQuality(root,hq);shafts.visible=hq;mist.visible=hq;ripple.quality.value=hq?1:0;},snapshot:()=>({...artStats(root),ready,greybox:false,trees:FOREST_TREES.length,treePlacements,props,propDrawCalls:batches,scatter,atlasCount:1,mistCards:high?mist.children.length:0,ripple:high,quality:high?'HQ':'LOW'}),update(time:number){paintPaths();ripple.time.value=time;flames.forEach((f,i)=>{f.scale.y=.85+Math.sin(time*11+i)*.13;f.rotation.y=time*.6;});fireLights.forEach((l,i)=>l.intensity=3.5+Math.sin(time*9+i)*.5);mist.children.forEach((o,i)=>{o.position.x=mistOrigins[i].x+Math.sin(time*.1+i)*.55;o.position.z=mistOrigins[i].z+Math.cos(time*.07+i)*.18;});}};
}
