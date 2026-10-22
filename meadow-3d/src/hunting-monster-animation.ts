import {isFrostEnemy,isYokaiEnemy} from '@the-beginning-online/shared';
import {DIRECTIONS,facingFor} from './sprite-animation.ts';

export const HUNTING_ASSET_ROOT='/assets/monsters-hunting/';
export const EXPANSION_ASSET_ROOT='/assets/monsters-expansion-v1/';
type State={dataId?:string;motion:string;motionTime:number;motionDuration:number;fx:number;fz:number;dead?:boolean;hurt?:number;boss?:boolean};
/** Impact times are simulation-clock seconds, so boss phase acceleration is already applied. */
const impact:Record<string,number>={slam:.85,sweep:.7,charge:.8,spit:.8,summon:.9};
export function huntingCell(e:State,attackWindup=.5,columns=6){
 let motion='idle',time=Math.max(0,e.motionTime),duration=e.motionDuration||1.8,loop=false;
 if(e.dead||e.motion==='death'){motion='death';duration=e.boss?1.8:.75;}
 else if(e.motion==='attack'||e.motion in impact){
  motion='attack';const strike=e.motion==='attack'?((e.dataId?.startsWith('himmapan_')||e.dataId?.startsWith('desert_')||isFrostEnemy(e.dataId??'')||isYokaiEnemy(e.dataId??'')||/^(dragon|volcano|fae|ocean|astral|abyss|confluence)_/.test(e.dataId??''))?Math.max(.1,e.motionDuration-.7):attackWindup):impact[e.motion];
  // The second half starts at contact, synchronized with the authoritative strike.
  const contact=Math.floor(columns/2);
  const column=time<strike?Math.min(contact-1,Math.floor(time/strike*contact)):Math.min(columns-1,contact+Math.floor((time-strike)/Math.max(.05,duration-strike)*(columns-contact)));
  return{motion,column,row:DIRECTIONS.indexOf(facingFor(e.fx,e.fz))};
 }else if(e.motion==='hit'||e.motion==='stun'){motion='hit';}
 else if((e.hurt??0)>0){motion='hit';duration=.18;time=Math.max(0,.18-e.hurt!);}
 else if(e.motion==='hop'||e.motion==='move'){motion='move';duration=e.boss?.9:.6;loop=true;}
 else{duration=1.8;loop=true;}
 const progress=time/duration;
 return{motion,column:loop?Math.floor(progress*columns)%columns:Math.min(columns-1,Math.floor(progress*columns)),row:DIRECTIONS.indexOf(facingFor(e.fx,e.fz))};
}
