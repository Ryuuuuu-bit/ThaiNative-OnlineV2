import type { Player } from './sim';

export const DIRECTIONS = ['SE', 'SW', 'NE', 'NW'] as const;
export type Direction = typeof DIRECTIONS[number];
export const MOTIONS = ['idle', 'run', 'attack', 'spin', 'cast', 'hit', 'dodge', 'death'] as const;
export type Motion = typeof MOTIONS[number];
export const MOTION_DURATION: Record<Motion, number> = {idle:1,run:.6,attack:.34,spin:.6,cast:.8,hit:.3,dodge:.22,death:.9};
export function frameCount(motion: Motion) { return motion === 'idle' ? 1 : motion === 'hit' || motion === 'dodge' ? 3 : 6; }
export function motionFrame(motion: Motion, elapsed: number): number {
  const count=frameCount(motion), progress=Math.max(0,elapsed)/MOTION_DURATION[motion];
  return motion==='idle'?0:motion==='run'?Math.floor(progress*count)%count:Math.min(count-1,Math.floor(progress*count));
}

// Screen-space directions for the fixed camera at (9,16,13).
export function facingFor(x: number, z: number): Direction {
  const horizontal = 13*x - 9*z;
  const upward = -9*x - 13*z;
  return upward > 0 ? (horizontal >= 0 ? 'NE' : 'NW') : (horizontal >= 0 ? 'SE' : 'SW');
}

export function motionFor(p: Pick<Player, 'attack' | 'attackKind' | 'dash' | 'moving' | 'dead' | 'hurt'>): Motion {
  if (p.dead) return 'death';
  if (p.hurt > 0) return 'hit';
  if (p.dash > 0) return 'dodge';
  if (p.attack > 0) return p.attackKind==='spin'?'spin':p.attackKind==='meteor'?'cast':'attack';
  return p.moving ? 'run' : 'idle';
}

export function attackFrame(remaining: number, kind: string): number {
  const duration = kind === 'meteor' ? .8 : kind === 'spin' ? .6 : .34;
  return Math.max(0, Math.min(5, Math.floor((1 - remaining/duration)*6)));
}

export function atlasCell(motion: Motion, direction: Direction, frame: number) {
  const row = DIRECTIONS.indexOf(direction);
  return motion === 'idle' ? {column: row, row: 0, columns: 4, rows: 1}
    : {column: Math.max(0, Math.min(frameCount(motion)-1, frame)), row, columns: frameCount(motion), rows: 4};
}
