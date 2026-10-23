import {heroSprite,motionFrame,frameCount,MOTION_V2,v2Cell,facingFor,facing8For,WALK_FRAMES,DIRECTIONS,IDLE_V2_FRAMES,IDLE_V2_SECONDS,type Motion,type Facing} from './sprite-animation.ts';
import {heroBodyCalibration} from './city-character-calibration.ts';

/** Shared by the game and previews, including cardinal standing poses and foot calibration. */
export function heroPresentation(motion:Motion,fx:number,fz:number,elapsed:number,frame?:number){
 const sprite=heroSprite(motion,fx,fz,frame??motionFrame(motion,elapsed),frame===undefined?elapsed:undefined);
 const base=MOTION_V2[sprite.sheet];
 const cell=base?v2Cell(sprite.sheet,facingFor(fx,fz),sprite.cell.column,frame!==undefined&&sprite.sheet==='idle'?frame*IDLE_V2_SECONDS/IDLE_V2_FRAMES:elapsed):sprite.cell;
 const px=base??{w:384,h:256,feet:240},calibration=heroBodyCalibration(sprite.sheet,facing8For(fx,fz),cell.column,cell.row);
 return{sheet:sprite.sheet,cell,key:`/assets/hero-painted/hero-${sprite.sheet}-${base?'v2':'v1'}.png`,...px,feet:calibration?.feet??px.feet,scale:calibration?.scale??1};
}
export function previewFrameCount(motion:Motion,facing:Facing){
 if(motion==='walk')return WALK_FRAMES[facing];
 if(motion==='idle')return (DIRECTIONS as readonly string[]).includes(facing)?IDLE_V2_FRAMES:1;
 return frameCount(motion);
}
export const PREVIEW_FACING:Record<Facing,readonly [number,number]>={SE:[22,4],SW:[-4,22],NE:[4,-22],NW:[-22,-4],S:[9,13],E:[13,-9],N:[-9,-13],W:[-13,9]};
