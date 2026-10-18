import {project} from './city-2d-sim.ts';

export const CITY_GATES=[
  {id:'south',axis:'x',x:0,z:47,name:'ประตูทุ่งวุ้นจิ๋ว'},
  {id:'north',axis:'x',x:0,z:-47,name:'ประตูเหนือ'},
  {id:'east',axis:'z',x:47,z:0,name:'ประตูป่าหมอก'},
  {id:'west',axis:'z',x:-47,z:0,name:'ประตูตะวันตก'},
] as const;

// Each facade is painted for its camera direction. Preserve the complete image's
// aspect ratio: fitting width and height separately squashes roofs and arches.
// Tower footprints overlap the wall ends to absorb small painted perspective offsets.
export function gateTransform(axis:'x'|'z'){
  const [a,b]=axis==='x'?[[176,825],[419,927]]:[[380,1320],[800,790]];
  const from=axis==='x'?project(-4,0):project(0,4);
  const to=axis==='x'?project(4,0):project(0,-4);
  const scale=Math.hypot(to.x-from.x,to.y-from.y)/Math.hypot(b[0]-a[0],b[1]-a[1]);
  return {a,b,from,to,sx:scale,sy:scale,skew:0,tx:-scale*(a[0]+b[0])/2,ty:-scale*(a[1]+b[1])/2};
}
