import { CITY_SPAWN } from '@thainative/shared/maps';
import {city2dWalkable as cityWalkable} from './city-2d-layout.ts';

// A local exploration simulation. No network, inventory, or save mutations.
export const project = (x: number, z: number, h = 0) => ({ x: .83205 * x - .5547 * z, y: .39223 * x + .58835 * z - .82 * h });
export function unproject(x: number, y: number) {
  const det = .83205 * .58835 + .5547 * .39223;
  return { x: (.58835 * x + .5547 * y) / det, z: (-.39223 * x + .83205 * y) / det };
}
export function createCityExplorer() {
  const player = { ...CITY_SPAWN, fx: 0, fz: 1, moving: false, clock: 0 };
  return {
    player,
    reset() { Object.assign(player, CITY_SPAWN, { moving: false, clock: 0 }); },
    step(horizontal: number, vertical: number, dt: number) {
      player.moving = false;
      if (!horizontal && !vertical) { player.clock = 0; return; }
      const d = unproject(horizontal, vertical), length = Math.hypot(d.x, d.z);
      const vx = d.x / length, vz = d.z / length;
      const startX = player.x, startZ = player.z;
      // Small substeps preserve wall contact even after a slow frame.
      let left = Math.min(.1, Math.max(0, dt));
      while (left > 0) {
        const step = Math.min(left, 1 / 120) * 6;
        if (cityWalkable(player.x + vx * step, player.z, .38)) player.x += vx * step;
        if (cityWalkable(player.x, player.z + vz * step, .38)) player.z += vz * step;
        left -= step / 6;
      }
      player.fx = vx; player.fz = vz;
      player.moving = Math.hypot(player.x - startX, player.z - startZ) > .00001;
      player.clock = player.moving ? player.clock + dt : 0;
    },
  };
}
