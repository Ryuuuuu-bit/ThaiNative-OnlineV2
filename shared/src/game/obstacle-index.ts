import RBush from 'rbush';

export interface ObstacleCircle { x: number; z: number; r: number }
interface IndexedCircle extends ObstacleCircle {
 minX: number; minY: number; maxX: number; maxY: number;
}

const GRID_CELL = 4;
export const GRID_MAX_R = 2.5;

/** Static RBush broad phase, followed by the original strict circle intersection test. */
export function circleIndex(circles: readonly ObstacleCircle[]) {
 const tree = new RBush<IndexedCircle>();
 let indexedCount = -1;
 const rebuild = () => {
  tree.clear().load(circles.map(o => ({...o,minX:o.x-o.r,minY:o.z-o.r,maxX:o.x+o.r,maxY:o.z+o.r})));
  indexedCount = circles.length;
 };
 rebuild();
 return (x: number, z: number, r: number) => {
  // Map-review fixtures replace footprint lists in place. Rebuild only on a change,
  // retaining constant-time validation in the normal immutable-layout hot path.
  if (circles.length !== indexedCount) rebuild();
  const candidates = tree.search({minX:x-r,minY:z-r,maxX:x+r,maxY:z+r});
  for (const o of candidates) {
   if (Math.hypot(x-o.x,z-o.z)<o.r+r) return true;
  }
  return false;
 };
}

/** Existing meadow/forest hot path: faster than an R-tree for discs up to 2.5 m. */
export function circleGrid(circles: readonly ObstacleCircle[]) {
 const cells = new Map<number, ObstacleCircle[]>();
 const key = (cx: number, cz: number) => cx*4096+cz;
 for (const o of circles) {
  const reach=o.r+GRID_MAX_R;
  for(let cx=Math.floor((o.x-reach)/GRID_CELL);cx<=Math.floor((o.x+reach)/GRID_CELL);cx++)
   for(let cz=Math.floor((o.z-reach)/GRID_CELL);cz<=Math.floor((o.z+reach)/GRID_CELL);cz++) {
    const k=key(cx,cz),list=cells.get(k);
    if(list)list.push(o);else cells.set(k,[o]);
   }
 }
 return (x: number, z: number, r: number) => {
  const list=cells.get(key(Math.floor(x/GRID_CELL),Math.floor(z/GRID_CELL)));
  if(list)for(const o of list){const dx=x-o.x,dz=z-o.z,reach=o.r+r;if(dx*dx+dz*dz<reach*reach)return true;}
  return false;
 };
}
