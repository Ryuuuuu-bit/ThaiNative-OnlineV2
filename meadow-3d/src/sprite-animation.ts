import type { Player } from './sim';

export const DIRECTIONS = ['SE', 'SW', 'NE', 'NW'] as const;
export type Direction = typeof DIRECTIONS[number];
// Walk has its own 8-direction atlas: the four diagonal rows first (same order as DIRECTIONS), then the cardinals.
export const WALK_DIRECTIONS = ['SE', 'SW', 'NE', 'NW', 'S', 'E', 'N', 'W'] as const;
export type Facing = typeof WALK_DIRECTIONS[number];
/** Walk frames per facing: one stride cycle each (S, E, W keep their approved 8 samples). Matches tools/pack-hero-walk.py. */
export const WALK_FRAMES: Record<Facing, number> = {SE:11,SW:11,NE:10,NW:10,S:8,E:8,N:9,W:8};
/** Each facing owns 12 slots (frames, then the standing pose), wrapped 8 per atlas row: an 8 x 12 sheet. */
export const WALK_SLOTS = 12, WALK_COLUMNS = 8;
/** Walk slot holding the standing pose each walk render starts from. */
export const WALK_STAND = WALK_SLOTS - 1;
/** Walk frame for a facing: one stride cycle per MOTION_DURATION.walk, whatever its frame count. */
export function walkFrame(facing: Facing, elapsed: number) { const n=WALK_FRAMES[facing]; return Math.floor(Math.max(0,elapsed)/MOTION_DURATION.walk*n)%n; }
export const MOTIONS = ['idle', 'walk', 'run', 'attack', 'spin', 'cast', 'hit', 'dodge', 'death'] as const;
export type Motion = typeof MOTIONS[number];
export const MOTION_DURATION: Record<Motion, number> = {idle:1,walk:.8,run:.6,attack:.34,spin:.6,cast:.8,hit:.3,dodge:.22,death:.9};
/** Base motions redrawn with the approved AutoSprite model (hero-<motion>-v2.png, rows SE SW NE NW, same frame
 * counts as v1; idle becomes an 8-frame breathing loop). Cell size and feet height in game px. Matches tools/pack-hero-motions-v2.py. */
export const MOTION_V2: Partial<Record<Motion, {w: number; h: number; feet: number}>> = {attack:{w:384,h:274,feet:240},dodge:{w:384,h:285,feet:240},hit:{w:384,h:256,feet:240},death:{w:384,h:267,feet:240},spin:{w:384,h:260,feet:240},idle:{w:384,h:256,feet:240}};
export const IDLE_V2_FRAMES = 8, IDLE_V2_SECONDS = 2;
/** v2 sheet cell for a 4-facing motion; idle loops its breathing frames over IDLE_V2_SECONDS. */
export function v2Cell(motion: Motion, direction: Direction, frame: number, elapsed: number) {
  if (motion === 'idle') return {column: Math.floor(Math.max(0, elapsed) / IDLE_V2_SECONDS * IDLE_V2_FRAMES) % IDLE_V2_FRAMES, row: DIRECTIONS.indexOf(direction), columns: IDLE_V2_FRAMES, rows: 4};
  return atlasCell(motion, direction, frame);
}
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
  if (motion === 'walk') {
    const facing = direction as Facing, slot = frame >= WALK_STAND ? WALK_STAND : Math.max(0, Math.min(WALK_FRAMES[facing] - 1, frame));
    const index = WALK_DIRECTIONS.indexOf(facing) * WALK_SLOTS + slot;
    return {column: index % WALK_COLUMNS, row: Math.floor(index / WALK_COLUMNS), columns: WALK_COLUMNS, rows: WALK_SLOTS * WALK_DIRECTIONS.length / WALK_COLUMNS};
  }
  const row = DIRECTIONS.indexOf(direction as Direction);
  return motion === 'idle' ? {column: row, row: 0, columns: 4, rows: 1}
    : {column: Math.max(0, Math.min(frameCount(motion)-1, frame)), row, columns: frameCount(motion), rows: 4};
}

/**
 * Which hero sheet and cell to draw. Walk uses all eight facings. Idle facing a cardinal
 * borrows the walk sheet's standing-pose column (there is no painted cardinal idle). Every
 * other motion only has the four diagonal rows, so it keeps the old quadrant facing.
 */
export function heroSprite(motion: Motion, x: number, z: number, frame: number, elapsed?: number): {sheet: Motion; cell: ReturnType<typeof atlasCell>} {
  const facing = facing8For(x, z);
  // Walk facings have their own frame counts, so walk takes the elapsed time when it has it.
  if (motion === 'walk') return {sheet: 'walk', cell: atlasCell('walk', facing, elapsed === undefined ? frame : walkFrame(facing, elapsed))};
  if (motion === 'idle' && !(DIRECTIONS as readonly string[]).includes(facing)) return {sheet: 'walk', cell: atlasCell('walk', facing, WALK_STAND)};
  return {sheet: motion, cell: atlasCell(motion, facingFor(x, z), frame)};
}
