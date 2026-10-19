import test from "node:test";
import assert from "node:assert/strict";
import { applyInventory, cardSlots, deriveStats, equipped, equippedCards, loadGameData, socketPrice, type Inventory, type OwnedItem } from "../src/index.node.js";
const data = loadGameData(), profile = data.stats.defaultBuild;
let n = 0;
const item = (template: string, location: OwnedItem["location"] = "bag", slot: string | null = null): OwnedItem => ({ id: `i${++n}`, template, qty: 1, location, slot, refine: 0, cards: [], bound: false, source: "test" });
const bag = (...items: OwnedItem[]): Inventory => ({ version: 1, autoPickup: true, items });
const insert = (inv: Inventory, card: OwnedItem, target: OwnedItem) => applyInventory({ gold: 0, inventory: inv }, { op: "card", card: card.id, id: target.id }, profile, data, () => "uuid");

test("every card is an item and fits a kind of equipment the forge can socket", () => {
	for (const c of data.cards.cards) {
		assert.ok(data.items.items.some((i) => i.id === c.id && i.type === "card"), `${c.id} is a card item`);
		assert.ok(data.items.items.some((i) => i.type === c.slot && i.slot), `${c.id} fits some ${c.slot}`);
	}
});

test("a card goes into a matching slot for good and is used up", () => {
	const card = item("card_jelly_pink"), armour = item("traveler_clothes");
	const out = insert(bag(card, armour), card, armour);
	const after = out.state.inventory.items;
	assert.equal(after.find((i) => i.id === card.id), undefined, "card used up");
	assert.deepEqual(after.find((i) => i.id === armour.id)!.cards, ["card_jelly_pink"]);
	assert.equal(out.ledger.find((l) => l.itemId === card.id)?.kind, "use");
});

test("wrong type, full and slotless equipment are refused", () => {
	const card = item("card_jelly_pink"), sword = item("training_sword");
	assert.throws(() => insert(bag(card, sword), card, sword), /ชุดเกราะ/);
	const full = { ...item("traveler_clothes"), cards: ["card_jelly_pink"] };
	assert.throws(() => insert(bag(card, full), card, full), /เต็ม/);
	const titan = item("card_crag_titan"), starterShield = item("wood_shield");
	assert.throws(() => insert(bag(titan, starterShield), titan, starterShield), /ไม่มีช่อง/);
	const ironShield = { ...item("iron_shield"), sockets: 1 };
	assert.deepEqual(insert(bag(titan, ironShield), titan, ironShield).state.inventory.items.find((i) => i.id === ironShield.id)!.cards, ["card_crag_titan"]);
});

test("cards in worn equipment change stats; cards in the bag do not", () => {
	const armour = { ...item("traveler_clothes", "equip", "body"), cards: ["card_jelly_pink"] };
	const worn = bag(armour), carried = bag({ ...armour, location: "bag", slot: null });
	const stats = (inv: Inventory) => deriveStats({ ...profile, equipment: equipped(inv), cards: equippedCards(inv) }, data);
	assert.deepEqual(equippedCards(worn), ["card_jelly_pink"]);
	assert.ok(stats(worn).maxHp > stats(carried).maxHp, "the card's +50 HP and VIT count while worn");
	// Inserting into worn equipment applies at once.
	const card = item("card_king_jelly"), sword = item("training_sword", "equip", "weapon");
	const out = insert(bag(card, sword, armour), card, sword);
	assert.deepEqual(equippedCards(out.state.inventory).sort(), ["card_jelly_pink", "card_king_jelly"]);
});

test("the forge drills one card slot into unslotted gear for gold and the map's material", () => {
	const socket = (inv: Inventory, target: OwnedItem, gold: number) => applyInventory({ gold, inventory: inv }, { op: "socket", id: target.id }, profile, data, () => "uuid");
	const shield = item("iron_shield"), wood = { ...item("mist_wood"), id: "stack:mist_wood", qty: 12 };
	assert.equal(cardSlots(shield, data), 0);
	const price = socketPrice(shield, data);
	assert.deepEqual(price, { gold: 2000, material: "mist_wood", qty: 10 });
	const out = socket(bag(shield, wood), shield, 2500);
	const drilled = out.state.inventory.items.find((i) => i.id === shield.id)!;
	assert.equal(cardSlots(drilled, data), 1);
	assert.equal(out.state.gold, 500);
	assert.equal(out.state.inventory.items.find((i) => i.template === "mist_wood")?.qty, 2);
	assert.equal(out.ledger.reduce((n, l) => n + l.goldDelta, 0), -2000);
	assert.throws(() => socket(out.state.inventory, drilled, 9999), /มีช่องการ์ดแล้ว/);
	assert.throws(() => socket(bag(shield, wood), shield, 1999), /ทองไม่พอ/);
	assert.throws(() => socket(bag(shield, { ...wood, qty: 9 }), shield, 5000), /ไม้หมอก/);
	const sword = item("training_sword");
	assert.throws(() => socket(bag(sword), sword, 9999), /มีช่องการ์ดแล้ว/, "starter gear already has its slot");
	// Deeper gear costs the deeper map's material.
	assert.equal((socketPrice(item("relic_armour"), data) as { material: string }).material, "crag_root");
});
