import {DIRECTIONS,facingFor} from './sprite-animation.ts';

export const HUNTING_ASSET_ROOT='/assets/monsters-hunting/';
type State={motion:string;motionTime:number;motionDuration:number;fx:number;fz:number;dead?:boolean;hurt?:number;boss?:boolean};
/** Impact times are simulation-clock seconds, so boss phase acceleration is already applied. */
const impact:Record<string,number>={slam:.85,sweep:.7,charge:.8,spit:.8,summon:.9};
export function huntingCell(e:State,attackWindup=.5){
 let motion='idle',time=Math.max(0,e.motionTime),duration=e.motionDuration||1.8,loop=false;
 if(e.dead||e.motion==='death'){motion='death';duration=e.boss?1.8:.75;}
 else if(e.motion==='attack'||e.motion in impact){
  motion='attack';const strike=e.motion==='attack'?attackWindup:impact[e.motion];
  // Frame 4 is contact: never display it before the authoritative impact threshold.
  const column=time<strike?Math.min(2,Math.floor(time/strike*3)):Math.min(5,3+Math.floor((time-strike)/Math.max(.05,duration-strike)*3));
  return{motion,column,row:DIRECTIONS.indexOf(facingFor(e.fx,e.fz))};
 }else if(e.motion==='hit'||e.motion==='stun'){motion='hit';}
 else if((e.hurt??0)>0){motion='hit';duration=.18;time=Math.max(0,.18-e.hurt!);}
 else if(e.motion==='hop'||e.motion==='move'){motion='move';duration=e.boss?.9:.6;loop=true;}
 else{duration=1.8;loop=true;}
 const progress=time/duration;
 return{motion,column:loop?Math.floor(progress*6)%6:Math.min(5,Math.floor(progress*6)),row:DIRECTIONS.indexOf(facingFor(e.fx,e.fz))};
}
