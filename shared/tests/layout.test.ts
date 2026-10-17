import test from "node:test";
import assert from "node:assert/strict";
import {
	walkable,
	LAYOUTS,
	GATES,
	CITY_BUILDINGS,
	CITY_SPAWN,
	CITY_RETURN,
	CITY_EAST_RETURN,
	HEALER,
	GATE_CAPTAIN,
	MEADOW_ENTRY,
	FOREST_ENTRY,
	FIELD_BOSS,
	onPath,
	loadGameData,
	type MapId,
} from "../src/index.node.js";
const data = loadGameData();

/** Flood fill on a 1 m grid from a start point. */
function reachable(map: MapId, from: { x: number; z: number }) {
	const seen = new Set<string>(), q = [[Math.round(from.x), Math.round(from.z)]];
	seen.add(q[0].join());
	for (let i = 0; i < q.length; i++) {
		const [x, z] = q[i];
		for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const k = `${x + dx},${z + dz}`;
			if (seen.has(k) || !walkable(x + dx, z + dz, 0.4, map) || !walkable(x + dx / 2, z + dz / 2, 0.4, map)) continue;
			seen.add(k);
			q.push([x + dx, z + dz]);
		}
	}
	return (p: { x: number; z: number }) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => seen.has(`${Math.round(p.x) + dx},${Math.round(p.z) + dz}`));
}

test("maps are about three times larger than the first prototypes", () => {
	assert.ok(LAYOUTS.meadow.halfX * 2 >= 96 && LAYOUTS.meadow.halfZ * 2 >= 80);
	assert.ok(LAYOUTS.forest.halfX * 2 >= 110 && LAYOUTS.forest.halfZ * 2 >= 90);
	assert.ok(LAYOUTS.city_plaza.halfX * 2 >= 90);
	assert.ok(LAYOUTS.meadow.spawns.length >= 40);
});

test("every gate, entry, camp, arena, NPC and spawn is reachable from the map entry", () => {
	const meadow = reachable("meadow", MEADOW_ENTRY);
	for (const p of [GATES.meadow.north, ...LAYOUTS.meadow.camps, FIELD_BOSS.meadow, ...LAYOUTS.meadow.spawns]) assert.ok(meadow(p), `meadow ${JSON.stringify(p)}`);
	const forest = reachable("forest", FOREST_ENTRY);
	for (const p of [GATES.forest.west, ...LAYOUTS.forest.camps, FIELD_BOSS.forest, ...LAYOUTS.forest.spawns]) assert.ok(forest(p), `forest ${JSON.stringify(p)}`);
	const city = reachable("city_plaza", CITY_SPAWN);
	const angel = { x: data.jobs.angel.x, z: data.jobs.angel.z + 1 };
	for (const p of [CITY_RETURN, CITY_EAST_RETURN, HEALER, GATE_CAPTAIN, angel, ...CITY_BUILDINGS.map((b) => b.talk), ...Object.values(GATES.city_plaza)]) assert.ok(city(p), `city ${JSON.stringify(p)}`);
});

test("paths stay walkable apart from the odd bridge-free crossing", () => {
	for (const map of ["meadow", "forest"] as const) {
		const l = LAYOUTS[map];
		let total = 0, blocked = 0;
		for (const p of l.paths)
			for (let i = 1; i < p.points.length; i++) {
				const [a, b] = [p.points[i - 1], p.points[i]], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
				for (let k = 0; k <= n; k++) {
					const x = a[0] + ((b[0] - a[0]) * k) / n, z = a[1] + ((b[1] - a[1]) * k) / n;
					if (Math.abs(x) > l.halfX - 2 || Math.abs(z) > l.halfZ - 2) continue;
					total++;
					if (!walkable(x, z, 0.3, map)) blocked++;
				}
			}
		assert.ok(blocked / total < 0.02, `${map}: ${blocked}/${total} path samples blocked`);
		assert.ok(l.obstacles.every((o) => !onPath(l.paths, o.x, o.z, o.r)), `${map}: no tree on a path`);
	}
});

test("layouts are deterministic across processes", () => {
	const sum = (m: MapId) => LAYOUTS[m].obstacles.reduce((n, o) => n + o.x * 3 + o.z * 7 + o.r, 0) + LAYOUTS[m].spawns.reduce((n, s) => n + s.x + s.z * 2, 0);
	assert.equal(Math.round(sum("meadow") * 1000), Math.round(sum("meadow") * 1000));
	assert.ok(LAYOUTS.forest.obstacles.length >= 100, "forest is dense");
});

test("meadow landmarks are solid and no spawn, camp or path sits inside them", async () => {
	const { MEADOW_LANDMARKS, onPath } = await import("../src/game/maps.js");
	for (const c of MEADOW_LANDMARKS.circles) assert.equal(walkable(c.x, c.z, 0.3, "meadow"), false, c.kind);
	for (const b of MEADOW_LANDMARKS.boxes) {
		assert.equal(walkable(b.x, b.z, 0.3, "meadow"), false, b.kind);
		assert.equal(walkable(b.x + b.w / 2 + 0.6, b.z, 0.3, "meadow") || walkable(b.x - b.w / 2 - 0.6, b.z, 0.3, "meadow"), true, "walk around the tower");
	}
	for (const s of LAYOUTS.meadow.spawns) assert.ok(walkable(s.x, s.z, 0.3, "meadow"), `spawn ${s.x},${s.z}`);
	for (const c of LAYOUTS.meadow.camps) assert.ok(walkable(c.x, c.z, 0.3, "meadow"));
	const all = [...MEADOW_LANDMARKS.circles.map(c => ({ x: c.x, z: c.z, r: c.r })), ...MEADOW_LANDMARKS.boxes.map(b => ({ x: b.x, z: b.z, r: Math.hypot(b.w, b.d) / 2 }))];
	for (const o of all) assert.equal(onPath(LAYOUTS.meadow.paths, o.x, o.z, o.r), false, `landmark on a path at ${o.x},${o.z}`);
});

test("city planters, benches and stalls are solid, stay off the main roads and leave every NPC reachable", async () => {
	const { CITY_PLANTERS, CITY_BENCHES, CITY_STALLS } = await import("../src/game/maps.js");
	const city = (x: number, z: number) => walkable(x, z, 0.3, "city_plaza");
	for (const p of CITY_PLANTERS) assert.equal(city(p.x, p.z), false, `planter ${p.x},${p.z}`);
	for (const b of CITY_BENCHES) assert.equal(city(b.x, b.z), false, `bench ${b.x},${b.z}`);
	for (const s of CITY_STALLS) {
		assert.equal(city(s.x, s.z), false, `stall ${s.x},${s.z}`);
		assert.equal(city(s.x - 1.8, s.z + 0.5), false, "crate beside the stall");
	}
	const boxes = [...CITY_PLANTERS.map(p => ({ x: p.x, z: p.z, w: p.r * 2, d: p.r * 2 })), ...CITY_BENCHES, ...CITY_STALLS.map(s => s.solid)];
	// Both 6 m main roads (|x| < 3, |z| < 3) keep a 0.4 m margin from every prop.
	for (const b of boxes) assert.ok(Math.min(Math.abs(b.x) - b.w / 2, Math.abs(b.z) - b.d / 2) >= 3.4, `prop on a main road at ${b.x},${b.z}`);
	for (const p of [CITY_SPAWN, CITY_RETURN, CITY_EAST_RETURN, HEALER, GATE_CAPTAIN, ...CITY_BUILDINGS.map(b => b.talk)]) assert.ok(city(p.x, p.z), `${p.x},${p.z}`);
});
