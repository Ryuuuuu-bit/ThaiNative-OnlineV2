import EasyStar from 'easystarjs';

export interface PathPoint { x: number; z: number }
type Walkable = (x: number, z: number) => boolean;
type Bounds = { halfX: number; halfZ: number };

/** Check between cells too, rather than just checking waypoint endpoints. */
export function pathSegmentWalkable(a: PathPoint, b: PathPoint, walk: Walkable) {
 const samples = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .15));
 for (let i = 0; i <= samples; i++) {
  const t = i / samples;
  if (!walk(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
 }
 return true;
}

const directions = [
 [-1, -1, EasyStar.TOP_LEFT], [0, -1, EasyStar.TOP], [1, -1, EasyStar.TOP_RIGHT],
 [-1, 0, EasyStar.LEFT], [1, 0, EasyStar.RIGHT],
 [-1, 1, EasyStar.BOTTOM_LEFT], [0, 1, EasyStar.BOTTOM], [1, 1, EasyStar.BOTTOM_RIGHT],
] as const;

/** One reusable lazy grid per map, in world x/z coordinates. */
export function createPathfinder(walk: Walkable, bounds: Bounds = { halfX: 64, halfZ: 64 }) {
 const halfX = Math.ceil(bounds.halfX), halfZ = Math.ceil(bounds.halfZ);
 const inside = (p: PathPoint) => Number.isFinite(p.x) && Number.isFinite(p.z)
  && Math.abs(p.x) <= halfX && Math.abs(p.z) <= halfZ;
 // Leave room for waypoint arrival tolerance, preserving the existing corner clearance.
 const clear = (x: number, z: number) => walk(x,z) && walk(x-.12,z) && walk(x+.12,z) && walk(x,z-.12) && walk(x,z+.12);
 let finder: EasyStar.js | undefined;
 let grid: number[][];
 const blockedEntries = new Map<string, Set<string>>();
 function prepare() {
  if (finder) return;
  grid = Array.from({ length: halfZ * 2 + 1 }, (_, z) =>
   Array.from({ length: halfX * 2 + 1 }, (_, x) => clear(x-halfX, z-halfZ) ? 0 : 1));
  finder = new EasyStar.js(); finder.setGrid(grid); finder.setAcceptableTiles([0]);
  finder.enableDiagonals(); finder.disableCornerCutting(); finder.enableSync();
 }
 function anchor(p: PathPoint) {
  const candidates: PathPoint[] = [];
  for (let z = Math.floor(p.z)-1; z <= Math.ceil(p.z)+1; z++) {
   for (let x = Math.floor(p.x)-1; x <= Math.ceil(p.x)+1; x++) {
    if (inside({x,z}) && grid[z+halfZ][x+halfX] === 0) candidates.push({x,z});
   }
  }
  candidates.sort((a,b) => Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
  return candidates.find(candidate => pathSegmentWalkable(p,candidate,walk));
 }
 function smooth(start: PathPoint, points: PathPoint[]) {
  const result: PathPoint[] = [];
  let current = start, next = 0;
  while (next < points.length) {
   let farthest = next;
   // Bounded look-ahead avoids quadratic work on winding paths.
   for (let i = Math.min(points.length-1,next+24); i > next; i--) {
    if (pathSegmentWalkable(current,points[i],clear)) { farthest=i; break; }
   }
   if (!pathSegmentWalkable(current,points[farthest],walk)) return [];
   if (Math.hypot(points[farthest].x-current.x,points[farthest].z-current.z) > .001) {
    current=points[farthest]; result.push(current);
   }
   next=farthest+1;
  }
  return result;
 }
 return {
  findPath(start: PathPoint, goal: PathPoint): PathPoint[] {
   if (!inside(start)||!inside(goal)||!walk(start.x,start.z)||!walk(goal.x,goal.z)) return [];
   if (pathSegmentWalkable(start,goal,walk)) return [{x:goal.x,z:goal.z}];
   prepare();
   const from=anchor(start),to=anchor(goal);
   if (!from||!to) return [];
   // EasyStar returns an empty list for equal cells; fractional endpoints may
   // still need to travel via that shared anchor to get around a small prop.
   if (from.x===to.x&&from.z===to.z) return smooth(start,[from,{x:goal.x,z:goal.z}]);
   // Validate edges lazily instead of precomputing every possible map edge.
   for (let attempt=0; attempt<32; attempt++) {
    const result: { nodes: {x:number;y:number}[] | null } = {nodes:null};
    finder!.findPath(from.x+halfX,from.z+halfZ,to.x+halfX,to.z+halfZ,path=>{result.nodes=path;});
    finder!.calculate();
    const nodes=result.nodes;
    if (!nodes?.length) return [];
    const points=nodes.map(node=>({x:node.x-halfX,z:node.y-halfZ}));
    let invalid=false;
    for (let i=1;i<points.length;i++) {
     const a=points[i-1],b=points[i];
     if (pathSegmentWalkable(a,b,walk)) continue;
     const direction=directions.find(([x,z])=>x===a.x-b.x&&z===a.z-b.z)![2];
     const key=`${b.x},${b.z}`,blocked=blockedEntries.get(key)??new Set<string>();
     blocked.add(direction);blockedEntries.set(key,blocked);
     finder!.setDirectionalCondition(b.x+halfX,b.z+halfZ,directions.map(d=>d[2]).filter(d=>!blocked.has(d)));
     invalid=true;
    }
    if (!invalid) return smooth(start,[...points,{x:goal.x,z:goal.z}]);
   }
   return [];
  },
 };
}

/** Stateless helper for map tools and regression tests. */
export function gridPath(start: PathPoint,goal: PathPoint,walk: Walkable) {
 return createPathfinder(walk).findPath(start,goal);
}
