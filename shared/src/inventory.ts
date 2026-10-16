import { deriveStats } from "./derive.js";
import type { CharacterInput, GameData, Monster } from "./schema.js";

export type ItemLocation =
	| "bag"
	| "equip"
	| "storage"
	| "mail"
	| "escrow"
	| "market"
	| "auction";
export interface OwnedItem {
	id: string;
	template: string;
	qty: number;
	location: ItemLocation;
	slot: string | null;
	refine: number;
	cards: string[];
	bound: boolean;
	source: string;
}
export interface Inventory {
	version: 1;
	items: OwnedItem[];
	autoPickup: boolean;
}
export interface EconomyState {
	gold: number;
	inventory: Inventory;
}
export interface InventoryOp {
	op:
		| "buy"
		| "sell"
		| "equip"
		| "unequip"
		| "use"
		| "discard"
		| "pickup"
		| "settings"
		| "admin";
	template?: string;
	id?: string;
	qty?: number;
	ids?: string[];
	shop?: string;
	gold?: number;
	loot?: { template: string; qty: number }[];
	on?: boolean;
}
export interface LedgerEntry {
	kind: string;
	template?: string;
	itemId?: string;
	qty: number;
	goldDelta: number;
}
export const rarityColors = {
	common: "#eee7d4",
	fine: "#83ba73",
	rare: "#79b6ec",
	epic: "#c697ed",
	legendary: "#edc369",
};
export function inventoryWeight(inv: Inventory, data: GameData) {
	return inv.items
		.filter((i) => i.location === "bag" || i.location === "equip")
		.reduce(
			(n, i) =>
				n + data.items.items.find((t) => t.id === i.template)!.weight * i.qty,
			0,
		);
}
export function inventorySlots(inv: Inventory, data: GameData) {
	return inv.items
		.filter((i) => i.location === "bag")
		.reduce(
			(n, i) =>
				n +
				Math.ceil(
					i.qty / data.items.items.find((t) => t.id === i.template)!.maxStack,
				),
			0,
		);
}
export function equipped(inv: Inventory) {
	return inv.items.filter((i) => i.location === "equip").map((i) => i.template);
}
export function redPotion(inv: Inventory, data: GameData) {
	return inv.items
		.filter(
			(i) =>
				i.location === "bag" &&
				data.items.items.find((t) => t.id === i.template)?.effect === "hp",
		)
		.sort(
			(a, b) =>
				data.items.items.find((t) => t.id === b.template)!.amount! -
				data.items.items.find((t) => t.id === a.template)!.amount!,
		)[0];
}
export function starterInventory(
	potions: number,
	uuid: () => string,
): Inventory {
	return {
		version: 1,
		autoPickup: true,
		items: [
			{
				id: uuid(),
				template: "training_sword",
				qty: 1,
				location: "equip",
				slot: "weapon",
				refine: 0,
				cards: [],
				bound: false,
				source: "migration",
			},
			{
				id: uuid(),
				template: "traveler_clothes",
				qty: 1,
				location: "equip",
				slot: "body",
				refine: 0,
				cards: [],
				bound: false,
				source: "migration",
			},
			...(potions > 0
				? [
						{
							id: "stack:red_small",
							template: "red_small",
							qty: potions,
							location: "bag" as const,
							slot: null,
							refine: 0,
							cards: [],
							bound: false,
							source: "migration",
						},
					]
				: []),
		],
	};
}
export function rollDrops(
	monster: Monster,
	random: () => number,
	data: GameData,
	autoSeconds = 0,
	bonus = 0,
) {
	return monster.drops.flatMap((d) => {
		const t = data.items.items.find((t) => t.id === d.item)!;
		const rare = ["rare", "epic", "legendary"].includes(t.rarity);
		const multiplier =
			data.economy.dropMultiplier *
			(1 + bonus) *
			(rare && autoSeconds > data.economy.autoRareAfterSeconds
				? data.economy.autoRareMultiplier
				: 1);
		return random() < Math.min(1, d.rate * multiplier)
			? [
					{
						template: d.item,
						qty: d.min + Math.floor(random() * (d.max - d.min + 1)),
					},
				]
			: [];
	});
}
/** Pure copy-on-write reducer. Stores publish this result and ledger together, or neither. */
export function applyInventory(
	state: EconomyState,
	op: InventoryOp,
	profile: CharacterInput,
	data: GameData,
	uuid: () => string,
) {
	const next = structuredClone(state),
		inv = next.inventory,
		ledger: LedgerEntry[] = [];
	const template = (id: string) => {
		const t = data.items.items.find((t) => t.id === id);
		if (!t) throw Error("ไม่พบชนิดไอเทม");
		return t;
	};
	const count = op.qty ?? 1;
	if (!Number.isSafeInteger(count) || count < 1 || count > 9999)
		throw Error("จำนวนไม่ถูกต้อง");
	const owned = (id?: string) => {
		const i = inv.items.find((i) => i.id === id);
		if (!i || !["bag", "equip"].includes(i.location))
			throw Error("ไอเทมนี้ไม่ใช่ของคุณ");
		return i;
	};
	const add = (id: string, qty: number, source: string) => {
		const t = template(id);
		if (!Number.isSafeInteger(qty) || qty < 1 || qty > 9999)
			throw Error("จำนวนไม่ถูกต้อง");
		let i = t.stackable
			? inv.items.find((i) => i.template === id && i.location === "bag")
			: undefined;
		if (i) i.qty += qty;
		else
			for (let n = 0; n < (t.stackable ? 1 : qty); n++)
				inv.items.push({
					id: t.stackable ? "stack:" + id : uuid(),
					template: id,
					qty: t.stackable ? qty : 1,
					location: "bag",
					slot: null,
					refine: 0,
					cards: [],
					bound: t.bind === "account",
					source,
				});
	};
	const remove = (i: OwnedItem, qty: number) => {
		if (i.location !== "bag" || qty > i.qty)
			throw Error("ไอเทมไม่พอ หรือยังสวมอยู่");
		i.qty -= qty;
		if (!i.qty) inv.items.splice(inv.items.indexOf(i), 1);
	};
	const log = (
		kind: string,
		i: OwnedItem | undefined,
		qty: number,
		goldDelta = 0,
	) =>
		ledger.push({
			kind,
			itemId: i?.id,
			template: i?.template ?? op.template,
			qty,
			goldDelta,
		});
	if (op.op === "buy") {
		const t = template(op.template!);
		const price = data.economy.shops[op.shop || ""]?.[t.id];
		if (price === undefined) throw Error("ร้านนี้ไม่มีสินค้านี้");
		const cost = price * count;
		if (cost > next.gold) throw Error("ทองไม่พอ");
		next.gold -= cost;
		add(t.id, count, "npc");
		log("npc_buy", undefined, count, -cost);
	}
	if (op.op === "sell" || op.op === "discard") {
		const ids = op.ids ?? [op.id!];
		if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length)
			throw Error("รายการซ้ำหรือไม่ถูกต้อง");
		for (const id of ids) {
			const i = owned(id),
				t = template(i.template);
			if (i.bound && op.op === "sell") throw Error("ขายของผูกมัดไม่ได้");
			const qty = op.ids ? i.qty : count;
			const value =
				op.op === "sell"
					? Math.floor(t.npcPrice * data.economy.sellMultiplier) * qty
					: 0;
			remove(i, qty);
			next.gold += value;
			log(op.op === "sell" ? "npc_sell" : "discard", i, qty, value);
		}
	}
	if (op.op === "equip") {
		const i = owned(op.id),
			t = template(i.template);
		if (i.location !== "bag" || !t.slot || t.level > profile.level)
			throw Error("ระดับไม่พอ หรือใส่ไม่ได้");
		const old = inv.items.find(
			(i) => i.location === "equip" && i.slot === t.slot,
		);
		if (old) {
			old.location = "bag";
			old.slot = null;
			log("unequip", old, 1);
		}
		i.location = "equip";
		i.slot = t.slot;
		i.bound ||= t.bind === "equip";
		deriveStats({ ...profile, equipment: equipped(inv) }, data);
		log("equip", i, 1);
	}
	if (op.op === "unequip") {
		const i = owned(op.id);
		if (i.location !== "equip") throw Error("ยังไม่ได้สวม");
		i.location = "bag";
		i.slot = null;
		log("unequip", i, 1);
	}
	let effect: { kind: string; amount: number } | undefined;
	if (op.op === "use") {
		const i = owned(op.id),
			t = template(i.template);
		if (t.type !== "consumable" || !t.effect) throw Error("ใช้ไม่ได้");
		remove(i, 1);
		log("use", i, 1);
		effect = { kind: t.effect, amount: t.amount! };
	}
	if (op.op === "pickup" || op.op === "admin") {
		for (const drop of op.loot ?? []) {
			add(drop.template, drop.qty, op.op === "pickup" ? "drop" : "admin");
			ledger.push({
				kind: op.op,
				template: drop.template,
				qty: drop.qty,
				goldDelta: 0,
			});
		}
		const gold = op.gold ?? 0;
		if (!Number.isSafeInteger(gold) || gold < 0) throw Error("ทองไม่ถูกต้อง");
		next.gold += gold;
		ledger.push({ kind: op.op, qty: 0, goldDelta: gold });
	}
	if (op.op === "settings") inv.autoPickup = !!op.on;
	if (
		!Number.isSafeInteger(next.gold) ||
		next.gold < 0 ||
		next.gold > 2147483647
	)
		throw Error("ทองเกินขีดจำกัด");
	if (["buy", "pickup", "equip", "unequip"].includes(op.op)) {
		if (inventorySlots(inv, data) > data.economy.inventorySlots)
			throw Error("กระเป๋าเต็ม");
		const max = deriveStats(
			{ ...profile, equipment: equipped(inv) },
			data,
		).weight;
		if (inventoryWeight(inv, data) > max) throw Error("น้ำหนักเกิน");
	}
	return { state: next, ledger, effect };
}
