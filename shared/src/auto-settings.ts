import { z } from "zod";
import type { GameData } from "./schema.js";
import { FIELD_BOSS, LAYOUTS, type MapId } from "./game/maps.js";

/**
 * AUTO (auto-hunt) settings, chosen in the ตั้งค่า AUTO window and run by the server sim (autoStep).
 * Ported from The Beginning OnlineOnline src/ui/autoSettings.js; skills are kept by skill id instead of bar slot,
 * because the server, not the browser, casts them. Potion thresholds are the per-character AutoPotion
 * rule (auto-potion.ts), which also works outside AUTO.
 */
export const AUTO_RANGES = { near: 7, mid: 11, far: 14, map: Infinity } as const;
export type AutoRange = keyof typeof AUTO_RANGES;
const pct = z.number().int().min(0).max(90);
const id = z.string().regex(/^[a-z0-9_]{1,40}$/);
export const AutoSettingsSchema = z
	.object({
		/** skills AUTO never casts */
		off: z.array(id).max(32),
		/** skills in the order AUTO uses them; learned skills not listed follow in hotbar order */
		order: z.array(id).max(32),
		/** cycle: take turns down the order · priority: always the first ready one */
		mode: z.enum(["cycle", "priority"]),
		/** { mapId: monster data ids } AUTO hunts there; a map with none listed hunts everything */
		mobs: z.record(z.string().max(20), z.array(id).max(32)),
		/** basic attacks between skills (casters may turn it off to save SP) */
		basic: z.boolean(),
		/** below this % HP, survival skills go first */
		survive: pct,
		/** monsters already fighting me come first */
		attackers: z.boolean(),
		/** then elites and bosses */
		elites: z.boolean(),
		range: z.enum(["near", "mid", "far", "map"]),
	})
	.strict();
export type AutoSettings = z.infer<typeof AutoSettingsSchema>;
export const DEFAULT_AUTO: AutoSettings = {
	off: [],
	order: [],
	mode: "cycle",
	mobs: {},
	basic: true,
	survive: 45,
	attackers: true,
	// Off by default: untouched AUTO hunts the nearest monster instead of crossing the map for the boss.
	elites: false,
	range: "mid",
};
/** Anything malformed falls back field by field to the defaults. */
export function normalizeAuto(s: unknown): AutoSettings {
	const o = { ...DEFAULT_AUTO, ...(s && typeof s === "object" ? s : {}) } as Record<string, unknown>;
	const out = {} as Record<string, unknown>;
	for (const key of Object.keys(DEFAULT_AUTO) as (keyof AutoSettings)[]) {
		const field = AutoSettingsSchema.shape[key].safeParse(o[key]);
		out[key] = field.success ? field.data : DEFAULT_AUTO[key];
	}
	return out as AutoSettings;
}

/** Skills that keep the player alive (buffs, heals): cast first once HP drops under `survive`. */
export const isSurvivalSkill = (skill: { effect?: string } | undefined) =>
	!!skill && ["endure", "heal", "barrier", "guard"].includes(skill.effect ?? "");

/** The monsters a field map spawns (its boss included), weakest first, for the hunt list. */
export function huntList(mapId: MapId, data: GameData) {
	const ids = new Set(LAYOUTS[mapId]?.spawns.map((s) => s.dataId) ?? []);
	const boss = (FIELD_BOSS as Record<string, { dataId: string; minion: string }>)[mapId];
	if (boss) ids.add(boss.dataId);
	return [...ids]
		.map((id) => data.monsters.monsters.find((m) => m.id === id))
		.filter((m): m is NonNullable<typeof m> => !!m)
		.map((m) => ({ id: m.id, name: m.nameTh, level: m.level, boss: !!m.boss }))
		.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "th"));
}
export const wantedMonsters = (s: AutoSettings, mapId: string) =>
	s.mobs[mapId]?.length ? new Set(s.mobs[mapId]) : null;

/**
 * Active skills AUTO may cast, in the player's order: s.order first, then the rest in hotbar order,
 * then learned skills that are not on the bar (so a newly learned job skill is used before it is placed).
 */
export function autoSkillSequence(s: AutoSettings, hotbar: readonly (string | null)[], learned: (id: string) => boolean, known: readonly string[] = [], rank: (id: string) => number = () => 0) {
	const bar = [...hotbar.filter((id): id is string => !!id && !id.startsWith("item:")), ...known];
	// skills the player has not ordered follow by rank (higher job tier first), then bar order
	const rest = bar.filter((id) => !s.order.includes(id)).map((id, i) => ({ id, i, r: rank(id) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.id);
	const seq = [...s.order.filter((id) => bar.includes(id)), ...rest];
	return [...new Set(seq)].filter((id) => learned(id) && !s.off.includes(id));
}
/**
 * Skills to try this decision, in order. 'cycle' rotates the sequence to start at `next`;
 * 'priority' always starts at the top. Under the survival line, survival skills move to the front.
 */
export function autoCastOrder(seq: string[], s: AutoSettings, hpFrac: number, next: string | null, survival: (id: string) => boolean) {
	let start = s.mode === "priority" || !next ? 0 : seq.indexOf(next);
	if (start < 0) start = 0;
	const order = [...seq.slice(start), ...seq.slice(0, start)];
	if (s.survive && hpFrac * 100 < s.survive) return [...order.filter(survival), ...order.filter((id) => !survival(id))];
	return order;
}
/** Default AUTO rank of a skill: skills of a higher job tier come first (SP goes to the stronger move). */
export function skillTierRank(data: GameData, skillId: string) {
	const skill = data.skills.skills.find((x) => x.id === skillId),
		tier = data.jobs.jobs.find((j) => j.id === skill?.jobId)?.tier ?? 1;
	return -tier;
}
