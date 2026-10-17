import {chunkInstances,artQuality,artStats,groundPatches,meadowHorizon} from './world-art.ts';
import * as T from 'three';import type{PaintedLoader}from'./assets';
import{ARENA,OBSTACLES,water}from'./sim';
import{LAYOUTS,GATES,type Ellipse}from'@thainative/shared/maps';
const L=LAYOUTS.meadow,W=L.halfX*2,D=L.halfZ*2;
export function random(seed=7){let n=seed;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function label(text:string,color='#fff2d4'){const c=document.createElement('canvas');const measure=c.getContext('2d')!;measure.font='500 22px "Noto Sans Thai",sans-serif';c.width=Math.max(64,Math.ceil(measure.measureText(text).width)+24);c.height=64;const x=c.getContext('2d')!;x.font='500 22px "Noto Sans Thai",sans-serif';x.fillStyle='#132923e6';x.beginPath();x.roundRect(2,8,c.width-4,44,8);x.fill();x.textAlign='center';x.lineWidth=5;x.strokeStyle='#344b39';x.strokeText(text,c.width/2,37);x.fillStyle=color;x.fillText(text,c.width/2,37);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));s.scale.set(c.width/384*2.8,.47,1);return s;}
/** Path segments with their half-width, from the shared layout. */
const pathSegments=L.paths.flatMap(p=>p.points.slice(1).map((b,i)=>({a:p.points[i] as number[],b:b as number[],half:p.width/2})));
function segmentDistance(x:number,z:number,a:number[],b:number[]){const dx=b[0]-a[0],dz=b[1]-a[1],t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
function onPath(x:number,z:number){return pathSegments.some(s=>segmentDistance(x,z,s.a,s.b)<s.half);}
interface PaintedAsset {name:string;atlas:string;pixelSize:[number,number];worldSize:[number,number];anchor:[number,number];uvRect:[number,number,number,number];flat:boolean}
interface EnvironmentManifest {assets:PaintedAsset[];atlases:{file:string;size:[number,number]}[]}
const ENV='/assets/env-painted/';
const cameraRotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(new T.Vector3(9,16,13),new T.Vector3(),new T.Vector3(0,1,0)));

/** Painted billboards share atlas textures; small foliage is instanced by asset. */
export function buildScene(scene:T.Scene,loader:PaintedLoader){
 const r=random(17),root=new T.Group();scene.add(root);
 const ripple={time:{value:0},quality:{value:1}};
 const shadowProxies:T.Mesh[]=[];let highQuality=true,ready=false,propCount=0,coverCount=0,atlasCount=0;
 const texture=(file:string,repeat=1)=>{const t=loader.load(file);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;return t;};
 const grass=texture('/assets/meadow-grass.png',42);
 const ground=new T.Mesh(new T.PlaneGeometry(W+160,D+160),new T.MeshStandardMaterial({map:grass,color:'#e0ddc8',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;root.add(ground);
 meadowHorizon(root,grass,L.halfX,L.halfZ);
 groundPatches(root,Array.from({length:130},(_,i)=>({x:(r()-.5)*W,z:(r()-.5)*D,size:4+r()*8,colour:['#a8ac80','#b9b291','#79966c','#9a9877'][i%4]})));
 const dirt=texture(ENV+'tile-dirt-v1.png');dirt.repeat.set(W/3.4,D/3.4);
 const pathCanvas=document.createElement('canvas');pathCanvas.width=2048;pathCanvas.height=Math.round(2048*D/W);const PX=2048/W;
 const ctx=pathCanvas.getContext('2d')!;ctx.fillStyle='#000';ctx.fillRect(0,0,pathCanvas.width,pathCanvas.height);
 const coord=(x:number,z:number)=>[(x+L.halfX)*PX,(z+L.halfZ)*PX];
 const mask=new T.CanvasTexture(pathCanvas);
 const pathMaterial=new T.MeshStandardMaterial({map:dirt,alphaMap:mask,transparent:true,roughness:1,depthWrite:false,color:'#e5dac0'});
 const path=new T.Mesh(new T.PlaneGeometry(W,D),pathMaterial);path.rotation.x=-Math.PI/2;path.position.y=.005;path.receiveShadow=true;root.add(path);
 // Stamp the generated alpha brush along every path, then join the worn core.
 const brush=texture(ENV+'tile-transition-v1.png');
 function paintPaths(){
  ctx.fillStyle='#000';ctx.fillRect(0,0,pathCanvas.width,pathCanvas.height);ctx.globalCompositeOperation='screen';
  const stamp=document.createElement('canvas');stamp.width=stamp.height=256;const sc=stamp.getContext('2d')!;
  sc.drawImage(brush.image as HTMLImageElement,0,0,256,256);sc.globalCompositeOperation='source-in';sc.fillStyle='#fff';sc.fillRect(0,0,256,256);
  for(const{a,b,half}of pathSegments){const length=Math.hypot(b[0]-a[0],b[1]-a[1]),size=half*2*1.42*PX;for(let t=0;t<=length;t+=.28){const k=t/length,[x,y]=coord(T.MathUtils.lerp(a[0],b[0],k),T.MathUtils.lerp(a[1],b[1],k));ctx.drawImage(stamp,x-size/2,y-size/2,size,size);}}
  ctx.globalCompositeOperation='source-over';ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff';
  pathSegments.forEach(({a,b,half})=>{const p=coord(a[0],a[1]),q=coord(b[0],b[1]);ctx.lineWidth=half*2*.7*PX;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();});mask.needsUpdate=true;
 }
 // Texture loading is async; the loading manager accounts for it.
 const originalBrushUpdate=brush.onUpdate;let pathsPainted=false;
 brush.onUpdate=(t)=>{originalBrushUpdate?.(t);if(!pathsPainted&&brush.userData.ready){pathsPainted=true;paintPaths();}};
 const waterTexture=texture(ENV+'tile-water-v2.png',3);
 const waterMaterial=new T.MeshStandardMaterial({map:waterTexture,color:'#ffffff',roughness:1,metalness:0,transparent:true,depthWrite:false});
 const stillWaterMaterial=waterMaterial.clone();
 // UVs remain independent of texture repeat, so both quality modes retain the feathered shore.
 function pondShader(material:T.MeshStandardMaterial,animated:boolean){material.onBeforeCompile=shader=>{
  shader.uniforms.uPondTime=ripple.time;shader.uniforms.uPondQuality=ripple.quality;
  shader.vertexShader='varying vec2 vPondUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvPondUv=uv;');
  shader.fragmentShader='varying vec2 vPondUv;uniform float uPondTime;uniform float uPondQuality;\n'+shader.fragmentShader;
  if(animated)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replaceAll('vMapUv','(vMapUv + vec2(sin(vMapUv.y*70.0+uPondTime*.6),cos(vMapUv.x*65.0-uPondTime*.5))*.0015*uPondQuality)'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','float pondR=length(vPondUv-.5)*2.;float edgeWobble=sin(vPondUv.x*67.)*sin(vPondUv.y*59.)*.018;diffuseColor.a*=1.-smoothstep(.86,1.,pondR+edgeWobble);\n#include <alphatest_fragment>');
 };material.customProgramCacheKey=()=>animated?'painted-pond-ripple-v2':'painted-pond-still-v2';}
 pondShader(waterMaterial,true);pondShader(stillWaterMaterial,false);
 const shoreMaterial=new T.MeshStandardMaterial({map:dirt,color:'#b9ac8f',roughness:1,metalness:0,transparent:true,depthWrite:false});
 shoreMaterial.onBeforeCompile=shader=>{shader.vertexShader='varying vec2 vShoreUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvShoreUv=uv;');shader.fragmentShader='varying vec2 vShoreUv;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','float shoreR=length(vShoreUv-.5)*2.;float shoreWobble=sin(vShoreUv.x*51.)*sin(vShoreUv.y*43.)*.025;diffuseColor.a*=1.-smoothstep(.83,1.,shoreR+shoreWobble);\n#include <alphatest_fragment>');};
 const ponds:T.Mesh[]=[];const pondGeometry=new T.CircleGeometry(1,64),shoreGeometry=new T.CircleGeometry(1,96);
 for(const w of L.water){
  // Shore ring is ~0.45 m wider than the blocked ellipse, like the original pond.
  const shore=new T.Mesh(shoreGeometry,shoreMaterial);shore.rotation.x=-Math.PI/2;shore.position.set(w.x,.012,w.z);shore.scale.set(w.rx*1.14,w.rz*1.1,1);shore.receiveShadow=true;root.add(shore);
  const pond=new T.Mesh(pondGeometry,waterMaterial);pond.rotation.x=-Math.PI/2;pond.position.set(w.x,.024,w.z);pond.scale.set(w.rx,w.rz,1);pond.receiveShadow=true;root.add(pond);ponds.push(pond);
 }
 const pond=ponds[0];
 const stoneTexture=texture(ENV+'tile-stone-v1.png',2);
 const arena=new T.Mesh(new T.CircleGeometry(L.arena!.r-.25,64),new T.MeshStandardMaterial({map:stoneTexture,color:'#cfceb8',roughness:1}));arena.rotation.x=-Math.PI/2;arena.position.set(ARENA.x,.013,ARENA.z);arena.receiveShadow=true;root.add(arena);
 // All contact ellipses share one instanced draw and a soft analytic gradient.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const sx=shadowCanvas.getContext('2d')!,gradient=sx.createRadialGradient(32,32,3,32,32,31);gradient.addColorStop(0,'#35443565');gradient.addColorStop(1,'#35443500');sx.fillStyle=gradient;sx.fillRect(0,0,64,64);
 const shadowMap=new T.CanvasTexture(shadowCanvas),contactMatrices:T.Matrix4[]=[];
 const dummy=new T.Object3D();
 function contact(x:number,z:number,width:number){dummy.position.set(x,.038,z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(width,width*.62,1);dummy.updateMatrix();contactMatrices.push(dummy.matrix.clone());}
 loader.json<EnvironmentManifest>(ENV+'manifest.json',data=>{
  const manifest=data as unknown as EnvironmentManifest;atlasCount=manifest.atlases.length;
  const assets=new Map(manifest.assets.map(a=>[a.name,a]));
  const atlases=new Map(manifest.atlases.map(a=>{const map=texture(ENV+a.file);map.wrapS=map.wrapT=T.ClampToEdgeWrapping;map.repeat.set(1,1);return[a.file,map] as const;}));
  const propBatches=new Map<string,{a:PaintedAsset;matrices:T.Matrix4[];cast:boolean}>();
  const geometries=new Map<string,T.PlaneGeometry>(),meshMaterials=new Map<string,T.MeshBasicMaterial>();
  function asset(name:string){const a=assets.get(name);if(!a)throw new Error('Missing painted asset '+name);return a;}
  function geometry(a:PaintedAsset,anchored=true){const key=a.name+anchored;if(geometries.has(key))return geometries.get(key)!;const g=new T.PlaneGeometry(1,1);if(anchored)g.translate(.5-a.anchor[0],a.anchor[1]-.5,0);const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,a.uvRect[0]+uv.getX(i)*a.uvRect[2],a.uvRect[1]+uv.getY(i)*a.uvRect[3]);geometries.set(key,g);return g;}
  function meshMaterial(a:PaintedAsset){if(!meshMaterials.has(a.name))meshMaterials.set(a.name,new T.MeshBasicMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:.1,depthWrite:true,toneMapped:false,color:'#f2eadc',side:T.DoubleSide}));return meshMaterials.get(a.name)!;}
  function prop(name:string,x:number,z:number,scale=1,cast=false){
   const a=asset(name);
   const key=name+cast;let batch=propBatches.get(key);if(!batch){batch={a,matrices:[],cast};propBatches.set(key,batch);}
   dummy.position.set(x,.045,z);dummy.quaternion.copy(cameraRotation);dummy.scale.set(a.worldSize[0]*scale,a.worldSize[1]*scale,1);dummy.updateMatrix();batch.matrices.push(dummy.matrix.clone());propCount++;
   contact(x,z,Math.min(a.worldSize[0]*scale*.75,4));
  }

  function decal(name:string,x:number,z:number,width?:number,height?:number){const a=asset(name),o=new T.Mesh(geometry(a,false),new T.MeshStandardMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:.08,roughness:1,depthWrite:true,side:T.DoubleSide,color:'#ded7bf'}));o.rotation.x=-Math.PI/2;o.position.set(x,name==='bridge'?.09:.03,z);o.scale.set(width||a.worldSize[0],height||a.worldSize[1],1);o.receiveShadow=true;root.add(o);propCount++;}
  let treeIndex=0;const trees=['tree-round','tree-tall','tree-leaning','tree-flowering'];
  function tree(x:number,z:number,scale=1){prop(trees[treeIndex++%4],x,z,scale,true);}
  // Collision circles from the shared layout: trees ~1 m trunk radius, boulders ~.75 m.
  for(const o of OBSTACLES){if(o.kind==='boulder')prop(['boulder-round','boulder-tall'][Math.floor(r()*2)],o.x,o.z,o.r/.75*.9,true);else tree(o.x,o.z,.86+r()*.25);}
  // Treeline just outside the walkable edge, leaving the north gate open.
  const gate=GATES.meadow.north;
  for(let x=-L.halfX;x<=L.halfX;x+=3.3+r()*2.4){if(Math.abs(x-gate.x)>4)tree(x,-L.halfZ-1-r()*2,.85+r()*.2);tree(x,L.halfZ+1+r()*2,.9+r()*.1);}
  for(let z=-L.halfZ+3;z<=L.halfZ-2;z+=3.5+r()*2.8){tree(-L.halfX-1-r(),z,.85+r()*.2);tree(L.halfX+1+r(),z,.85+r()*.2);}
  // A second, staggered forest edge dissolves into the painted horizon.
  for(let i=0;i<92;i++){const side=i%4,t=r(),x=side<2?(t-.5)*(W+35):(side===2?-1:1)*(L.halfX+9+r()*7),z=side<2?(side===0?-1:1)*(L.halfZ+8+r()*8):(t-.5)*(D+30);if(z<-L.halfZ&&Math.abs(x)<5)continue;tree(x,z,.95+r()*.25);}
  // Landmarks on open ground. Requested footprints are recorded for layout-owner review.
  prop('tree-round',40,18,1.26,true);
  for(const [dx,dz]of [[-1,-1],[1,-1],[-1,1],[1,1]])prop('pillar-square',-38+dx,32+dz,2.4,true);
  prop('arch',-38,32,1.2,true);
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;prop('pillar-fluted',-24+Math.cos(a)*2.8,-14+Math.sin(a)*2.8,.85,true);}
  const cover=new Map<string,{x:number;z:number;scale:number}[]>();
  function coverAt(name:string,x:number,z:number,scale=1){const list=cover.get(name)||[];list.push({x,z,scale});cover.set(name,list);}
  // Density matches the original meadow (≈1.7 grass tufts and 0.05 bushes per m²).
  const area=(W+3)*(D+2),onCamp=(x:number,z:number)=>L.camps.some(c=>Math.hypot(x-c.x,z-c.z)<3.2);
  for(let i=0;i<area*1.45;i++){const x=(r()-.5)*(W+3),z=(r()-.5)*(D+2);if(onPath(x,z)||water(x,z)||onCamp(x,z)||Math.hypot(x-ARENA.x,z-ARENA.z)<L.arena!.r)continue;coverAt('grass-'+(1+i%3),x,z,.6+r()*.55);}
  for(let c=0;c<Math.round(area/160);c++){const entry=c%3===0,cx=(r()-.5)*(entry?30:W-6),cz=entry?-L.halfZ+5+r()*14:(r()-.5)*(D-6);for(let i=0;i<18;i++){const x=cx+(r()-.5)*3,z=cz+(r()-.5)*2;if(!onPath(x,z)&&!water(x,z))coverAt(['flowers-white','flowers-yellow','flowers-lavender','flowers-pink'][i%4],x,z,.75+r()*.5);}}
  for(let i=0;i<area*.047;i++){const x=(r()-.5)*W,z=(r()-.5)*D;if(!onPath(x,z)&&!water(x,z)&&!onCamp(x,z)&&Math.hypot(x-ARENA.x,z-ARENA.z)>L.arena!.r+.1)coverAt(['bush-round','bush-flowering','fern-wide','fern-upright'][i%4],x,z,.65+r()*.4);}
  for(const[name,instances]of cover){const a=asset(name),batch=new T.InstancedMesh(geometry(a),meshMaterial(a),instances.length);instances.forEach((v,i)=>{dummy.position.set(v.x,.04,v.z);dummy.quaternion.copy(cameraRotation);dummy.scale.set(a.worldSize[0]*v.scale,a.worldSize[1]*v.scale,1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.name='meadow-'+name;batch.userData.groundCover=true;batch.computeBoundingSphere();root.add(batch);coverCount+=instances.length;}
  for(const {a,b,half}of pathSegments){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;for(let d=1;d<len;d+=2.2){const side=Math.floor(d)%2?1:-1,x=a[0]+(b[0]-a[0])*d/len+nx*(half+.5)*side,z=a[1]+(b[1]-a[1])*d/len+nz*(half+.5)*side;if(!water(x,z)){prop('flowers-white',x,z,.8);if(d%3<1)prop('boulder-flat',x+.2,z,.18);}}}
  // Every camp: the original camp kit, offset from its rest point (fire 1.3 m east of it).
  for(const [campIndex,c] of L.camps.entries()){prop('tent',c.x-1,c.z+1.2,1,true);prop('bench',c.x+1.3,c.z+1.1);prop('campfire',c.x+1.3,c.z-.7);prop('fallen-log',c.x-2.8,c.z-.5,.65);prop('stump',c.x-2.4,c.z+2.4,.8);if(campIndex===1){prop('fallen-log',c.x+2.7,c.z+2,.7);prop('reeds-2',c.x-3,c.z+2.7);}if(campIndex===2){prop('pillar-square',c.x-3,c.z+2,.6,true);prop('boulder-flat',c.x+3,c.z+2);}
   for(let i=0;i<3;i++)prop('fence-span',c.x-3.5+i*2.3,c.z+3.5,.9);prop('fence-post',c.x-5,c.z+3.5);}
  // Signposts where paths meet.
  for(const p of L.paths.slice(2))prop('signpost',p.points[0][0]+1.8,p.points[0][1]+1.4,1);
  prop('arch',gate.x,gate.z-.2,1,true);prop('pillar-square',ARENA.x-3.3,ARENA.z+1.7,.85,true);prop('pillar-fluted',ARENA.x+3,ARENA.z+1.2,.8,true);decal('stone-circle',ARENA.x,ARENA.z,L.arena!.r*2,L.arena!.r*2);
  for(const w of L.water){
   if(w.bridgeZ!==undefined){const span=w.rx*1.1,a=asset('bridge');for(const side of [-1,1])decal('bridge',w.x+side*span/2,w.bridgeZ,span,span*a.worldSize[1]/a.worldSize[0]);}
   const n=Math.round((w.rx+w.rz)*2);
   for(let i=0;i<n;i++){const angle=i/n*Math.PI*2,x=w.x+Math.cos(angle)*(w.rx+.2),z=w.z+Math.sin(angle)*(w.rz+.25);if(w.bridgeZ!==undefined&&Math.abs(z-w.bridgeZ)<(w.bridgeHalf??1)+.15)continue;if(onPath(x,z))continue;prop(['reeds-1','reeds-2','reeds-3'][i%3],x,z,.9+r()*.15);if(i%3===0)prop('rock-cluster',x+.25,z,.55);}
  }
  const contacts=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.65}),contactMatrices.length);contactMatrices.forEach((m,i)=>contacts.setMatrixAt(i,m));contacts.computeBoundingSphere();root.add(contacts);
  for(const {a,matrices,cast}of propBatches.values()){const batch=new T.InstancedMesh(geometry(a).clone(),meshMaterial(a),matrices.length);batch.name='meadow-prop-'+a.name;batch.userData.groundCover=/^(grass|flowers|fern|bush)/.test(a.name);matrices.forEach((m,i)=>batch.setMatrixAt(i,m));batch.castShadow=cast&&highQuality;batch.userData.shadowCaster=cast;batch.customDepthMaterial=new T.MeshDepthMaterial({map:atlases.get(a.atlas),alphaTest:.2,depthPacking:T.RGBADepthPacking,side:T.DoubleSide});root.add(batch);}
  chunkInstances(root);artQuality(root,highQuality);ready=true;
 });
 const flames:T.Mesh[]=[];
 for(const c of L.camps){const flame=new T.Group();flame.position.set(c.x+1.3,.12,c.z-.7);root.add(flame);
 for(let i=0;i<3;i++){const f=new T.Mesh(new T.ConeGeometry(.09,.38,6),new T.MeshBasicMaterial({color:i%2?'#f8dfad':'#db9b65',transparent:true,opacity:.7,depthWrite:false}));f.position.set(Math.sin(i*2)*.08,.2,Math.cos(i*2)*.08);flame.add(f);flames.push(f);}}
 for(const c of L.camps){const light=new T.PointLight('#ffc58a',3,7,2);light.position.set(c.x+1.3,1,c.z-.7);root.add(light);}
 const gateName=label('นครที่ถูกลืมเลือน ↑');gateName.position.set(GATES.meadow.north.x,4,GATES.meadow.north.z-.2);root.add(gateName);
 for(const c of L.camps){const campName=label('แคมป์ · พักฟื้น','#e5efd3');campName.position.set(c.x,2.1,c.z);root.add(campName);}
 return{root,setQuality(hq:boolean){highQuality=hq;artQuality(root,hq);ripple.quality.value=hq?1:0;ponds.forEach(p=>p.material=hq?waterMaterial:stillWaterMaterial);shadowProxies.forEach(o=>{o.castShadow=hq;o.visible=hq;});},snapshot:()=>({...artStats(root),ready,propCount,coverCount,atlasCount,shadowCasters:highQuality?propCount:0,quality:highQuality?'HQ':'LOW',ripple:pond.material===waterMaterial&&!!ripple.quality.value}),update(time:number){ripple.time.value=time;arena.visible=!!stoneTexture.userData.ready;if(!pathsPainted&&brush.userData.ready){pathsPainted=true;paintPaths();}flames.forEach((f,i)=>{f.scale.y=.85+Math.sin(time*11+i)*.13;f.rotation.y=time*.6;});}};
}
