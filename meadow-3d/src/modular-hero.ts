import type {CanvasAssets} from './game-2d-assets';
import {animateModularLayers,modularPose,MODULAR_BOW,type Matrix,type ModularMotion} from './modular-hero-motion.ts';

export type Outfit = 'base' | 'traveler' | 'guardian';
export type Sword = 'none' | 'iron' | 'falchion' | 'bow';
export interface HeroLook {outfit: Outfit; sword: Sword; shield: boolean}
type Rect = readonly [number, number, number, number];
type Point = readonly [number, number];

const ROOT = '/assets/hero-modular-v1/';
export const MODULAR_ART = {
 body: {url:ROOT+'body.webp',label:'สรีระพื้นฐาน'},
 traveler: {url:ROOT+'traveler-fit-v2.webp',label:'ชุดนักเดินทาง'},
 guardian: {url:ROOT+'guardian-fit-v2.webp',label:'ชุดผู้พิทักษ์'},
 iron: {url:ROOT+'iron.webp',label:'ดาบเหล็ก'},
 falchion: {url:ROOT+'falchion.webp',label:'ดาบโค้งทองเหลือง'},
 bow: {url:ROOT+'bow.webp',label:'ธนูไม้'},
 shield: {url:ROOT+'shield.webp',label:'โล่ไม้ขอบเหล็ก'},
} as const;
export type ModularAsset = keyof typeof MODULAR_ART;
export const MODULAR_CANVAS = 1254;
export const MODULAR_FEET = 1127;
export const MODULAR_BODY_HEIGHT = 1000;
export const DEFAULT_LOOK: HeroLook = {outfit:'traveler',sword:'iron',shield:true};
export const HERO_ATTACHMENTS: Record<Outfit,{
 rightHand:Rect;leftHand:Rect;rightGrip:Point;leftGrip:Point;neck:Point;
}> = {
 base:{rightHand:[410,540,75,110],leftHand:[744,604,90,90],rightGrip:[450,630],leftGrip:[790,657],neck:[630,350]},
 traveler:{rightHand:[408,504,68,100],leftHand:[778,582,82,82],rightGrip:[444,586],leftGrip:[820,630],neck:[630,330]},
 guardian:{rightHand:[412,527,68,100],leftHand:[772,597,82,82],rightGrip:[448,609],leftGrip:[814,645],neck:[630,330]},
};

export interface HeroLayer {
 asset: ModularAsset;
 source: Rect;
 target: Rect;
 rotation?: number;
 origin?: Point;
 clip?: readonly Point[];
 transform?: Matrix;
}
const full: Rect = [0,0,MODULAR_CANVAS,MODULAR_CANVAS];
const head: Rect = [515,105,230,275];
const face: Rect = [515,105,230,225];
const jaw: readonly Point[] = [[515,105],[745,105],[745,310],[680,310],[667,320],[650,321],[628,312],[601,293],[579,280],[565,270],[515,270]];
const rightHand: Rect = [410,540,75,110];
const leftHand: Rect = [744,604,90,90];

// shortcut: SE-only art; other facings need their own registered source parts.
export function modularLayers(look: HeroLook): HeroLayer[] {
 const dressed=look.outfit!=='base';
 const mount=HERO_ATTACHMENTS[look.outfit],layers:HeroLayer[]=[];
 if(look.sword==='bow')layers.push({asset:'bow',source:full,target:[...mount.leftGrip,MODULAR_CANVAS*MODULAR_BOW.scale,MODULAR_CANVAS*MODULAR_BOW.scale],rotation:MODULAR_BOW.rotation,origin:MODULAR_BOW.grip});
 else if(look.sword!=='none'){
  const scale=look.sword==='iron'?.43:.46;
  layers.push({asset:look.sword,source:full,target:[...mount.rightGrip,MODULAR_CANVAS*scale,MODULAR_CANVAS*scale],rotation:.3,origin:[627,245]});
 }
 if(dressed){
  const outfit=look.outfit as 'traveler'|'guardian';
  layers.push({asset:'body',source:head,target:head},
   {asset:'body',source:rightHand,target:mount.rightHand},{asset:'body',source:leftHand,target:mount.leftHand},
   {asset:outfit,source:full,target:full});
  // The rear collar goes behind the jaw; the neck remains under the front collar.
  layers.push({asset:'body',source:face,target:face,clip:jaw});
 }else layers.push({asset:'body',source:full,target:full});
 if(look.shield&&look.sword!=='bow')layers.push({asset:'shield',source:full,target:[...mount.leftGrip,530,530],origin:[565,610]});
 return layers;
}

export function drawModularHero(
 ctx:CanvasRenderingContext2D,assets:CanvasAssets,look:HeroLook,
 x:number,feetY:number,bodyHeight:number,guides=false,motion:ModularMotion='idle',frame=0,
) {
 const {layers,pose}=animateModularLayers(look,motion,frame,HERO_ATTACHMENTS[look.outfit],modularLayers(look));
 const scale=bodyHeight/MODULAR_BODY_HEIGHT;
 ctx.save();ctx.translate(x-MODULAR_CANVAS/2*scale,feetY-MODULAR_FEET*scale);ctx.scale(scale,scale);
 for(const layer of layers){
  const image=assets.get(MODULAR_ART[layer.asset].url);
  if(!image)continue;
  const sourceScale=image.width/MODULAR_CANVAS,[sx,sy,sw,sh]=layer.source;
  ctx.save();
  if(layer.transform)ctx.transform(...layer.transform);
  if(layer.clip){
   ctx.beginPath();ctx.moveTo(...layer.clip[0]);
   for(const point of layer.clip.slice(1))ctx.lineTo(...point);
   ctx.closePath();ctx.clip();
  }
  if(layer.origin){
   const [x,y,w,h]=layer.target;
   ctx.translate(x,y);ctx.rotate(layer.rotation??0);
   ctx.drawImage(image,-layer.origin[0]/MODULAR_CANVAS*w,-layer.origin[1]/MODULAR_CANVAS*h,w,h);
  }else{
   ctx.drawImage(image,sx*sourceScale,sy*sourceScale,sw*sourceScale,sh*sourceScale,...layer.target);
  }
  ctx.restore();
 }
 if(pose.bow){
  const {top,bottom,nock,arrow}=pose.bow;
  ctx.strokeStyle='#ead9b5';ctx.lineWidth=3;ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(...top);ctx.lineTo(...nock);ctx.lineTo(...bottom);ctx.stroke();
  if(arrow){
   ctx.strokeStyle='#e0c69b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(...arrow.tail);ctx.lineTo(...arrow.tip);ctx.stroke();
   ctx.save();ctx.translate(...arrow.tip);ctx.rotate(MODULAR_BOW.rotation);
   ctx.fillStyle='#d9e2dc';ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-15,-8);ctx.lineTo(-10,0);ctx.lineTo(-15,8);ctx.closePath();ctx.fill();ctx.restore();
  }
 }
 ctx.restore();
 if(guides)drawModularGuides(ctx,look,x,feetY,bodyHeight,motion,frame);
}

export function drawModularGuides(ctx:CanvasRenderingContext2D,look:HeroLook,x:number,feetY:number,bodyHeight:number,motion:ModularMotion,frame:number){
  const pose=modularPose(motion,frame,HERO_ATTACHMENTS[look.outfit],look.sword),scale=bodyHeight/MODULAR_BODY_HEIGHT;
  ctx.save();ctx.translate(x-MODULAR_CANVAS/2*scale,feetY-MODULAR_FEET*scale);ctx.scale(scale,scale);
  ctx.strokeStyle='#e6ce99';ctx.lineWidth=1/scale;ctx.setLineDash([6/scale,4/scale]);
  ctx.beginPath();ctx.moveTo(210,MODULAR_FEET);ctx.lineTo(1000,MODULAR_FEET);ctx.stroke();ctx.setLineDash([]);
  ctx.font=`${10/scale}px sans-serif`;ctx.fillStyle='#f6e5b8';
  for(const [label,[x,y]]of [['มือขวา',pose.arms.right.grip],['มือซ้าย',pose.arms.left.grip],['คอเสื้อ',pose.neck]] as const){
   ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.stroke();ctx.fillText(label,x+20,y-12);
  }
 ctx.restore();
}
