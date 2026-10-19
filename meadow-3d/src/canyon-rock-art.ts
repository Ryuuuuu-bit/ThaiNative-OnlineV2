import type {CanvasAssets} from './game-2d-assets';

type RockArt={name:string;rect:number[];anchor:number[]};
type RockPoint={x:number;z:number;r?:number;kind?:string};
const root='/assets/canyon-painted-v1/';

/** Stable, spatially varied art selection; never changes authoritative collisions. */
export function canyonRockVariants(points:RockPoint[],count=9){
 const chosen:number[]=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],seed=Math.abs(Math.round(p.x*73+p.z*137));
  const group=p.kind==='canyon-crag'?[0,4,7]:p.kind==='canyon-outcrop'?[1,3,8]:p.kind==='canyon-scree'?[2,5,6]:Array.from({length:count},(_,n)=>n);
  let best=0,bestScore=-Infinity;
  for(let n=0;n<group.length;n++){
   const variant=group[(seed+n)%group.length];
   let nearest=40;
   for(let j=0;j<i;j++)if(chosen[j]===variant)nearest=Math.min(nearest,Math.hypot(p.x-points[j].x,p.z-points[j].z));
   const score=nearest-n*.001;
   if(score>bestScore){bestScore=score;best=variant;}
  }
  chosen.push(best);
 }
 return chosen;
}

export async function canyonRockProps(points:RockPoint[],assets:CanvasAssets){
 const manifest=await assets.json<{atlas:string;assets:RockArt[]}>(root+'manifest.json');
 const image=await assets.image(root+manifest.atlas),variants=canyonRockVariants(points,manifest.assets.length);
 return points.map((p,i)=>{
  const a=manifest.assets[variants[i]],w=p.kind==='canyon-crag'?8.5:p.kind==='canyon-outcrop'?5.8:p.kind==='canyon-scree'?3.8:Math.max(4,Math.min(8.5,(p.r??2)*2.9));
  // Preserve silhouette and native texel density; never inflate a tiny atlas crop.
  const h=w*a.rect[3]/a.rect[2];
  return {x:p.x,z:p.z,image,rect:a.rect,w,h,anchor:a.anchor};
 });
}
