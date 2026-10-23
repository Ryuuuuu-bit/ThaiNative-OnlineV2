import type { PathPoint } from '@the-beginning-online/shared/pathfinding';
export { createPathfinder, createPlayerPathfinder, gridPath, pathSegmentWalkable, type PathPoint } from '@the-beginning-online/shared/pathfinding';

/** Portals sit on the map border; stand one metre inside their activation radius. */
export function gateApproach(p: PathPoint) {
 return { x: p.x - Math.sign(p.x), z: p.z - Math.sign(p.z) };
}

/** Follow server-confirmed positions; retry a stalled route twice before reporting failure. */
export function createTravelRoute(findPath: (from: PathPoint, to: PathPoint) => PathPoint[]) {
 let points: PathPoint[] = [], goal: PathPoint | null = null, progress: PathPoint = {x:0,z:0}, since = 0, retries = 0;
 return {
  get points() { return points; },
  start(from: PathPoint, to: PathPoint, now: number) {
   goal = {...to}; progress = {...from}; since = now; retries = 0;
   points = findPath(from,to);
   if (!points.length) goal = null;
   return points.length > 0;
  },
  clear() { points = []; goal = null; },
  update(from: PathPoint, now: number): 'idle' | 'moving' | 'arrived' | 'blocked' {
   if (!goal) return 'idle';
   while (points.length && Math.hypot(from.x-points[0].x,from.z-points[0].z)<.18) {
    points.shift(); progress = {...from}; since = now;
   }
   if (!points.length) { goal = null; return 'arrived'; }
   if (Math.hypot(from.x-progress.x,from.z-progress.z)>.25) { progress = {...from}; since = now; }
   if (now-since>3000) {
    since = now;
    if (++retries>2) { this.clear(); return 'blocked'; }
    points = findPath(from,goal);
    if (!points.length) { this.clear(); return 'blocked'; }
   }
   return 'moving';
  },
 };
}
