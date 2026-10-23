import type { GameData, Modifier } from './schema.js';
import type { OwnedItem } from './inventory.js';

/** Highest refine level an item can reach. */
export const REFINE_MAX = 15;
export const REFINE_SAFE_LEVEL = 10;
/** Index = target level - 1. +1..+4 never fail; reaching +10 establishes a permanent floor. */
export const REFINE_TABLE: readonly { chance: number; gold: number }[] = [
	{ chance: 1, gold: 200 }, { chance: 1, gold: 400 }, { chance: 1, gold: 700 }, { chance: 1, gold: 1000 },
	{ chance: 0.8, gold: 1500 }, { chance: 0.65, gold: 2200 }, { chance: 0.5, gold: 3000 },
	{ chance: 0.35, gold: 4000 }, { chance: 0.25, gold: 5500 }, { chance: 0.15, gold: 7500 },
	// The protected +10 tier starts a new progression band; +1..+10 keep their original economy.
	{ chance: 0.6, gold: 10000 }, { chance: 0.5, gold: 14000 }, { chance: 0.4, gold: 19000 },
	{ chance: 0.3, gold: 25000 }, { chance: 0.2, gold: 32000 },
];
/** Per refine level: weapons gain their primary ATK/MATK, other armour pieces gain hard DEF, as a share of the item's base value. */
export const REFINE_WEAPON_SHARE = 0.04;
export const REFINE_ARMOUR_SHARE = 0.03;
const ARMOUR_TYPES = ['armour', 'shield', 'garment', 'footgear'];
type Template = GameData['items']['items'][number];
export interface RefineMilestone {level:number;modifier:Modifier}
/** Fixed bonuses are derived from the current refine level, never rolled into prefix/suffix slots. */
export function refineMilestones(t:Template):RefineMilestone[]{
 if(!refineKind(t))return [];
 const magic=refineBase(t).stat==='matk';
 const bonuses:Record<string,Modifier[]>={
  weapon:magic?[{kind:'percent',stat:'matk',value:.03},{kind:'percent',stat:'castMul',value:-.03},{kind:'percent',stat:'matk',value:.05}]:[{kind:'percent',stat:'atk',value:.03},{kind:'flat',stat:'crit',value:.02},{kind:'percent',stat:'aspd',value:.03}],
  // Flat defence stays useful even when the character starts with zero hard DEF/MDEF.
  armour:[{kind:'percent',stat:'maxHp',value:.03},{kind:'flat',stat:'hardDef',value:5},{kind:'percent',stat:'maxHp',value:.05}],
  shield:[{kind:'flat',stat:'hardDef',value:5},{kind:'percent',stat:'maxHp',value:.03},{kind:'flat',stat:'hardMdef',value:5}],
  garment:[{kind:'flat',stat:'flee',value:3},{kind:'flat',stat:'hardMdef',value:5},{kind:'percent',stat:'moveSpeed',value:.02}],
  footgear:[{kind:'percent',stat:'moveSpeed',value:.02},{kind:'flat',stat:'flee',value:3},{kind:'percent',stat:'maxHp',value:.03}],
 };
 return bonuses[t.type].map((modifier,index)=>({level:(index+1)*5,modifier}));
}

export function refineKind(t: Template | undefined): 'weapon' | 'armour' | null {
	if (!t?.slot) return null;
	return t.type === 'weapon' ? 'weapon' : ARMOUR_TYPES.includes(t.type) ? 'armour' : null;
}
/** The stat a refine level raises and the item's base value for it. */
export function refineBase(t: Template): { stat: 'atk' | 'matk' | 'hardDef'; base: number } {
	if (t.type === 'weapon') return (t.matk ?? 0) > (t.atk ?? 0) ? { stat: 'matk', base: t.matk ?? 0 } : { stat: 'atk', base: t.atk ?? 0 };
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
	return value ? [{ kind: 'flat', stat: refineBase(t).stat, value },...refineMilestones(t).filter(m=>item.refine>=m.level).map(m=>m.modifier)] : [];
}
/** What the next attempt costs and risks, or a Thai reason the item cannot be refined. */
export function refineQuote(item: OwnedItem, data: GameData): { next: number; chance: number; gold: number; stone: string; failTo: number } | string {
	const t = data.items.items.find((t) => t.id === item.template), kind = refineKind(t);
	if (!kind) return 'ตีบวกได้เฉพาะอาวุธ เกราะ โล่ ผ้าคลุม และรองเท้า';
	if (item.refine >= REFINE_MAX) return `ตีบวกถึง +${REFINE_MAX} แล้ว`;
	const next = item.refine + 1, { chance, gold } = REFINE_TABLE[next - 1];
	return { next, chance, gold, stone: kind === 'weapon' ? 'weapon_stone' : 'armour_stone', failTo: chance < 1 ? Math.max(item.refine>=REFINE_SAFE_LEVEL?REFINE_SAFE_LEVEL:0, item.refine - 1) : item.refine };
}
