import { clamp, type Combatant } from "./derive.js";
import type { GameData, StatusId } from "./schema.js";
export interface ActiveStatus {
	id: StatusId;
	expiresAt: number;
}
export function statusChance(
	target: Combatant,
	id: StatusId,
	chance: number,
	data: GameData,
	scripted = false,
) {
	if (target.boss && !scripted && data.status.bossImmune.includes(id)) return 0;
	if (id === "fear" && target.element !== "ghost") return 0;
	return (
		clamp(chance, 0, 1) *
		(1 - clamp(target.statusResist[id] || 0, 0, data.stats.caps.maxResist))
	);
}
/** Caller owns time/RNG/history. Reapply refreshes; it never stacks a second copy. */
export function applyStatus(
	active: readonly ActiveStatus[],
	target: Combatant,
	id: StatusId,
	chance: number,
	now: number,
	rng: () => number,
	data: GameData,
	options: { scripted?: boolean; pvpCcTimes?: readonly number[] } = {},
) {
	const definition = data.status.statuses.find((s) => s.id === id)!;
	const recent = (options.pvpCcTimes || []).filter(
		(t) => t <= now && now - t < data.pvp.cc.window,
	);
	const cc = ["stun", "freeze", "sleep", "fear"].includes(id);
	const duration =
		definition.seconds *
		(options.pvpCcTimes && cc
			? data.pvp.cc.multipliers[Math.min(recent.length, 3)]
			: 1);
	const living = active.filter((s) => s.expiresAt > now);
	if (
		duration === 0 ||
		rng() >= statusChance(target, id, chance, data, options.scripted)
	)
		return { applied: false, statuses: living, duration: 0 };
	return {
		applied: true,
		statuses: [
			...living.filter((s) => s.id !== id),
			{ id, expiresAt: now + duration },
		],
		duration,
	};
}
export function healReduction(
	target: Combatant,
	now: number,
	lastPlayerHit: number | undefined,
	data: GameData,
) {
	return clamp(
		target.healReduction +
			(lastPlayerHit !== undefined &&
			now >= lastPlayerHit &&
			now - lastPlayerHit < data.pvp.heal.window
				? data.pvp.heal.reduction
				: 0),
		0,
		1,
	);
}
