import type { GameData, Modifier } from './schema.js';
import type { OwnedItem } from './inventory.js';

/** Highest refine level an item can reach. */
export const REFINE_MAX = 10;
/** Index = target level - 1. +1..+4 never fail; from +5 a failed attempt drops the item one level. */
export const REFINE_TABLE: readonly { chance: number; gold: number }[] = [
	{ chance: 1, gold: 200 }, { chance: 1, gold: 400 }, { chance: 1, gold: 700 }, { chance: 1, gold: 1000 },
	{ chance: 0.8, gold: 1500 }, { chance: 0.65, gold: 2200 }, { chance: 0.5, gold: 3000 },
	{ chance: 0.35, gold: 4000 }, { chance: 0.25, gold: 5500 }, { chance: 0.15, gold: 7500 },
];
/** Per refine level: weapons gain ATK, other armour pieces gain hard DEF, as a share of the item's base value. */
export const REFINE_WEAPON_SHARE = 0.04;
export const REFINE_ARMOUR_SHARE = 0.03;
const ARMOUR_TYPES = ['armour', 'shield', 'garment', 'footgear'];
type Template = GameData['items']['items'][number];

export function refineKind(t: Template | undefined): 'weapon' | 'armour' | null {
	if (!t?.slot) return null;
	return t.type === 'weapon' ? 'weapon' : ARMOUR_TYPES.includes(t.type) ? 'armour' : null;
}
/** The stat a refine level raises and the item's base value for it. */
export function refineBase(t: Template): { stat: 'atk' | 'hardDef'; base: number } {
	if (t.type === 'weapon') return { stat: 'atk', base: t.atk ?? 0 };
	return { stat: 'hardDef', base: t.modifiers.reduce((n, m) => n + (m.kind === 'flat' && m.stat === 'hardDef' ? m.value : 0), 0) };
}
/** Total bonus at `level`; every level is worth at least +1 so low-stat gear still improves. */
export function refineBonusValue(t: Template, level: number) {
	if (!level || !refineKind(t)) return 0;
	const { base } = refineBase(t), share = t.type === 'weapon' ? REFINE_WEAPON_SHARE : REFINE_ARMOUR_SHARE;
	return Math.max(level, Math.round(base * share * level));
}
export function refineModifiers(item: Pick<OwnedItem, 'refine'>, t: Template): Modifier[] {
	const value = refineBonusValue(t, item.refine);
	return value ? [{ kind: 'flat', stat: refineBase(t).stat, value }] : [];
}
/** What the next attempt costs and risks, or a Thai reason the item cannot be refined. */
export function refineQuote(item: OwnedItem, data: GameData): { next: number; chance: number; gold: number; stone: string; failTo: number } | string {
	const t = data.items.items.find((t) => t.id === item.template), kind = refineKind(t);
	if (!kind) return 'ตีบวกได้เฉพาะอาวุธ เกราะ โล่ ผ้าคลุม และรองเท้า';
	if (item.refine >= REFINE_MAX) return `ตีบวกถึง +${REFINE_MAX} แล้ว`;
	const next = item.refine + 1, { chance, gold } = REFINE_TABLE[next - 1];
	return { next, chance, gold, stone: kind === 'weapon' ? 'weapon_stone' : 'armour_stone', failTo: chance < 1 ? Math.max(0, item.refine - 1) : item.refine };
}
