import test from "node:test";
import assert from "node:assert/strict";
import {
	loadGameData,
	rollDrops,
	deriveStats,
	starterInventory,
	applyInventory,
	inventoryWeight,
	inventorySlots,
	createGame,
	step,
	action,
	refreshStats,
} from "../src/index.js";
const data = loadGameData();
test("100k seeded rolls per monster respect rates and quantity bounds", () => {
	let seed = 717;
	const rng = () =>
		(seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
	for (const m of data.monsters.monsters) {
		const counts: Record<string, number> = {};
		for (let i = 0; i < 100000; i++)
			for (const drop of rollDrops(m, rng, data)) {
				const rule = m.drops.find((d) => d.item === drop.template)!;
				assert.ok(drop.qty >= rule.min && drop.qty <= rule.max);
				counts[drop.template] = (counts[drop.template] || 0) + 1;
			}
		for (const d of m.drops) {
			const expected = d.rate * 100000,
				sigma = Math.sqrt(expected * (1 - d.rate));
			assert.ok(
				Math.abs((counts[d.item] || 0) - expected) <= 6 * sigma + 2,
				`${m.id}/${d.item}`,
			);
		}
	}
	const king = data.monsters.monsters.find((m) => m.boss)!;
	let full = 0,
		penalty = 0;
	for (let i = 0; i < 100000; i++) {
		full += rollDrops(king, rng, data).filter(
			(d) => d.template === "card_king_jelly",
		).length;
		penalty += rollDrops(king, rng, data, 7201).filter(
			(d) => d.template === "card_king_jelly",
		).length;
	}
	assert.ok(penalty < full * 0.85);
});
test("equipment adds exact modifiers, binds on equip, and reducer failures are atomic", () => {
	let id = 0;
	const uuid = () => String(++id),
		inv = starterInventory(5, uuid),
		profile = data.stats.defaultBuild;
	const granted = applyInventory(
		{ inventory: inv, gold: 500 },
		{ op: "buy", template: "leaf_sword", shop: "forge" },
		profile,
		data,
		uuid,
	);
	const sword = granted.state.inventory.items.find(
		(i) => i.template === "leaf_sword",
	)!;
	const equipped = applyInventory(
		granted.state,
		{ op: "equip", id: sword.id },
		profile,
		data,
		uuid,
	);
	const stats = deriveStats(
		{
			...profile,
			equipment: equipped.state.inventory.items
				.filter((i) => i.location === "equip")
				.map((i) => i.template),
		},
		data,
	);
	assert.equal(stats.atk - deriveStats(profile, data).atk, 9);
	assert.equal(stats.hardDef, 3);
	assert.ok(
		equipped.state.inventory.items.find((i) => i.id === sword.id)!.bound,
	);
	const before = structuredClone(granted.state);
	assert.throws(() =>
		applyInventory(
			granted.state,
			{ op: "buy", template: "leaf_sword", qty: 50, shop: "forge" },
			profile,
			data,
			uuid,
		),
	);
	assert.deepEqual(granted.state, before);
});
test("weight rules disable all regen at 50%, attack at 90%, enforce 100 slots and capacity", () => {
	const g = createGame(),
		p = g.p;
	p.inventory = starterInventory(0, () => String(g.nextId++));
	p.inventory.items.push({
		id: "stack:jelly_slime",
		template: "jelly_slime",
		qty: 400,
		location: "bag",
		slot: null,
		refine: 0,
		cards: [],
		bound: false,
		source: "admin",
	});
	refreshStats(g, p);
	assert.ok(inventoryWeight(p.inventory, data) >= p.stats.weight * 0.5);
	p.hp = 20;
	p.mp = 10;
	g.enemies = [];
	step(g, 0.1);
	assert.equal(p.hp, 20);
	assert.equal(p.mp, 10);
	p.inventory.items.at(-1)!.qty = 800;
	assert.equal(action(g, "attack"), false);
	p.inventory.items.at(-1)!.qty = 1;
	refreshStats(g, p);
	step(g, 0.1);
	assert.ok(p.hp > 20 && p.mp > 10);
	const inv = starterInventory(0, () => String(g.nextId++));
	for (let i = 0; i < 100; i++)
		inv.items.push({
			id: "ring" + i,
			template: "jade_ring",
			qty: 1,
			location: "bag",
			slot: null,
			refine: 0,
			cards: [],
			bound: false,
			source: "admin",
		});
	assert.equal(inventorySlots(inv, data), 100);
	assert.throws(
		() =>
			applyInventory(
				{ inventory: inv, gold: 200 },
				{ op: "buy", shop: "forge", template: "reed_dagger" },
				p.profile,
				data,
				() => String(g.nextId++),
			),
		/กระเป๋าเต็ม/,
	);
});
