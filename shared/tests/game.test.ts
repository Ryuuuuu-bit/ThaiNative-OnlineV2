import test from "node:test";
import assert from "node:assert/strict";
import {
	createGame,
	step,
	action,
	setAuto,
	spawn,
	revive,
	addPlayer,
	withPlayer,
	reconcileMovement,
	predictMovement,
	IntentSchema,
} from "../src/index.node.js";
test("shared sim is deterministic for 2000 ticks of identical inputs", () => {
	const run = () => {
		const g = createGame(17);
		setAuto(g, true);
		for (let i = 0; i < 2000; i++) {
			if (i % 300 === 0) action(g, "meteor");
			step(g, 0.05);
		}
		return JSON.parse(JSON.stringify({ ...g, players: [...g.players] }));
	};
	assert.deepEqual(run(), run());
});
test("two players share enemies: nearest player gets the telegraph; top damage earns loot", () => {
	const g = createGame();
	g.random = () => 0.5;
	g.enemies = [];
	const a = g.p,
		b = addPlayer(g, "second");
	a.x = 10;
	a.z = 10;
	b.x = 0;
	b.z = 0;
	const e = spawn(g, 0, 0.8);
	e.aggro = 5; // Already provoked: level-one jellies are now passive on approach.
	e.cooldown = 0;
	step(g, 0.05);
	assert.equal(e.aimX, 0);
	assert.equal(e.aimZ, 0.8); // warning centre is the nearby player's position on small attacks
	assert.equal(e.motion, "attack");
	assert.ok(g.events.some((e) => e.type === "warning" && e.playerId === b.id));
	a.x = 0;
	a.z = 0;
	e.x = 0;
	e.z = 1;
	e.motion = "idle";
	e.hp = e.maxHp;
	e.damageBy = {};
	a.cd.attack = 0;
	withPlayer(g, a.id, () => action(g, "attack"));
	a.cd.attack = 0;
	withPlayer(g, a.id, () => action(g, "attack"));
	withPlayer(g, b.id, () => action(g, "spin"));
	assert.equal(e.dead, true);
	assert.equal(a.kills, 1);
	assert.equal(b.kills, 0);
	for (let i = 0; i < 50; i++) step(g, 0.05);
	assert.ok(a.gold > 0);
	assert.equal(b.gold, 0);
	assert.ok(a.xp > 0);
	assert.equal(b.xp, 0);
});
test("kills are counted per room and per player; they no longer unlock the King", () => {
	const g = createGame();
	g.random = () => 0.5;
	g.enemies = [];
	const b = addPlayer(g, "second");
	b.x = g.p.x;
	b.z = g.p.z;
	for (let i = 0; i < 6; i++) {
		const e = spawn(g, g.p.x, g.p.z - 1);
		e.hp = 1;
		withPlayer(g, i % 2 ? b.id : "local", () => {
			g.p.cd.attack = 0;
			action(g, "attack");
		});
	}
	assert.equal(g.kills, 6);
	assert.equal(g.players.get("local")!.kills, 3);
	assert.equal(b.kills, 3);
	assert.equal(g.enemies.filter((e) => e.boss).length, 0);
});
test("movement prediction replays only unacknowledged inputs and chooses snap threshold", () => {
	const pending = [
		{ seq: 1, input: { x: 1, z: 0 }, dt: 0.05, speed: 4.5 },
		{ seq: 2, input: { x: 0, z: 1 }, dt: 0.05, speed: 4.5 },
	];
	const r = reconcileMovement({ x: 0, z: 4 }, { x: 0, z: 4 }, 1, pending);
	assert.equal(r.pending.length, 1);
	assert.equal(r.position.z, 4.225);
	assert.equal(r.snap, false);
	assert.equal(
		reconcileMovement({ x: 0, z: 4 }, { x: 3, z: 4 }, 2, pending).snap,
		true,
	);
	assert.equal(
		reconcileMovement({ x: 0, z: 4 }, { x: 1.5, z: 4 }, 2, []).snap,
		false,
	);
	assert.ok(
		Math.hypot(
			...Object.values(
				predictMovement({ x: 0, z: 0 }, { x: 100, z: 100 }, 0.05),
			),
		) <= 0.225001,
	);
});
test("intents reject authoritative fields, NaN, arbitrary actions and bad sequence ids", () => {
	assert.equal(
		IntentSchema.safeParse({ t: "act", a: "attack", seq: 1, damage: 1e9 })
			.success,
		false,
	);
	assert.equal(
		IntentSchema.safeParse({ t: "steer", dx: NaN, dz: 0, seq: 1 }).success,
		false,
	);
	assert.equal(
		IntentSchema.safeParse({ t: "act", a: "giveGold", seq: 1 }).success,
		false,
	);
	assert.equal(
		IntentSchema.safeParse({ t: "move", x: 1, z: 2, seq: -1 }).success,
		false,
	);
});

test("King damage stays distinct across its four patterns and both phases", () => {
	for (const [phase, expected] of [
		[1, [24, 20, 22, 12]],
		[2, [30, 25, 28, 16]],
	] as const) {
		for (const [index, motion] of (
			["slam", "sweep", "charge", "spit"] as const
		).entries()) {
			const g = createGame();
			g.random = () => 0.5;
			g.enemies = [];
			g.p.x = 0;
			g.p.z = 0;
			const e = spawn(g, 0, 1, true);
			e.engaged = true;
			e.bossPhase = phase;
			e.motion = motion;
			e.motionTime =
				motion === "sweep" ? 0.69 : motion === "slam" ? 0.84 : 0.79;
			e.motionDuration = 2;
			e.startX = 0;
			e.startZ = 1;
			e.aimX = 0;
			e.aimZ = 0;
			e.fx = 0;
			e.fz = -1;
			step(g, 0.05);
			assert.equal(
				g.events.find((e) => e.type === "hurt")?.amount,
				expected[index],
				`${motion} phase${phase}`,
			);
			assert.ok(g.events.find((e) => e.type === "hurt")?.breakdown);
		}
	}
});

test("one player reviving does not clear a living teammate’s encounter", () => {
	const g = createGame();
	const b = addPlayer(g, "teammate"),
		e = spawn(g, 0, 2, true);
	e.engaged = true;
	e.motion = "charge";
	g.projectiles.push({
		id: 900,
		owner: e.id,
		x: 1,
		z: 1,
		vx: 1,
		vz: 0,
		life: 2,
		damage: 1,
		phase: 1,
	});
	g.p.dead = true;
	g.p.hp = 0;
	revive(g);
	assert.equal(g.projectiles.length, 1);
	assert.equal(e.engaged, true);
	assert.equal(e.motion, "charge");
	assert.equal(b.dead, false);
});

test("20Hz cooldowns do not acquire an extra tick from floating-point residue", () => {
	const g = createGame();
	g.enemies = [];
	g.p.cd.spin = 4;
	g.p.cd.attack = 0.55;
	for (let i = 0; i < 11; i++) step(g, 0.05);
	assert.equal(g.p.cd.attack, 0);
	for (let i = 11; i < 80; i++) step(g, 0.05);
	assert.equal(g.p.cd.spin, 0);
});

test("a missed incoming hit causes no hurt animation or free invulnerability", () => {
	const g = createGame();
	g.random = () => 0.99;
	g.enemies = [];
	g.p.x = 0;
	g.p.z = 0;
	const e = spawn(g, 0, 0.9);
	e.aggro = 5;
	e.cooldown = 0;
	for (let i = 0; i < 15; i++) step(g, 0.05);
	assert.equal(g.p.hp, g.p.maxHp);
	assert.equal(g.p.hurt, 0);
	assert.equal(g.p.invulnerable, 0);
	assert.ok(g.events.some((e) => e.type === "miss" && e.defender === "player"));
	assert.equal(
		g.events.some((e) => e.type === "hurt"),
		false,
	);
});
