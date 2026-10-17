import * as T from 'three';
import type { PaintedLoader } from './assets';
import { FOREST, FOREST_TREES, FOREST_CAMP, FOREST_ARENA, GATES } from '@thainative/shared/maps';
import { walkable } from './sim';
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
 const floor=tex('tile-moss-v1.png',20),dirt=tex('tile-path-v1.png',12),litter=tex('tile-litter-v1.png',18);
 const ground=new T.Mesh(new T.PlaneGeometry(110,110),new T.MeshStandardMaterial({map:floor,color:'#a9bcb1',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;root.add(ground);
 const pathCanvas=document.createElement('canvas');pathCanvas.width=pathCanvas.height=1024;
 const ctx=pathCanvas.getContext('2d')!,mask=new T.CanvasTexture(pathCanvas);
 const segments=[[-19.4,0,13,0],[13,0,13,6]],brush=loader.load(BASE+'brush-path-v1.png');let pathsPainted=false;
 function paintPaths(){if(pathsPainted||!brush.userData.ready)return;pathsPainted=true;ctx.fillStyle='#000';ctx.fillRect(0,0,1024,1024);ctx.globalCompositeOperation='screen';
  const stamp=document.createElement('canvas');stamp.width=stamp.height=128;const sc=stamp.getContext('2d')!;sc.drawImage(brush.image as HTMLImageElement,0,0,128,128);sc.globalCompositeOperation='source-in';sc.fillStyle='#fff';sc.fillRect(0,0,128,128);
  for(const[ax,az,bx,bz]of segments){const len=Math.hypot(bx-ax,bz-az);for(let n=0;n<=len;n+=.22){const t=n/len,x=T.MathUtils.lerp(ax,bx,t),z=T.MathUtils.lerp(az,bz,t);ctx.drawImage(stamp,(x+20)/40*1024-44,(z+16)/32*1024-44,88,88);}}
  ctx.globalCompositeOperation='source-over';mask.needsUpdate=true;
 }
 const path=new T.Mesh(new T.PlaneGeometry(40,32),new T.MeshStandardMaterial({map:dirt,alphaMap:mask,transparent:true,depthWrite:false,roughness:1,color:'#b9b6a5'}));path.rotation.x=-Math.PI/2;path.position.y=.006;root.add(path);
 // The meadow ripple shader, with an even smaller displacement; feathered UV edges in HQ/LOW.
 function soft(material:T.MeshStandardMaterial,animated=false){material.onBeforeCompile=shader=>{
  shader.uniforms.uForestTime=ripple.time;shader.uniforms.uForestQuality=ripple.quality;
  shader.vertexShader='varying vec2 vForestUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvForestUV=uv;');
  shader.fragmentShader='varying vec2 vForestUV;uniform float uForestTime;uniform float uForestQuality;\n'+shader.fragmentShader;
  if(animated)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replaceAll('vMapUv','(vMapUv+vec2(sin(vMapUv.y*70.+uForestTime*.6),cos(vMapUv.x*65.-uForestTime*.5))*.0006*uForestQuality)'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','float fr=length(vForestUV-.5)*2.;float fw=sin(vForestUV.x*51.)*sin(vForestUV.y*43.)*.022;diffuseColor.a*=1.-smoothstep(.82,1.,fr+fw);\n#include <alphatest_fragment>');
 };material.customProgramCacheKey=()=>`forest-soft-${animated}`;}
 function disc(material:T.MeshStandardMaterial,x:number,z:number,rx:number,rz:number,y:number){const o=new T.Mesh(new T.CircleGeometry(1,64),material);o.rotation.x=-Math.PI/2;o.scale.set(rx,rz,1);o.position.set(x,y,z);root.add(o);return o;}
 const shoreMat=new T.MeshStandardMaterial({map:litter,color:'#929d88',roughness:1,transparent:true,depthWrite:false});soft(shoreMat);disc(shoreMat,5,-8,4.5,3.1,.012);
 const waterMat=new T.MeshStandardMaterial({map:tex('tile-water-v1.png',3),color:'#6c9295',roughness:1,metalness:0,transparent:true,depthWrite:false});soft(waterMat,true);disc(waterMat,5,-8,4,2.6,.024);
 const clearingMat=new T.MeshStandardMaterial({map:floor,color:'#a2b6a0',roughness:1,transparent:true,depthWrite:false});soft(clearingMat);disc(clearingMat,FOREST_ARENA.x,FOREST_ARENA.z,3.4,3.4,.018);
 const treePlacements:{x:number;z:number;r:number;design:string;trunkWidth:number}[]=[];
 const mist=new T.Group();root.add(mist);
 const mistMat=new T.MeshBasicMaterial({map:loader.load(BASE+'mist-card-v1.png'),color:'#c6bfd4',transparent:true,opacity:.16,depthWrite:false,side:T.DoubleSide});
 const mistOrigins:{x:number;z:number}[]=[];
 for(let i=0;i<11;i++){const sheet=new T.Mesh(new T.PlaneGeometry(i<3?5:9,1.1),mistMat);sheet.quaternion.copy(facing);const x=i<3?3+i*2:-17+(i-3)*4.5,z=i<3?-8+(i-1)*.7:(r()-.5)*26;sheet.position.set(x,.38,z);mist.add(sheet);mistOrigins.push({x,z});}
 loader.json<Manifest>(BASE+'manifest.json',manifest=>{
  const assets=new Map(manifest.assets.map(a=>[a.name,a])),atlases=new Map(manifest.atlases.map(a=>[a.file,loader.load(BASE+a.file)]));
  const instances=new Map<string,{x:number;z:number;sx:number;sy:number;flip:boolean}[]>(),contacts:{x:number;z:number;width:number}[]=[];
  function prop(name:string,x:number,z:number,sx=1,sy=sx,flip=false,foreground=false){const key=name+(foreground?':foreground':'');const list=instances.get(key)||[];list.push({x,z,sx,sy,flip});instances.set(key,list);props++;const a=assets.get(name)!;contacts.push({x,z,width:Math.min(a.worldSize[0]*sx*.65,3.5)});}
  const trees=['pine','oak','silver','hollow'];
  for(const[i,t]of FOREST_TREES.entries()){const design=trees[i%4],a=assets.get(design)!,sx=t.r*2/(a.trunkWidth||1),sy=Math.max(sx*(.88+r()*.18),(3.8+r()*1.2)/a.worldSize[1]);prop(design,t.x,t.z,sx,sy,i%2===1);treePlacements.push({...t,design,trunkWidth:(a.trunkWidth||1)*sx});}
  for(let i=0;i<96;i++){const side=i%4,k=Math.floor(i/4)/24;let x=0,z=0;
   if(side<2){x=-21+k*42;z=(side===0?-1:1)*(FOREST.halfZ+1.6+r());}else{x=(side===2?1:-1)*(FOREST.halfX+1.6+r());z=-17+k*34;if(side===3&&Math.abs(z)<3.8)continue;}
   const step=Math.floor(i/4),design=step%6===0?'silver':trees[(step+side)%2],a=assets.get(design)!,scale=(5.6+r()*2)/a.worldSize[1];prop(design,x,z,scale,scale,i%3===0,side===1||side===2);
  }
  prop('arch',GATES.forest.west.x,GATES.forest.west.z);
  prop('bedroll',FOREST_CAMP.x,FOREST_CAMP.z+.7,.9);prop('log-seat',FOREST_CAMP.x-1.3,FOREST_CAMP.z-.8,.65);prop('log-seat',FOREST_CAMP.x+2,FOREST_CAMP.z+.8,.65);prop('campfire',FOREST_CAMP.x+1.3,FOREST_CAMP.z-.7,.75);prop('lantern',FOREST_CAMP.x-1.7,FOREST_CAMP.z+.8,.9);
  for(let i=0;i<11;i++){const a=i/11*Math.PI*2;prop('rock',FOREST_ARENA.x+Math.cos(a)*3.9,FOREST_ARENA.z+Math.sin(a)*3.9,.48,.7,i%2===0);}
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;prop('reeds',5+Math.cos(a)*4.15,-8+Math.sin(a)*2.8,.6);}
  for(let i=0;i<220;i++){const x=(r()-.5)*38,z=(r()-.5)*30;if(!walkable(x,z,.3,'forest')||Math.hypot(x-FOREST_ARENA.x,z-FOREST_ARENA.z)<4.2||Math.hypot(x-FOREST_CAMP.x,z-FOREST_CAMP.z)<3||Math.abs(z)<1.7||(x>11&&x<15&&z>0&&z<7))continue;prop(['fern','mushrooms','fallen-log','rock','spores'][i%5],x,z,.35+r()*.4,undefined,i%2===0);scatter++;}
  for(const [x,z,scale]of [[3.8,-8.5,.65],[6.2,-7.2,.55]]){const a=assets.get('lilies')!,g=new T.PlaneGeometry(a.worldSize[0]*scale,a.worldSize[1]*scale),uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,a.uvRect[0]+uv.getX(i)*a.uvRect[2],a.uvRect[1]+uv.getY(i)*a.uvRect[3]);const o=new T.Mesh(g,new T.MeshBasicMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:.08,depthWrite:false,toneMapped:false}));o.rotation.x=-Math.PI/2;o.position.set(x,.04,z);root.add(o);batches++;props++;}
  for(const t of [FOREST_TREES[0],FOREST_TREES[5],FOREST_TREES[9]])prop('lantern',t.x+.45,t.z,.65);
  const dummy=new T.Object3D();
  for(const[name,list]of instances){const foreground=name.endsWith(':foreground'),a=assets.get(name.split(':')[0])!,g=new T.PlaneGeometry(1,1);g.translate(.5-a.anchor[0],a.anchor[1]-.5,0);const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,a.uvRect[0]+uv.getX(i)*a.uvRect[2],a.uvRect[1]+uv.getY(i)*a.uvRect[3]);
   // The camera-side edge stays dense but does not hide the playable clearing.
   const material=new T.MeshBasicMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:foreground?.01:.08,depthWrite:!foreground,opacity:foreground?.24:1,side:T.DoubleSide,toneMapped:false,color:'#d8e3db'}),batch=new T.InstancedMesh(g,material,list.length);batch.name='forest-'+name;
   g.setAttribute('forestFlip',new T.InstancedBufferAttribute(new Float32Array(list.map(p=>p.flip?1:0)),1));
   material.onBeforeCompile=shader=>{shader.uniforms.uForestFlipBounds={value:new T.Vector3(a.uvRect[0]*2,a.uvRect[2],a.anchor[0]*2-1)};shader.vertexShader='attribute float forestFlip;uniform vec3 uForestFlipBounds;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMapUv.x=mix(vMapUv.x,uForestFlipBounds.x+uForestFlipBounds.y-vMapUv.x,forestFlip);').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=forestFlip*uForestFlipBounds.z;');};material.customProgramCacheKey=()=> 'forest-prop-flip-v1';
   list.forEach((p,i)=>{dummy.position.set(p.x,.045,p.z);dummy.quaternion.copy(facing);dummy.scale.set(a.worldSize[0]*p.sx,a.worldSize[1]*p.sy,1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.computeBoundingSphere();root.add(batch);batches++;
  }
  // One instanced draw for all soft contact ellipses.
  const shadowMat=new T.MeshBasicMaterial({color:'#243b3b',transparent:true,opacity:.25,depthWrite:false});
  shadowMat.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 vContactUV;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvContactUV=uv;');shader.fragmentShader='varying vec2 vContactUV;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=1.-smoothstep(.08,.5,length(vContactUV-.5));\n#include <alphatest_fragment>');};shadowMat.customProgramCacheKey=()=> 'forest-contact';
  const shadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),shadowMat,contacts.length);contacts.forEach((p,i)=>{dummy.position.set(p.x,.031,p.z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(p.width,p.width*.62,1);dummy.updateMatrix();shadows.setMatrixAt(i,dummy.matrix);});shadows.computeBoundingSphere();root.add(shadows);batches++;ready=true;
 });
 const flame=new T.Group();flame.position.set(FOREST_CAMP.x+1.3,.12,FOREST_CAMP.z-.7);root.add(flame);const flames:T.Mesh[]=[];
 for(let i=0;i<3;i++){const f=new T.Mesh(new T.ConeGeometry(.09,.38,6),new T.MeshBasicMaterial({color:i%2?'#f8dfad':'#db9b65',transparent:true,opacity:.7,depthWrite:false}));f.position.set(Math.sin(i*2)*.08,.2,Math.cos(i*2)*.08);flame.add(f);flames.push(f);}
 const fireLight=new T.PointLight('#ffb36b',4,7,2);fireLight.position.set(flame.position.x,1,flame.position.z);root.add(fireLight);
 const gateName=label('← นครที่ถูกลืมเลือน');gateName.position.set(GATES.forest.west.x+1.5,3.2,GATES.forest.west.z);root.add(gateName);
 const campName=label('แคมป์ · พักฟื้น','#e5efd3');campName.position.set(FOREST_CAMP.x,2.1,FOREST_CAMP.z);root.add(campName);
 return{root,setQuality(hq:boolean){high=hq;mist.visible=hq;ripple.quality.value=hq?1:0;},snapshot:()=>({ready,greybox:false,trees:FOREST_TREES.length,treePlacements,props,propDrawCalls:batches,scatter,atlasCount:1,mistCards:high?mist.children.length:0,ripple:high,quality:high?'HQ':'LOW'}),update(time:number){paintPaths();ripple.time.value=time;flames.forEach((f,i)=>{f.scale.y=.85+Math.sin(time*11+i)*.13;f.rotation.y=time*.6;});fireLight.intensity=3.5+Math.sin(time*9)*.5;mist.children.forEach((o,i)=>{o.position.x=mistOrigins[i].x+Math.sin(time*.1+i)*.55;o.position.z=mistOrigins[i].z+Math.cos(time*.07+i)*.18;});}};
}
