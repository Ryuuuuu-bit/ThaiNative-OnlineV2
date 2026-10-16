export type MapId = 'city_plaza' | 'meadow';
export const CITY_SPAWN = { x: 0, z: 5 };
export const CITY_RETURN = { x: 0, z: 25 };
export const MEADOW_ENTRY = { x: 0, z: -10.5 };
export const HEALER = { x: -9, z: 6 };
export const CITY_BUILDINGS = [
  { id: 'storage', name: 'คลังเก็บของ', npc: 'คนเฝ้าคลัง', x: 0, z: -19, w: 9, d: 6, talk: { x: 0, z: -14 } },
  { id: 'forge', name: 'โรงตีเหล็ก', npc: 'ช่างตีเหล็ก', x: -20, z: 0, w: 7, d: 8, talk: { x: -14, z: 0 } },
  { id: 'market', name: 'ตลาด', npc: 'พ่อค้าเบ็ดเตล็ด', x: 20, z: 0, w: 7, d: 8, talk: { x: 14, z: 0 } },
] as const;
export const GATES = {
  city_plaza: { south: { x: 0, z: 28 }, north: { x: 0, z: -28 }, east: { x: 28, z: 0 }, west: { x: -28, z: 0 } },
  meadow: { north: { x: 0, z: -12.8 } },
};
export function travelDestination(map: MapId, gate: string, p: { x: number; z: number; dead?: boolean }) {
  const trigger = (GATES[map] as Record<string, { x: number; z: number }>)[gate];
  if (p.dead || !trigger || Math.hypot(p.x-trigger.x,p.z-trigger.z)>1.5) return null;
  if (map==='city_plaza' && gate==='south') return { mapId: 'meadow' as const, ...MEADOW_ENTRY };
  if (map==='meadow' && gate==='north') return { mapId: 'city_plaza' as const, ...CITY_RETURN };
  return null;
}
export function cityWalkable(x: number, z: number, r: number) {
  if (Math.abs(x)>=29-r || Math.abs(z)>=29-r) return false;
  if (Math.abs(x)<2+r && Math.abs(z)<2+r) return false;
  if (Math.hypot(x+9,z-9)<2.5+r) return false;
  return !CITY_BUILDINGS.some(b=>Math.abs(x-b.x)<b.w/2+r && Math.abs(z-b.z)<b.d/2+r);
}
