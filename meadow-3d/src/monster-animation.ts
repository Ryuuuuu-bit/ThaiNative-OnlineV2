import { MONSTER_MOTIONS } from './monster-motion-data.ts';
import type { Enemy, MonsterMotion, SlimeVariant } from './sim.ts';
import { DIRECTIONS, facingFor } from './sprite-animation.ts';
export type MonsterSpecies='slime'|'king';
export const VARIANT_HUE:Record<SlimeVariant,number>={pink:0,mint:.45,sky:.61};
export function monsterFrame(species:MonsterSpecies,motion:MonsterMotion,elapsed:number){
 const def=(MONSTER_MOTIONS[species] as any)[motion]||(MONSTER_MOTIONS[species] as any).idle;
 let t=Math.max(0,elapsed);if(def.loop)t%=def.duration;
 for(let i=0;i<def.frameDurations.length;i++){if(t<def.frameDurations[i]-1e-9)return i;t-=def.frameDurations[i];}return def.frames-1;
}
export function monsterCell(species:MonsterSpecies,motion:MonsterMotion,x:number,z:number,elapsed:number){
 const definition=(MONSTER_MOTIONS[species] as any)[motion]||(MONSTER_MOTIONS[species] as any).idle;
 const direction=facingFor(x,z);return{direction,row:DIRECTIONS.indexOf(direction),column:monsterFrame(species,motion,elapsed),columns:definition.frames,rows:4};
}
export function monsterOpacity(e:Pick<Enemy,'boss'|'dead'|'deathAge'>){if(!e.dead)return 1;const hold=e.boss?3.8:1.3;return Math.max(0,1-Math.max(0,e.deathAge-hold)/.7);}
