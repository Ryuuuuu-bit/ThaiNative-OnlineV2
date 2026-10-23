import {AnimatedSprite,Spritesheet,Texture,type SpritesheetData} from 'pixi.js';
import type {CanvasAssets} from './game-2d-assets';
import {drawModularHero,type HeroLook} from './modular-hero.ts';
import {MODULAR_MOTIONS,type ModularMotion} from './modular-hero-motion.ts';

export const HERO_SHEET={size:640,bodyHeight:400,feet:580,columns:4} as const;
export function modularSheetData(motion:ModularMotion):SpritesheetData{
 const count=MODULAR_MOTIONS[motion].frames,{size,columns}=HERO_SHEET;
 const names=Array.from({length:count},(_,i)=>motion+'-'+i),width=Math.min(columns,count)*size,height=Math.ceil(count/columns)*size;
 return{frames:Object.fromEntries(names.map((name,i)=>[name,{
  frame:{x:i%columns*size,y:Math.floor(i/columns)*size,w:size,h:size},trimmed:false,rotated:false,
  sourceSize:{w:size,h:size},spriteSourceSize:{x:0,y:0,w:size,h:size},
 }])),animations:{[motion]:names},meta:{scale:1,size:{w:width,h:height}}};
}

/** Pixi owns atlas slicing and playback; the game's Canvas2D renderer reads its current texture. */
export class ModularHeroSheet{
 readonly canvas=document.createElement('canvas');
 readonly sheet:Spritesheet;
 readonly sprite:AnimatedSprite;
 constructor(assets:CanvasAssets,look:HeroLook,motion:ModularMotion){
  const data=modularSheetData(motion),{size,feet,bodyHeight}=HERO_SHEET;
  this.canvas.width=data.meta.size!.w;this.canvas.height=data.meta.size!.h;
  const ctx=this.canvas.getContext('2d');if(!ctx)throw Error('Canvas 2D unavailable');
  for(const [i,{frame}]of Object.values(data.frames).entries()){
   ctx.save();ctx.beginPath();ctx.rect(frame.x,frame.y,size,size);ctx.clip();ctx.translate(frame.x,frame.y);
   drawModularHero(ctx,assets,look,size/2,feet,bodyHeight,false,motion,i);ctx.restore();
  }
  this.sheet=new Spritesheet({texture:Texture.from(this.canvas,true),data,cachePrefix:'modular-preview-'});
  this.sheet.parseSync();
  const time=MODULAR_MOTIONS[motion].seconds*1000/MODULAR_MOTIONS[motion].frames;
  this.sprite=new AnimatedSprite({textures:this.sheet.animations[motion].map(texture=>({texture,time})),autoUpdate:false,loop:true});
 }
 draw(ctx:CanvasRenderingContext2D,x:number,feetY:number,bodyHeight:number){
  const {x:sx,y:sy,width,height}=this.sprite.texture.frame,scale=bodyHeight/HERO_SHEET.bodyHeight;
  ctx.drawImage(this.canvas,sx,sy,width,height,x-HERO_SHEET.size/2*scale,feetY-HERO_SHEET.feet*scale,width*scale,height*scale);
 }
 destroy(){this.sprite.destroy();this.sheet.destroy(true);this.canvas.width=0;this.canvas.height=0;}
}
