export type MapId = 'city_plaza' | 'meadow' | 'forest';
/** Hunting maps (combat, monsters, auto-hunt). */
export const isField = (m: MapId | undefined) => m === 'meadow' || m === 'forest';
export const CITY_SPAWN = { x: 0, z: 10 };
export const CITY_RETURN = { x: 0, z: 25 };
export const MEADOW_ENTRY = { x: 0, z: -10.5 };
/** ป่าหมอก: east of the city, 40 x 32 m, levels 6-15. */
export const FOREST = { halfX: 20, halfZ: 16 };
export const FOREST_ENTRY = { x: -17.5, z: 0 };
export const CITY_EAST_RETURN = { x: 25, z: 0 };
export const FOREST_CAMP = { x: -15, z: 4 };
export const FOREST_ARENA = { x: 13, z: 6 };
export const FOREST_TREES = [
  { x: -12, z: -9, r: 1.2 }, { x: -9, z: 9, r: 1.1 }, { x: -5, z: -4, r: 0.9 }, { x: -3, z: 12, r: 1.0 },
  { x: 0, z: -12, r: 1.2 }, { x: 2, z: 3, r: 0.8 }, { x: 5, z: -1, r: 0.9 }, { x: 7, z: 12, r: 1.1 },
  { x: 9, z: -13, r: 1.0 }, { x: 17, z: -6, r: 1.2 }, { x: -16, z: -13, r: 1.1 }, { x: 18, z: 13, r: 1.0 },
] as const;
/** A misty pool in the north-west of the forest. */
export const forestPool = (x: number, z: number) => ((x - 5) / 4) ** 2 + ((z + 8) / 2.6) ** 2 < 1;
export const FOREST_SPAWNS: { dataId: string; x: number; z: number }[] = [
  { dataId: 'mist_shroom', x: -13, z: -3 }, { dataId: 'mist_shroom', x: -10, z: 2 }, { dataId: 'mist_shroom', x: -14, z: 10 }, { dataId: 'mist_shroom', x: -7, z: -10 },
  { dataId: 'shade_wolf', x: -4, z: 6 }, { dataId: 'shade_wolf', x: -1, z: -6 }, { dataId: 'shade_wolf', x: 3, z: 9 },
  { dataId: 'lantern_wisp', x: 1, z: -14 }, { dataId: 'lantern_wisp', x: 11, z: -10 }, { dataId: 'lantern_wisp', x: 10, z: -3 },
  { dataId: 'stump_guard', x: 15, z: 1 }, { dataId: 'stump_guard', x: 9, z: 9 }, { dataId: 'stump_guard', x: 16, z: 11 },
];
/** Per-map field boss: spawns once the room has enough kills and someone in it is off cooldown. */
export const FIELD_BOSS: Record<'meadow' | 'forest', { dataId: string; kills: number; x: number; z: number; minion: string }> = {
  meadow: { dataId: 'king_jelly', kills: 6, x: 1, z: 10, minion: 'jelly_summon' },
  forest: { dataId: 'mist_warden', kills: 12, x: 13, z: 6, minion: 'mist_shroom' },
};
export const HEALER = { x: -9, z: 6 };
export const GATE_CAPTAIN = { x: 4, z: 25 };
export const CITY_BUILDINGS = [
  { id: 'storage', name: 'คลังเก็บของ', npc: 'คนเฝ้าคลัง', x: 0, z: -19, w: 9, d: 6, talk: { x: 0, z: -14 } },
  { id: 'forge', name: 'โรงตีเหล็ก', npc: 'ช่างตีเหล็ก', x: -20, z: 0, w: 7, d: 8, talk: { x: -14, z: 0 } },
  { id: 'market', name: 'ตลาด', npc: 'พ่อค้าเบ็ดเตล็ด', x: 20, z: 0, w: 7, d: 8, talk: { x: 14, z: 0 } },
] as const;
export const GATES = {
  city_plaza: { south: { x: 0, z: 28 }, north: { x: 0, z: -28 }, east: { x: 28, z: 0 }, west: { x: -28, z: 0 } },
  meadow: { north: { x: 0, z: -12.8 } },
  forest: { west: { x: -19.4, z: 0 } },
};
export function travelDestination(map: MapId, gate: string, p: { x: number; z: number; dead?: boolean }) {
  const trigger = (GATES[map] as Record<string, { x: number; z: number }>)[gate];
  if (p.dead || !trigger || Math.hypot(p.x-trigger.x,p.z-trigger.z)>1.5) return null;
  if (map==='city_plaza' && gate==='south') return { mapId: 'meadow' as const, ...MEADOW_ENTRY };
  if (map==='meadow' && gate==='north') return { mapId: 'city_plaza' as const, ...CITY_RETURN };
  if (map==='city_plaza' && gate==='east') return { mapId: 'forest' as const, ...FOREST_ENTRY };
  if (map==='forest' && gate==='west') return { mapId: 'city_plaza' as const, ...CITY_EAST_RETURN };
  return null;
}
export function cityWalkable(x: number, z: number, r: number) {
  if (Math.abs(x)>=29-r || Math.abs(z)>=29-r) return false;
  if (Math.abs(x)<2+r && Math.abs(z)<2+r) return false;
  if (Math.hypot(x+9,z-9)<2.5+r) return false;
  return !CITY_BUILDINGS.some(b=>Math.abs(x-b.x)<b.w/2+r && Math.abs(z-b.z)<b.d/2+r);
}
export function forestWalkable(x: number, z: number, r: number) {
  if (Math.abs(x) >= FOREST.halfX - r || Math.abs(z) >= FOREST.halfZ - r) return false;
  if (forestPool(x, z)) return false;
  return !FOREST_TREES.some(t => Math.hypot(x - t.x, z - t.z) < t.r + r);
}
