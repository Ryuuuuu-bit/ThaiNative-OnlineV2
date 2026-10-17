export interface Rect { left:number; top:number; right:number; bottom:number }
export const overlaps=(a:Rect,b:Rect,gap=3)=>a.left<b.right+gap&&a.right>b.left-gap&&a.top<b.bottom+gap&&a.bottom>b.top-gap;
export function nameplateCandidates(enemies:readonly {id:number;x:number;z:number;dead?:boolean}[],p:{x:number;z:number},target:number|null,hover:number|null){
 return enemies.filter(e=>!e.dead&&(e.id===target||e.id===hover||Math.hypot(e.x-p.x,e.z-p.z)<=5))
  .sort((a,b)=>Number(b.id===target)-Number(a.id===target)||Number(b.id===hover)-Number(a.id===hover)||Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)||a.id-b.id).slice(0,4).map(e=>e.id);
}
