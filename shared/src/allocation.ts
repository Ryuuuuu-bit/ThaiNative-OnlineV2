import { statPointCost, deriveStats } from "./derive.js";
import type { CharacterInput, GameData, Stat } from "./schema.js";
export interface Allocation {
	profile: CharacterInput;
	statPoints: number;
	autoAllocate: boolean;
	autoAllocCursor: number;
}
export function allocateStats(
	state: Allocation,
	add: Partial<Record<Stat, number>>,
	data: GameData,
) {
	const base = { ...state.profile.baseStats };
	let points = state.statPoints,
		total = 0;
	for (const [key, value] of Object.entries(add)) {
		if (
			!data.stats.baseStats.includes(key as Stat) ||
			!Number.isInteger(value) ||
			value < 0 ||
			value > 99
		)
			throw Error("ค่าสเตตัสไม่ถูกต้อง");
		const stat = key as Stat;
		for (let n = 0; n < value; n++) {
			if (base[stat] >= data.stats.maxStat) throw Error("สเตตัสสูงสุด 99");
			const cost = statPointCost(base[stat], data);
			if (cost > points) throw Error("แต้มสเตตัสไม่พอ");
			points -= cost;
			base[stat]++;
			total++;
		}
	}
	if (!total) throw Error("ยังไม่ได้เลือกสเตตัส");
	return {
		profile: { ...state.profile, baseStats: base },
		statPoints: points,
		autoAllocate: false,
		autoAllocCursor: state.autoAllocCursor,
	};
}
/** Smooth weighted round-robin; cursor survives level-ups and reconnects. Unaffordable remainder carries. */
export function autoAllocateStats(
	state: Allocation,
	data: GameData,
): Allocation {
	if (!state.autoAllocate) return state;
	const preset = data.classes.classes.find(
		(c) => c.id === state.profile.classId,
	)!.preset;
	const ring = data.stats.baseStats
		.flatMap((stat) =>
			Array.from({ length: preset[stat] }, (_, i) => ({
				stat,
				rank: (i + 0.5) / preset[stat],
			})),
		)
		.sort((a, b) => a.rank - b.rank)
		.map((v) => v.stat);
	const next = {
		...state,
		profile: { ...state.profile, baseStats: { ...state.profile.baseStats } },
	};
	while (next.statPoints > 0) {
		let selected = false;
		for (let offset = 0; offset < ring.length; offset++) {
			const index = (next.autoAllocCursor + offset) % ring.length,
				stat = ring[index],
				value = next.profile.baseStats[stat],
				cost = statPointCost(value, data);
			if (value >= data.stats.maxStat || cost > next.statPoints) continue;
			next.profile.baseStats[stat]++;
			next.statPoints -= cost;
			next.autoAllocCursor = (index + 1) % ring.length;
			selected = true;
			break;
		}
		if (!selected) break;
	}
	return next;
}
export function resetStats(state: Allocation, data: GameData): Allocation {
	if (!data.stats.statResetFree) throw Error("ยังไม่เปิดให้รีเซ็ตสเตตัส");
	const base = { ...state.profile.baseStats };
	let refund = 0;
	for (const stat of data.stats.baseStats) {
		const start = state.profile.starterGrant
			? data.stats.defaultBuild.baseStats[stat]
			: data.stats.start;
		for (let n = start; n < base[stat]; n++) refund += statPointCost(n, data);
		base[stat] = Math.min(base[stat], start);
	}
	return {
		...state,
		profile: { ...state.profile, baseStats: base },
		statPoints: state.statPoints + refund,
		autoAllocate: false,
		autoAllocCursor: 0,
	};
}
export function allocationPreview(
	state: Allocation,
	add: Partial<Record<Stat, number>>,
	data: GameData,
) {
	const next = allocateStats(state, add, data);
	return { ...next, derived: deriveStats(next.profile, data) };
}
