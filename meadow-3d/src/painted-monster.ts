import {BOSS_METRES} from './world-scale.ts';
import * as T from 'three';import type{PaintedLoader}from'./assets';
import type { Enemy, MonsterMotion, SlimeVariant } from './sim';
import { makeMonsterFallback } from './actors';
import { monsterCell, monsterOpacity, VARIANT_HUE, monsterSpecies, SPECIES_SCALE } from './monster-animation';
import type { MonsterSpecies } from './monster-animation';
interface MotionAtlas{file:string;columns:number;rows:number;frames:number;duration:number;directions:{faceRect:[number,number,number,number]|null;bounds:number[]}[][]}
interface SpeciesManifest{bodyWorldHeight?:number;cellSize:[number,number];anchor:[number,number];quadWorldSize:[number,number];motions:Record<string,MotionAtlas>}
interface Manifest{species:Record<MonsterSpecies,SpeciesManifest>;phase2:{expressionOverlay:string}}
interface Bank{manifest:Manifest|null;textures:Record<MonsterSpecies,Record<string,T.Texture>>;expression:T.Texture|null;request:(species:MonsterSpecies)=>void}
const banks=new WeakMap<PaintedLoader,Bank>();
const BASE='/assets/monsters-painted/';
function assetBank(loader:PaintedLoader){
 const existing=banks.get(loader);if(existing)return existing;
 const requested=new Set<MonsterSpecies>(),started=new Set<MonsterSpecies>();
 const bank:Bank={manifest:null,textures:{slime:{},king:{},shroom:{},wolf:{},wisp:{},stump:{},warden:{}},expression:null,request(species){requested.add(species);if(!bank.manifest||started.has(species))return;started.add(species);
  for(const[motion,atlas]of Object.entries(bank.manifest.species[species]?.motions||{}))loader.load(BASE+atlas.file,t=>{t.colorSpace=T.SRGBColorSpace;t.magFilter=T.LinearFilter;t.minFilter=T.LinearFilter;t.wrapS=t.wrapT=T.ClampToEdgeWrapping;bank.textures[species][motion]=t;},undefined,()=>{});
  if(species==='king')loader.load(BASE+bank.manifest.phase2.expressionOverlay,t=>{t.colorSpace=T.SRGBColorSpace;bank.expression=t;},undefined,()=>{});
 }};
 banks.set(loader,bank);loader.json<Manifest>(BASE+'manifest.json',data=>{bank.manifest=data as unknown as Manifest;requested.forEach(s=>bank.request(s));});return bank;
}
const colourShader=`
vec3 jellyRgbToHsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1.e-8)),d/(q.x+1.e-8),q.x);}
vec3 jellyHsvToRgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}
uniform vec4 uJellyCell;uniform float uJellyHue;uniform float uJellyPhase;uniform float uJellyFlash;uniform float uJellyTime;uniform float uForestPhase;
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
 // Warden phase two lights existing pale cracks and lanterns, preserving the bark palette.
 float crack=smoothstep(.34,.72,max(originalJelly.r,max(originalJelly.g,originalJelly.b)));
 diffuseColor.rgb+=vec3(.24,.27,.15)*crack*uForestPhase*(.85+.15*sin(uJellyTime*5.));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.),uJellyFlash);
 `);};material.customProgramCacheKey=()=>atlas?'painted-jelly-atlas-v1':'painted-jelly-expression-v1';
}
export interface MonsterOptions{dataId?:string;variant?:SlimeVariant;hueShift?:number;tint?:string;id?:number;placeholder?:{color:string;height:number}}
/** Shared textures, per-instance frame/hue uniforms, one real ground anchor. */
/** Visual size of the small jelly relative to its packed atlas size (about 0.6x the hero). */
export const SMALL_JELLY_SCALE=.72;
export function makePaintedMonster(loader:PaintedLoader,boss=false,options:MonsterOptions={}){
 const species=monsterSpecies(options.dataId,boss),bank=assetBank(loader);const placeholder=options.placeholder;bank.request(species);
 const root=new T.Group();const uniforms={uJellyCell:{value:new T.Vector4(0,0,1,1)},uJellyHue:{value:0},uJellyPhase:{value:0},uJellyFlash:{value:0},uJellyTime:{value:0},uForestPhase:{value:0},uJellyExpression:{value:null as T.Texture|null},uJellyFaceRect:{value:new T.Vector4(0,0,1,1)},uJellyFaceDirection:{value:0},uJellyFaceEnabled:{value:0}};
 const material=new T.SpriteMaterial({transparent:true,alphaTest:.08,depthWrite:true,toneMapped:false,color:options.tint||'#ffffff'});paintShader(material,uniforms);
 const portrait=new T.Sprite(material);portrait.userData.enemyId=options.id;portrait.visible=false;root.add(portrait);
 const fallback=makeMonsterFallback(boss);fallback.userData.enemyId=options.id;root.add(fallback);
 if(placeholder){(fallback.material as T.MeshBasicMaterial).color.set(placeholder.color);const h=placeholder.height;fallback.scale.set(h*.5,h*.5,h*.4);fallback.position.y=h*.5;}
 const shadowMaterial=new T.MeshBasicMaterial({color:'#354333',transparent:true,opacity:.16,depthWrite:false});
 const shadowRadius={slime:.32,king:1.8,shroom:.4,wolf:.55,wisp:.28,stump:.65,warden:1.8}[species];
 const shadow=new T.Mesh(new T.CircleGeometry(shadowRadius,32),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.scale.set(species==='wolf'?1.4:1,.62,1);shadow.position.y=.026;shadow.raycast=()=>{};root.add(shadow);
 let expressionVisible=false,lastMotion:MonsterMotion='idle',recoveryAt=-Infinity,recoveryFrom=.85;
 let diagnostic={motion:'idle',actualMotion:'fallback',frame:0,direction:'SE',phase:1,variant:'pink',loaded:[] as string[],opacity:1,expression:false};
 // Sprite raycasting normally hits transparent padding. Sample only the clicked texel.
 const sample=document.createElement('canvas');sample.width=sample.height=1;const sx=sample.getContext('2d',{willReadFrequently:true})!;
 const defaultRaycast=portrait.raycast.bind(portrait),fallbackRaycast=fallback.raycast.bind(fallback);
 portrait.raycast=(ray,hits)=>{if(!portrait.visible||!material.map?.image)return;const found:T.Intersection[]=[];defaultRaycast(ray,found);const cw=bank.manifest!.species[species].cellSize[0],ch=bank.manifest!.species[species].cellSize[1],uv=uniforms.uJellyCell.value;
  for(const hit of found){if(!hit.uv)continue;const image=(material.map.userData.hitMask||material.map.image) as HTMLImageElement;const x=Math.min(image.width-1,Math.floor((uv.x+hit.uv.x*uv.z)*image.width)),y=Math.min(image.height-1,Math.floor((1-uv.y-hit.uv.y*uv.w)*image.height));sx.clearRect(0,0,1,1);sx.drawImage(image,x,y,1,1,0,0,1,1);if(sx.getImageData(0,0,1,1).data[3]>32)hits.push(hit);}
 };
 fallback.raycast=(ray,hits)=>{if(fallback.visible)fallbackRaycast(ray,hits);};
 return{root,flash(value:number){uniforms.uJellyFlash.value=value;},snapshot:()=>({...diagnostic,species,loaded:Object.keys(bank.textures[species])}),dispose(){material.dispose();shadow.geometry.dispose();shadowMaterial.dispose();fallback.geometry.dispose();(fallback.material as T.Material).dispose();},update(e:Enemy,time:number){
  root.position.set(e.x,.04,e.z);root.userData.dead=e.dead;
  const opacity=monsterOpacity(e);root.visible=opacity>0;material.opacity=opacity;
  // The simulation retains its legacy .85s regular attack. Finish the painted
  // recoil during idle without delaying damage or overriding death/new actions.
  if(lastMotion==='attack'&&e.motion==='idle'){recoveryAt=time;recoveryFrom=.85;}
  if(e.motion!=='idle')recoveryAt=-Infinity;
  const recovered=recoveryFrom+time-recoveryAt;
  const visualMotion=e.motion==='idle'&&recovered<(bank.manifest?.species[species]?.motions.attack?.duration||0)?'attack':e.motion;
  const visualTime=visualMotion!==e.motion?recovered:e.motionTime;lastMotion=e.motion;
  const definition=bank.manifest?.species[species],texture=bank.textures[species][visualMotion]||bank.textures[species].idle;
  const actual=bank.textures[species][visualMotion]?visualMotion:'idle';
  fallback.visible=!definition||!texture;portrait.visible=!fallback.visible;
  expressionVisible=false;uniforms.uJellyFaceEnabled.value=0;
  if(!definition||!texture){if(placeholder){(fallback.material as T.MeshBasicMaterial).color.set(e.hurt>0?'#ffffff':placeholder.color);(fallback.material as T.MeshBasicMaterial).opacity=opacity;}diagnostic={...diagnostic,motion:e.motion,actualMotion:'fallback',opacity};return;}
  const cell=monsterCell(species,actual,e.fx,e.fz,visualTime);const info=definition.motions[actual];
  uniforms.uJellyCell.value.set(cell.column/info.columns,1-(cell.row+1)/4,1/info.columns,.25);
  if(material.map!==texture){material.map=texture;material.needsUpdate=true;}
  uniforms.uJellyHue.value=species==='slime'||species==='king'?(options.hueShift??VARIANT_HUE[options.variant||e.variant]):0;uniforms.uJellyPhase.value=species==='king'&&e.bossPhase===2?1:0;uniforms.uForestPhase.value=species==='warden'&&e.bossPhase===2&&!e.dead?1:0;uniforms.uJellyFlash.value=e.dead?0:Math.min(1,e.hurt/.18)*.8;uniforms.uJellyTime.value=time;
  portrait.center.set(...definition.anchor);const sizeScale=SPECIES_SCALE[species]*((species==='king'||species==='warden')?BOSS_METRES/(definition.bodyWorldHeight||6.9):1);portrait.scale.set(definition.quadWorldSize[0]*sizeScale,definition.quadWorldSize[1]*sizeScale,1);
  shadowMaterial.opacity=.16*opacity*((e.motion==='hop'||e.motion==='move'||e.motion==='slam')&&cell.column===1?.5:1);
  const face=info.directions[cell.row][cell.column].faceRect;
  if(species==='king'&&e.bossPhase===2&&face&&bank.expression&&!['death','stun','transform'].includes(e.motion)){
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
export function makePaintedDroplet(loader:PaintedLoader,phase:1|2=1){
 const actor=makePaintedMonster(loader,false,{hueShift:phase===2?-.045:0});actor.root.scale.setScalar(.24);
 return{root:actor.root,dispose:actor.dispose,update(x:number,z:number,time:number){actor.update({x,z,fx:0,fz:1,motion:'idle',motionTime:0,bossPhase:1,variant:'pink',hurt:0,dead:false,deathAge:0} as Enemy,time);actor.root.position.y=.65;}};
}


export function warmKing(loader:PaintedLoader){assetBank(loader).request('king');}
export function kingReady(loader:PaintedLoader){const b=assetBank(loader);return !!b.manifest&&Object.keys(b.textures.king).length===Object.keys(b.manifest.species.king.motions).length&&!!b.expression;}

/** Four painted fire frames; independent texture transform per projectile. */
export function makePaintedWispBolt(loader:PaintedLoader){
 const root=new T.Group();const map=loader.load('/assets/monsters-painted/wisp-bolt-v1.png');map.repeat.set(.25,1);
 const material=new T.SpriteMaterial({map,transparent:true,depthWrite:false,toneMapped:false,alphaTest:.03});
 const sprite=new T.Sprite(material);sprite.scale.set(.75,.75,1);root.add(sprite);
 return{root,dispose(){map.dispose();material.dispose();},update(x:number,z:number,time:number){root.position.set(x,.85,z);map.offset.x=Math.floor(time*12)%4/4;sprite.material.opacity=.92;}};
}
/** The Warden exhales painted mist and spores; it never throws a jelly sprite. */
export function makePaintedMistSpore(loader:PaintedLoader){
 const root=new T.Group(),map=loader.load('/assets/env-forest/mist-card-v1.png');
 const mistMaterial=new T.SpriteMaterial({map,color:'#ddd1ed',transparent:true,opacity:.8,depthWrite:false,toneMapped:false});
 const puff=new T.Sprite(mistMaterial);puff.scale.set(.95,.55,1);root.add(puff);
 const sporeMaterial=new T.SpriteMaterial({map,color:'#fff0bd',transparent:true,opacity:.9,depthWrite:false,toneMapped:false});
 const spores=Array.from({length:3},(_,i)=>{const s=new T.Sprite(sporeMaterial);s.scale.set(.13,.13,1);s.position.set((i-1)*.19,(i%2)*.12,0);root.add(s);return s;});let born:number|undefined;
 return{root,dispose(){map.dispose();mistMaterial.dispose();sporeMaterial.dispose();},update(x:number,z:number,time:number){born??=time;root.position.set(x,.75+Math.max(0,1-(time-born)/.5)*1.7,z);mistMaterial.opacity=.68+Math.sin(time*9)*.1;spores.forEach((s,i)=>s.position.y=Math.sin(time*5+i)*.1);}};
}
export function warmWarden(loader:PaintedLoader){assetBank(loader).request('warden');}
export function wardenReady(loader:PaintedLoader){const b=assetBank(loader),defs=b.manifest?.species.warden;return !!defs&&Object.keys(b.textures.warden).length===Object.keys(defs.motions).length;}
