import type { PathPoint } from '@the-beginning-online/shared/pathfinding';
export { createPathfinder, createPlayerPathfinder, gridPath, pathSegmentWalkable, type PathPoint } from '@the-beginning-online/shared/pathfinding';

/** Portals sit on the map border; stand one metre inside their activation radius. */
export function gateApproach(p: PathPoint) {
 return { x: p.x - Math.sign(p.x), z: p.z - Math.sign(p.z) };
}
