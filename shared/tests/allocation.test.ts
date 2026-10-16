import test from "node:test";
import assert from "node:assert/strict";
import {
	loadGameData,
	deriveStats,
	autoAllocateStats,
	allocateStats,
	resetStats,
	allocationPreview,
	createGame,
	step,
	action,
	spawn,
	statPointCost,
} from "../src/index.node.js";
const data = loadGameData(),
	state = (points = 26) => ({
		profile: structuredClone(data.stats.defaultBuild),
		statPoints: points,
		autoAllocate: true,
		autoAllocCursor: 0,
	});
test("per-second regeneration golden and five second combat recovery", () => {
	const p = deriveStats(data.stats.defaultBuild, data);
	assert.equal(p.spRegen, 3.09456);
	assert.equal(p.hpRegen, 1.252);
	const g = createGame();
	g.enemies = [];
	g.p.x = g.p.z = 0;
	g.p.mp = 0;
	g.p.hp = 50;
	step(g, 1);
	assert.ok(Math.abs(g.p.mp - p.spRegen) < 1e-9);
	assert.ok(Math.abs(g.p.hp - 51.252) < 1e-9);
	g.p.lastCombat = g.time;
	const before = g.p.hp;
	step(g, 1);
	assert.ok(Math.abs(g.p.hp - before - p.hpRegen * 0.2) < 1e-9);
	for (let i = 0; i < 5; i++) step(g, 1);
	const rested = g.p.hp;
	step(g, 1);
	assert.ok(Math.abs(g.p.hp - rested - p.hpRegen) < 1e-9);
});
test("weighted round robin spends 26 points for exactly thirteen weighted raises; remainder carries", () => {
	const first = autoAllocateStats(state(), data);
	assert.equal(first.statPoints, 0);
	assert.deepEqual(first.profile.baseStats, {
		str: 9,
		agi: 5,
		vit: 7,
		int: 4,
		dex: 5,
		luk: 2,
	});
	const odd = autoAllocateStats(state(3), data);
	assert.equal(odd.statPoints, 1);
	const next = autoAllocateStats(
		{ ...odd, statPoints: odd.statPoints + 3 },
		data,
	);
	assert.equal(next.statPoints, 0);
	assert.equal(
		Object.values(next.profile.baseStats).reduce((a, b) => a + b) -
			Object.values(state().profile.baseStats).reduce((a, b) => a + b),
		3,
	);
});
test("preview equals allocation, manual spending disables auto, reset refunds earned points only", () => {
	const base = state(9),
		preview = allocationPreview(base, { str: 3, int: 1 }, data),
		server = allocateStats(base, { str: 3, int: 1 }, data);
	assert.deepEqual(preview.derived, deriveStats(server.profile, data));
	assert.equal(server.autoAllocate, false);
	assert.equal(server.statPoints, 1);
	assert.deepEqual(resetStats(server, data), { ...base, autoAllocate: false });
	assert.throws(() =>
		resetStats(server, {
			...data,
			stats: { ...data.stats, statResetFree: false },
		}),
	);
});
test("allocation rejects overbudget, negative and overcap atomically; cost boundaries respected", () => {
	const base = state(3);
	for (const add of [{ str: 2 }, { str: -1 }, { str: 99 }])
		assert.throws(() => allocateStats(base, add, data));
	assert.equal(base.statPoints, 3);
	assert.equal(statPointCost(10, data), 2);
	assert.equal(statPointCost(11, data), 3);
	const capped = state(9999);
	for (const key of data.stats.baseStats) capped.profile.baseStats[key] = 99;
	assert.equal(autoAllocateStats(capped, data).statPoints, 9999);
});
test("damage dealt refreshes combat timer and levelup allocates before deriving stats", () => {
	const g = createGame();
	g.random = () => 0.5;
	g.enemies = [];
	g.p.x = g.p.z = 0;
	spawn(g, 0, 0.5);
	action(g, "spin");
	assert.equal(g.p.lastCombat, g.time);
	g.drops.push({
		ownerId: g.p.id,
		id: 100,
		x: 0,
		z: 0,
		gold: 0,
		xp: 200,
		time: 1,
	});
	step(g, 0.01);
	assert.equal(g.p.level, 3);
	assert.equal(g.p.statPoints, 0);
	assert.ok(g.p.stats.atk > deriveStats(data.stats.defaultBuild, data).atk);
	assert.equal(g.events.filter((e) => e.type === "level").length, 2);
});
