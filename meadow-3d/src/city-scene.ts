import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_BUILDINGS, HEALER } from '@thainative/shared/maps';
import type { PaintedLoader } from './assets';

/** Visual-only dressing. Shared map footprints, navigation and interaction anchors are authoritative. */
export function buildCity(scene:T.Scene,loader:PaintedLoader){
 const root=new T.Group();root.name='city_plaza';scene.add(root);
 const atlas=loader.load('/assets/city/city-trim-v1.png');
 const paint=new T.MeshStandardMaterial({map:atlas,roughness:1});
 const glow=new T.MeshBasicMaterial({map:atlas,color:'#ffcf87'});
 const water=new T.MeshStandardMaterial({color:'#739da3',roughness:.3,metalness:.15,transparent:true,opacity:.87});
 const batches=new Map<T.Material,T.BufferGeometry[]>();
 const matrix=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3();
 function uv(g:T.BufferGeometry,cell:number){const a=g.getAttribute('uv');for(let i=0;i<a.count;i++)a.setXY(i,(cell%4+.015+a.getX(i)*.97)/4,(2-Math.floor(cell/4)+.015+a.getY(i)*.97)/3);return g;}
 function add(g:T.BufferGeometry,x:number,y:number,z:number,sx:number,sy:number,sz:number,cell:number,material:T.Material=paint,ry=0,rx=0){
  uv(g,cell);q.setFromEuler(new T.Euler(rx,ry,0));matrix.compose(v.set(x,y,z),q,new T.Vector3(sx,sy,sz));g.applyMatrix4(matrix);if(!batches.has(material))batches.set(material,[]);batches.get(material)!.push(g);
 }
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c=2,m=paint)=>add(new T.BoxGeometry(1,1,1),x,y+h/2,z,w,h,d,c,m);
 const cyl=(x:number,y:number,z:number,r:number,h:number,c=2,m:T.Material=paint)=>add(new T.CylinderGeometry(1,1,1,16),x,y+h/2,z,r,h,r,c,m);
 function plane(x:number,y:number,z:number,w:number,h:number,c:number,ry=0,m:T.Material=paint){add(new T.PlaneGeometry(1,1),x,y,z,w,h,1,c,m,ry);}
 function roof(x:number,y:number,z:number,w:number,d:number,c:number){add(new T.ConeGeometry(1,1,4),x,y+1.5,z,w*.76,3,d*.76,c,paint,Math.PI/4);}
 // Five-metre plain cobbles: mirrored samples blend away seams and large-scale tint breaks repetition.
 const paving=new T.MeshStandardMaterial({map:atlas,roughness:1});
 paving.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>',`#include <map_pars_fragment>
   vec3 cobbles(vec2 p){vec2 t=abs(fract(p*.5)*2.-1.);return texture2D(map,vec2((1.02+t.x*.96)/4.,(2.02+t.y*.96)/3.)).rgb;}
  `).replace('#include <map_fragment>',`
   vec2 world=vMapUv*60.-30.;
   vec2 tile=world/5.;
   float blend=.32+.12*sin(world.x*.23+world.y*.17);
   vec3 stone=mix(cobbles(tile),cobbles(vec2(-tile.y,tile.x)*.93+vec2(.37,.61)),blend);
   float crossDistance=min(abs(world.x),abs(world.y));
   float road=1.-smoothstep(2.,3.,crossDistance);
   float grey=dot(stone,vec3(.299,.587,.114));
   // Warm terracotta edge strokes become worn grey kerb stone rather than red grid lines.
   float redTrim=smoothstep(.025,.10,stone.r-stone.g);
   stone=mix(stone,vec3(grey)*vec3(1.04,1.025,.97),redTrim*.92);
   vec3 plaza=mix(stone,vec3(grey)*vec3(1.13,1.09,.98),.42);
   float variation=1.+.035*sin(world.x*.37+sin(world.y*.29))+.025*cos(world.y*.51-world.x*.19);
   diffuseColor.rgb*=mix(plaza,stone*.86,road)*variation;
  `);
 };
 paving.customProgramCacheKey=()=> 'city-cobbles-worn-kerb-v3';
 const ground=new T.Mesh(new T.PlaneGeometry(60,60).rotateX(-Math.PI/2),paving);ground.position.y=.005;ground.receiveShadow=true;root.add(ground);
 // Exactly one medallion on the existing circular apron; the tower and steps stay fixed.
 cyl(0,.02,0,5,.08,1);
 const medallion=new T.Mesh(uv(new T.CircleGeometry(4.9,48).rotateX(-Math.PI/2),0),paint);medallion.position.y=.105;medallion.receiveShadow=true;root.add(medallion);
 box(0,.12,0,4,10,4);box(0,10.12,0,4.8,.5,4.8);box(0,10.62,0,3.5,2,3.5,3);roof(0,12.62,0,5.2,5.2,4);
 for(const [x,z,ry]of [[0,2.025,0],[2.025,0,Math.PI/2],[0,-2.025,Math.PI],[-2.025,0,-Math.PI/2]])plane(x,8,z,2.3,2.3,8,ry);
 for(const x of [-1.8,1.8])box(x,.12,2.04,.22,6,.12,3);
 box(0,.08,2.6,5,.15,1);box(0,.04,3.5,6,.08,1);plane(.55,.55,2.031,.12,.9,10);
 function house(x:number,z:number,w:number,d:number,h=4.5,c=4){box(x,0,z,w,h,d,3);roof(x,h,z,w+.6,d+.6,c);plane(x,h*.38,z+d/2+.015,1.3,h*.7,6);for(const dx of [-w*.3,w*.3])plane(x+dx,h*.63,z+d/2+.025,1.1,1.2,7,0,glow);}
 for(const b of CITY_BUILDINGS){
  if(b.id==='market'){
   box(b.x,0,b.z,b.w,1.1,b.d,10);box(b.x,2.6,b.z,b.w+.6,.25,b.d+.6,9);
   for(const dx of [-3,3])for(const dz of [-3.5,3.5])box(b.x+dx,0,b.z+dz,.16,2.6,.16,10);
   for(let i=0;i<7;i++)box(b.x-3+i,2.82,b.z,1,.12,b.d+.7,i%2?5:4);
  }else house(b.x,b.z,b.w,b.d,4.5,b.id==='forge'?5:4);
 }
 box(-22,4.5,-2,1.2,4,1.3);box(-22,8.5,-2,1.6,.25,1.7);plane(-16.48,1.3,0,2.1,1.8,7,Math.PI/2,glow);
 // Six houses sit behind the occupied building footprints, without new navigation obstacles.
 for(const [x,z,w,d,c]of [[-20,-22,6,5,4],[-11,-24,5,4,5],[11,-24,5,4,4],[21,-22,6,5,5],[-23,20,5,6,5],[23,20,5,6,4]])house(x,z,w,d,4,c);
 cyl(-9,0,9,2.5,.65);cyl(-9,.65,9,2.1,.08,11,water);cyl(-9,.73,9,.45,1.4);cyl(-9,2.13,9,1,.12);cyl(-9,2.25,9,.75,.04,11,water);
 for(const axis of ['x','z']as const)for(const side of [-1,1]){
  for(const offset of [-16.5,16.5]){
   const x=axis==='x'?side*30:offset,z=axis==='z'?side*30:offset;
   box(x,0,z,axis==='x'?1:27,5,axis==='z'?1:27);box(x-side*(axis==='x'?.5:0),4.5,z-side*(axis==='z'?.5:0),axis==='x'?2:27,.3,axis==='z'?2:27);
   for(let i=-12;i<=12;i+=2)box(x+(axis==='z'?i:0),5,z+(axis==='x'?i:0),1,.7,1);
  }
  const x=axis==='x'?side*30:0,z=axis==='z'?side*30:0,open=axis==='z'&&side===1;
  box(x,5,z,axis==='x'?2:7,1.2,axis==='z'?2:7);if(!open)box(x,0,z,axis==='x'?1:6,5,axis==='z'?1:6,6);
  for(const offset of [-3.5,3.5]){const a=x+(axis==='z'?offset:0),b=z+(axis==='x'?offset:0);box(a,0,b,2,6.5,2);roof(a,6.5,b,2.5,2.5,4);}
  if(open)for(let i=-2.5;i<=2.5;i+=.5)box(i,4.1,30,.08,1.8,.12,10);
 }
 // Repeated tiny props are instanced; no additional collision shapes.
 const props=new Map<string,{g:T.BufferGeometry;m:T.Material;transforms:T.Matrix4[]}>();
 function prop(key:string,g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number,c:number){if(!props.has(key))props.set(key,{g:uv(g,c),m,transforms:[]});props.get(key)!.transforms.push(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion(),new T.Vector3(sx,sy,sz)));}
 for(const [x,z]of [[-4,-5],[4,-5],[-5,5],[5,5],[-25,-10],[25,-10],[-25,10],[25,10],[-4,24],[4,24]]){
  prop('post',new T.BoxGeometry(1,1,1),paint,x,1.5,z,.12,3,.12,10);prop('lantern',new T.BoxGeometry(1,1,1),glow,x,3,z,.42,.65,.42,7);
  prop('banner',new T.BoxGeometry(1,1,1),paint,x+.45,2.25,z,.65,1.1,.08,9);
 }
 for(const [x,z]of [[-3,-22],[3,-22],[-23,3],[22,3],[23,-3],[24,3]]){
  prop('crate',new T.BoxGeometry(1,1,1),paint,x,.45,z,.9,.9,.9,10);prop('barrel',new T.CylinderGeometry(1,1,1,10),paint,x+1,.55,z,.4,1.1,.4,10);
 }
 for(const [x,z]of [[-25,-22],[25,-22],[-25,22],[25,22]]){
  prop('planter',new T.CylinderGeometry(1,1,1,10),paint,x,.35,z,1,.7,1,2);prop('trunk',new T.CylinderGeometry(1,1,1,6),paint,x,1.5,z,.18,2.5,.18,10);prop('tree',new T.IcosahedronGeometry(1,1),paint,x,3.4,z,1.8,2,1.8,4);
 }
 for(const x of [-11,11]){box(x,.45,12,3,.18,.7,10);for(const dx of [-1,1])box(x+dx,0,12,.15,.45,.6,10);box(x,.7,12.3,3,.7,.12,10);}
 box(-5,0,25,.14,2,.14,10);box(-5,1,25,2,1.2,.15,10);
 for(const b of CITY_BUILDINGS){plane(b.x,b.id==='market'?2:3,b.z+b.d/2+.04,1,1,9);box(b.x-2,1,b.z+b.d/2+.18,1.6,.35,.45,10);for(let i=0;i<5;i++)cyl(b.x-2.6+i*.3,1.35,b.z+b.d/2+.18,.13,.25,i%2?5:4);}
 for(const p of props.values()){const mesh=new T.InstancedMesh(p.g,p.m,p.transforms.length);p.transforms.forEach((t,i)=>mesh.setMatrixAt(i,t));mesh.receiveShadow=true;root.add(mesh);}
 for(const [material,geometries]of batches){const mesh=new T.Mesh(mergeGeometries(geometries),material);mesh.receiveShadow=true;mesh.castShadow=material===paint;root.add(mesh);geometries.forEach(g=>g.dispose());}
 // Five fixed front-facing, four-frame idle sprites share one atlas and one material.
 const npcMap=loader.load('/assets/city/city-npcs-v1.png');const npcMaterial=new T.MeshBasicMaterial({map:npcMap,transparent:true,alphaTest:.05,side:T.DoubleSide,depthWrite:true,toneMapped:false});
 const npcs=[...CITY_BUILDINGS.map(b=>b.talk),HEALER,{x:4,z:25}].map((p,row)=>{
  const height=row===4?3.53:3.23;const g=new T.PlaneGeometry(2.6*height/3.5,height);g.translate(0,height*(.5-8/320),0);const mesh=new T.Mesh(g,npcMaterial);mesh.position.set(p.x,.035,p.z);mesh.onBeforeRender=(_r,_s,c)=>mesh.quaternion.copy(c.quaternion);root.add(mesh);return{mesh,row};
 });
 const angel=new T.Sprite(new T.SpriteMaterial({map:loader.load('/assets/skills-painted/angel-v1.png'),transparent:true,alphaTest:.04,depthWrite:false,toneMapped:false}));angel.center.set(.5,.025);angel.scale.set(2.6,3.9,1);angel.position.set(0,.2,3.2);root.add(angel);
 function fogTexture(size:number){const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d')!,grad=ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);grad.addColorStop(0,'#bacbd4aa');grad.addColorStop(1,'#bacbd400');ctx.fillStyle=grad;ctx.fillRect(0,0,size,size);return new T.CanvasTexture(c);}
 const fogHQ=fogTexture(128),fogLOW=fogTexture(64);
 // The existing painted mist/castle cell fills both the horizon and the ground outside the walls.
 const backdropMaterial=new T.MeshBasicMaterial({map:atlas,color:'#bacbd7',side:T.DoubleSide,fog:false});
 const outside=new T.Mesh(uv(new T.PlaneGeometry(240,240).rotateX(-Math.PI/2),11),backdropMaterial);outside.position.y=-.17;root.add(outside);
 for(const side of [-1,1])for(const axis of [0,1]){
  const horizon=new T.Mesh(uv(new T.PlaneGeometry(160,65),11),backdropMaterial);horizon.position.set(axis?side*57:0,13,axis?0:side*57);horizon.rotation.y=axis?Math.PI/2:0;root.add(horizon);
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
 for(let layer=0;layer<3;layer++)for(const side of [-1,1])for(const axis of [0,1]){
  const f=new T.Mesh(new T.PlaneGeometry(94,30),fogMaterial);f.position.set(axis?side*(30+layer*2):0,6+layer,axis?0:side*(30+layer*2));f.rotation.set(-Math.PI/4,axis?Math.PI/2:0,0);curtains.add(f);
 }
 // Flat banks make the plaza boundary visibly hazy even from the top-down overview.
 const edgeBanks=new T.Group();root.add(edgeBanks);
 for(const side of [-1,1])for(const axis of [0,1]){
  const f=new T.Mesh(new T.PlaneGeometry(axis?16:85,axis?85:16).rotateX(-Math.PI/2),fogMaterial);f.position.set(axis?side*29:0,.22,axis?0:side*29);edgeBanks.add(f);
 }
  const seam=new T.Sprite(new T.SpriteMaterial({map:fogHQ,transparent:true,opacity:.45,depthWrite:false}));seam.position.set(.55,.35,2.2);seam.scale.set(2,.7,1);root.add(seam);
 const mistPositions=new Float32Array(36*3);for(let i=0;i<36;i++){mistPositions[i*3]=Math.sin(i*17.1)*26;mistPositions[i*3+1]=.2+(i%5)*.13;mistPositions[i*3+2]=Math.cos(i*13.7)*26;}
 const mistGeo=new T.BufferGeometry();mistGeo.setAttribute('position',new T.BufferAttribute(mistPositions,3));const mist=new T.Points(mistGeo,new T.PointsMaterial({map:fogHQ,color:'#d4e0e3',size:1.8,transparent:true,opacity:.19,depthWrite:false}));root.add(mist);
 // Two local points + the shared hemisphere and key light = four real lights total.
 for(const [x,z]of [[-16,0],[4,5]]){const l=new T.PointLight('#ffc681',2,8,2);l.position.set(x,2.5,z);root.add(l);}
 let high=true,frame=-1;
 return{root,npcActors:[...npcs.map(n=>n.mesh),angel],setQuality(hq:boolean){high=hq;mist.visible=hq;fogMaterial.uniforms.softness.value=hq?fogHQ:fogLOW;seam.material.map=hq?fogHQ:fogLOW;curtains.children.forEach((o,i)=>o.visible=hq||i<4);root.traverse(o=>{if(o instanceof T.Mesh&&!(o instanceof T.InstancedMesh))o.castShadow=hq&&o.material===paint;});},snapshot:()=>({ready:!!atlas.userData.ready&&!!npcMap.userData.ready,mapId:'city_plaza',size:[60,60],quality:high?'HQ':'LOW',mistParticles:high?36:0,fogResolution:high?128:64,groundTileMetres:5,compassMedallions:1,paintedBackdrop:true,fogCards:high?16:8,npcFrames:4,npcCount:5,realLights:4}),update(time:number){
  const next=Math.floor(time*4)%4;if(next!==frame){frame=next;for(const {mesh,row}of npcs){const a=mesh.geometry.getAttribute('uv');a.setXY(0,(frame+.02)/4,(5-row-.02)/5);a.setXY(1,(frame+.98)/4,(5-row-.02)/5);a.setXY(2,(frame+.02)/4,(4-row+.02)/5);a.setXY(3,(frame+.98)/4,(4-row+.02)/5);a.needsUpdate=true;}}
  mist.position.x=Math.sin(time*.07)*.7;mist.position.z=Math.cos(time*.05)*.6;seam.material.opacity=.32+Math.sin(time*.8)*.08;
 }};
}
