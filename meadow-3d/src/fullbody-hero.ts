import {AnimatedSprite,Spritesheet,Texture,type SpritesheetData} from 'pixi.js';
import {z} from 'zod';

export const FULLBODY_MOTIONS={idle:'ยืน',walk:'เดิน',attack:'โจมตี',cast:'ร่ายเวท',heal:'ฮีล'} as const;
export type FullBodyMotion=keyof typeof FULLBODY_MOTIONS;
export type HeroLook={outfit:'male'|'female';sword:'iron'|'bow'};
export const FULLBODY_LOOKS=['male-iron','male-bow','female-iron','female-bow'] as const;
export function fullBodyLookKey(look:HeroLook){return `${look.outfit}-${look.sword}` as typeof FULLBODY_LOOKS[number];}

const positive=z.number().finite().positive();
const clipSchema=z.object({
 url:z.string().refine(value=>/^\/assets\/hero-shadow-v1\/[\w./-]+$/.test(value)&&!value.includes('..')),
 cell:z.tuple([positive.int(),positive.int()]),columns:positive.int(),frames:positive.int(),seconds:positive,
 anchor:z.tuple([z.number().finite().nonnegative(),z.number().finite().nonnegative()]),bodyHeight:positive,
 bounds:z.tuple([z.number().finite().nonnegative(),z.number().finite().nonnegative(),positive,positive]).optional(),
 impactFrame:z.number().int().nonnegative().optional(),
}).refine(c=>c.anchor[0]<=c.cell[0]&&c.anchor[1]<=c.cell[1]&&c.bodyHeight<=c.cell[1]&&(c.impactFrame===undefined||c.impactFrame<c.frames)&&
 (!c.bounds||(c.bounds[0]<c.bounds[2]&&c.bounds[1]<c.bounds[3]&&c.bounds[2]<=c.cell[0]&&c.bounds[3]<=c.cell[1])),'Invalid frame geometry or impact');
const lookSchema=z.object({label:z.string().min(1),clips:z.object({idle:clipSchema,walk:clipSchema,attack:clipSchema,cast:clipSchema,heal:clipSchema})})
 .refine(look=>['attack','cast','heal'].every(motion=>look.clips[motion].frames>1&&look.clips[motion].impactFrame>0),'Action clips need a release after anticipation');
const manifestSchema=z.object({version:z.literal(2),looks:z.object({'male-iron':lookSchema,'male-bow':lookSchema,'female-iron':lookSchema,'female-bow':lookSchema})});
export type FullBodyClip=z.infer<typeof clipSchema>;
export type FullBodyManifest=z.infer<typeof manifestSchema>;
export function parseFullBodyManifest(value:unknown):FullBodyManifest{return manifestSchema.parse(value);}

/** One envelope for every look and motion keeps scale and ground position stable. */
export function fullBodyLayout(manifest:FullBodyManifest,width:number,height:number){
 const clips=Object.values(manifest.looks).flatMap(look=>Object.values(look.clips));
 const left=Math.max(0,...clips.map(c=>(c.anchor[0]-(c.bounds?.[0]??0))/c.bodyHeight)),right=Math.max(0,...clips.map(c=>((c.bounds?.[2]??c.cell[0])-c.anchor[0])/c.bodyHeight));
 const up=Math.max(0,...clips.map(c=>(c.anchor[1]-(c.bounds?.[1]??0))/c.bodyHeight)),down=Math.max(0,...clips.map(c=>((c.bounds?.[3]??c.cell[1])-c.anchor[1])/c.bodyHeight));
 const bodyHeight=Math.max(0,Math.min(height*.65,(width-24)/(left+right),(height-56)/(up+down)));
 return{bodyHeight,x:(width+(left-right)*bodyHeight)/2,feetY:40+(height-56-(up+down)*bodyHeight)/2+up*bodyHeight};
}

export function fullBodyFrame(clip:FullBodyClip,frame:number){
 const index=Math.max(0,Math.min(clip.frames-1,Math.floor(Number.isFinite(frame)?frame:0)));
 return{x:index%clip.columns*clip.cell[0],y:Math.floor(index/clip.columns)*clip.cell[1],w:clip.cell[0],h:clip.cell[1]};
}
export function fullBodySheetData(clip:FullBodyClip,width=clip.columns*clip.cell[0],height=Math.ceil(clip.frames/clip.columns)*clip.cell[1]):SpritesheetData{
 if(width!==clip.columns*clip.cell[0]||height<Math.ceil(clip.frames/clip.columns)*clip.cell[1])throw Error('ขนาดภาพไม่ตรงกับข้อมูลเฟรม');
 const names=Array.from({length:clip.frames},(_,i)=>'frame-'+i),[w,h]=clip.cell;
 return{frames:Object.fromEntries(names.map((name,i)=>[name,{frame:fullBodyFrame(clip,i),trimmed:false,rotated:false,sourceSize:{w,h},spriteSourceSize:{x:0,y:0,w,h}}])),animations:{clip:names},meta:{scale:1,size:{w:width,h:height}}};
}
export function drawFullBodyFrame(ctx:CanvasRenderingContext2D,image:CanvasImageSource,clip:FullBodyClip,frame:number,x:number,feetY:number,bodyHeight:number){
 const source=fullBodyFrame(clip,frame),scale=bodyHeight/clip.bodyHeight;
 ctx.drawImage(image,source.x,source.y,source.w,source.h,x-clip.anchor[0]*scale,feetY-clip.anchor[1]*scale,source.w*scale,source.h*scale);
}

/** Every texture is an intact authored pose. Only the whole frame is scaled. */
export class FullBodyHeroSheet{
 readonly clip:FullBodyClip;
 readonly image:HTMLImageElement;
 readonly sheet:Spritesheet;
 readonly sprite:AnimatedSprite;
 constructor(image:HTMLImageElement,clip:FullBodyClip){
  this.image=image;this.clip=clip;
  const data=fullBodySheetData(clip,image.naturalWidth,image.naturalHeight);
  this.sheet=new Spritesheet({texture:Texture.from(image,true),data,cachePrefix:'fullbody-preview-'});this.sheet.parseSync();
  this.sprite=new AnimatedSprite({textures:this.sheet.animations.clip.map(texture=>({texture,time:clip.seconds*1000/clip.frames})),autoUpdate:false,loop:true});
 }
 draw(ctx:CanvasRenderingContext2D,x:number,feetY:number,bodyHeight:number){drawFullBodyFrame(ctx,this.image,this.clip,this.sprite.currentFrame,x,feetY,bodyHeight);}
 destroy(){this.sprite.destroy();this.sheet.destroy(true);}
}
