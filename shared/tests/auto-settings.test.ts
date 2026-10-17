import test from "node:test";
import assert from "node:assert/strict";
import {
	createGame,
	step,
	setAuto,
	spawn,
	loadGameData,
	normalizeAuto,
	huntList,
	autoSkillSequence,
	autoCastOrder,
	DEFAULT_AUTO,
	AutoSettingsSchema,
} from "../src/index.node.js";

const data = loadGameData();

test("normalizeAuto keeps valid fields and resets broken ones to the defaults", () => {
	const s = normalizeAuto({ survive: 55, hpPotion: 70, range: "far", mode: "nope", off: ["slash", 3], mobs: { meadow: ["jelly_pink"] } });
	assert.equal(s.survive, 55);
	assert.ok(!("hpPotion" in s), "old potion fields are dropped");
	assert.equal(s.range, "far");
	assert.equal(s.mode, DEFAULT_AUTO.mode);
	assert.deepEqual(s.off, DEFAULT_AUTO.off);
	assert.deepEqual(s.mobs, { meadow: ["jelly_pink"] });
	assert.deepEqual(normalizeAuto(undefined), DEFAULT_AUTO);
	assert.ok(AutoSettingsSchema.safeParse(DEFAULT_AUTO).success);
});

test("huntList lists each field map's monsters once, weakest first, with its boss", () => {
	const meadow = huntList("meadow", data);
	assert.deepEqual(new Set(meadow.map((m) => m.id)).size, meadow.length);
	assert.ok(meadow.some((m) => m.boss));
	assert.ok(meadow.every((m, i) => i === 0 || meadow[i - 1].level <= m.level));
	assert.deepEqual(huntList("city_plaza", data), []);
});

test("skill order: custom order first, disabled skipped, cycle rotates, priority restarts, survival jumps ahead", () => {
	const bar = ["slash", "whirlwind", "item:red_small", "endure", "provoke", null];
	const s = { ...DEFAULT_AUTO, order: ["provoke", "slash"], off: ["whirlwind"] };
	const seq = autoSkillSequence(s, bar, () => true);
	assert.deepEqual(seq, ["provoke", "slash", "endure"]);
	assert.deepEqual(autoCastOrder(seq, s, 1, "slash", () => false), ["slash", "endure", "provoke"]);
	assert.deepEqual(autoCastOrder(seq, { ...s, mode: "priority" }, 1, "slash", () => false), seq);
	assert.deepEqual(autoCastOrder(seq, s, 0.3, "slash", (id) => id === "endure"), ["endure", "slash", "provoke"]);
});

test("AUTO only hunts the monsters picked for the map, and respects the search radius", () => {
	const g = createGame(5);
	g.enemies = [];
	const p = g.p;
	p.x = 0;
	p.z = 0;
	const pink = spawn(g, 4, 0),
		mint = spawn(g, 2, 0);
	pink.dataId = "jelly_pink";
	mint.dataId = "jelly_mint";
	for (const e of [pink, mint]) {
		e.aggro = 0;
		e.cooldown = 99;
	}
	p.autoCfg = { ...DEFAULT_AUTO, mobs: { [g.mapId]: ["jelly_pink"] } };
	setAuto(g, true);
	step(g, 0.25);
	assert.equal(g.target, pink.id);

	p.autoCfg = { ...DEFAULT_AUTO, range: "near" };
	g.target = null;
	pink.x = 12;
	mint.x = 30;
	step(g, 0.25);
	assert.equal(g.target, null, "nothing within 7 m");
});

test("AUTO casts the skills its settings allow, and skips switched-off ones", () => {
	const fight = (cfg: typeof DEFAULT_AUTO) => {
		const g = createGame(9);
		g.enemies = [];
		const p = g.p,
			e = spawn(g, 1.2, 0);
		p.x = 0;
		p.z = 0;
		e.cooldown = 99;
		p.skills = { ...p.skills, slash: 1 };
		p.hotbar = [{ skill: "slash", key: "Digit1" }, ...p.hotbar.slice(1)];
		p.mp = p.maxMp;
		p.autoCfg = cfg;
		setAuto(g, true);
		step(g, 0.25);
		return (p.cd.slash || 0) > 0;
	};
	assert.equal(fight({ ...DEFAULT_AUTO }), true, "slash is cast");
	assert.equal(fight({ ...DEFAULT_AUTO, off: ["slash"] }), false, "slash switched off");
});

import { resolveKeys, actionKeys, reservedKeys, bindingProblem, DEFAULT_KEYS, UISettingsSchema, validateHotbar, newJob, loadGameData as loadData } from "../src/index.node.js";
test("action keys: defaults with old alternates, rebinding frees the old key, conflicts are refused", () => {
	const d = resolveKeys(undefined);
	assert.equal(d.attack, "Space");
	assert.deepEqual(actionKeys(d).attack, ["Space", "KeyJ"]);
	assert.deepEqual(actionKeys(d).auto, ["KeyF", "KeyT"]);
	// Saved settings from before this change (only two keys) still resolve to full defaults.
	assert.deepEqual(resolveKeys({ returnCity: "KeyB", pickupAll: "KeyZ" }), { ...DEFAULT_KEYS, returnCity: "KeyB" });
	// Moving attack to Q drops its J alternate; moving inventory off I frees I for the hotbar.
	const moved = resolveKeys({ attack: "KeyQ", inventory: "KeyO" });
	assert.deepEqual(actionKeys(moved).attack, ["KeyQ"]);
	assert.ok(!reservedKeys(moved).includes("KeyI"));
	assert.ok(reservedKeys(moved).includes("KeyO"));
	const job = newJob(), data = loadData();
	const bar = job.hotbar.map((s, i) => (i === 9 ? { ...s, key: "KeyI" } : s));
	assert.equal(validateHotbar(job, bar, data, reservedKeys(moved))[9].key, "KeyI");
	assert.throws(() => validateHotbar(job, bar, data, reservedKeys(d)), /ปุ่ม/);
	// Problems: duplicate, movement/Esc, a hotbar key.
	assert.match(bindingProblem({ ...d, potion: "KeyF" })!, /ใช้อยู่/);
	assert.match(bindingProblem({ ...d, potion: "KeyW" })!, /เปลี่ยนไม่ได้/);
	assert.match(bindingProblem({ ...d, potion: "Digit1" }, ["Digit1"])!, /แถบสกิล/);
	assert.equal(bindingProblem(moved), null);
	// Fixed or malformed saved keys fall back to the default instead of locking the player out.
	assert.equal(resolveKeys({ attack: "KeyW", dash: "Nope" }).attack, "Space");
	assert.equal(resolveKeys({ attack: "KeyW", dash: "Nope" }).dash, "ShiftLeft");
	// The stored schema accepts the new optional keys and still accepts old records.
	assert.ok(UISettingsSchema.safeParse({ scale: 100, windows: {}, keys: { returnCity: "KeyH", pickupAll: "KeyZ" } }).success);
	assert.ok(UISettingsSchema.safeParse({ scale: 100, windows: {}, keys: { ...DEFAULT_KEYS, attack: "KeyQ" } }).success);
});
