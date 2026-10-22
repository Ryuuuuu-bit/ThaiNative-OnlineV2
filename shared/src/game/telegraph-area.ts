import type {BossTelegraph} from './sim.js';
/** The shared area rule used by all authored boss and regional encounters. */
export function telegraphContains(t:Pick<BossTelegraph,'shape'|'x'|'z'|'fx'|'fz'|'radius'|'inner'|'angle'>,x:number,z:number){
 const dx=x-t.x,dz=z-t.z,d=Math.hypot(dx,dz);
 if(d>t.radius)return false;
 if(t.shape==='ring')return d>=t.inner;
 if(t.shape==='cone')return d<.6||(dx*t.fx+dz*t.fz)/d>=Math.cos(t.angle/2*Math.PI/180);
 return true;
}
