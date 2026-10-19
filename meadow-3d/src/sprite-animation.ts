import type { Player } from './sim';

export const DIRECTIONS = ['SE', 'SW', 'NE', 'NW'] as const;
export type Direction = typeof DIRECTIONS[number];
// Walk has its own 8-direction atlas: the four diagonal rows first (same order as DIRECTIONS), then the cardinals.
export const WALK_DIRECTIONS = ['SE', 'SW', 'NE', 'NW', 'S', 'E', 'N', 'W'] as const;
export type Facing = typeof WALK_DIRECTIONS[number];
export const MOTIONS = ['idle', 'walk', 'run', 'attack', 'spin', 'cast', 'hit', 'dodge', 'death'] as const;
export type Motion = typeof MOTIONS[number];
export const MOTION_DURATION: Record<Motion, number> = {idle:1,walk:.8,run:.6,attack:.34,spin:.6,cast:.8,hit:.3,dodge:.22,death:.9};
export function frameCount(motion: Motion) { return motion === 'idle' ? 1 : motion === 'walk' ? 8 : motion === 'hit' || motion === 'dodge' ? 3 : 6; }
export function isLoop(motion: Motion) { return motion === 'walk' || motion === 'run'; }
export function motionFrame(motion: Motion, elapsed: number): number {
  const count=frameCount(motion), progress=Math.max(0,elapsed)/MOTION_DURATION[motion];
  return motion==='idle'?0:isLoop(motion)?Math.floor(progress*count)%count:Math.min(count-1,Math.floor(progress*count));
}

// Screen-space directions for the fixed camera at (9,16,13).
export function facingFor(x: number, z: number): Direction {
  const horizontal = 13*x - 9*z;
  const upward = -9*x - 13*z;
  return upward > 0 ? (horizontal >= 0 ? 'NE' : 'NW') : (horizontal >= 0 ? 'SE' : 'SW');
}

/** Same screen axes as facingFor, split into eight 45-degree sectors centred on the screen axes and diagonals. */
export function facing8For(x: number, z: number): Facing {
  const sector = Math.round(Math.atan2(-9*x - 13*z, 13*x - 9*z) / (Math.PI/4));
  return (['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const)[(sector + 8) % 8];
}

export function motionFor(p: Pick<Player, 'attack' | 'attackKind' | 'dash' | 'moving' | 'dead' | 'hurt'>): Motion {
  if (p.dead) return 'death';
  if (p.hurt > 0) return 'hit';
  if (p.dash > 0) return 'dodge';
  if(p.attack>0&&p.attackKind==='dash_strike')return 'dodge';
  if (p.attack > 0) return p.attackKind==='spin'?'spin':p.attackKind==='meteor'?'cast':'attack';
  // AutoSprite walk (4 directions, 8 frames); the painted run atlas stays for scenes that ask for it.
  return p.moving ? 'walk' : 'idle';
}

export function attackFrame(remaining: number, kind: string): number {
  const duration = kind === 'meteor' ? .8 : kind === 'spin' ? .6 : .34;
  return Math.max(0, Math.min(5, Math.floor((1 - remaining/duration)*6)));
}

export function atlasCell(motion: Motion, direction: Direction | Facing, frame: number) {
  if (motion === 'walk') return {column: Math.max(0, Math.min(7, frame)), row: WALK_DIRECTIONS.indexOf(direction), columns: 8, rows: WALK_DIRECTIONS.length};
  const row = DIRECTIONS.indexOf(direction as Direction);
  return motion === 'idle' ? {column: row, row: 0, columns: 4, rows: 1}
    : {column: Math.max(0, Math.min(frameCount(motion)-1, frame)), row, columns: frameCount(motion), rows: 4};
}

/**
 * Which hero sheet and cell to draw. Walk uses all eight facings. Idle facing a cardinal
 * borrows the walk sheet's first frame, which is that direction's standing pose. Every
 * other motion only has the four diagonal rows, so it keeps the old quadrant facing.
 */
export function heroSprite(motion: Motion, x: number, z: number, frame: number): {sheet: Motion; cell: ReturnType<typeof atlasCell>} {
  const facing = facing8For(x, z);
  if (motion === 'walk') return {sheet: 'walk', cell: atlasCell('walk', facing, frame)};
  if (motion === 'idle' && !(DIRECTIONS as readonly string[]).includes(facing)) return {sheet: 'walk', cell: atlasCell('walk', facing, 0)};
  return {sheet: motion, cell: atlasCell(motion, facingFor(x, z), frame)};
}
