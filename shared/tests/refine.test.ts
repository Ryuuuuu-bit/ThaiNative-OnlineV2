import test from "node:test";
import assert from "node:assert/strict";
import { applyInventory, deriveStats, inventoryProfile, loadGameData, refineBonusValue, refineQuote, REFINE_MAX, REFINE_TABLE, type Inventory, type OwnedItem } from "../src/index.node.js";
const data = loadGameData(), profile = { ...data.stats.defaultBuild, level: 99 };
let n = 0;
const item = (template: string, extra: Partial<OwnedItem> = {}): OwnedItem => ({ id: `r${++n}`, template, qty: 1, location: "bag", slot: null, refine: 0, cards: [], bound: false, source: "test", ...extra });
const bag = (...items: OwnedItem[]): Inventory => ({ version: 1, autoPickup: true, items });
const refine = (inv: Inventory, target: OwnedItem, gold: number, roll?: number) => applyInventory({ gold, inventory: inv }, { op: "refine", id: target.id, roll }, profile, data, () => "uuid");
const tpl = (id: string) => data.items.items.find((t) => t.id === id)!;

test("refine rates: safe up to +4, riskier after, capped at +10", () => {
	assert.equal(REFINE_TABLE.length, REFINE_MAX);
	assert.ok(REFINE_TABLE.slice(0, 4).every((r) => r.chance === 1));
	for (let i = 4; i < REFINE_MAX; i++) assert.ok(REFINE_TABLE[i].chance < REFINE_TABLE[i - 1].chance && REFINE_TABLE[i].gold > REFINE_TABLE[i - 1].gold);
	assert.match(String(refineQuote(item("training_sword", { refine: 10 }), data)), /\+10/);
	assert.match(String(refineQuote(item("jade_ring"), data)), /ตีบวกได้เฉพาะ/);
	assert.match(String(refineQuote(item("red_small"), data)), /ตีบวกได้เฉพาะ/);
	const q = refineQuote(item("traveler_clothes", { refine: 6 }), data);
	assert.ok(typeof q !== "string" && q.stone === "armour_stone" && q.next === 7 && q.failTo === 5);
});

test("a successful refine spends one stone and gold and raises the level", () => {
	const sword = item("training_sword", { refine: 6 }), stones = item("weapon_stone", { id: "stack:weapon_stone", qty: 3 });
	const out = refine(bag(sword, stones), sword, 5000, 0.1);
	const after = out.state.inventory.items;
	assert.equal(after.find((i) => i.id === sword.id)!.refine, 7);
	assert.equal(after.find((i) => i.id === stones.id)!.qty, 2);
	assert.equal(out.state.gold, 5000 - REFINE_TABLE[6].gold);
	assert.equal(out.ledger.reduce((s, l) => s + l.goldDelta, 0), -REFINE_TABLE[6].gold, "gold change is on the ledger");
});

test("a failed refine above +4 drops one level; +1..+4 cannot fail", () => {
	const sword = item("training_sword", { refine: 6 }), stones = item("weapon_stone", { id: "stack:weapon_stone", qty: 3 });
	assert.equal(refine(bag(sword, stones), sword, 5000, 0.99).state.inventory.items.find((i) => i.id === sword.id)!.refine, 5);
	const low = item("training_sword", { refine: 2 });
	assert.equal(refine(bag(low, stones), low, 5000, 0.999).state.inventory.items.find((i) => i.id === low.id)!.refine, 3);
});

test("refine needs the server's roll, the right stone and enough gold", () => {
	const sword = item("training_sword"), armour = item("traveler_clothes"), wstone = item("weapon_stone", { id: "stack:weapon_stone" });
	assert.throws(() => refine(bag(sword, wstone), sword, 5000), /เซิร์ฟเวอร์/);
	assert.throws(() => refine(bag(sword, wstone), sword, 5000, 1), /เซิร์ฟเวอร์/);
	assert.throws(() => refine(bag(armour, wstone), armour, 5000, 0), /หินตีบวกเกราะ/);
	assert.throws(() => refine(bag(sword, wstone), sword, 100, 0), /ทองไม่พอ/);
	const stored = item("training_sword", { location: "storage" });
	assert.throws(() => refine(bag(stored, wstone), stored, 5000, 0), /ไม่ใช่ของคุณ/);
});

test("refine levels on worn gear raise ATK and hard DEF", () => {
	const wear = (refine: number) => bag(item("training_sword", { location: "equip", slot: "weapon", refine }), item("traveler_clothes", { location: "equip", slot: "body", refine }));
	const base = deriveStats(inventoryProfile(profile, wear(0), data), data), plus = deriveStats(inventoryProfile(profile, wear(7), data), data);
	assert.ok(plus.atk >= base.atk + refineBonusValue(tpl("training_sword"), 7), "weapon refine adds ATK");
	assert.equal(plus.hardDef - base.hardDef, refineBonusValue(tpl("traveler_clothes"), 7), "armour refine adds hard DEF");
	assert.ok(refineBonusValue(tpl("traveler_clothes"), 3) >= 3, "every level is worth at least +1");
});

test("clients ask for a refine but cannot choose its roll", async () => {
	const { IntentSchema } = await import("../src/game/protocol.js");
	const req = "123e4567-e89b-42d3-a456-426614174000";
	assert.ok(IntentSchema.safeParse({ t: "inv", op: "refine", req, id: "x" }).success);
	assert.equal(IntentSchema.safeParse({ t: "inv", op: "refine", req, id: "x", roll: 0 }).success, false);
});
