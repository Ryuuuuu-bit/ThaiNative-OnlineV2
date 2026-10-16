import * as T from 'three';import type{PaintedLoader}from'./assets';
import{CAMP,ARENA,OBSTACLES,water}from'./sim';
export function random(seed=7){let n=seed;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function label(text:string,color='#fff2d4'){const c=document.createElement('canvas');const measure=c.getContext('2d')!;measure.font='500 22px "Noto Sans Thai",sans-serif';c.width=Math.max(64,Math.ceil(measure.measureText(text).width)+24);c.height=64;const x=c.getContext('2d')!;x.font='500 22px "Noto Sans Thai",sans-serif';x.fillStyle='#132923e6';x.beginPath();x.roundRect(2,8,c.width-4,44,8);x.fill();x.textAlign='center';x.lineWidth=5;x.strokeStyle='#344b39';x.strokeText(text,c.width/2,37);x.fillStyle=color;x.fillText(text,c.width/2,37);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map,transparent:true,depthWrite:false}));s.scale.set(c.width/384*2.8,.47,1);return s;}
const pathSegments=[[[0,-14],[0,-7]],[[0,2],[1,10]],[[-1,14],[-1,6]],[[-1,6],[0,2]],[[0,2],[-1,-2]],[[-1,-2],[1,-9]],[[-17,2],[-8,2]],[[-8,2],[0,2]],[[0,2],[5,0]],[[5,0],[17,0]],[[-1,6],[-7,8]]];
function segmentDistance(x:number,z:number,a:number[],b:number[]){const dx=b[0]-a[0],dz=b[1]-a[1],t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
function onPath(x:number,z:number){return pathSegments.some(([a,b],i)=>segmentDistance(x,z,a,b)<(i<4?1.15:.8));}
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
 const grass=texture('/assets/meadow-grass.png',16);
 const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({map:grass,color:'#e0ddc8',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;ground.receiveShadow=true;root.add(ground);
 const dirt=texture(ENV+'tile-dirt-v1.png',10);
 const pathCanvas=document.createElement('canvas');pathCanvas.width=pathCanvas.height=1024;
 const ctx=pathCanvas.getContext('2d')!;ctx.fillStyle='#000';ctx.fillRect(0,0,1024,1024);
 const coord=(x:number,z:number)=>[(x+17)/34*1024,(z+14)/28*1024];
 const mask=new T.CanvasTexture(pathCanvas);
 const pathMaterial=new T.MeshStandardMaterial({map:dirt,alphaMap:mask,transparent:true,roughness:1,depthWrite:false,color:'#e5dac0'});
 const path=new T.Mesh(new T.PlaneGeometry(34,28),pathMaterial);path.rotation.x=-Math.PI/2;path.position.y=.005;path.receiveShadow=true;root.add(path);
 // Stamp the generated alpha brush along every path, then join the worn core.
 const brush=texture(ENV+'tile-transition-v1.png');
 function paintPaths(){
  ctx.fillStyle='#000';ctx.fillRect(0,0,1024,1024);ctx.globalCompositeOperation='screen';
  const stamp=document.createElement('canvas');stamp.width=stamp.height=256;const sc=stamp.getContext('2d')!;
  sc.drawImage(brush.image as HTMLImageElement,0,0,256,256);sc.globalCompositeOperation='source-in';sc.fillStyle='#fff';sc.fillRect(0,0,256,256);
  for(const[a,b]of pathSegments){const length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let t=0;t<=length;t+=.28){const k=t/length,[x,y]=coord(T.MathUtils.lerp(a[0],b[0],k),T.MathUtils.lerp(a[1],b[1],k));ctx.drawImage(stamp,x-49,y-49,98,98);}}
  ctx.globalCompositeOperation='source-over';ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff';
  pathSegments.forEach(([a,b],i)=>{const p=coord(a[0],a[1]),q=coord(b[0],b[1]);ctx.lineWidth=i<4?48:33;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();});mask.needsUpdate=true;
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
 const shore=new T.Mesh(new T.CircleGeometry(1,96),shoreMaterial);shore.rotation.x=-Math.PI/2;shore.position.set(11,.012,-1);shore.scale.set(3.55,4.65,1);shore.receiveShadow=true;root.add(shore);
 const pond=new T.Mesh(new T.CircleGeometry(1,64),waterMaterial);pond.rotation.x=-Math.PI/2;pond.position.set(11,.024,-1);pond.scale.set(3.1,4.2,1);pond.receiveShadow=true;root.add(pond);
 const stoneTexture=texture(ENV+'tile-stone-v1.png',2);
 const arena=new T.Mesh(new T.CircleGeometry(3.15,64),new T.MeshStandardMaterial({map:stoneTexture,color:'#cfceb8',roughness:1}));arena.rotation.x=-Math.PI/2;arena.position.set(ARENA.x,.013,ARENA.z);arena.receiveShadow=true;root.add(arena);
 // All contact ellipses share one instanced draw and a soft analytic gradient.
 const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;const sx=shadowCanvas.getContext('2d')!,gradient=sx.createRadialGradient(32,32,3,32,32,31);gradient.addColorStop(0,'#35443565');gradient.addColorStop(1,'#35443500');sx.fillStyle=gradient;sx.fillRect(0,0,64,64);
 const shadowMap=new T.CanvasTexture(shadowCanvas),contactMatrices:T.Matrix4[]=[];
 const dummy=new T.Object3D();
 function contact(x:number,z:number,width:number){dummy.position.set(x,.038,z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(width,width*.62,1);dummy.updateMatrix();contactMatrices.push(dummy.matrix.clone());}
 loader.json<EnvironmentManifest>(ENV+'manifest.json',data=>{
  const manifest=data as unknown as EnvironmentManifest;atlasCount=manifest.atlases.length;
  const assets=new Map(manifest.assets.map(a=>[a.name,a]));
  const atlases=new Map(manifest.atlases.map(a=>{const map=texture(ENV+a.file);map.wrapS=map.wrapT=T.ClampToEdgeWrapping;map.repeat.set(1,1);return[a.file,map] as const;}));
  const spriteMaterials=new Map<string,T.SpriteMaterial>(),geometries=new Map<string,T.PlaneGeometry>(),meshMaterials=new Map<string,T.MeshBasicMaterial>();
  function asset(name:string){const a=assets.get(name);if(!a)throw new Error('Missing painted asset '+name);return a;}
  function geometry(a:PaintedAsset,anchored=true){const key=a.name+anchored;if(geometries.has(key))return geometries.get(key)!;const g=new T.PlaneGeometry(1,1);if(anchored)g.translate(.5-a.anchor[0],a.anchor[1]-.5,0);const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,a.uvRect[0]+uv.getX(i)*a.uvRect[2],a.uvRect[1]+uv.getY(i)*a.uvRect[3]);geometries.set(key,g);return g;}
  function meshMaterial(a:PaintedAsset){if(!meshMaterials.has(a.name))meshMaterials.set(a.name,new T.MeshBasicMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:.1,depthWrite:true,toneMapped:false,color:'#f2eadc',side:T.DoubleSide}));return meshMaterials.get(a.name)!;}
  function prop(name:string,x:number,z:number,scale=1,cast=false){
   const a=asset(name);if(!spriteMaterials.has(name)){
    const material=new T.SpriteMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:.1,depthWrite:true,toneMapped:false,color:'#f2eadc'});
    material.onBeforeCompile=shader=>{shader.uniforms.uAtlasRect={value:new T.Vector4(...a.uvRect)};shader.fragmentShader='uniform vec4 uAtlasRect;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replaceAll('vMapUv','(vMapUv*uAtlasRect.zw+uAtlasRect.xy)'));};
    material.customProgramCacheKey=()=> 'painted-environment-atlas';spriteMaterials.set(name,material);
   }
   const sprite=new T.Sprite(spriteMaterials.get(name));sprite.center.set(a.anchor[0],1-a.anchor[1]);sprite.position.set(x,.045,z);sprite.scale.set(a.worldSize[0]*scale,a.worldSize[1]*scale,1);root.add(sprite);propCount++;
   contact(x,z,Math.min(a.worldSize[0]*scale*.75,3));
   if(cast){const proxy=new T.Mesh(geometry(a),new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));proxy.quaternion.copy(cameraRotation);proxy.position.copy(sprite.position);proxy.scale.copy(sprite.scale);proxy.castShadow=highQuality;proxy.visible=highQuality;proxy.customDepthMaterial=new T.MeshDepthMaterial({map:atlases.get(a.atlas),alphaTest:.2,depthPacking:T.RGBADepthPacking,side:T.DoubleSide});root.add(proxy);shadowProxies.push(proxy);}
   return sprite;
  }
  function decal(name:string,x:number,z:number,width?:number,height?:number){const a=asset(name),o=new T.Mesh(geometry(a,false),new T.MeshStandardMaterial({map:atlases.get(a.atlas),transparent:true,alphaTest:.08,roughness:1,depthWrite:true,side:T.DoubleSide,color:'#ded7bf'}));o.rotation.x=-Math.PI/2;o.position.set(x,name==='bridge'?.09:.03,z);o.scale.set(width||a.worldSize[0],height||a.worldSize[1],1);o.receiveShadow=true;root.add(o);propCount++;}
  let treeIndex=0;const trees=['tree-round','tree-tall','tree-leaning','tree-flowering'];
  function tree(x:number,z:number,scale=1){prop(trees[treeIndex++%4],x,z,scale,true);}
  for(const o of OBSTACLES.slice(0,6))tree(o.x,o.z,.85+r()*.15);
  for(const[i,o]of OBSTACLES.slice(6).entries())prop(['boulder-round','boulder-tall'][i],o.x,o.z,.9,true);
  for(let x=-19;x<=19;x+=4){tree(x,-16-r()*2,.85+r()*.2);if(x<-8||x>9)tree(x,16+r()*2,.9+r()*.1);}
  for(let z=-11;z<=12;z+=5){tree(-20-r(),z,.85+r()*.2);tree(20+r(),z,.85+r()*.2);}
  const cover=new Map<string,{x:number;z:number;scale:number}[]>();
  function coverAt(name:string,x:number,z:number,scale=1){const list=cover.get(name)||[];list.push({x,z,scale});cover.set(name,list);}
  for(let i=0;i<1600;i++){const x=(r()-.5)*37,z=(r()-.5)*30;if(onPath(x,z)||water(x,z)||Math.hypot(x-ARENA.x,z-ARENA.z)<3.4)continue;coverAt('grass-'+(1+i%3),x,z,.6+r()*.55);}
  for(const[cx,cz]of[[-7,3],[5,6],[-7,-4],[7,-6],[-4,10],[9,10]])for(let i=0;i<18;i++){const x=cx+(r()-.5)*3,z=cz+(r()-.5)*2;if(!onPath(x,z))coverAt(['flowers-white','flowers-yellow','flowers-lavender','flowers-pink'][i%4],x,z,.75+r()*.5);}
  for(let i=0;i<45;i++){const x=(r()-.5)*34,z=(r()-.5)*27;if(!onPath(x,z)&&!water(x,z)&&Math.hypot(x-ARENA.x,z-ARENA.z)>3.5)coverAt(['bush-round','bush-flowering','fern-wide','fern-upright'][i%4],x,z,.65+r()*.4);}
  for(const[name,instances]of cover){const a=asset(name),batch=new T.InstancedMesh(geometry(a),meshMaterial(a),instances.length);instances.forEach((v,i)=>{dummy.position.set(v.x,.04,v.z);dummy.quaternion.copy(cameraRotation);dummy.scale.set(a.worldSize[0]*v.scale,a.worldSize[1]*v.scale,1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);});batch.computeBoundingSphere();root.add(batch);coverCount+=instances.length;}
  prop('tent',-8,9.2,1,true);prop('bench',-5.7,9.1);prop('campfire',-5.7,7.3);prop('fallen-log',-9.8,7.5,.65);prop('stump',-9.4,10.4,.8);
  prop('signpost',-2.8,6,.8);prop('signpost',6,1.6,.8);
  for(let i=0;i<3;i++)prop('fence-span',-10.5+i*2.3,11.5,.9);prop('fence-post',-12,11.5);
  prop('arch',0,-13,1,true);prop('pillar-square',-2.3,11.7,.85,true);prop('pillar-fluted',4,11.2,.8,true);decal('stone-circle',ARENA.x,ARENA.z,6.3,6.3);
  decal('bridge',11,0,6.8,1.75);
  for(let i=0;i<15;i++){const angle=i/15*Math.PI*2,x=11+Math.cos(angle)*3.3,z=-1+Math.sin(angle)*4.45;if(Math.abs(z)<1.15)continue;prop(['reeds-1','reeds-2','reeds-3'][i%3],x,z,.7+r()*.25);if(i%3===0)prop('rock-cluster',x+.25,z,.55);}
  prop('reeds-2',8.3,-3.5,.65);prop('reeds-3',12.8,2.7,.6);prop('reeds-1',10.2,-5.2,.7);
  const contacts=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false,opacity:.65}),contactMatrices.length);contactMatrices.forEach((m,i)=>contacts.setMatrixAt(i,m));contacts.computeBoundingSphere();root.add(contacts);
  ready=true;
 });
 const flame=new T.Group();flame.position.set(-5.7,.12,7.3);root.add(flame);const flames:T.Mesh[]=[];
 for(let i=0;i<3;i++){const f=new T.Mesh(new T.ConeGeometry(.09,.38,6),new T.MeshBasicMaterial({color:i%2?'#f8dfad':'#db9b65',transparent:true,opacity:.7,depthWrite:false}));f.position.set(Math.sin(i*2)*.08,.2,Math.cos(i*2)*.08);flame.add(f);flames.push(f);}
 const gateName=label('นครที่ถูกลืมเลือน ↑');gateName.position.set(0,4,-13);root.add(gateName);
 const campName=label('แคมป์ · พักฟื้น','#e5efd3');campName.position.set(CAMP.x,2.1,CAMP.z);root.add(campName);
 return{root,setQuality(hq:boolean){highQuality=hq;ripple.quality.value=hq?1:0;pond.material=hq?waterMaterial:stillWaterMaterial;shadowProxies.forEach(o=>{o.castShadow=hq;o.visible=hq;});},snapshot:()=>({ready,propCount,coverCount,atlasCount,shadowCasters:shadowProxies.filter(o=>o.castShadow).length,quality:highQuality?'HQ':'LOW',ripple:pond.material===waterMaterial&&!!ripple.quality.value}),update(time:number){ripple.time.value=time;arena.visible=!!stoneTexture.userData.ready;if(!pathsPainted&&brush.userData.ready){pathsPainted=true;paintPaths();}flames.forEach((f,i)=>{f.scale.y=.85+Math.sin(time*11+i)*.13;f.rotation.y=time*.6;});}};
}
