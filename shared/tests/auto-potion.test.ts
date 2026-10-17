import test from "node:test";
import assert from "node:assert/strict";
import {
	createGame,
	step,
	setAuto,
	autoDrink,
	starterInventory,
	normalizeAutoPotion,
	DEFAULT_AUTO_POTION,
	AutoPotionSchema,
	validateHotbar,
	normalizeJob,
	defaultHotbar,
	loadGameData,
	type Game,
} from "../src/index.js";
const data = loadGameData();
const COOLDOWN = data.skills.skills.find((s) => s.id === "potion")!.cooldown;
const count = (g: Game, template: string) =>
	g.p.inventory!.items.filter((i) => i.template === template && i.location === "bag").reduce((n, i) => n + i.qty, 0);
/** A city player (no monsters, potions still usable) with a bag of red and blue potions. */
function city(red = 5, blue = 3, rule = { hp: { on: true, at: 40 }, mp: { on: true, at: 30 } }) {
	const g = createGame(7, undefined, undefined, undefined, "city_plaza");
	let n = 0;
	g.p.inventory = starterInventory(red, () => "id" + n++);
	if (blue) g.p.inventory.items.push({ id: "stack:blue_potion", template: "blue_potion", qty: blue, location: "bag", slot: null, refine: 0, cards: [], bound: false, source: "test" });
	g.p.autoPotion = structuredClone(rule);
	return g;
}
const drank = (g: Game) => g.events.filter((e) => e.type === "autoPotion");

test("auto-potion drinks HP only once HP falls below the threshold", () => {
	const g = city();
	g.p.hp = g.p.maxHp * 0.41;
	step(g, 0.01);
	assert.equal(count(g, "red_small"), 5, "41% is above a 40% threshold");
	g.p.hp = g.p.maxHp * 0.39;
	step(g, 0.01);
	assert.equal(count(g, "red_small"), 4);
	assert.ok(g.p.hp > g.p.maxHp * 0.39);
	assert.equal(g.p.cd.potion, COOLDOWN);
	assert.deepEqual(drank(g).map((e) => [e.kind, e.template]), [["hp", "red_small"]]);
});

test("auto-potion respects the shared potion cooldown and does not spam", () => {
	const g = city();
	g.p.hp = 1;
	step(g, 0.01);
	assert.equal(count(g, "red_small"), 4);
	g.p.hp = 1;
	for (let t = 0; t < COOLDOWN - 0.2; t += 0.05) {
		step(g, 0.05);
		g.p.hp = 1;
	}
	assert.equal(count(g, "red_small"), 4, "no second drink inside the cooldown");
	for (let i = 0; i < 10; i++) step(g, 0.05);
	assert.equal(count(g, "red_small"), 3, "drinks again once the cooldown ends");
});

test("auto-potion drinks MP potions below the MP threshold; HP goes first and both share the cooldown", () => {
	const g = city();
	g.p.mp = g.p.maxMp * 0.2;
	step(g, 0.01);
	assert.equal(count(g, "blue_potion"), 2);
	assert.ok(g.p.mp > g.p.maxMp * 0.2);
	const both = city();
	both.p.hp = 1;
	both.p.mp = 0;
	step(both, 0.01);
	assert.equal(count(both, "red_small"), 4);
	assert.equal(count(both, "blue_potion"), 3, "MP waits for the shared cooldown");
	both.p.cd.potion = 0;
	both.p.hp = both.p.maxHp;
	both.p.mp = 0;
	step(both, 0.01);
	assert.equal(count(both, "blue_potion"), 2);
});

test("auto-potion does nothing with an empty bag, when off, or when dead", () => {
	const empty = city(0, 0);
	empty.p.hp = 1;
	empty.p.mp = 0;
	step(empty, 0.01);
	assert.equal(empty.p.cd.potion, 0, "nothing to drink: no cooldown is spent");
	assert.equal(drank(empty).length, 0);
	assert.equal(autoDrink(empty), null);
	const noBlue = city(5, 0);
	noBlue.p.mp = 0;
	step(noBlue, 0.01);
	assert.equal(noBlue.p.cd.potion, 0, "no MP potion: red potions are not wasted on MP");
	assert.equal(count(noBlue, "red_small"), 5);
	const off = city(5, 3, { hp: { on: false, at: 40 }, mp: { on: false, at: 30 } });
	off.p.hp = 1;
	off.p.mp = 0;
	step(off, 0.01);
	assert.equal(count(off, "red_small"), 5);
	assert.equal(count(off, "blue_potion"), 3);
	const dead = city();
	dead.p.hp = 0;
	dead.p.dead = true;
	assert.equal(autoDrink(dead), null);
	assert.equal(count(dead, "red_small"), 5);
});

test("auto-potion runs with AUTO on and replaces AUTO's built-in 45% potion rule", () => {
	const g = createGame(3);
	let n = 0;
	g.p.inventory = starterInventory(5, () => "id" + n++);
	g.enemies = [];
	g.p.autoPotion = { hp: { on: true, at: 30 }, mp: { on: false, at: 30 } };
	setAuto(g, true);
	g.p.hp = g.p.maxHp * 0.4;
	for (let i = 0; i < 5; i++) step(g, 0.05);
	assert.equal(count(g, "red_small"), 5, "AUTO no longer drinks at 45% when auto-potion is set to 30%");
	g.p.hp = g.p.maxHp * 0.25;
	step(g, 0.05);
	assert.equal(count(g, "red_small"), 4);
});

test("auto-potion settings validate and migrate to defaults", () => {
	assert.deepEqual(normalizeAutoPotion(undefined), DEFAULT_AUTO_POTION);
	assert.deepEqual(normalizeAutoPotion({ hp: { on: true } }), DEFAULT_AUTO_POTION);
	assert.deepEqual(normalizeAutoPotion({ hp: { on: true, at: 55 }, mp: { on: false, at: 20 } }), { hp: { on: true, at: 55 }, mp: { on: false, at: 20 } });
	assert.equal(DEFAULT_AUTO_POTION.hp.on || DEFAULT_AUTO_POTION.mp.on, false, "off by default");
	for (const at of [0, 4, 96, 100, 40.5]) assert.equal(AutoPotionSchema.safeParse({ hp: { on: true, at }, mp: { on: false, at: 30 } }).success, false, String(at));
});

test("potions can sit on the hotbar; materials and unknown items cannot", () => {
	const g = createGame(1);
	const slots = defaultHotbar("swordsman");
	slots[6] = { ...slots[6], skill: "item:red_small" };
	slots[7] = { ...slots[7], skill: "item:blue_potion" };
	const out = validateHotbar(g.p, slots, data);
	assert.equal(out[6].skill, "item:red_small");
	assert.equal(out[7].skill, "item:blue_potion");
	for (const bad of ["item:jelly_slime", "item:training_sword", "item:nope"]) {
		const next = defaultHotbar("swordsman");
		next[6] = { ...next[6], skill: bad };
		assert.throws(() => validateHotbar(g.p, next, data), bad);
	}
});

test("saved bars migrate: skill-only bars are unchanged, item slots persist, removed items are cleared", () => {
	const g = createGame(1);
	const saved = { ...g.p, jobsVersion: 3, hotbar: defaultHotbar("swordsman") };
	assert.deepEqual(normalizeJob(saved).hotbar, defaultHotbar("swordsman"));
	saved.hotbar = saved.hotbar.map((s, i) => ({ ...s, skill: i === 6 ? "item:red_small" : i === 7 ? "item:retired_elixir" : s.skill }));
	const out = normalizeJob(saved).hotbar;
	assert.equal(out[6].skill, "item:red_small");
	assert.equal(out[7].skill, null);
	assert.deepEqual(out.map((s) => s.key), saved.hotbar.map((s) => s.key));
	assert.equal(out[0].skill, "slash");
});
