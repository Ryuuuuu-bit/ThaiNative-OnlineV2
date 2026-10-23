import {MasteryVfx2D} from './mastery-vfx-2d.ts';
import type {FullBodyClip,FullBodyMotion,HeroLook} from './fullbody-hero.ts';

type Point={x:number;y:number};
export type PreviewShot={from:Point;to:Point};
export function previewBowPath(outfit:HeroLook['outfit'],clip:FullBodyClip,layout:{x:number;feetY:number;bodyHeight:number},width:number):PreviewShot{
 // shortcut: sockets measured on the approved SE release poses; author per-direction sockets before gameplay integration.
 const socket=outfit==='male'?[374,154]:[376,156],scale=layout.bodyHeight/clip.bodyHeight;
 const from={x:layout.x+(socket[0]*clip.cell[0]/512-clip.anchor[0])*scale,y:layout.feetY+(socket[1]*clip.cell[1]/512-clip.anchor[1])*scale};
 const distance=Math.max(0,Math.min(layout.bodyHeight*.55,width-18-from.x));
 return{from,to:{x:from.x+distance,y:from.y+distance*.32}};
}
export function previewArrowPosition(shot:PreviewShot,progress:number){
 const t=Math.max(0,Math.min(1,progress));
 return{x:shot.from.x+(shot.to.x-shot.from.x)*t,y:shot.from.y+(shot.to.y-shot.from.y)*t,angle:Math.atan2(shot.to.y-shot.from.y,shot.to.x-shot.from.x)};
}

/** Preview events only; production proc decisions remain on the server. */
export class EquipmentPreviewSpells{
 readonly vfx=new MasteryVfx2D();
 attacks=0;procs=0;
 target={x:1.1,z:0};
 arrow:(PreviewShot&{at:number})|undefined;
 shoot(path:PreviewShot){this.arrow={from:{...path.from},to:{...path.to},at:this.vfx.time};}
 advance(dt:number){this.vfx.advance(dt);if(this.arrow&&this.vfx.time-this.arrow.at>.48)this.arrow=undefined;}
 start(motion:'cast'|'heal'){
  this.vfx.event({type:'skill',skillId:motion==='heal'?'healer_01':'mage_01',playerId:'preview',x:0,z:0,dx:1,dz:0});
 }
 frame(motion:FullBodyMotion,weapon:HeroLook['sword'],previous:number,current:number,auto:boolean,impact:number|undefined){
  if(motion==='idle'||motion==='walk'||impact===undefined)return null;
  const crossed=previous<current?previous<impact&&current>=impact:current<previous&&(impact>previous||impact<=current);
  if(!crossed)return null;
  if(motion==='attack'){
   this.attacks++;
   // The preview draws the arrow from its authored bow socket, not the generic body-centred hit ray.
   // shortcut: deterministic every-second-hit demo; use server Auto Spell events when integrating into gameplay.
   if(!auto||this.attacks%2)return null;
   this.procs++;
  }
  const heal=motion==='heal';
  this.vfx.event({type:heal?'skillImpact':'hit',skillId:heal?'healer_01':'mage_01',playerId:'preview',id:1,x:heal?0:this.target.x,z:heal?0:this.target.z});
  return motion==='attack'?'auto':motion;
 }
}
