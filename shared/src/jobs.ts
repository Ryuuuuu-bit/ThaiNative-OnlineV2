import type { GameData, Skill } from "./schema.js";
import jobDefinitions from "../data/jobs.json" with { type: "json" };

export interface HotbarSlot {
	skill: string | null;
	key: string;
}
export interface JobProgress {
	jobId: string;
	jobLevel: number;
	jobExp: number;
	skillPoints: number;
	skills: Record<string, number>;
	hotbar: HotbarSlot[];
}
export const HOTBAR_KEYS = [
	"Digit1",
	"Digit2",
	"Digit3",
	"Digit4",
	"Digit5",
	"Digit6",
	"Digit7",
	"Digit8",
	"Digit9",
	"Digit0",
];
export const RESERVED_KEYS = [
	"KeyW",
	"KeyA",
	"KeyS",
	"KeyD",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"KeyK",
	"KeyC",
	"KeyF",
	"KeyT",
	"KeyJ",
	"KeyR",
	"Space",
	"Tab",
	"Escape",
	"ShiftLeft",
	"ShiftRight",
];
export const skillId = (id: string) =>
	(
		({ attack: "basic", spin: "whirlwind", dash: "dodge" }) as Record<
			string,
			string
		>
	)[id] || id;
export function defaultHotbar(jobId: string): HotbarSlot[] {
	const active =
		jobId === "villager"
			? ["punch"]
			: [
					"slash",
					"whirlwind",
					"dash_strike",
					"earth_break",
					"endure",
					"provoke",
				];
	return HOTBAR_KEYS.map((key, i) => ({ key, skill: active[i] || null }));
}
export function newJob(): JobProgress {
	return {
		jobId: "villager",
		jobLevel: 1,
		jobExp: 0,
		skillPoints: 1,
		skills: { basic: 1, dodge: 1, potion: 1 },
		hotbar: defaultHotbar("villager"),
	};
}
export function migrateJob(level: number): JobProgress {
	const p = newJob();
	return {
		...p,
		jobId: "swordsman",
		skillPoints: Math.min(50, 10 + level - 1),
		skills: { ...p.skills, whirlwind: 1, earth_break: 1, fighter_basics: 0 },
		hotbar: defaultHotbar("swordsman"),
	};
}
export function oldDefaultHotbars() {
	const keys = [
		"KeyQ",
		"KeyE",
		"Digit1",
		"Digit2",
		"Digit3",
		"Digit4",
		"Digit5",
		"Digit6",
		"Digit7",
		"Digit8",
	];
	return [false, true].map((legacy) =>
		keys.map((key, i) => ({
			key,
			skill:
				i === 0
					? legacy
						? "whirlwind"
						: "basic"
					: i === 1
						? legacy
							? "earth_break"
							: "dodge"
						: i === 6
							? "potion"
							: null,
		})),
	);
}
export function resolveSkill(data: GameData, id: string, level = 1): Skill {
	const s = data.skills.skills.find((s) => s.id === skillId(id));
	if (!s) throw Error("ไม่พบสกิล");
	const index = Math.max(0, Math.min(s.maxLevel - 1, level - 1));
	return {
		...s,
		percent: s.values?.percent?.[index] ?? s.percent,
		sp: s.values?.sp?.[index] ?? s.sp,
	};
}
export const skillValue = (s: Skill, name: string, level: number) =>
	s.values?.[name]?.[Math.max(0, Math.min(s.maxLevel - 1, level - 1))] ?? 0;
export function belongsToJob(
	job: string,
	skillJob: string,
	data: GameData,
): boolean {
	if (skillJob === "common") return true;
	let current = data.jobs.jobs.find((j) => j.id === job);
	const seen = new Set<string>();
	while (current && !seen.has(current.id)) {
		if (current.id === skillJob) return true;
		seen.add(current.id);
		current = data.jobs.jobs.find((j) => j.id === current!.parent);
	}
	return false;
}
export function skillLock(
	p: JobProgress,
	id: string,
	data: GameData,
): string | null {
	const s = data.skills.skills.find((s) => s.id === id);
	if (!s) return "ไม่พบสกิล";
	if (id === "fighter_basics") return "ได้รับจากต่อยเมื่อเปลี่ยนอาชีพ";
	if (id === "punch" && p.jobId !== "villager") return "ต่อยเปลี่ยนเป็นพื้นฐานนักสู้แล้ว";
	if (!belongsToJob(p.jobId, s.jobId, data)) return "อาชีพไม่ตรง";
	if ((p.skills[id] || 0) >= s.maxLevel) return "ระดับสูงสุด";
	const missing = s.requires.find((r) => (p.skills[r.id] || 0) < r.level);
	if (missing)
		return `ต้องมี ${data.skills.skills.find((s) => s.id === missing.id)?.nameTh} Lv.${missing.level}`;
	if (p.skillPoints < 1) return "แต้มสกิลไม่พอ";
	return null;
}
export function learnSkill(
	p: JobProgress,
	id: string,
	data: GameData,
): JobProgress {
	const reason = skillLock(p, id, data);
	if (reason) throw Error(reason);
	return {
		...p,
		skillPoints: p.skillPoints - 1,
		skills: { ...p.skills, [id]: (p.skills[id] || 0) + 1 },
	};
}
export function gainJobExp(
	p: JobProgress,
	amount: number,
	data: GameData,
): number {
	const job = data.jobs.jobs.find((j) => j.id === p.jobId)!;
	let gained = 0;
	p.jobExp += Math.max(0, Math.floor(amount));
	const table =
		job.tier === 0
			? data.jobs.expToNext.villager
			: job.tier === 1
				? data.jobs.expToNext.tier1
				: data.jobs.expToNext.tier2;
	while (p.jobLevel < job.maxLevel && p.jobExp >= table[p.jobLevel - 1]) {
		p.jobExp -= table[p.jobLevel - 1];
		p.jobLevel++;
		p.skillPoints++;
		gained++;
	}
	if (p.jobLevel === job.maxLevel) p.jobExp = 0;
	return gained;
}
export function changeJob(
	p: JobProgress,
	jobId: string,
	x: number,
	z: number,
	data: GameData,
): JobProgress {
	const job = data.jobs.jobs.find((j) => j.id === jobId),
		angel = data.jobs.angel;
	if (!job?.available || job.parent !== p.jobId) throw Error("อาชีพนี้ยังไม่เปิด");
	if (p.jobLevel < (job.tier === 1 ? 10 : 40)) throw Error("Job Lv ไม่ถึงเกณฑ์");
	if (Math.hypot(x - angel.x, z - angel.z) > angel.range)
		throw Error("กรุณาคุยกับทูตสวรรค์ใกล้แคมป์");
	const skills = { ...p.skills };
	if (p.jobId === "villager") {
		skills.fighter_basics = skills.punch || 0;
		delete skills.punch;
	}
	return {
		...p,
		jobId,
		jobLevel: 1,
		jobExp: 0,
		skillPoints: p.skillPoints + 1,
		skills,
		hotbar: defaultHotbar(jobId),
	};
}
export function validateHotbar(
	p: JobProgress,
	slots: HotbarSlot[],
	data: GameData,
): HotbarSlot[] {
	if (slots.length !== 10) throw Error("ต้องมี 10 ช่อง");
	const used = new Set<string>();
	for (const [index, slot] of slots.entries()) {
		if (
			!/^(Key[A-Z]|Digit[0-9]|F[1-9]|F1[0-2])$/.test(slot.key) ||
			RESERVED_KEYS.includes(slot.key) ||
			used.has(slot.key)
		)
			throw Error("ปุ่มซ้ำหรือสงวนไว้");
		used.add(slot.key);
		if (slot.skill !== null) {
			const s = data.skills.skills.find((s) => s.id === slot.skill);
			if (
				!s ||
				s.passive ||
				(!p.skills[s.id] && p.hotbar[index]?.skill !== s.id) ||
				!belongsToJob(p.jobId, s.jobId, data)
			)
				throw Error("ต้องเรียนสกิลก่อน");
		}
	}
	return slots.map((s) => ({ ...s }));
}
export interface TimedEffect {
	id: "stun" | "knockup" | "taunt" | "def_down" | "slow" | "endure";
	remaining: number;
	value: number;
	sourceId: string;
}
export function skillEffects(
	s: Skill,
	level: number,
	sourceId: string,
	isPlayer = false,
): TimedEffect[] {
	const effect = (
		id: TimedEffect["id"],
		remaining: number,
		value = 0,
	): TimedEffect => ({ id, remaining, value, sourceId });
	if (s.effect === "dash" || s.effect === "knockup")
		return [
			effect(
				s.effect === "dash" ? "stun" : "knockup",
				(s.duration || 0) * (isPlayer ? (s.pvpDurationMul ?? 1) : 1),
			),
		];
	if (s.effect === "taunt")
		return isPlayer
			? [effect("slow", s.pvpEffect?.duration || 3, s.pvpEffect?.value || 0.2)]
			: [
					effect("taunt", s.duration || 5),
					effect("def_down", s.duration || 5, skillValue(s, "defDown", level)),
				];
	if (s.effect === "endure")
		return [effect("endure", s.duration || 8, skillValue(s, "defUp", level))];
	return [];
}
export function applyEffects(
	target: { statuses: TimedEffect[] },
	effects: TimedEffect[],
) {
	for (const effect of effects) {
		if (
			effect.id === "knockup" &&
			target.statuses.some((s) => s.id === "endure" && s.remaining > 0)
		)
			continue;
		target.statuses = target.statuses.filter((s) => s.id !== effect.id);
		target.statuses.push({ ...effect });
	}
}
export function tickEffects(target: { statuses: TimedEffect[] }, dt: number) {
	target.statuses = target.statuses
		.map((s) => ({ ...s, remaining: s.remaining - dt }))
		.filter((s) => s.remaining > 0);
}
export function rhythmCooldowns(
	cd: Record<string, number>,
	level: number,
	data?: GameData,
) {
	const reduction =
		data && level > 0
			? skillValue(
					resolveSkill(data, "sword_rhythm", level),
					"cooldownReduction",
					level,
				)
			: 0.1 * level;
	for (const key of Object.keys(cd))
		if (!["attack", "basic"].includes(key))
			cd[key] = Math.max(0, cd[key] - reduction);
}

export function normalizeJob(
	p: Partial<JobProgress> & { level: number; jobsVersion?: number },
): JobProgress {
	if (!p.jobId) return migrateJob(p.level);
	const out: JobProgress = {
		jobId: p.jobId,
		jobLevel: p.jobLevel || 1,
		jobExp: p.jobExp || 0,
		skillPoints: p.skillPoints ?? 0,
		skills: { ...(p.skills || {}) },
		hotbar: (p.hotbar || defaultHotbar(p.jobId)).map((s) => ({ ...s })),
	};
	if ((p.jobsVersion ?? 0) < 2) {
		const tier = jobDefinitions.jobs.find((j) => j.id === p.jobId)?.tier ?? 1;
		out.skillPoints = Math.min(
			tier === 0 ? 10 : tier === 1 ? 50 : 70,
			out.skillPoints +
				((p.jobsVersion ?? 0) === 0 ? 1 : tier + 1) +
				(out.skills.first_aid || 0) +
				(out.skills.survival || 0),
		);
		delete out.skills.first_aid;
		delete out.skills.survival;
		if (p.jobId !== "villager") {
			out.skills.fighter_basics =
				out.skills.punch || out.skills.fighter_basics || 0;
			delete out.skills.punch;
		}
		if (
			oldDefaultHotbars().some(
				(old) =>
					old.length === out.hotbar.length &&
					old.every(
						(s, i) =>
							s.key === out.hotbar[i].key && s.skill === out.hotbar[i].skill,
					),
			)
		)
			out.hotbar = defaultHotbar(p.jobId);
		out.hotbar = out.hotbar.map((s) => ({
			...s,
			skill:
				["first_aid", "survival"].includes(s.skill || "") ||
				(s.skill === "punch" && p.jobId !== "villager")
					? null
					: s.skill,
		}));
	}
	return out;
}
