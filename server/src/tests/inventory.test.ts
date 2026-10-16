import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MemoryStore } from "../store/memory.js";
import { loadGameData } from "@thainative/shared";
const data = loadGameData(),
	context = { profile: data.stats.defaultBuild };
async function fixture() {
	const store = new MemoryStore(),
		a = await store.createGuest(randomUUID()),
		c = await store.createCharacter(a.id, "Economy", "economy");
	await store.inventory(a.id, c.id);
	const run = (op: any, req = randomUUID(), ctx = context) =>
		store.inventoryOp(a.id, c.id, req, op, ctx);
	return { store, a, c, run };
}
test("100 identical concurrent sells commit once; stale progress cannot overwrite gold", async () => {
	const { store, a, c, run } = await fixture();
	await run({ op: "admin", loot: [{ template: "jelly_slime", qty: 20 }] });
	const req = randomUUID();
	const results = await Promise.all(
		Array.from({ length: 100 }, () =>
			run({ op: "sell", id: "stack:jelly_slime", qty: 20 }, req),
		),
	);
	assert.equal(results.filter((r) => !r.duplicate).length, 1);
	assert.equal((await store.inventory(a.id, c.id)).gold, 80);
	await store.saveProgress(a.id, c.id, { ...c, gold: 0, potions: 5 });
	assert.equal((await store.inventory(a.id, c.id)).gold, 80);
	assert.ok((await store.integrity()).ok);
});
test("100 different concurrent buys with gold for exactly 3 produce exactly 3", async () => {
	const { store, a, c, run } = await fixture();
	await run({ op: "admin", gold: 240 });
	const results = await Promise.all(
		Array.from({ length: 100 }, () =>
			run({ op: "buy", shop: "forge", template: "training_sword" }),
		),
	);
	assert.equal(results.filter((r) => !r.error).length, 3);
	const state = await store.inventory(a.id, c.id);
	assert.equal(state.gold, 0);
	assert.equal(
		state.inventory.items.filter((i) => i.template === "training_sword").length,
		4,
	);
	assert.ok((await store.integrity()).ok);
});
test("reject foreign item, wrong class, high level, duplicate ids; persist failed request results", async () => {
	const { run } = await fixture();
	await run({
		op: "admin",
		gold: 10000,
		loot: [
			{ template: "wood_staff", qty: 1 },
			{ template: "crystal_sword", qty: 1 },
		],
	});
	const state = await run({ op: "settings", on: false });
	const staff = state.inventory.items.find((i) => i.template === "wood_staff")!,
		sword = state.inventory.items.find((i) => i.template === "crystal_sword")!;
	assert.match((await run({ op: "equip", id: randomUUID() })).error!, /ไม่ใช่/);
	assert.match(
		(await run({ op: "equip", id: staff.id })).error!,
		/cannot equip/,
	);
	assert.match((await run({ op: "equip", id: sword.id })).error!, /ระดับ/);
	assert.ok((await run({ op: "sell", ids: [staff.id, staff.id] })).error);
	const req = randomUUID();
	const bad = await run({ op: "buy", template: "unknown", shop: "forge" }, req);
	const repeat = await run(
		{ op: "buy", template: "training_sword", shop: "forge" },
		req,
	);
	assert.equal(repeat.error, bad.error);
	assert.ok(repeat.duplicate);
});
test("10k deterministic random operations preserve ledger = gold and all inventory invariants", async () => {
	const { store, a, c, run } = await fixture();
	await run({ op: "admin", gold: 50000 });
	let seed = 38;
	const rng = () =>
		(seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
	const ops = [
		"buy",
		"sell",
		"equip",
		"unequip",
		"discard",
		"use",
		"pickup",
	] as const;
	for (let n = 0; n < 10000; n++) {
		const state = await store.inventory(a.id, c.id),
			i =
				state.inventory.items[Math.floor(rng() * state.inventory.items.length)],
			op = ops[Math.floor(rng() * ops.length)];
		await run(
			op === "buy"
				? {
						op,
						shop: "forge",
						template: rng() < 0.5 ? "training_sword" : "leaf_sword",
					}
				: op === "pickup"
					? {
							op,
							gold: Math.floor(rng() * 14),
							loot: [
								{ template: rng() < 0.5 ? "jelly_slime" : "red_small", qty: 1 },
							],
						}
					: { op, id: i?.id, qty: 1 },
		);
	}
	assert.ok((await store.integrity()).ok);
	const state = await store.inventory(a.id, c.id);
	assert.ok(state.gold >= 0);
	assert.ok(state.inventory.items.every((i) => i.qty > 0));
});
