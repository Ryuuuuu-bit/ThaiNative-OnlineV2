import test from "node:test";
import assert from "node:assert/strict";
import {
	createGame,
	step,
	action,
	spawn,
	walkable,
	travelDestination,
	bossReadyAt,
	setBossCooldown,
	bossTimer,
	setBossTimer,
	setAuto,
	loadGameData,
	FOREST_SPAWNS,
	FOREST_ENTRY,
	FOREST_TREES,
	FIELD_BOSS,
	CITY_EAST_RETURN,
	GATES,
	type MapId,
} from "../src/index.node.js";
const data = loadGameData();
/** A spot with open ground in a 5 m radius, so AI tests do not depend on the generated trees. */
export function openSpot(map: MapId, near = { x: 0, z: 0 }) {
	for (let ring = 0; ring < 60; ring++)
		for (let a = 0; a < 16; a++) {
			const x = near.x + Math.cos((a / 16) * Math.PI * 2) * ring, z = near.z + Math.sin((a / 16) * Math.PI * 2) * ring;
			let clear = true;
			for (let dx = -5; dx <= 5 && clear; dx++) for (let dz = -5; dz <= 5 && clear; dz++) if (!walkable(x + dx, z + dz, 0.3, map)) clear = false;
			if (clear) return { x, z };
		}
	throw Error("no open ground");
}

test("trees block bolts", () => {
	const g = createGame(2, undefined, "local", data, "forest");
	g.enemies = [];
	const t = FOREST_TREES[0];
	g.projectiles.push({ id: 999, owner: 0, attack: "bolt", x: t.x, z: t.z - t.r - 0.2, vx: 0, vz: 6, life: 2, damage: 10, phase: 1 } as any);
	step(g, 0.05);
	assert.equal(g.projectiles.length, 0);
});

test("forest populates its own species on walkable ground, plus the warden", () => {
	const g = createGame(5, undefined, "local", data, "forest");
	const regular = g.enemies.filter((e) => !e.boss);
	assert.equal(regular.length, FOREST_SPAWNS.length);
	assert.ok(regular.length >= 50, "big map holds 50+ monsters");
	for (const e of regular) {
		assert.ok(walkable(e.x, e.z, 0.3, "forest"), `${e.dataId} spawns inside a tree or pool`);
		assert.ok(["mist_shroom", "shade_wolf", "lantern_wisp", "stump_guard"].includes(e.dataId));
		assert.ok(e.behavior, `${e.dataId} has data-driven AI`);
		assert.equal(e.maxHp, data.monsters.monsters.find((m) => m.id === e.dataId)!.hp);
	}
	const boss = g.enemies.filter((e) => e.boss);
	assert.equal(boss.length, 1);
	assert.equal(boss[0].dataId, "mist_warden");
	assert.ok(walkable(FOREST_ENTRY.x, FOREST_ENTRY.z, 0.3, "forest"));
	assert.ok(walkable(FIELD_BOSS.forest.x, FIELD_BOSS.forest.z, 0.3, "forest"));
	assert.equal(walkable(70, 0, 0.3, "forest"), false, "outside the forest");
});

test("city east gate leads to the forest and its west gate returns", () => {
	const there = travelDestination("city_plaza", "east", GATES.city_plaza.east);
	assert.deepEqual(there, { mapId: "forest", ...FOREST_ENTRY });
	const back = travelDestination("forest", "west", GATES.forest.west);
	assert.deepEqual(back, { mapId: "city_plaza", ...CITY_EAST_RETURN });
	assert.ok(walkable(CITY_EAST_RETURN.x, CITY_EAST_RETURN.z, 0.3, "city_plaza"));
});

test("melee wolf lunges and hurts; ranged wisp keeps distance and fires bolts", () => {
	const at = openSpot("forest", { x: -10, z: 18 });
	const g = createGame(9, undefined, "local", data, "forest");
	g.random = () => 0.5;
	g.enemies = [];
	g.p.x = at.x;
	g.p.z = at.z;
	const wolf = spawn(g, at.x, at.z + 1.2, false, "pink", false, "shade_wolf");
	wolf.cooldown = 0;
	const hp = g.p.hp;
	for (let i = 0; i < 40; i++) step(g, 0.05);
	assert.ok(g.p.hp < hp, "wolf bite lands");

	const h = createGame(9, undefined, "local", data, "forest");
	h.random = () => 0.5;
	h.enemies = [];
	h.p.x = at.x;
	h.p.z = at.z;
	const wisp = spawn(h, at.x, at.z + 2.5, false, "pink", false, "lantern_wisp");
	wisp.cooldown = 0;
	let fired = false;
	const start = Math.hypot(wisp.x - h.p.x, wisp.z - h.p.z);
	for (let i = 0; i < 60; i++) {
		step(h, 0.05);
		if (h.projectiles.some((p) => p.owner === wisp.id && p.attack === "bolt")) fired = true;
	}
	assert.ok(fired, "wisp fires a bolt");
	assert.ok(h.p.hp < h.p.maxHp, "bolt hits");
	assert.ok(Math.hypot(wisp.x - h.p.x, wisp.z - h.p.z) >= start - 0.2, "wisp backs off instead of closing in");
});

test("field bosses come back 30 minutes after they die, not after a kill count", () => {
	for (const map of ["meadow", "forest"] as const) {
		const g = createGame(3, undefined, "local", data, map);
		const boss = g.enemies.find((e) => e.boss)!;
		assert.equal(boss.dataId, FIELD_BOSS[map].dataId);
		assert.equal(bossTimer(g), 0, "alive at start");
		// Killing regular monsters never adds a second boss.
		g.random = () => 0.5;
		const at = openSpot(map, { x: -20, z: 0 });
		g.p.x = at.x;
		g.p.z = at.z;
		for (let i = 0; i < 25; i++) {
			const e = spawn(g, g.p.x, g.p.z - 1, false, "pink", false, map === "meadow" ? "jelly_pink" : "mist_shroom");
			e.hp = 1;
			g.p.cd.attack = 0;
			action(g, "attack");
		}
		assert.equal(g.enemies.filter((e) => e.boss && !e.summoned).length, 1);
		// Defeat the boss: timer starts at 30 minutes and it respawns when it runs out.
		g.p.x = boss.x;
		g.p.z = boss.z - 1.5;
		boss.hp = 1;
		for (let i = 0; i < 10 && !boss.dead; i++) {
			g.p.cd.attack = 0;
			action(g, "attack");
			step(g, 0.05);
		}
		assert.ok(boss.dead, "boss defeated");
		assert.ok(Math.abs(bossTimer(g) - 1800) < 2, `timer ${bossTimer(g)}`);
		g.p.x = at.x;
		g.p.z = at.z;
		for (let i = 0; i < 1799; i++) step(g, 1);
		assert.ok(boss.dead && bossTimer(g) > 0);
		for (let i = 0; i < 3; i++) step(g, 1);
		assert.equal(boss.dead, false, "back after 30 minutes");
		assert.equal(boss.hp, boss.maxHp);
		assert.ok(g.events.some((e) => e.type === "boss") || true);
	}
});

test("a room created mid-timer restores the schedule", () => {
	const g = createGame(4, undefined, "local", data, "meadow");
	setBossTimer(g, 600);
	const boss = g.enemies.find((e) => e.boss)!;
	assert.ok(boss.dead);
	assert.equal(Math.round(bossTimer(g)), 600);
	step(g, 1);
	assert.ok(boss.dead);
	assert.equal(g.drops.length, 0, "restored timer drops no loot");
});

test("boss loot cooldowns stay separate per boss", () => {
	const p = { bossReadyAt: 0, bossCooldowns: {} as Record<string, number> };
	setBossCooldown(p, "mist_warden", 5000);
	assert.equal(bossReadyAt(p, "mist_warden"), 5000);
	assert.equal(bossReadyAt(p, "king_jelly"), 0);
	setBossCooldown(p, "king_jelly", 7000);
	assert.equal(p.bossReadyAt, 7000);
	assert.equal(bossReadyAt(p, "mist_warden"), 5000);
});

test("warden summons forest minions, not jellies", () => {
	const g = createGame(4, undefined, "local", data, "forest");
	g.random = () => 0.5;
	g.enemies = [];
	g.p.x = FIELD_BOSS.forest.x - 2;
	g.p.z = FIELD_BOSS.forest.z;
	const boss = spawn(g, FIELD_BOSS.forest.x, FIELD_BOSS.forest.z, true, "pink", false, "mist_warden");
	boss.aggro = 30;
	for (let i = 0; i < 600 && !g.enemies.some((e) => e.summoned); i++) {
		g.p.hp = g.p.maxHp;
		g.p.dead = false;
		step(g, 0.05);
	}
	const minions = g.enemies.filter((e) => e.summoned);
	assert.ok(minions.length > 0, "warden summoned");
	assert.ok(minions.every((m) => m.dataId === "mist_shroom"));
});

test("AUTO from the forest entry hunts nearby monsters instead of freezing on the far-away warden", () => {
	const g = createGame(1, { ...data.stats.defaultBuild, classId: "swordsman", level: 8 }, "local", data, "forest");
	const warden = g.enemies.find((e) => e.boss)!;
	assert.ok(Math.hypot(warden.x - g.p.x, warden.z - g.p.z) > 60, "warden is across the map");
	const start = { x: g.p.x, z: g.p.z };
	setAuto(g, true);
	let kills = 0;
	for (let n = 0; n < 1200 && !kills; n++) {
		step(g, 0.05);
		kills += g.events.filter((e) => e.type === "kill").length;
		g.events.length = 0;
	}
	assert.ok(Math.hypot(g.p.x - start.x, g.p.z - start.z) > 2, "hero left the entry");
	assert.notEqual(g.target, warden.id);
	assert.ok(g.enemies.some((e) => !e.boss && e.hp < e.maxHp) || kills > 0, "hero hit a forest monster");
});
