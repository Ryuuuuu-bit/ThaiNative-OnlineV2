export type MapId = 'city_plaza' | 'meadow' | 'forest';
/** Hunting maps (combat, monsters, auto-hunt). */
export const isField = (m: MapId | undefined) => m === 'meadow' || m === 'forest';

/*
 * World layouts, in metres. The hero is about 1.8 m tall; the camera shows ~27 m vertically.
 * Every map is described here as data so that collision (server + client prediction), spawns,
 * minimap and the scene builders all read the same source. Generated features (trees, rocks)
 * use a fixed seed, so every process produces the identical layout.
 */
export interface Circle { x: number; z: number; r: number; kind?: string }
export interface Ellipse { x: number; z: number; rx: number; rz: number; /** walkable crossing band along x (bridge), |z - bridgeZ| < bridgeHalf */ bridgeZ?: number; bridgeHalf?: number }
export interface Path { points: [number, number][]; width: number }
export interface SpawnZone { dataId: string; variant?: 'pink' | 'mint' | 'sky'; x: number; z: number; rx: number; rz: number; count: number }
export interface Layout {
	halfX: number; halfZ: number;
	obstacles: Circle[];
	water: Ellipse[];
	paths: Path[];
	camps: { x: number; z: number }[];
	arena?: { x: number; z: number; r: number };
	spawns: { dataId: string; variant: 'pink' | 'mint' | 'sky'; x: number; z: number }[];
}

/** Spatial hash over circles: a walkable test only looks at the few obstacles near the point. */
const GRID_CELL = 4, GRID_MAX_R = 2.5;
function circleGrid(circles: Circle[]) {
	const cells = new Map<number, Circle[]>(), key = (cx: number, cz: number) => cx * 4096 + cz;
	for (const c of circles) {
		const reach = c.r + GRID_MAX_R;
		for (let cx = Math.floor((c.x - reach) / GRID_CELL); cx <= Math.floor((c.x + reach) / GRID_CELL); cx++)
			for (let cz = Math.floor((c.z - reach) / GRID_CELL); cz <= Math.floor((c.z + reach) / GRID_CELL); cz++) {
				const k = key(cx, cz), list = cells.get(k);
				if (list) list.push(c); else cells.set(k, [c]);
			}
	}
	/** True when a disc of radius r (≤ GRID_MAX_R) at x,z overlaps any circle. */
	return (x: number, z: number, r: number) => {
		const list = cells.get(key(Math.floor(x / GRID_CELL), Math.floor(z / GRID_CELL)));
		if (!list) return false;
		for (const o of list) { const dx = x - o.x, dz = z - o.z, rr = o.r + r; if (dx * dx + dz * dz < rr * rr) return true; }
		return false;
	};
}
function seeded(seed: number) { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; }
export function segmentDistance(x: number, z: number, a: readonly [number, number], b: readonly [number, number]) {
	const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l));
	return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
export function onPath(paths: Path[], x: number, z: number, pad = 0) {
	return paths.some(p => p.points.some((a, i) => i > 0 && segmentDistance(x, z, p.points[i - 1], a) < p.width / 2 + pad));
}
export function inWater(water: Ellipse[], x: number, z: number, r = 0) {
	return water.some(w => {
		if (w.bridgeZ !== undefined && Math.abs(z - w.bridgeZ) < (w.bridgeHalf ?? 1) - r) return false;
		return ((x - w.x) / (w.rx + r)) ** 2 + ((z - w.z) / (w.rz + r)) ** 2 < 1;
	});
}
/** Scatter `count` circles with a seed, keeping clear of paths, water, camps, arena and keep-out points. */
function scatter(seed: number, count: number, half: { x: number; z: number }, l: Pick<Layout, 'paths' | 'water' | 'camps' | 'arena'>, kinds: string[], rMin: number, rMax: number, keepOut: Circle[] = [], existing: Circle[] = []) {
	const r = seeded(seed), out: Circle[] = [];
	for (let i = 0; out.length < count && i < count * 40; i++) {
		const c = { x: (r() * 2 - 1) * (half.x - 2), z: (r() * 2 - 1) * (half.z - 2), r: rMin + r() * (rMax - rMin), kind: kinds[Math.floor(r() * kinds.length)] };
		if (onPath(l.paths, c.x, c.z, c.r + 1.2) || inWater(l.water, c.x, c.z, c.r + 1)) continue;
		if (l.camps.some(p => Math.hypot(c.x - p.x, c.z - p.z) < 6) || (l.arena && Math.hypot(c.x - l.arena.x, c.z - l.arena.z) < l.arena.r + 4)) continue;
		if ([...keepOut, ...existing, ...out].some(o => Math.hypot(c.x - o.x, c.z - o.z) < c.r + o.r + 2.2)) continue;
		out.push(c);
	}
	return out;
}
function zoneSpawns(seed: number, zones: SpawnZone[], ok: (x: number, z: number) => boolean) {
	const r = seeded(seed), out: Layout['spawns'] = [];
	for (const zone of zones) {
		let placed = 0;
		for (let i = 0; placed < zone.count && i < zone.count * 60; i++) {
			const a = r() * Math.PI * 2, d = Math.sqrt(r());
			const x = zone.x + Math.cos(a) * d * zone.rx, z = zone.z + Math.sin(a) * d * zone.rz;
			if (!ok(x, z) || out.some(s => Math.hypot(s.x - x, s.z - z) < 2.2)) continue;
			out.push({ dataId: zone.dataId, variant: zone.variant ?? 'pink', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
			placed++;
		}
	}
	return out;
}

/* ---------------------------------------------------------------- city: นครที่ถูกลืมเลือน, 96 x 96 m */
export const CITY = { halfX: 48, halfZ: 48 };
export const CITY_SPAWN = { x: 0, z: 14 };
export const CITY_RETURN = { x: 0, z: 44 };
export const CITY_EAST_RETURN = { x: 44, z: 0 };
export const CITY_TOWER = { half: 2 };
export const CITY_FOUNTAIN = { x: -14, z: 14, r: 2.5 };
export const HEALER = { x: -14, z: 10 };
export const GATE_CAPTAIN = { x: 5, z: 40 };
export const CITY_BUILDINGS = [
	{ id: 'storage', name: 'คลังเก็บของ', npc: 'คนเฝ้าคลัง', x: 0, z: -30, w: 9, d: 6, talk: { x: 0, z: -25 } },
	{ id: 'forge', name: 'โรงตีเหล็ก', npc: 'ช่างตีเหล็ก', x: -32, z: 0, w: 7, d: 8, talk: { x: -26.5, z: 0 } },
	{ id: 'market', name: 'ตลาด', npc: 'พ่อค้าเบ็ดเตล็ด', x: 32, z: 0, w: 7, d: 8, talk: { x: 26.5, z: 0 } },
] as const;
/** Decorative houses (solid): behind the main roads, clear of every NPC and road. */
export const CITY_HOUSES: { x: number; z: number; w: number; d: number }[] = [
	[-32, -35, 6, 5], [-18, -38, 5, 4], [18, -38, 5, 4], [32, -35, 6, 5], [-37, 32, 5, 6], [37, 32, 5, 6],
	[-36, -18, 6, 5], [36, -18, 6, 5], [-22, 34, 5, 5], [22, 34, 5, 5], [-36, 16, 5, 5], [36, 16, 5, 5],
].map(([x, z, w, d]) => ({ x, z, w, d }));
export function cityWalkable(x: number, z: number, r: number) {
	if (Math.abs(x) >= CITY.halfX - 1 - r || Math.abs(z) >= CITY.halfZ - 1 - r) return false;
	if (Math.abs(x) < CITY_TOWER.half + r && Math.abs(z) < CITY_TOWER.half + r) return false;
	if (Math.hypot(x - CITY_FOUNTAIN.x, z - CITY_FOUNTAIN.z) < CITY_FOUNTAIN.r + r) return false;
	return ![...CITY_BUILDINGS, ...CITY_HOUSES].some(b => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r);
}

/* ---------------------------------------------------------------- meadow: ทุ่งวุ้นจิ๋ว, 100 x 84 m, Lv 1-5 */
export const MEADOW = { halfX: 50, halfZ: 42 };
export const MEADOW_ENTRY = { x: 0, z: -38.5 };
const meadowBase = {
	paths: [
		{ points: [[0, -42], [0, -30], [-2, -18], [1, -4], [-1, 10], [0, 24]], width: 2.6 },
		{ points: [[-50, -4], [-30, -5], [-12, -4], [1, -4], [16, -3], [34, -3], [50, -2]], width: 2 },
		{ points: [[-2, -18], [-10, -26], [-14, -30]], width: 1.7 },
		{ points: [[-1, 10], [-14, 18], [-26, 20]], width: 1.6 },
		{ points: [[1, -4], [14, 12], [26, 22]], width: 1.6 },
	] as Path[],
	water: [
		{ x: 28, z: -4, rx: 7, rz: 10, bridgeZ: -3, bridgeHalf: 1 },
		{ x: -32, z: 16, rx: 5.5, rz: 3.6 },
		{ x: 30, z: 30, rx: 4, rz: 3 },
	] as Ellipse[],
	camps: [{ x: -14, z: -31 }, { x: -12, z: 26 }, { x: 22, z: -24 }],
	arena: { x: 0, z: 28, r: 3.4 },
};
const meadowObstacles = (() => {
	const trees = scatter(1201, 58, { x: MEADOW.halfX, z: MEADOW.halfZ }, meadowBase, ['tree'], 0.8, 1.1);
	const rocks = scatter(1202, 18, { x: MEADOW.halfX, z: MEADOW.halfZ }, meadowBase, ['boulder'], 0.6, 0.9, [], trees);
	return [...trees, ...rocks];
})();
/** Painted landmarks (world-scale art pass): solid, but drawn by the scene itself rather than as trees/boulders. */
export const MEADOW_LANDMARKS = {
	circles: [
		{ x: 40, z: 18, r: 1.1, kind: 'giant-tree' },
		{ x: -21.2, z: -14, r: 0.6, kind: 'standing-stone' },
		{ x: -23.135, z: -11.337, r: 0.6, kind: 'standing-stone' },
		{ x: -26.265, z: -12.354, r: 0.6, kind: 'standing-stone' },
		{ x: -26.265, z: -15.646, r: 0.6, kind: 'standing-stone' },
		{ x: -23.135, z: -16.663, r: 0.6, kind: 'standing-stone' },
	] as Circle[],
	boxes: [{ x: -38, z: 32, w: 6, d: 6, kind: 'watchtower' }],
};
const meadowHits = circleGrid([...meadowObstacles, ...MEADOW_LANDMARKS.circles]);
export function meadowWalkable(x: number, z: number, r: number) {
	if (Math.abs(x) >= MEADOW.halfX - 1 - r || Math.abs(z) >= MEADOW.halfZ - 1 - r) return false;
	if (inWater(meadowBase.water, x, z)) return false;
	if (MEADOW_LANDMARKS.boxes.some(b => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r)) return false;
	return r <= GRID_MAX_R ? !meadowHits(x, z, r) : ![...meadowObstacles, ...MEADOW_LANDMARKS.circles].some(o => Math.hypot(x - o.x, z - o.z) < o.r + r);
}

/* ---------------------------------------------------------------- forest: ป่าหมอก, 120 x 96 m, Lv 6-15 */
export const FOREST = { halfX: 60, halfZ: 48 };
export const FOREST_ENTRY = { x: -56.5, z: 0 };
export const FOREST_CAMP = { x: -50, z: 7 };
export const FOREST_ARENA = { x: 40, z: 18 };
const forestBase = {
	paths: [
		{ points: [[-60, 0], [-40, 1], [-20, -1], [0, 1], [22, 0], [34, 6], [40, 18]], width: 2.4 },
		{ points: [[-20, -1], [-14, 14], [-22, 30]], width: 1.6 },
		{ points: [[0, 1], [6, -16], [12, -24]], width: 1.6 },
		{ points: [[22, 0], [36, -18], [50, -30]], width: 1.6 },
		{ points: [[-40, 1], [-46, 7], [-50, 7]], width: 1.6 },
	] as Path[],
	water: [
		{ x: 14, z: -32, rx: 10, rz: 6 },
		{ x: -24, z: 34, rx: 6, rz: 4 },
		{ x: 50, z: 34, rx: 5, rz: 4 },
	] as Ellipse[],
	camps: [FOREST_CAMP, { x: 4, z: 18 }],
	arena: { x: FOREST_ARENA.x, z: FOREST_ARENA.z, r: 3.4 },
};
export const FOREST_TREES: Circle[] = scatter(2203, 120, { x: FOREST.halfX, z: FOREST.halfZ }, forestBase, ['pine', 'oak', 'dead', 'hollow'], 0.8, 1.3);
export const forestPool = (x: number, z: number) => inWater(forestBase.water, x, z);
const forestHits = circleGrid(FOREST_TREES);
export function forestWalkable(x: number, z: number, r: number) {
	if (Math.abs(x) >= FOREST.halfX - 1 - r || Math.abs(z) >= FOREST.halfZ - 1 - r) return false;
		if (forestPool(x, z)) return false;
	return r <= GRID_MAX_R ? !forestHits(x, z, r) : !FOREST_TREES.some(t => Math.hypot(x - t.x, z - t.z) < t.r + r);
}

/* ---------------------------------------------------------------- spawns, bosses, gates */
export const MEADOW_SPAWNS = zoneSpawns(3301, [
	{ dataId: 'jelly_pink', variant: 'pink', x: 0, z: -22, rx: 30, rz: 9, count: 16 },
	{ dataId: 'jelly_mint', variant: 'mint', x: -24, z: 6, rx: 18, rz: 12, count: 10 },
	{ dataId: 'jelly_sky', variant: 'sky', x: 20, z: 12, rx: 18, rz: 12, count: 10 },
	{ dataId: 'jelly_pink', variant: 'pink', x: -30, z: -22, rx: 12, rz: 8, count: 6 },
], (x, z) => meadowWalkable(x, z, 0.5) && !meadowBase.camps.some(c => Math.hypot(x - c.x, z - c.z) < 6) && Math.hypot(x - meadowBase.arena.x, z - meadowBase.arena.z) > 7 && Math.hypot(x - MEADOW_ENTRY.x, z - MEADOW_ENTRY.z) > 10);
export const FOREST_SPAWNS = zoneSpawns(3302, [
	{ dataId: 'mist_shroom', x: -40, z: -14, rx: 16, rz: 22, count: 16 },
	{ dataId: 'shade_wolf', x: -10, z: 18, rx: 16, rz: 16, count: 14 },
	{ dataId: 'lantern_wisp', x: 18, z: -18, rx: 18, rz: 14, count: 12 },
	{ dataId: 'stump_guard', x: 42, z: 0, rx: 14, rz: 26, count: 12 },
], (x, z) => forestWalkable(x, z, 0.5) && !forestBase.camps.some(c => Math.hypot(x - c.x, z - c.z) < 6) && Math.hypot(x - FOREST_ARENA.x, z - FOREST_ARENA.z) > 8 && Math.hypot(x - FOREST_ENTRY.x, z - FOREST_ENTRY.z) > 8);

/** Per-map field boss: appears when the map's timer is due and comes back `respawnMinutes` after it dies. */
export const FIELD_BOSS: Record<'meadow' | 'forest', { dataId: string; x: number; z: number; minion: string; respawnMinutes: number }> = {
	meadow: { dataId: 'king_jelly', x: meadowBase.arena.x, z: meadowBase.arena.z, minion: 'jelly_summon', respawnMinutes: 30 },
	forest: { dataId: 'mist_warden', x: FOREST_ARENA.x, z: FOREST_ARENA.z, minion: 'mist_shroom', respawnMinutes: 30 },
};
export const BOSS_RESPAWN_MS = (m: 'meadow' | 'forest') => FIELD_BOSS[m].respawnMinutes * 60000;

export const LAYOUTS: Record<MapId, Layout> = {
	city_plaza: { halfX: CITY.halfX, halfZ: CITY.halfZ, obstacles: [], water: [], paths: [], camps: [], spawns: [] },
	meadow: { halfX: MEADOW.halfX, halfZ: MEADOW.halfZ, ...meadowBase, obstacles: meadowObstacles, spawns: MEADOW_SPAWNS },
	forest: { halfX: FOREST.halfX, halfZ: FOREST.halfZ, ...forestBase, obstacles: FOREST_TREES, spawns: FOREST_SPAWNS.map(s => ({ ...s })) },
};
export const campsFor = (m: MapId) => LAYOUTS[m].camps;
export function nearestCamp(m: MapId, x: number, z: number) {
	return campsFor(m).reduce((best, c) => (Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z) ? c : best), campsFor(m)[0]);
}

export const GATES = {
	city_plaza: { south: { x: 0, z: CITY.halfZ - 1 }, north: { x: 0, z: -(CITY.halfZ - 1) }, east: { x: CITY.halfX - 1, z: 0 }, west: { x: -(CITY.halfX - 1), z: 0 } },
	meadow: { north: { x: 0, z: -(MEADOW.halfZ - 1.2) } },
	forest: { west: { x: -(FOREST.halfX - 0.6), z: 0 } },
};
export function travelDestination(map: MapId, gate: string, p: { x: number; z: number; dead?: boolean }) {
	const trigger = (GATES[map] as Record<string, { x: number; z: number }>)[gate];
	if (p.dead || !trigger || Math.hypot(p.x - trigger.x, p.z - trigger.z) > 1.5) return null;
	if (map === 'city_plaza' && gate === 'south') return { mapId: 'meadow' as const, ...MEADOW_ENTRY };
	if (map === 'meadow' && gate === 'north') return { mapId: 'city_plaza' as const, ...CITY_RETURN };
	if (map === 'city_plaza' && gate === 'east') return { mapId: 'forest' as const, ...FOREST_ENTRY };
	if (map === 'forest' && gate === 'west') return { mapId: 'city_plaza' as const, ...CITY_EAST_RETURN };
	return null;
}
