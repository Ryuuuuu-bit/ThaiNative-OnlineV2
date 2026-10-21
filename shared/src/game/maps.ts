import {circleIndex,circleGrid,GRID_MAX_R} from './obstacle-index.js';
import {DECOR,GARDEN_TREES,FORTIFICATION_SOLIDS,CITY2D_FOUNTAIN,CITY2D_HEALER} from './city-details.js';
export * from './city-details.js';
export type FieldMapId = 'meadow' | 'forest' | 'ruins' | 'canyon';
export type MapId = 'city_plaza' | FieldMapId;
/** Hunting maps (combat, monsters, auto-hunt). */
export const isField = (m: MapId | undefined): m is FieldMapId => m === 'meadow' || m === 'forest' || m === 'ruins' || m === 'canyon';
export const MAP_INFO:Record<MapId,{name:string;levels:string;hint:string}>={
 city_plaza:{name:'นครที่ถูกลืมเลือน',levels:'เขตปลอดภัย',hint:'เตรียมเสบียงก่อนออกเดินทาง'},
 meadow:{name:'ทุ่งวุ้นจิ๋ว',levels:'1–5',hint:'เริ่มจากวุ้นจิ๋วใกล้ทางเข้า แล้วฝึกกับวุ้นสีอื่น'},
 forest:{name:'ป่าหมอก',levels:'6–15',hint:'ประตูตะวันออกเชื่อมซากนครโบราณ · ระวังภูตยิงจากระยะไกล'},
 ruins:{name:'ซากนครโบราณ',levels:'16–22',hint:'ทางตะวันตกกลับป่าหมอก · ทางตะวันออกสู่หุบเขาหิน'},
 canyon:{name:'หุบเขาหิน',levels:'23–30',hint:'ทางตะวันตกกลับซากนคร · เตรียมเสบียงก่อนเข้าลานบอสทางตะวันออก'},
};

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
export const CITY_FOUNTAIN = CITY2D_FOUNTAIN;
export const HEALER = CITY2D_HEALER;
export const GATE_CAPTAIN = { x: 5, z: 40 };
export const CITY_BUILDINGS = [
	{ id: 'storage', name: 'คลังเก็บของ', npc: 'คนเฝ้าคลัง', x: 13, z: -20, w: 8, d: 6, talk: { x: 12, z: -15 } },
	{ id: 'forge', name: 'โรงตีเหล็ก', npc: 'ช่างตีเหล็ก', x: -25, z: -15, w: 9, d: 8, talk: { x: -19, z: -12 } },
	{ id: 'market', name: 'ตลาด', npc: 'พ่อค้าเบ็ดเตล็ด', x: 25, z: 13, w: 8, d: 7, talk: { x: 18, z: 13 } },
] as const;
/** Decorative houses (solid): behind the main roads, clear of every NPC and road. */
export const CITY_HOUSES: { x: number; z: number; w: number; d: number }[] = [
	[-38,-36,6,6],[-30,-27,6,5],[-12,-40,6,4],[-23,-40,5,4],
	[29,-36,7,6],[38,-28,6,6],[29,-23,6,5],[38,-15,6,5],[26,-12,6,5],
	[-39,31,5,6],[-30,40,6,5],[-11,39,6,5],[30,39,6,5],[38,36,6,5],
	[-38,-7,6,5],
].map(([x, z, w, d]) => ({ x, z, w, d }));
const ring = (radius: number, every: number) => Array.from({ length: 8 }, (_, i) => (i + 0.5) * Math.PI / 4).filter((_, i) => i % every === 0).map(a => ({ x: Math.cos(a) * radius, z: Math.sin(a) * radius }));
/** Planter trees (solid pots, r 0.8): eight on the plaza ring between the roads, eight in the quarters. */
export const CITY_PLANTERS = [...ring(13, 2), ...[[-42,-21],[42,-35],[-41,22],[42,27],[-23,-24],[21,-27],[-7,36],[30,30]].map(([x,z])=>({x,z}))].map(p=>({...p,r:.8}));
/** Benches (solid, seat and back): four on the outer ring, four in the quarters. */
export const CITY_BENCHES = [[-11,-9],[11,9],[-11,9],[11,-9],[-19,19],[-27,27],[34,-20],[24,-28]].map(([x,z])=>({x,z,w:2.2,d:.7}));
/** Market stalls around the main market; `x/z/w/d` is the canopy, `solid` also covers the crate and barrel at its west front. */
export const CITY_STALLS = [[33,13],[39,14],[19,20],[33,27]].map(([x,z])=>({x,z,w:3,d:2.1,solid:{x:x-.35,z:z+.125,w:3.7,d:2.35}}));
/** City polish 4 art (guard booths, wells, carts, hay, crate clusters, forge firewood); the scene draws them from this list. */
export const CITY_ART_SOLIDS: ({ kind: 'box'; x: number; z: number; w: number; d: number; label: string } | { kind: 'circle'; x: number; z: number; r: number; label: string })[] = [
	{kind:'box',x:-7,z:44.5,w:1.8,d:1.8,label:'guard-south'},
	{kind:'box',x:44.5,z:-7,w:1.8,d:1.8,label:'guard-east'},
	{kind:'circle',x:-24,z:-27,r:1.1,label:'well-north'},
	{kind:'circle',x:27,z:24,r:1.1,label:'well-south'},
	{kind:'box',x:-39,z:9,w:3.2,d:1.6,label:'cart-west'},
	{kind:'box',x:21,z:-30,w:3.2,d:1.6,label:'cart-north'},
	{kind:'box',x:-41.5,z:9,w:1.2,d:1.2,label:'hay-west'},
	{kind:'box',x:23.5,z:-30,w:1.2,d:1.2,label:'hay-north'},
	{kind:'box',x:-28,z:-35,w:1.8,d:2,label:'crates-north'},
	{kind:'box',x:34,z:-35,w:1.8,d:2,label:'crates-east'},
	{kind:'box',x:-36,z:18,w:1.8,d:2,label:'crates-west'},
	{kind:'box',x:32,z:16,w:1.8,d:2,label:'crates-south'},
	{kind:'box',x:-31,z:-15,w:1.4,d:3,label:'firewood-forge'},
];
const cityBoxes = [...FORTIFICATION_SOLIDS,...DECOR.filter(p=>p.solid),...CITY_BUILDINGS, ...CITY_HOUSES, ...CITY_BENCHES, ...CITY_STALLS.map(s => s.solid), ...CITY_ART_SOLIDS.filter(s => s.kind === 'box')];
const cityCircleHits = circleIndex([...CITY_PLANTERS, ...CITY_ART_SOLIDS.filter(s => s.kind === 'circle'), ...GARDEN_TREES.map(t=>({...t,r:.55}))]);
export function cityWalkable(x: number, z: number, r: number) {
	if (Math.abs(x) >= CITY.halfX - 1 - r || Math.abs(z) >= CITY.halfZ - 1 - r) return false;
	if (Math.abs(x) < CITY_TOWER.half + r && Math.abs(z) < CITY_TOWER.half + r) return false;
	if (Math.hypot(x - CITY_FOUNTAIN.x, z - CITY_FOUNTAIN.z) < CITY_FOUNTAIN.r + r) return false;
	if (cityCircleHits(x,z,r)) return false;
	return !cityBoxes.some(b => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r);
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
const meadowCircles = [...meadowObstacles, ...MEADOW_LANDMARKS.circles];
const meadowHits = circleGrid(meadowCircles), meadowWideHits = circleIndex(meadowCircles);
export function meadowWalkable(x: number, z: number, r: number) {
	if (Math.abs(x) >= MEADOW.halfX - 1 - r || Math.abs(z) >= MEADOW.halfZ - 1 - r) return false;
	if (inWater(meadowBase.water, x, z)) return false;
	if (MEADOW_LANDMARKS.boxes.some(b => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r)) return false;
	return r <= GRID_MAX_R ? !meadowHits(x,z,r) : !meadowWideHits(x,z,r);
}

/* ---------------------------------------------------------------- forest: ป่าหมอก, 120 x 96 m, Lv 6-15 */
export const FOREST = { halfX: 60, halfZ: 48 };
export const FOREST_ENTRY = { x: -56.5, z: 0 };
export const FOREST_CAMP = { x: -50, z: 7 };
export const FOREST_ARENA = { x: 40, z: 18 };
const forestBase = {
	paths: [
		{ points: [[22, 0], [60, 0]], width: 2.4 },
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
const forestHits = circleGrid(FOREST_TREES), forestWideHits = circleIndex(FOREST_TREES);
export function forestWalkable(x: number, z: number, r: number) {
	if (Math.abs(x) >= FOREST.halfX - 1 - r || Math.abs(z) >= FOREST.halfZ - 1 - r) return false;
		if (forestPool(x, z)) return false;
	return r <= GRID_MAX_R ? !forestHits(x,z,r) : !forestWideHits(x,z,r);
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

/* New hunting grounds use the same deterministic collision and spawn model as the original fields. */
export const RUINS={halfX:62,halfZ:50}, CANYON={halfX:62,halfZ:52};
export const RUINS_ENTRY={x:-58,z:0}, RUINS_EAST_ENTRY={x:57,z:0}, CANYON_ENTRY={x:-58,z:0}, FOREST_EAST_RETURN={x:56,z:0};
const ruinsBase={paths:[
 {points:[[-62,0],[-38,0],[-18,8],[8,8],[30,0],[62,0]],width:2.6},
 {points:[[-38,0],[-32,-24],[-12,-30],[10,-24],[30,0]],width:2},
 {points:[[-18,8],[-24,29],[0,34],[26,24],[30,0]],width:1.8},
 {points:[[30,0],[40,-20],[43,-30]],width:2.2},
 {points:[[-51,0],[-51,7]],width:1.2},{points:[[2,8],[2,14]],width:1.2},{points:[[48,0],[48,7]],width:1.2},
 ] as Path[],water:[{x:10,z:-7,rx:7,rz:6},{x:-42,z:30,rx:5,rz:4}],camps:[{x:-51,z:7},{x:2,z:14},{x:48,z:7}],arena:{x:43,z:-30,r:5}};
const canyonBase={paths:[
 {points:[[-62,0],[-36,0],[-22,-14],[0,-14],[18,0],[40,4],[46,20]],width:2.7},
 {points:[[-36,0],[-30,25],[-6,30],[18,18],[18,0]],width:2},
 {points:[[-22,-14],[-16,-35],[12,-34],[34,-22],[40,4]],width:1.8},
 {points:[[-51,0],[-51,7]],width:1.2},{points:[[-2,-14],[-2,-23]],width:1.2},{points:[[18,9],[24,9]],width:1.2},
 ] as Path[],water:[{x:-7,z:9,rx:7,rz:5},{x:26,z:35,rx:5,rz:3}],camps:[{x:-51,z:7},{x:-2,z:-23},{x:24,z:9}],arena:{x:46,z:24,r:5.5}};
// Authored quarters retain the main roads, camp pockets and water corridors.
// Ruin walls use several small collision feet, shared by server and client.
export const RUINS_STRUCTURES=[
 {x:-48,z:-16,r:1,kind:'ruins-wall-x'}, {x:-47,z:-32,r:1,kind:'ruins-wall-z'},
 {x:-38,z:-38,r:3.2,kind:'ruins-house'}, {x:-50,z:18,r:3,kind:'ruins-house'},
 {x:-34,z:-16,r:.85,kind:'ruins-arch'},
 {x:-30,z:17,r:1,kind:'ruins-wall-x'}, {x:-35,z:36,r:3,kind:'ruins-house'},
 {x:-14,z:21,r:3,kind:'ruins-foundation'}, {x:-14,z:42,r:1,kind:'ruins-wall-x'},
 {x:8,z:40,r:3.2,kind:'ruins-house'}, {x:34,z:34,r:3,kind:'ruins-foundation'},
 {x:44,z:18,r:1,kind:'ruins-wall-z'}, {x:52,z:34,r:1,kind:'ruins-wall-x'},
 {x:5,z:-38,r:3.2,kind:'ruins-house'}, {x:23,z:-40,r:1,kind:'ruins-wall-x'},
 {x:29,z:-17,r:1,kind:'ruins-wall-z'}, {x:48,z:-43,r:3.3,kind:'ruins-temple'},
 {x:34,z:-38,r:.9,kind:'ruins-column'}, {x:53,z:-28,r:.9,kind:'ruins-pier'},
 {x:34,z:-28,r:1.25,kind:'ruins-statue'}, {x:52,z:-16,r:1.1,kind:'ruins-fallen'},
];
const ruinsObstacles:Circle[]=[];
for(const s of RUINS_STRUCTURES){
 const axis=s.kind==='ruins-wall-z'?'z':'x';
 const offsets=s.kind==='ruins-arch'?[-3.5,3.5]:s.kind.startsWith('ruins-wall')?[-2.8,-1.4,0,1.4,2.8]:[0];
 offsets.forEach((offset,i)=>ruinsObstacles.push({x:s.x+(axis==='x'?offset:0),z:s.z+(axis==='z'?offset:0),r:s.r,kind:'ruins-foot'}));
}
// Relics in open hunting pockets, with several metres of breathing room.
const relics=[[-55,-36],[-25,-39],[-13,-16],[-5,-43],[17,-31],[54,-39],[-57,40],[-22,38],[-4,24],[18,29],[39,12],[55,43],[-37,14],[-4,-2],[30,-7],[48,42]];
for(const [i,[x,z]]of relics.entries()){
 const r=i%4===0?1.6:1.05;
 if(onPath(ruinsBase.paths,x,z,r+1.5)||inWater(ruinsBase.water,x,z,r+1)||ruinsBase.camps.some(c=>Math.hypot(x-c.x,z-c.z)<r+6)||ruinsObstacles.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.r+3))continue;
 ruinsObstacles.push({x,z,r,kind:['ruins-boulder','ruins-rubble','ruins-fallen','ruins-pier'][i%4]});
}
// A few surviving trees frame the edge; the city interior is masonry, not forest.
for(const [x,z]of [[-57,-44],[-57,45],[-5,46],[58,42],[58,-46],[17,46]])
 ruinsObstacles.push({x,z,r:1.2,kind:'tree'});
// Composed outcrops frame open hunting pockets; avoid a uniform field of pebbles.
// These same footprints drive client drawing, server collision and spawn rejection.
const canyonRidges=[[-55,-12],[-55,20],[-48,-35],[-43,40],[-31,-27],[-18,44],[-4,-44],[5,-3],[9,44],[27,-44],[48,-31],[54,-8],[37,44],[57,29],[47,40]];
const canyonObstacles:Circle[]=[];
for(const [i,[x,z]]of canyonRidges.entries())for(const [j,[dx,dz,r]]of [[0,0,2.6],[-4,2,1.9],[3.7,3,1.5]].entries()){
 const angle=i*2.39996;
 const o={x:x+dx*Math.cos(angle)-dz*Math.sin(angle),z:z+dx*Math.sin(angle)+dz*Math.cos(angle),r,kind:j===0?'canyon-crag':j===1?'canyon-outcrop':'canyon-scree'};
 if(Math.abs(o.x)+r>CANYON.halfX-1||Math.abs(o.z)+r>CANYON.halfZ-1||onPath(canyonBase.paths,o.x,o.z,r+2.4)||inWater(canyonBase.water,o.x,o.z,r+1))continue;
 if(canyonBase.camps.some(c=>Math.hypot(o.x-c.x,o.z-c.z)<r+7)||Math.hypot(o.x-canyonBase.arena.x,o.z-canyonBase.arena.z)<r+canyonBase.arena.r+2.5)continue;
 canyonObstacles.push(o);
}
const ruinsHits=circleIndex(ruinsObstacles),canyonHits=circleIndex(canyonObstacles);
function huntingWalkable(half:{halfX:number;halfZ:number},base:{water:Ellipse[]},hits:ReturnType<typeof circleIndex>,x:number,z:number,r:number){
 return Math.abs(x)<half.halfX-1-r&&Math.abs(z)<half.halfZ-1-r&&!inWater(base.water,x,z)&&!hits(x,z,r);
}
export const ruinsWalkable=(x:number,z:number,r=.3)=>huntingWalkable(RUINS,ruinsBase,ruinsHits,x,z,r);
export const canyonWalkable=(x:number,z:number,r=.3)=>huntingWalkable(CANYON,canyonBase,canyonHits,x,z,r);
function huntingSpawns(seed:number,zones:SpawnZone[],base:typeof ruinsBase,entry:{x:number;z:number},walk:(x:number,z:number,r:number)=>boolean){
 return zoneSpawns(seed,zones,(x,z)=>walk(x,z,.65)&&base.camps.every(c=>Math.hypot(x-c.x,z-c.z)>7)&&Math.hypot(x-entry.x,z-entry.z)>10&&Math.hypot(x-base.arena.x,z-base.arena.z)>9);
}
export const RUINS_SPAWNS=huntingSpawns(5501,[
 {dataId:'ruin_shroom',x:-36,z:-16,rx:15,rz:16,count:14},{dataId:'relic_hound',x:-22,z:24,rx:16,rz:16,count:14},
 {dataId:'relic_wisp',x:14,z:-23,rx:17,rz:15,count:14},{dataId:'ruin_guard',x:30,z:21,rx:18,rz:16,count:12},
],ruinsBase,RUINS_ENTRY,ruinsWalkable);
export const CANYON_SPAWNS=huntingSpawns(5502,[
 {dataId:'crag_slime',x:-35,z:-19,rx:16,rz:16,count:14},{dataId:'crag_wolf',x:-23,z:27,rx:17,rz:14,count:14},
 {dataId:'dust_wisp',x:17,z:-26,rx:18,rz:16,count:14},{dataId:'crag_guard',x:31,z:16,rx:17,rz:20,count:12},
],canyonBase,CANYON_ENTRY,canyonWalkable);
export const MAP_ENTRY:Record<MapId,{x:number;z:number}>={city_plaza:CITY_SPAWN,meadow:MEADOW_ENTRY,forest:FOREST_ENTRY,ruins:RUINS_ENTRY,canyon:CANYON_ENTRY};
/** Per-map field boss: appears when the map's timer is due and comes back `respawnMinutes` after it dies. */
export const FIELD_BOSS: Record<FieldMapId, { dataId: string; x: number; z: number; minion: string; respawnMinutes: number }> = {
	meadow: { dataId: 'king_jelly', x: meadowBase.arena.x, z: meadowBase.arena.z, minion: 'jelly_summon', respawnMinutes: 30 },
	forest: { dataId: 'mist_warden', x: FOREST_ARENA.x, z: FOREST_ARENA.z, minion: 'mist_shroom', respawnMinutes: 30 },
 ruins:{dataId:'relic_warden',x:43,z:-30,minion:'ruin_shroom',respawnMinutes:30},
 canyon:{dataId:'crag_titan',x:46,z:24,minion:'crag_slime',respawnMinutes:30},
};
export const BOSS_RESPAWN_MS = (m: FieldMapId) => FIELD_BOSS[m].respawnMinutes * 60000;

export const LAYOUTS: Record<MapId, Layout> = {
	city_plaza: { halfX: CITY.halfX, halfZ: CITY.halfZ, obstacles: [], water: [], paths: [], camps: [], spawns: [] },
	meadow: { halfX: MEADOW.halfX, halfZ: MEADOW.halfZ, ...meadowBase, obstacles: meadowObstacles, spawns: MEADOW_SPAWNS },
	forest: { halfX: FOREST.halfX, halfZ: FOREST.halfZ, ...forestBase, obstacles: FOREST_TREES, spawns: FOREST_SPAWNS.map(s => ({ ...s })) },
 ruins:{...RUINS,...ruinsBase,obstacles:ruinsObstacles,spawns:RUINS_SPAWNS},
 canyon:{...CANYON,...canyonBase,obstacles:canyonObstacles,spawns:CANYON_SPAWNS},
};
export const campsFor = (m: MapId) => LAYOUTS[m].camps;
export function nearestCamp(m: MapId, x: number, z: number) {
	return campsFor(m).reduce((best, c) => (Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z) ? c : best), campsFor(m)[0]);
}

export const GATES = {
	city_plaza: { south: { x: 0, z: CITY.halfZ - 1 }, north: { x: 0, z: -(CITY.halfZ - 1) }, east: { x: CITY.halfX - 1, z: 0 }, west: { x: -(CITY.halfX - 1), z: 0 } },
	meadow: { north: { x: 0, z: -(MEADOW.halfZ - 1.2) } },
	forest: { west: { x: -(FOREST.halfX - 0.6), z: 0 },east:{x:FOREST.halfX-1,z:0} },
 ruins:{west:{x:-61,z:0},east:{x:61,z:0}},
 canyon:{west:{x:-61,z:0}},
};
export function travelDestination(map: MapId, gate: string, p: { x: number; z: number; dead?: boolean }) {
	const trigger = (GATES[map] as Record<string, { x: number; z: number }>)[gate];
	if (p.dead || !trigger || Math.hypot(p.x - trigger.x, p.z - trigger.z) > 1.5) return null;
	if (map === 'city_plaza' && gate === 'south') return { mapId: 'meadow' as const, ...MEADOW_ENTRY };
	if (map === 'meadow' && gate === 'north') return { mapId: 'city_plaza' as const, ...CITY_RETURN };
	if (map === 'city_plaza' && gate === 'east') return { mapId: 'forest' as const, ...FOREST_ENTRY };
	if (map === 'forest' && gate === 'west') return { mapId: 'city_plaza' as const, ...CITY_EAST_RETURN };
 if(map==='forest'&&gate==='east')return{mapId:'ruins' as const,...RUINS_ENTRY};
 if(map==='ruins'&&gate==='west')return{mapId:'forest' as const,...FOREST_EAST_RETURN};
 if(map==='ruins'&&gate==='east')return{mapId:'canyon' as const,...CANYON_ENTRY};
 if(map==='canyon'&&gate==='west')return{mapId:'ruins' as const,...RUINS_EAST_ENTRY};
	return null;
}
/** Where each gate leads (mirrors travelDestination). */
export const GATE_LINKS: Record<MapId, Record<string, MapId>> = {
	city_plaza: { south: 'meadow', east: 'forest' },
	meadow: { north: 'city_plaza' },
	forest: { west: 'city_plaza', east: 'ruins' },
	ruins: { west: 'forest', east: 'canyon' },
	canyon: { west: 'ruins' },
};
/** Gates to walk through, in order, to get from one map to another (empty when already there or unreachable). */
export function gateRoute(from: MapId, to: MapId): { map: MapId; gate: string }[] {
	const back = new Map<MapId, { map: MapId; gate: string } | null>([[from, null]]);
	const queue: MapId[] = [from];
	while (queue.length) {
		const map = queue.shift()!;
		if (map === to) break;
		for (const [gate, next] of Object.entries(GATE_LINKS[map])) if (!back.has(next)) { back.set(next, { map, gate }); queue.push(next); }
	}
	if (!back.has(to)) return [];
	const steps: { map: MapId; gate: string }[] = [];
	for (let at = to, step = back.get(at); step; at = step.map, step = back.get(at)) steps.unshift(step);
	return steps;
}
