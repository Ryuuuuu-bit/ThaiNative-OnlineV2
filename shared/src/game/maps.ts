import {circleIndex,circleGrid,GRID_MAX_R} from './obstacle-index.js';
import {CITY_COLLISION,cityNpcPlacement} from './city-approved-layout.js';
export {CITY_LAYOUT,CITY_COLLISION,cityNpcPlacement,cityLayoutGeometry,type CityLayoutItem} from './city-approved-layout.js';
import {DECOR,GARDEN_TREES,FORTIFICATION_SOLIDS,CITY2D_FOUNTAIN,CITY2D_HEALER} from './city-details.js';
import meadow from '../../data/maps/meadow.generated.json' with {type:'json'};
import forest from '../../data/maps/forest.generated.json' with {type:'json'};
import ruins from '../../data/maps/ruins.generated.json' with {type:'json'};
import canyon from '../../data/maps/canyon.generated.json' with {type:'json'};
import grove from '../../data/maps/grove.generated.json' with {type:'json'};
import himmapan from '../../data/maps/himmapan.generated.json' with {type:'json'};
import temple from '../../data/maps/temple.generated.json' with {type:'json'};
import summit from '../../data/maps/summit.generated.json' with {type:'json'};
export * from './city-details.js';
import exploration from '../../data/maps/exploration.generated.json' with {type:'json'};
import connections from '../../data/world-connections.json' with {type:'json'};
import {MAP_IDS,BIOME_IDS,EXPLORATION_IDS,type BiomeMapId,type MapId,type FieldMapId,type HuntingMapId,type ExplorationMapId} from './world-ids.js';
export {MAP_IDS,BIOME_IDS,EXPLORATION_IDS};
export type {BiomeMapId,MapId,FieldMapId,HuntingMapId,ExplorationMapId};
const regionRecord=<T>(get:(id:BiomeMapId)=>T)=>Object.fromEntries(BIOME_IDS.map(id=>[id,get(id)])) as Record<BiomeMapId,T>;
/** All outdoor maps, including regions whose encounters are still being authored. */
export const isField=(m:MapId|undefined):m is FieldMapId=>m!==undefined&&m!=='city_plaza'&&(MAP_IDS as readonly string[]).includes(m);
export const MAP_INFO:Record<MapId,{name:string;levels:string;hint:string}>={
 ...regionRecord(id=>({name:exploration[id].name,levels:exploration[id].levels,hint:exploration[id].exploration?'พื้นที่สำรวจ · มอนสเตอร์และรางวัลยังไม่เปิด':'พื้นที่ล่า Lv.'+exploration[id].levels+' · ระวังกลไกเฉพาะตัว'})),
 himmapan:{name:'ป่าหิมพานต์และธารนาคา',levels:'35–40',hint:'พื้นที่ล่า Lv.35–40 · มอนสเตอร์เรียงจากทางเข้าถึงลานบอส'},
 temple:{name:'วิหารกรีกหลงกาล',levels:'30–35',hint:'พื้นที่ล่า Lv.30–35 · มอนสเตอร์เรียงจากทางเข้าถึงลานบอส'},
 grove:{name:'ป่าอรุณอำพัน',levels:'20–25',hint:'พื้นที่ล่า Lv.20–25 · มอนสเตอร์เรียงจากทางเข้าถึงลานบอส'},
 summit:{name:'ผาผลึกจันทรา',levels:'25–30',hint:'พื้นที่ล่า Lv.25–30 · มอนสเตอร์เรียงจากทางเข้าถึงลานบอส'},
 city_plaza:{name:'นครที่ถูกลืมเลือน',levels:'เขตปลอดภัย',hint:'เตรียมเสบียงก่อนออกเดินทาง'},
 meadow:{name:'ทุ่งวุ้นจิ๋ว',levels:'1–5',hint:'วุ้น Lv.1 · กระต่าย Lv.3 · ด้วง Elite Lv.4 · ราชาวุ้น Lv.5'},
 forest:{name:'ป่าหมอก',levels:'5–10',hint:'พื้นที่ล่า Lv.5–10 · มอนสเตอร์เรียงจากทางเข้าถึงลานบอส'},
 ruins:{name:'ซากนครโบราณ',levels:'10–15',hint:'พื้นที่ล่า Lv.10–15 · มอนสเตอร์เรียงจากทางเข้าถึงลานบอส'},
 canyon:{name:'หุบเขาหิน',levels:'15–20',hint:'พื้นที่ล่า Lv.15–20 · มอนสเตอร์เรียงจากทางเข้าถึงลานบอส'},
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
 exploration?:boolean;
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
export const CITY = { halfX: 48, halfZ: 48, empty: false };
export const CITY_SPAWN = { x: 0, z: 14 };
export const CITY_RETURN = { x: 0, z: 44 };
export const CITY_EAST_RETURN = { x: 44, z: 0 };
export const CITY_NORTH_RETURN = {x:0,z:-44},CITY_WEST_RETURN={x:-44,z:0};
export const CITY_TOWER = { half: 2 };
export const CITY_FOUNTAIN = CITY2D_FOUNTAIN;
export const HEALER = cityNpcPlacement('healer');
export const GATE_CAPTAIN = cityNpcPlacement('guard');
export const CITY_BUILDINGS = [
	{ id: 'storage', name: 'คลังเก็บของ', npc: 'คนเฝ้าคลัง', x: 13, z: -20, w: 8, d: 6, talk: { x: 12, z: -15 } },
	{ id: 'forge', name: 'โรงตีเหล็ก', npc: 'ช่างตีเหล็ก', x: -25, z: -15, w: 9, d: 8, talk: { x: -19, z: -12 } },
	{ id: 'market', name: 'ตลาด', npc: 'พ่อค้าเบ็ดเตล็ด', x: 25, z: 13, w: 8, d: 7, talk: { x: 18, z: 13 } },
].map(b=>({...b,talk:cityNpcPlacement(b.id==='forge'?'blacksmith':b.id==='market'?'merchant':'clerk')}));
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
const cityBoxes = CITY_COLLISION.boxes;
const cityCircleHits = circleIndex(CITY_COLLISION.circles);
export function cityWalkable(x: number, z: number, r: number) {
	if (Math.abs(x) >= CITY.halfX - 1 - r || Math.abs(z) >= CITY.halfZ - 1 - r) return false;
	if (CITY.empty) return true;
	if (cityCircleHits(x,z,r)) return false;
	return !cityBoxes.some(b => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r);
}

/* ---------------------------------------------------------------- meadow: ทุ่งวุ้นจิ๋ว, 100 x 84 m, Lv 1-5 */
export const MEADOW = { halfX: meadow.halfX, halfZ: meadow.halfZ };
export const MEADOW_ENTRY = meadow.entry;
export const MEADOW_PLACES = meadow.pois;
export const MEADOW_HABITATS = meadow.spawnZones;
export function meadowHabitatAt(x:number,z:number){
 return fieldHabitatAt('meadow',x,z);
}
const meadowBase = {
	paths: meadow.paths as Path[],
	water: meadow.water as Ellipse[],
	camps: meadow.camps,
	arena: meadow.arena,
};
const meadowObstacles = meadow.obstacles;
/** Painted landmarks (world-scale art pass): solid, but drawn by the scene itself rather than as trees/boulders. */
export const MEADOW_LANDMARKS = {
	circles: meadow.landmarks.circles as Circle[],
	boxes: meadow.landmarks.boxes,
};
const meadowCircles = [...meadowObstacles, ...MEADOW_LANDMARKS.circles];
const meadowHits = circleGrid(meadowCircles), meadowWideHits = circleIndex(meadowCircles);
export function meadowWalkable(x: number, z: number, r: number) {
	if (Math.abs(x) >= MEADOW.halfX - 1 - r || Math.abs(z) >= MEADOW.halfZ - 1 - r) return false;
	if (inWater(meadowBase.water, x, z, r)) return false;
	if (MEADOW_LANDMARKS.boxes.some(b => Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r)) return false;
	return r <= GRID_MAX_R ? !meadowHits(x,z,r) : !meadowWideHits(x,z,r);
}

/* ---------------------------------------------------------------- forest: ป่าหมอก, 120 x 96 m, Lv 5-10 */
export const FOREST = {halfX:forest.halfX,halfZ:forest.halfZ};
export const FOREST_ENTRY = forest.entry;
export const FOREST_CAMP = forest.camps[0];
export const FOREST_ARENA = {x:forest.arena.x,z:forest.arena.z};
const forestBase = {paths:forest.paths as Path[],water:forest.water as Ellipse[],camps:forest.camps,arena:forest.arena};
export const FOREST_TREES:Circle[] = forest.obstacles;
export const forestPool = (x:number,z:number) => inWater(forestBase.water,x,z);
const forestHits=circleGrid(FOREST_TREES),forestWideHits=circleIndex(FOREST_TREES);
export function forestWalkable(x:number,z:number,r:number){
 if(Math.abs(x)>=FOREST.halfX-1-r||Math.abs(z)>=FOREST.halfZ-1-r||inWater(forestBase.water,x,z,r))return false;
 return r<=GRID_MAX_R?!forestHits(x,z,r):!forestWideHits(x,z,r);
}

/* ---------------------------------------------------------------- spawns, bosses, gates */
export const MEADOW_SPAWNS = zoneSpawns(3301, meadow.spawnZones as SpawnZone[], (x, z) => meadowWalkable(x, z, 0.5) && !meadowBase.camps.some(c => Math.hypot(x - c.x, z - c.z) < 6) && Math.hypot(x - meadowBase.arena.x, z - meadowBase.arena.z) > 7 && Math.hypot(x - MEADOW_ENTRY.x, z - MEADOW_ENTRY.z) > 10);
export const FOREST_SPAWNS = zoneSpawns(3302,forest.spawnZones as SpawnZone[],(x,z)=>forestWalkable(x,z,.5)&&forestBase.camps.every(c=>Math.hypot(x-c.x,z-c.z)>6)&&Math.hypot(x-FOREST_ARENA.x,z-FOREST_ARENA.z)>8&&Math.hypot(x-FOREST_ENTRY.x,z-FOREST_ENTRY.z)>8);

export const RUINS={halfX:ruins.halfX,halfZ:ruins.halfZ},CANYON={halfX:canyon.halfX,halfZ:canyon.halfZ};
export const RUINS_ENTRY=ruins.entry,CANYON_ENTRY=canyon.entry;
const ruinsBase={paths:ruins.paths as Path[],water:ruins.water as Ellipse[],camps:ruins.camps,arena:ruins.arena};
const canyonBase={paths:canyon.paths as Path[],water:canyon.water as Ellipse[],camps:canyon.camps,arena:canyon.arena};
export const RUINS_STRUCTURES=ruins.structures;
const ruinsObstacles:Circle[]=ruins.obstacles,canyonObstacles:Circle[]=canyon.obstacles;
const groveBase={paths:grove.paths as Path[],water:grove.water as Ellipse[],camps:grove.camps,arena:grove.arena};
const himmapanBase={paths:himmapan.paths as Path[],water:himmapan.water as Ellipse[],camps:himmapan.camps,arena:himmapan.arena};
const himmapanHits=circleIndex(himmapan.obstacles);
export const himmapanWalkable=(x:number,z:number,r=.3)=>huntingWalkable(himmapan,himmapanBase,himmapanHits,x,z,r);
const templeBase={paths:temple.paths as Path[],water:temple.water as Ellipse[],camps:temple.camps,arena:temple.arena};
const templeHits=circleIndex(temple.obstacles);
export const templeWalkable=(x:number,z:number,r=.3)=>huntingWalkable(temple,templeBase,templeHits,x,z,r);
const summitBase={paths:summit.paths as Path[],water:summit.water as Ellipse[],camps:summit.camps,arena:summit.arena};
const groveHits=circleIndex(grove.obstacles),summitHits=circleIndex(summit.obstacles);
export const groveWalkable=(x:number,z:number,r=.3)=>huntingWalkable(grove,groveBase,groveHits,x,z,r);
export const summitWalkable=(x:number,z:number,r=.3)=>huntingWalkable(summit,summitBase,summitHits,x,z,r);
const ruinsHits=circleIndex(ruinsObstacles),canyonHits=circleIndex(canyonObstacles);
function huntingWalkable(half:{halfX:number;halfZ:number},base:{water:Ellipse[]},hits:ReturnType<typeof circleIndex>,x:number,z:number,r:number){
 return Math.abs(x)<half.halfX-1-r&&Math.abs(z)<half.halfZ-1-r&&!inWater(base.water,x,z,r)&&!hits(x,z,r);
}
export const ruinsWalkable=(x:number,z:number,r=.3)=>huntingWalkable(RUINS,ruinsBase,ruinsHits,x,z,r);
export const canyonWalkable=(x:number,z:number,r=.3)=>huntingWalkable(CANYON,canyonBase,canyonHits,x,z,r);
function huntingSpawns(seed:number,zones:SpawnZone[],base:{camps:{x:number;z:number}[];arena:{x:number;z:number}},entry:{x:number;z:number},walk:(x:number,z:number,r:number)=>boolean){
 return zoneSpawns(seed,zones,(x,z)=>walk(x,z,.65)&&base.camps.every(c=>Math.hypot(x-c.x,z-c.z)>7)&&Math.hypot(x-entry.x,z-entry.z)>10&&Math.hypot(x-base.arena.x,z-base.arena.z)>9);
}
export const RUINS_SPAWNS=huntingSpawns(5501,ruins.spawnZones as SpawnZone[],ruinsBase,RUINS_ENTRY,ruinsWalkable);
export const CANYON_SPAWNS=huntingSpawns(5502,canyon.spawnZones as SpawnZone[],canyonBase,CANYON_ENTRY,canyonWalkable);
const GROVE_SPAWNS=huntingSpawns(6601,grove.spawnZones as SpawnZone[],groveBase,grove.entry,groveWalkable);
const HIMMAPAN_SPAWNS=huntingSpawns(8859,himmapan.spawnZones as SpawnZone[],himmapanBase,himmapan.entry,himmapanWalkable);
const TEMPLE_SPAWNS=huntingSpawns(7749,temple.spawnZones as SpawnZone[],templeBase,temple.entry,templeWalkable);
const SUMMIT_SPAWNS=huntingSpawns(6602,summit.spawnZones as SpawnZone[],summitBase,summit.entry,summitWalkable);
/** Named habitats and landmarks shared by navigation, HUD, minimap and scene art. */
export const FIELD_HABITATS:Record<FieldMapId,(SpawnZone&{name:string})[]>={...regionRecord(id=>exploration[id].spawnZones as (SpawnZone&{name:string})[]),himmapan:himmapan.spawnZones as (SpawnZone&{name:string})[],meadow:meadow.spawnZones as (SpawnZone&{name:string})[],forest:forest.spawnZones as (SpawnZone&{name:string})[],ruins:ruins.spawnZones as (SpawnZone&{name:string})[],canyon:canyon.spawnZones as (SpawnZone&{name:string})[],grove:grove.spawnZones as (SpawnZone&{name:string})[],summit:summit.spawnZones as (SpawnZone&{name:string})[],temple:temple.spawnZones as (SpawnZone&{name:string})[]};
export const FIELD_PLACES={...regionRecord(id=>exploration[id].pois),himmapan:himmapan.pois,meadow:meadow.pois,forest:forest.pois,ruins:ruins.pois,canyon:canyon.pois,grove:grove.pois,summit:summit.pois,temple:temple.pois};
export function fieldHabitatAt(map:FieldMapId,x:number,z:number){
 return FIELD_HABITATS[map].map(h=>({h,d:((x-h.x)/h.rx)**2+((z-h.z)/h.rz)**2})).filter(v=>v.d<=1).sort((a,b)=>a.d-b.d)[0]?.h??null;
}
export const MAP_ENTRY:Record<MapId,{x:number;z:number}>={...regionRecord(id=>exploration[id].entry),himmapan:himmapan.entry,city_plaza:CITY_SPAWN,meadow:MEADOW_ENTRY,forest:FOREST_ENTRY,ruins:RUINS_ENTRY,canyon:CANYON_ENTRY,grove:grove.entry,summit:summit.entry,temple:temple.entry};
/** Per-map field boss: appears when the map's timer is due and comes back `respawnMinutes` after it dies. */
type FieldBossRule={dataId:string;x:number;z:number;minion:string;respawnMinutes:number};
export const FIELD_BOSS: Record<HuntingMapId,FieldBossRule> & Partial<Record<ExplorationMapId,FieldBossRule>> = {
 confluence:{dataId:'confluence_worldcore_sovereign',x:exploration.confluence.arena.x,z:exploration.confluence.arena.z,minion:'confluence_life_pillar_guard',respawnMinutes:30},
 abyss:{dataId:'abyss_primordial_sea_dragon',x:exploration.abyss.arena.x,z:exploration.abyss.arena.z,minion:'abyss_black_salt_crab',respawnMinutes:30},
 astral:{dataId:'astral_star_eating_eclipse',x:exploration.astral.arena.x,z:exploration.astral.arena.z,minion:'astral_stardust_jellyfish',respawnMinutes:30},
 ocean:{dataId:'ocean_stormcrown_kraken',x:exploration.ocean.arena.x,z:exploration.ocean.arena.z,minion:'ocean_storm_conch',respawnMinutes:30},
 fae:{dataId:'fae_twilight_antler_king',x:exploration.fae.arena.x,z:exploration.fae.arena.z,minion:'fae_puca_shadowhorse',respawnMinutes:30},
 volcano:{dataId:'volcano_golden_ash_zmey',x:exploration.volcano.arena.x,z:exploration.volcano.arena.z,minion:'volcano_lava_glass_lizard',respawnMinutes:30},
 dragon:{dataId:'dragon_cloud_dragon_lord',x:exploration.dragon.arena.x,z:exploration.dragon.arena.z,minion:'dragon_cloud_carp',respawnMinutes:30},
 yokai:{dataId:'yokai_08',x:exploration.yokai.arena.x,z:exploration.yokai.arena.z,minion:'yokai_01',respawnMinutes:30},
 frost:{dataId:'frost_08',x:exploration.frost.arena.x,z:exploration.frost.arena.z,minion:'frost_03',respawnMinutes:30},
 desert:{dataId:'desert_08',x:exploration.desert.arena.x,z:exploration.desert.arena.z,minion:'desert_01',respawnMinutes:30},
 himmapan:{dataId:'himmapan_08',x:himmapan.arena.x,z:himmapan.arena.z,minion:'himmapan_03',respawnMinutes:30},
	meadow: { dataId: 'king_jelly', x: meadowBase.arena.x, z: meadowBase.arena.z, minion: 'jelly_summon', respawnMinutes: 30 },
	forest: { dataId: 'mist_warden', x: FOREST_ARENA.x, z: FOREST_ARENA.z, minion: 'mist_shroom', respawnMinutes: 30 },
 ruins:{dataId:'relic_warden',x:ruins.arena.x,z:ruins.arena.z,minion:'ruin_shroom',respawnMinutes:30},
 grove:{dataId:'grove_crown',x:grove.arena.x,z:grove.arena.z,minion:'amber_mantis',respawnMinutes:30},
 temple:{dataId:'greek_minotaur',x:temple.arena.x,z:temple.arena.z,minion:'greek_satyr',respawnMinutes:30},
 summit:{dataId:'moon_titan',x:summit.arena.x,z:summit.arena.z,minion:'moon_crab',respawnMinutes:30},
 canyon:{dataId:'crag_titan',x:canyon.arena.x,z:canyon.arena.z,minion:'crag_slime',respawnMinutes:30},
};
export const BOSS_RESPAWN_MS = (m: FieldMapId) => (FIELD_BOSS[m]?.respawnMinutes ?? 30) * 60000;
/** Optional forest arena, independent of the field boss. */
export const THORN_NEST={dataId:'thorn_nest_mother',x:-24,z:30,minion:'mist_weaver',respawnMinutes:30};

const explorationHits=regionRecord(id=>circleIndex(exploration[id].obstacles));
export const LAYOUTS: Record<MapId, Layout> = {
 ...regionRecord(id=>({...exploration[id],paths:exploration[id].paths as Path[],exploration:exploration[id].exploration,spawns:exploration[id].exploration?[]:huntingSpawns(9959,exploration[id].spawnZones as SpawnZone[],exploration[id],exploration[id].entry,(x,z,r)=>biomeWalkable(id,x,z,r)&&Math.hypot(x-exploration[id].arena.x,z-exploration[id].arena.z)>exploration[id].arena.r+1)})),
 himmapan:{halfX:himmapan.halfX,halfZ:himmapan.halfZ,...himmapanBase,exploration:false,obstacles:himmapan.obstacles,spawns:HIMMAPAN_SPAWNS},
	city_plaza: { halfX: CITY.halfX, halfZ: CITY.halfZ, obstacles: [], water: [], paths: [], camps: [], spawns: [] },
	meadow: { halfX: MEADOW.halfX, halfZ: MEADOW.halfZ, ...meadowBase, obstacles: meadowObstacles, spawns: MEADOW_SPAWNS },
	forest: { halfX: FOREST.halfX, halfZ: FOREST.halfZ, ...forestBase, obstacles: FOREST_TREES, spawns: FOREST_SPAWNS.map(s => ({ ...s })) },
 ruins:{...RUINS,...ruinsBase,obstacles:ruinsObstacles,spawns:RUINS_SPAWNS},
 canyon:{...CANYON,...canyonBase,obstacles:canyonObstacles,spawns:CANYON_SPAWNS},
 grove:{halfX:grove.halfX,halfZ:grove.halfZ,...groveBase,obstacles:grove.obstacles,spawns:GROVE_SPAWNS},
 temple:{halfX:temple.halfX,halfZ:temple.halfZ,...templeBase,obstacles:temple.obstacles,spawns:TEMPLE_SPAWNS},
 summit:{halfX:summit.halfX,halfZ:summit.halfZ,...summitBase,obstacles:summit.obstacles,spawns:SUMMIT_SPAWNS},
};
export const campsFor = (m: MapId) => LAYOUTS[m].camps;
export function nearestCamp(m: MapId, x: number, z: number) {
	return campsFor(m).reduce((best, c) => (Math.hypot(c.x - x, c.z - z) < Math.hypot(best.x - x, best.z - z) ? c : best), campsFor(m)[0]);
}

const fieldSources={meadow,forest,ruins,canyon,grove,summit,temple,himmapan,...exploration};
export const GATES:Record<MapId,Record<string,{x:number;z:number}>>={
 city_plaza:{south:{x:0,z:CITY.halfZ-1},north:{x:0,z:-(CITY.halfZ-1)},east:{x:CITY.halfX-1,z:0},west:{x:-(CITY.halfX-1),z:0}},
 ...Object.fromEntries(Object.entries(fieldSources).map(([id,data])=>[id,Object.fromEntries(Object.entries(data.gates).map(([direction,{x,z}])=>[direction,{x,z}]))])) as Record<FieldMapId,Record<string,{x:number;z:number}>>,
};

export function biomeWalkable(id:BiomeMapId,x:number,z:number,r=.3){return huntingWalkable(exploration[id],exploration[id],explorationHits[id],x,z,r);}
export function travelDestination(map: MapId, gate: string, p: { x: number; z: number; dead?: boolean }) {
	const trigger = (GATES[map] as Record<string, { x: number; z: number }>)[gate];
	if (p.dead || !trigger || Math.hypot(p.x - trigger.x, p.z - trigger.z) > 1.5) return null;
	if (map === 'city_plaza' && gate === 'south') return { mapId: 'meadow' as const, ...MEADOW_ENTRY };
	if (map === 'meadow' && gate === 'north') return { mapId: 'city_plaza' as const, ...CITY_RETURN };
	if (map === 'city_plaza' && gate === 'east') return { mapId: 'forest' as const, ...FOREST_ENTRY };
	if (map === 'forest' && gate === 'west') return { mapId: 'city_plaza' as const, ...CITY_EAST_RETURN };
 if(map==='city_plaza'&&gate==='north')return{mapId:'ruins' as const,...RUINS_ENTRY};
 if(map==='ruins'&&gate==='south')return{mapId:'city_plaza' as const,...CITY_NORTH_RETURN};
 if(map==='city_plaza'&&gate==='west')return{mapId:'canyon' as const,...CANYON_ENTRY};
 if(map==='canyon'&&gate==='east')return{mapId:'city_plaza' as const,...CITY_WEST_RETURN};
 if(map==='canyon'&&gate==='west')return{mapId:'grove' as const,...grove.entry};
 if(map==='grove'&&gate==='east')return{mapId:'canyon' as const,x:canyon.gates.west.x+4,z:canyon.gates.west.z};
 if(map==='grove'&&gate==='west')return{mapId:'summit' as const,...summit.entry};
 if(map==='summit'&&gate==='east')return{mapId:'grove' as const,x:grove.gates.west.x+4,z:grove.gates.west.z};
 if(map==='summit'&&gate==='west')return{mapId:'temple' as const,...temple.entry};
 if(map==='forest'&&gate==='east')return{mapId:'himmapan' as const,...himmapan.entry};
 if(map==='himmapan'&&gate==='west')return{mapId:'forest' as const,x:forest.gates.east.x-4,z:forest.gates.east.z};
 if(map==='temple'&&gate==='east')return{mapId:'summit' as const,x:summit.gates.west.x+4,z:summit.gates.west.z};
 const destination=GATE_LINKS[map][gate];
 if(destination){const back=Object.entries(GATE_LINKS[destination]).find(([,to])=>to===map)?.[0],exit=back?GATES[destination][back]:undefined;
  if(exit)return{mapId:destination,x:exit.x+(back==='west'?4:back==='east'?-4:0),z:exit.z+(back==='north'?4:back==='south'?-4:0)};
 }
	return null;
}
/** Where each gate leads (mirrors travelDestination). */
export const GATE_LINKS=connections as Record<MapId,Record<string,MapId>>;
/** With a player level, avoid the strongest transit encounter first, then use fewer gates.
 * The chosen destination is intentional; empty exploration maps add no combat risk. */
export function gateRoute(from: MapId, to: MapId, playerLevel?:number): { map: MapId; gate: string }[] {
 const level=Number.isFinite(playerLevel)?Math.max(1,playerLevel!):undefined;
 const risk=(map:MapId)=>level!==undefined&&map!==from&&map!==to&&map!=='city_plaza'&&!LAYOUTS[map].exploration?Math.max(0,parseInt(MAP_INFO[map].levels,10)-level-2):0;
 // The first reachable threshold minimizes the strongest transit encounter.
 // BFS within that threshold then finds the fewest gates, including when risk rises late in a route.
 for(const threshold of [...new Set(MAP_IDS.map(risk))].sort((a,b)=>a-b)){
  const back=new Map<MapId,{map:MapId;gate:string}|null>([[from,null]]),queue:MapId[]=[from];
  while(queue.length){const map=queue.shift()!;if(map===to)break;for(const [gate,next]of Object.entries(GATE_LINKS[map]))if(!back.has(next)&&risk(next)<=threshold){back.set(next,{map,gate});queue.push(next);}}
  if(back.has(to)){const steps:{map:MapId;gate:string}[]=[];for(let at=to,step=back.get(at);step;at=step.map,step=back.get(at))steps.unshift(step);return steps;}
 }
 return [];
}
