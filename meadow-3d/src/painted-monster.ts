import * as T from 'three';
import type { Enemy, MonsterMotion, SlimeVariant } from './sim';
import { makeMonsterFallback } from './actors';
import { monsterCell, monsterOpacity, VARIANT_HUE } from './monster-animation';
import type { MonsterSpecies } from './monster-animation';
interface MotionAtlas{file:string;columns:number;rows:number;frames:number;duration:number;directions:{faceRect:[number,number,number,number]|null;bounds:number[]}[][]}
interface SpeciesManifest{cellSize:[number,number];anchor:[number,number];quadWorldSize:[number,number];motions:Record<string,MotionAtlas>}
interface Manifest{species:Record<MonsterSpecies,SpeciesManifest>;phase2:{expressionOverlay:string}}
interface Bank{manifest:Manifest|null;textures:Record<MonsterSpecies,Record<string,T.Texture>>;expression:T.Texture|null;request:(species:MonsterSpecies)=>void}
const banks=new WeakMap<T.TextureLoader,Bank>();
const BASE='/assets/monsters-painted/';
function assetBank(loader:T.TextureLoader){
 const existing=banks.get(loader);if(existing)return existing;
 const requested=new Set<MonsterSpecies>(),started=new Set<MonsterSpecies>();
 const bank:Bank={manifest:null,textures:{slime:{},king:{}},expression:null,request(species){requested.add(species);if(!bank.manifest||started.has(species))return;started.add(species);
  for(const[motion,atlas]of Object.entries(bank.manifest.species[species].motions))loader.load(BASE+atlas.file,t=>{t.colorSpace=T.SRGBColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;bank.textures[species][motion]=t;},undefined,()=>{});
  if(species==='king')loader.load(BASE+bank.manifest.phase2.expressionOverlay,t=>{t.colorSpace=T.SRGBColorSpace;bank.expression=t;},undefined,()=>{});
 }};
 banks.set(loader,bank);new T.FileLoader(loader.manager).setResponseType('json').load(BASE+'manifest.json',data=>{bank.manifest=data as unknown as Manifest;requested.forEach(s=>bank.request(s));},undefined,()=>{});return bank;
}
const colourShader=`
vec3 jellyRgbToHsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1.e-8)),d/(q.x+1.e-8),q.x);}
vec3 jellyHsvToRgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}
uniform vec4 uJellyCell;uniform float uJellyHue;uniform float uJellyPhase;uniform float uJellyFlash;uniform float uJellyTime;
uniform sampler2D uJellyExpression;uniform vec4 uJellyFaceRect;uniform float uJellyFaceDirection;uniform float uJellyFaceEnabled;
`;
function paintShader(material:T.SpriteMaterial,uniforms:any,atlas=true){
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.fragmentShader=colourShader+shader.fragmentShader;
 const map=T.ShaderChunk.map_fragment.replaceAll('vMapUv',atlas?'(vMapUv*uJellyCell.zw+uJellyCell.xy)':'vMapUv');
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',map+`
 if(uJellyFaceEnabled>.5){
  vec2 faceUv=(vMapUv-uJellyFaceRect.xy)/uJellyFaceRect.zw;
  if(all(greaterThanEqual(faceUv,vec2(0.)))&&all(lessThanEqual(faceUv,vec2(1.)))){
   vec4 facePaint=texture2D(uJellyExpression,vec2((faceUv.x+uJellyFaceDirection)*.5,faceUv.y));
   float feather=1.-smoothstep(.68,1.,length((faceUv-.5)*2.));
   diffuseColor.rgb=mix(diffuseColor.rgb,facePaint.rgb,facePaint.a*feather);
  }
 }
 vec3 originalJelly=diffuseColor.rgb;
 float pink=step(originalJelly.g*1.08,originalJelly.r)*step(originalJelly.g*.82,originalJelly.b);
 vec3 hsv=jellyRgbToHsv(originalJelly);hsv.x=fract(hsv.x+uJellyHue+uJellyPhase*(-.045));hsv.y=min(1.,hsv.y*(1.+uJellyPhase*.32));hsv.z*=1.-uJellyPhase*.19;
 diffuseColor.rgb=mix(originalJelly,jellyHsvToRgb(hsv),pink);
 float gold=step(.10,originalJelly.r)*step(.045,originalJelly.g)*step(originalJelly.g*1.04,originalJelly.r)*step(originalJelly.b*1.25,originalJelly.g);
 diffuseColor.rgb+=vec3(.28,.16,.025)*gold*uJellyPhase*(.8+.2*sin(uJellyTime*5.));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.),uJellyFlash);
 `);};material.customProgramCacheKey=()=>atlas?'painted-jelly-atlas-v1':'painted-jelly-expression-v1';
}
export interface MonsterOptions{variant?:SlimeVariant;hueShift?:number;tint?:string;id?:number}
/** Shared textures, per-instance frame/hue uniforms, one real ground anchor. */
export function makePaintedMonster(loader:T.TextureLoader,boss=false,options:MonsterOptions={}){
 const species:MonsterSpecies=boss?'king':'slime',bank=assetBank(loader);bank.request(species);
 const root=new T.Group();const uniforms={uJellyCell:{value:new T.Vector4(0,0,1,1)},uJellyHue:{value:0},uJellyPhase:{value:0},uJellyFlash:{value:0},uJellyTime:{value:0},uJellyExpression:{value:null as T.Texture|null},uJellyFaceRect:{value:new T.Vector4(0,0,1,1)},uJellyFaceDirection:{value:0},uJellyFaceEnabled:{value:0}};
 const material=new T.SpriteMaterial({transparent:true,alphaTest:.08,depthWrite:true,toneMapped:false,color:options.tint||'#ffffff'});paintShader(material,uniforms);
 const portrait=new T.Sprite(material);portrait.userData.enemyId=options.id;portrait.visible=false;root.add(portrait);
 const fallback=makeMonsterFallback(boss);fallback.userData.enemyId=options.id;root.add(fallback);
 const shadowMaterial=new T.MeshBasicMaterial({color:'#354333',transparent:true,opacity:.16,depthWrite:false});
 const shadow=new T.Mesh(new T.CircleGeometry(boss?1.8:.42,32),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.scale.y=.62;shadow.position.y=.026;shadow.raycast=()=>{};root.add(shadow);
 let expressionVisible=false;
 let diagnostic={motion:'idle',actualMotion:'fallback',frame:0,direction:'SE',phase:1,variant:'pink',loaded:[] as string[],opacity:1,expression:false};
 // Sprite raycasting normally hits transparent padding. Sample only the clicked texel.
 const sample=document.createElement('canvas');sample.width=sample.height=1;const sx=sample.getContext('2d',{willReadFrequently:true})!;
 const defaultRaycast=portrait.raycast.bind(portrait),fallbackRaycast=fallback.raycast.bind(fallback);
 portrait.raycast=(ray,hits)=>{if(!portrait.visible||!material.map?.image)return;const found:T.Intersection[]=[];defaultRaycast(ray,found);const cw=bank.manifest!.species[species].cellSize[0],ch=bank.manifest!.species[species].cellSize[1],uv=uniforms.uJellyCell.value;
  for(const hit of found){if(!hit.uv)continue;const image=material.map.image as HTMLImageElement;const x=Math.min(image.width-1,Math.floor((uv.x+hit.uv.x*uv.z)*image.width)),y=Math.min(image.height-1,Math.floor((1-uv.y-hit.uv.y*uv.w)*image.height));sx.clearRect(0,0,1,1);sx.drawImage(image,x,y,1,1,0,0,1,1);if(sx.getImageData(0,0,1,1).data[3]>32)hits.push(hit);}
 };
 fallback.raycast=(ray,hits)=>{if(fallback.visible)fallbackRaycast(ray,hits);};
 return{root,snapshot:()=>({...diagnostic,loaded:Object.keys(bank.textures[species])}),dispose(){material.dispose();shadow.geometry.dispose();shadowMaterial.dispose();fallback.geometry.dispose();(fallback.material as T.Material).dispose();},update(e:Enemy,time:number){
  root.position.set(e.x,.04,e.z);root.userData.dead=e.dead;
  const opacity=monsterOpacity(e);root.visible=opacity>0;material.opacity=opacity;
  const definition=bank.manifest?.species[species],texture=bank.textures[species][e.motion]||bank.textures[species].idle;
  const actual=bank.textures[species][e.motion]?e.motion:'idle';
  fallback.visible=!definition||!texture;portrait.visible=!fallback.visible;
  expressionVisible=false;uniforms.uJellyFaceEnabled.value=0;
  if(!definition||!texture){diagnostic={...diagnostic,motion:e.motion,actualMotion:'fallback',opacity};return;}
  const cell=monsterCell(species,actual,e.fx,e.fz,e.motionTime);const info=definition.motions[actual];
  uniforms.uJellyCell.value.set(cell.column/info.columns,1-(cell.row+1)/4,1/info.columns,.25);
  if(material.map!==texture){material.map=texture;material.needsUpdate=true;}
  uniforms.uJellyHue.value=options.hueShift??VARIANT_HUE[options.variant||e.variant];uniforms.uJellyPhase.value=e.bossPhase===2?1:0;uniforms.uJellyFlash.value=e.dead?0:Math.min(1,e.hurt/.18)*.8;uniforms.uJellyTime.value=time;
  portrait.center.set(...definition.anchor);portrait.scale.set(definition.quadWorldSize[0],definition.quadWorldSize[1],1);
  shadowMaterial.opacity=.16*opacity*((e.motion==='hop'||e.motion==='move'||e.motion==='slam')&&cell.column===1?.5:1);
  const face=info.directions[cell.row][cell.column].faceRect;
  if(boss&&e.bossPhase===2&&face&&bank.expression&&!['death','stun','transform'].includes(e.motion)){
   expressionVisible=true;uniforms.uJellyFaceEnabled.value=1;uniforms.uJellyExpression.value=bank.expression;
   uniforms.uJellyFaceDirection.value=cell.direction==='SE'?0:1;
   const[cw,ch]=definition.cellSize,[x,y,w,h]=face;
   // Composite into the original sprite so its silhouette and depth clip the facial pass.
   uniforms.uJellyFaceRect.value.set(x/cw,1-(y+h)/ch,w/cw,h/ch);
  }
  diagnostic={motion:e.motion,actualMotion:actual,frame:cell.column,direction:cell.direction,phase:e.bossPhase,variant:e.variant,loaded:[],opacity,expression:expressionVisible};
 }};
}
/** Painted projectile, reusing the small jelly idle art rather than a 3D blob. */
export function makePaintedDroplet(loader:T.TextureLoader,phase:1|2=1){
 const actor=makePaintedMonster(loader,false,{hueShift:phase===2?-.045:0});actor.root.scale.setScalar(.24);
 return{root:actor.root,dispose:actor.dispose,update(x:number,z:number,time:number){actor.update({x,z,fx:0,fz:1,motion:'idle',motionTime:0,bossPhase:1,variant:'pink',hurt:0,dead:false,deathAge:0} as Enemy,time);actor.root.position.y=.65;}};
}

