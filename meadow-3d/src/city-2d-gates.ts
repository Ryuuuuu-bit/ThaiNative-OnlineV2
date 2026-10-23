import {project} from './city-2d-sim.ts';
import calibration from '../art/city-sprite-v2/fortification-calibration.json' with {type:'json'};

export const CITY_GATES=[
  {id:'south',axis:'x',x:0,z:47,name:'ประตูทุ่งวุ้นจิ๋ว'},
  {id:'north',axis:'x',x:0,z:-47,name:'ประตูเหนือ'},
  {id:'east',axis:'z',x:47,z:0,name:'ประตูป่าหมอก'},
  {id:'west',axis:'z',x:-47,z:0,name:'ประตูตะวันตก'},
] as const;

// Gates retain their painted proportions; only repeating wall panels fit both endpoints.
export function fortificationTransform(kind:'wall'|'gate',facing:0|1|2|3,length:number){
  if(!Number.isFinite(length)||length<=0)throw Error('Invalid fortification length');
  const {a,b,rise}=calibration[kind][facing];
  const from=facing%2?project(0,length/2):project(-length/2,0);
  const to=facing%2?project(0,-length/2):project(length/2,0);
  if(kind==='gate'){
    const scale=Math.hypot(to.x-from.x,to.y-from.y)/Math.hypot(b[0]-a[0],b[1]-a[1]);
    return {a,b,from,to,sx:scale,sy:scale,skew:0,tx:-scale*(a[0]+b[0])/2,ty:-scale*(a[1]+b[1])/2};
  }
  const sx=(to.x-from.x)/(b[0]-a[0]),sy=.82*3/rise;
  const skew=(to.y-from.y-sy*(b[1]-a[1]))/(b[0]-a[0]);
  return {a,b,from,to,sx,sy,skew,tx:from.x-sx*a[0],ty:from.y-skew*a[0]-sy*a[1]};
}

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
