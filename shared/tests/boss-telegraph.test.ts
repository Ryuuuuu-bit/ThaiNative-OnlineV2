import test from "node:test";
import assert from "node:assert/strict";
import { createGame, step, setAuto, inTelegraph, walkable, loadGameData, type MapId } from "../src/index.node.js";
const data = loadGameData();
function openSpot(map: MapId, near: { x: number; z: number }) {
	for (let ring = 0; ring < 60; ring++)
		for (let a = 0; a < 16; a++) {
			const x = near.x + Math.cos((a / 16) * Math.PI * 2) * ring, z = near.z + Math.sin((a / 16) * Math.PI * 2) * ring;
			let clear = true;
			for (let dx = -6; dx <= 6 && clear; dx++) for (let dz = -6; dz <= 6 && clear; dz++) if (!walkable(x + dx, z + dz, 0.3, map)) clear = false;
			if (clear) return { x, z };
		}
	throw Error("no open ground");
}

/** A boss alone on open ground, engaged and ready to start its next telegraphed skill. */
function arena(map: MapId, index = 0) {
	const g = createGame(3, undefined, "local", data, map);
	g.random = () => 0.5;
	const boss = g.enemies.find((e) => e.boss && !e.summoned)!;
	g.enemies = [boss];
	const spot = openSpot(map, { x: boss.x, z: boss.z });
	Object.assign(boss, { x: spot.x, z: spot.z, homeX: spot.x, homeZ: spot.z, engaged: true, aggro: 10, cooldown: 0, sinceTelegraph: 3, telegraphIndex: index });
	boss.motion = "idle";
	const p = g.p;
	p.maxHp = p.hp = 99999;
	p.invulnerable = 0;
	p.x = spot.x + 4;
	p.z = spot.z;
	return { g, boss, p, spot };
}
const until = (g: ReturnType<typeof createGame>, done: () => boolean, max = 4) => {
	for (let t = 0; t < max && !done(); t += 0.05) step(g, 0.05);
};

test("telegraph shapes: circle, ring hole and cone opening", () => {
	const base = { x: 0, z: 0, fx: 1, fz: 0, radius: 5, inner: 2, angle: 90 };
	assert.ok(inTelegraph({ ...base, shape: "circle" }, 1, 1));
	assert.ok(!inTelegraph({ ...base, shape: "circle" }, 6, 0));
	assert.ok(!inTelegraph({ ...base, shape: "ring" }, 1, 0), "ring hole is safe");
	assert.ok(inTelegraph({ ...base, shape: "ring" }, 3, 0));
	assert.ok(inTelegraph({ ...base, shape: "cone" }, 3, 1), "inside the 90° opening");
	assert.ok(!inTelegraph({ ...base, shape: "cone" }, 0, 3), "beside the cone");
	assert.ok(!inTelegraph({ ...base, shape: "cone" }, -3, 0), "behind the boss");
});

test("every boss has telegraphed skills with dodgeable windups", () => {
	for (const m of data.monsters.monsters.filter((m) => m.boss)) {
		assert.ok((m.telegraphs?.length ?? 0) >= 2, m.id);
		for (const t of m.telegraphs!) assert.ok(t.windup >= 1.8 && t.windup <= 2.4, `${m.id}/${t.id}`);
	}
});

test("King Jelly's cone locks its aim at the start: stepping aside avoids it, standing still is hit", () => {
	for (const dodge of [false, true]) {
		const { g, boss, p, spot } = arena("meadow");
		step(g, 0.05);
		const t = boss.telegraph!;
		assert.equal(t?.shape, "cone");
		const warning = g.events.find((e) => e.type === "warning" && e.attack === t.id);
		assert.ok(warning && warning.shape === "cone" && warning.duration === 2 && warning.name);
		step(g, 1);
		assert.ok(boss.telegraph, "still winding up after a second");
		if (dodge) p.z = spot.z + 4; // 90° off the locked direction
		const hp = p.hp;
		until(g, () => !boss.telegraph);
		assert.ok(g.events.some((e) => e.type === "bossBlast"));
		if (dodge) assert.equal(p.hp, hp);
		else assert.ok(p.hp < hp, "hit by the blast");
	}
});

test("Mist Warden's ring spares players in its hole", () => {
	for (const [distance, safe] of [[1.5, true], [4, false]] as const) {
		const { g, boss, p, spot } = arena("forest", 1);
		p.x = spot.x + distance;
		step(g, 0.05);
		assert.equal(boss.telegraph?.shape, "ring");
		const hp = p.hp;
		until(g, () => !boss.telegraph);
		assert.equal(p.hp === hp, safe, `distance ${distance}`);
	}
});

test("AUTO rolls out of a telegraph just before it lands", () => {
	const { g, boss, p } = arena("meadow");
	setAuto(g, true);
	g.target = null;
	step(g, 0.05);
	assert.ok(boss.telegraph);
	const hp = p.hp;
	let rolled = false;
	for (let t = 0; t < 4 && boss.telegraph; t += 0.05) {
		step(g, 0.05);
		rolled ||= p.dash > 0;
	}
	assert.ok(rolled, "dashed");
	assert.ok(!inTelegraph({ ...(g.events.find((e) => e.type === "bossBlast") as any), radius: 6, angle: 80 }, p.x, p.z));
	assert.equal(p.hp, hp);
});
