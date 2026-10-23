import { MONSTER_MOTIONS } from './monster-motion-data.ts';
import monsterData from '../../shared/data/monsters.json' with {type:'json'};
import type { Enemy, MonsterMotion, SlimeVariant } from './sim.ts';
import { DIRECTIONS, facingFor } from './sprite-animation.ts';
export type MonsterSpecies='slime'|'king'|'shroom'|'wolf'|'wisp'|'stump'|'warden';
export const FOREST_SPECIES:Record<string,MonsterSpecies>={bud_shroom:'shroom',clay_puff:'slime',pebble_puff:'slime',amber_mantis:'wolf',dawn_owl:'wisp',grove_crown:'warden',moon_crab:'stump',frost_lynx:'wolf',moon_titan:'warden',ruin_shroom:'shroom',relic_hound:'wolf',relic_wisp:'wisp',ruin_guard:'stump',relic_warden:'warden',crag_slime:'slime',crag_wolf:'wolf',dust_wisp:'wisp',crag_guard:'stump',crag_titan:'warden',mist_shroom:'shroom',shade_wolf:'wolf',lantern_wisp:'wisp',stump_guard:'stump',mist_warden:'warden'};
const ART:Record<string,{id:string;scale:number}>=Object.fromEntries(monsterData.monsters.flatMap(m=>'artId'in m?[[m.id,{id:m.artId,scale:m.visualScale}]]:[]));
export function monsterVisual(dataId:string){return ART[dataId]??{id:dataId,scale:1};}
export function monsterSpecies(dataId?:string,boss=false):MonsterSpecies{return FOREST_SPECIES[monsterVisual(dataId||'').id]||(boss?'king':'slime');}
export const SPECIES_SCALE:Record<MonsterSpecies,number>={slime:.72,king:1,shroom:.72,wolf:.85,wisp:.7,stump:1,warden:1};
export const SPECIES_HIT_COLOUR:Record<MonsterSpecies,string>={slime:'#e1b0c1',king:'#ddb0c2',shroom:'#c6b1dc',wolf:'#8097b9',wisp:'#f5bf69',stump:'#a1b77e',warden:'#bbd2bc'};
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
