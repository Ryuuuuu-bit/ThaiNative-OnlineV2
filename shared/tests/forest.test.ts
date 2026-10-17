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
	loadGameData,
	FOREST_SPAWNS,
	FOREST_ENTRY,
	FIELD_BOSS,
	CITY_EAST_RETURN,
	GATES,
} from "../src/index.node.js";
const data = loadGameData();

test("trees block bolts", () => {
	const g = createGame(2, undefined, "local", data, "forest");
	g.enemies = [];
	g.projectiles.push({ id: 999, owner: 0, attack: "bolt", x: -9, z: 8, vx: 0, vz: 6, life: 2, damage: 10, phase: 1 } as any);
	step(g, 0.05);
	assert.equal(g.projectiles.length, 0);
});
test("forest populates its own species on walkable ground", () => {
	const g = createGame(5, undefined, "local", data, "forest");
	assert.equal(g.enemies.length, FOREST_SPAWNS.length);
	for (const e of g.enemies) {
		assert.ok(walkable(e.x, e.z, 0.3, "forest"), `${e.dataId} spawns inside a tree or pool`);
		assert.ok(["mist_shroom", "shade_wolf", "lantern_wisp", "stump_guard"].includes(e.dataId));
		assert.equal(e.boss, false);
		assert.ok(e.behavior, `${e.dataId} has data-driven AI`);
		assert.equal(e.maxHp, data.monsters.monsters.find((m) => m.id === e.dataId)!.hp);
	}
	assert.ok(walkable(FOREST_ENTRY.x, FOREST_ENTRY.z, 0.3, "forest"));
	assert.ok(walkable(FIELD_BOSS.forest.x, FIELD_BOSS.forest.z, 0.3, "forest"));
	assert.equal(walkable(5, -8, 0.3, "forest"), false, "mist pool blocks");
	assert.equal(walkable(25, 0, 0.3, "forest"), false, "outside the forest");
});

test("city east gate leads to the forest and its west gate returns", () => {
	const there = travelDestination("city_plaza", "east", GATES.city_plaza.east);
	assert.deepEqual(there, { mapId: "forest", ...FOREST_ENTRY });
	const back = travelDestination("forest", "west", GATES.forest.west);
	assert.deepEqual(back, { mapId: "city_plaza", ...CITY_EAST_RETURN });
	assert.ok(walkable(CITY_EAST_RETURN.x, CITY_EAST_RETURN.z, 0.3, "city_plaza"));
});

test("melee wolf lunges and hurts; ranged wisp keeps distance and fires bolts", () => {
	const g = createGame(9, undefined, "local", data, "forest");
	g.random = () => 0.5;
	g.enemies = [];
	g.p.x = -10;
	g.p.z = 8;
	const wolf = spawn(g, -10, 9.2, false, "pink", false, "shade_wolf");
	wolf.cooldown = 0;
	const hp = g.p.hp;
	for (let i = 0; i < 40; i++) step(g, 0.05);
	assert.ok(g.p.hp < hp, "wolf bite lands");

	const h = createGame(9, undefined, "local", data, "forest");
	h.random = () => 0.5;
	h.enemies = [];
	h.p.x = -11;
	h.p.z = -2;
	const wisp = spawn(h, -11, 0.5, false, "pink", false, "lantern_wisp");
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

test("twelve forest kills call the Mist Warden; its cooldown is separate from the King's", () => {
	const g = createGame(3, undefined, "local", data, "forest");
	g.random = () => 0.5;
	g.enemies = [];
	g.p.x = -10;
	g.p.z = 8;
	for (let i = 0; i < FIELD_BOSS.forest.kills; i++) {
		const e = spawn(g, g.p.x, g.p.z - 1, false, "pink", false, "mist_shroom");
		e.hp = 1;
		g.p.cd.attack = 0;
		action(g, "attack");
	}
	assert.equal(g.kills, 12);
	const boss = g.enemies.find((e) => e.boss);
	assert.ok(boss, "warden spawned");
	assert.equal(boss!.dataId, "mist_warden");
	assert.equal(boss!.maxHp, 6000);

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
	g.p.x = 11;
	g.p.z = 6;
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
