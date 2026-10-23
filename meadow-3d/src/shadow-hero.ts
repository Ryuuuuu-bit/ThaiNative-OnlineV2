import {z} from 'zod';
import {facing8For,WALK_DIRECTIONS,type Facing} from './sprite-animation.ts';
import {HERO_BODY_PIXELS} from './world-scale.ts';
import type {CanvasAssets} from './game-2d-assets';

export const SHADOW_LOOKS=['male-iron','male-bow','female-iron','female-bow'] as const;
export const SHADOW_MOTIONS=['idle','walk','attack','cast','hit','dodge','death'] as const;
export type ShadowLook=typeof SHADOW_LOOKS[number];
export type ShadowMotion=typeof SHADOW_MOTIONS[number];
const positive=z.number().finite().positive();
const anchor=z.object({x:positive,y:positive,height:positive});
const clip=z.object({
 url:z.string().regex(/^\/assets\/hero-shadow-8dir-v1\/[\w-]+\.webp$/),
 size:positive.int(),frames:positive.int(),seconds:positive,
 anchors:z.record(z.enum(WALK_DIRECTIONS),anchor),
}).refine(c=>Object.values(c.anchors).every(a=>a.x<c.size&&a.y<=c.size&&a.height<=c.size));
export const shadowClipSchema=clip;
export type ShadowClip=z.infer<typeof clip>;
const schema=z.object({version:z.literal(1),looks:z.record(z.enum(SHADOW_LOOKS),z.record(z.enum(SHADOW_MOTIONS),clip))});
export type ShadowManifest=z.infer<typeof schema>;
export const parseShadowManifest=(value:unknown)=>schema.parse(value);

export function shadowPose<Look extends ShadowLook,Motion extends ShadowMotion>(manifest:{looks:Record<Look,Record<Motion,ShadowClip>>},look:Look,motion:Motion,facing:Facing,time:number,loop=true){
 const clip=manifest.looks[look][motion],anchor=clip.anchors[facing];
 const progress=Math.floor(Math.max(0,Number.isFinite(time)?time:0)/clip.seconds*clip.frames);
 const frame=loop?progress%clip.frames:Math.min(clip.frames-1,progress);
 return{key:clip.url,cell:{column:frame,row:WALK_DIRECTIONS.indexOf(facing),columns:clip.frames,rows:8},w:clip.size,h:clip.size,feet:anchor.y,anchorX:anchor.x/clip.size,scale:HERO_BODY_PIXELS/anchor.height};
}

/** The scene trial uses the same renderer; only this explicit attachment changes its hero art. */
export class ShadowHero{
 look:ShadowLook='male-iron';motion:ShadowMotion|undefined;clock=0;
 combat=false;outfit:'male'|'female'='male';playerId='';
 action?:{motion:'attack'|'cast';elapsed:number;duration:number};
 reaction?:{motion:'hit'|'dodge'|'death';elapsed:number;facing:Facing};
 private hurt=0;private dash=0;
 readonly manifest:ShadowManifest;
 constructor(manifest:ShadowManifest){this.manifest=manifest;}
 event(e:any){
  if(!this.combat||e.playerId!==this.playerId||e.autoSpell)return;
  if(e.type==='skillCancel'){this.action=undefined;return;}
  if(e.type==='slash'||e.type==='bowShot')this.action={motion:'attack',elapsed:0,duration:.34};
  if(e.type==='skill')this.action={motion:/^(archer|rogue|boxer)_/.test(e.learnedSkill??e.skillId)?'attack':'cast',elapsed:0,duration:Math.max(.1,e.duration||.4)};
 }
 combatPose(p:{id:string;fx:number;fz:number;dead:boolean;hurt:number;dash?:number;moving:boolean;castRemaining?:number;stats?:{weaponType?:string}},dt:number){
  if(this.playerId&&this.playerId!==p.id){this.action=undefined;this.reaction=undefined;this.hurt=this.dash=0;}
  this.playerId=p.id;this.look=`${this.outfit}-${p.stats?.weaponType==='bow'?'bow':'iron'}`;
  // shortcut: non-bow weapons share the armored combat art until their own weapon sheets are authored.
  this.clock+=dt;
  const reaction=p.dead?'death':p.hurt>0?'hit':(p.dash??0)>0?'dodge':undefined;
  const repeated=reaction==='hit'?p.hurt>this.hurt+.05:reaction==='dodge'&&(p.dash??0)>this.dash+.05;
  if(reaction){
   if(this.reaction?.motion!==reaction||repeated)this.reaction={motion:reaction,elapsed:0,facing:facing8For(p.fx,p.fz)};
   else this.reaction.elapsed+=dt;
  }else this.reaction=undefined;
  this.hurt=p.hurt;this.dash=p.dash??0;
  if(this.action){this.action.elapsed+=dt;if(this.action.elapsed>=this.action.duration||reaction)this.action=undefined;}
  const action=this.action,motion=reaction??action?.motion??(p.castRemaining?'cast':p.moving?'walk':'idle');
  const clip=this.manifest.looks[this.look][motion];
  const time=this.reaction?this.reaction.elapsed/({hit:.3,dodge:.22,death:1.1}[this.reaction.motion])*clip.seconds:action?action.elapsed/action.duration*clip.seconds:this.clock;
  return shadowPose(this.manifest,this.look,motion,this.reaction?.facing??facing8For(p.fx,p.fz),time,!action&&!reaction);
 }
 async load(assets:CanvasAssets,look:ShadowLook){
  await Promise.all(Object.values(this.manifest.looks[look]).map(c=>assets.image(c.url)));
  const previous=this.look;this.look=look;
  if(previous!==look)for(const c of Object.values(this.manifest.looks[previous]))assets.release(c.url);
 }
 pose(motion:string,fx:number,fz:number,time:number){
  const selected=this.motion??(motion==='run'?'walk':motion);
  if(!SHADOW_MOTIONS.includes(selected as ShadowMotion))return undefined;
  return shadowPose(this.manifest,this.look,selected as ShadowMotion,facing8For(fx,fz),this.motion?this.clock:time,selected!=='death'&&(!!this.motion||selected==='idle'||selected==='walk'));
 }
}
