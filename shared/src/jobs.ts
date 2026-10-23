import type { GameData, Skill } from "./schema.js";
import { normalizeMastery, isMasteryAction, isMasteryPassive, resolveMasteryAction, masterySkillLock, learnMasterySkill, masteryAutoRank,masteryTriggerSlots,type MasteryState } from "./mastery.js";
import { BINDABLE_KEY } from "./keybinds.js";
import jobDefinitions from "../data/jobs.json" with { type: "json" };
import itemDefinitions from "../data/items.json" with { type: "json" };
/** Item ids that may sit on the hotbar as "item:<id>" (usable consumables). */
export const HOTBAR_ITEMS = new Set(itemDefinitions.items.filter((t: any) => t.type === "consumable" && t.effect).map((t) => t.id));
export const isHotbarItem = (slot: string | null) => !!slot?.startsWith("item:") && HOTBAR_ITEMS.has(slot.slice(5));

export interface HotbarSlot {
	skill: string | null;
	key: string;
 mode?:'autoSpell';
 signature?:string;
}
export interface JobProgress extends MasteryState {
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
 "KeyI","KeyH",
 "KeyM",
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
		jobId === "needs_job" || jobId === "villager"
			? []
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
export function newJob(jobId = "swordsman"): JobProgress {
	const job = jobDefinitions.jobs.find(j => j.id === jobId);
	if (!job?.available || job.tier !== 1) throw Error("อาชีพนี้ยังไม่เปิด");
	return {
		...normalizeMastery({}),
		jobId,
		jobLevel: 1,
		jobExp: 0,
		skillPoints: 1,
		skills: { basic: 1, dodge: 1, potion: 1 },
		hotbar: defaultHotbar(jobId),
	};
}
export function migrateJob(level: number): JobProgress {
	const p = newJob();
	const skills = { ...p.skills, whirlwind: 1, earth_break: 1 };
	return {
		...p,
		...normalizeMastery({skills}),
		jobId: "swordsman",
		skillPoints: Math.min(50, 10 + level - 1),
		skills,
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
	if (isMasteryAction(id)||isMasteryPassive(id)) return resolveMasteryAction(data, id, level);
	const s = data.skills.skills.find((s) => s.id === skillId(id));
	if (!s) throw Error("ไม่พบสกิล");
	const index = Math.max(0, Math.min(s.maxLevel - 1, level - 1));
	return {
		...s,
		jobId:data.mastery.skills.some(v=>v.id===s.id&&v.school==='Swordsman')?'common':s.jobId,
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
	if (isMasteryAction(id)||isMasteryPassive(id)||data.mastery.skills.some(s=>s.id===id&&s.school==='Swordsman')) return masterySkillLock(p, id, data.mastery);
	const s = data.skills.skills.find((s) => s.id === id);
	if (!s) return "ไม่พบสกิล";
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
	if (isMasteryAction(id)||isMasteryPassive(id)||data.mastery.skills.some(s=>s.id===id&&s.school==='Swordsman')) return learnMasterySkill(p, id, data.mastery);
	const reason = skillLock(p, id, data);
	if (reason) throw Error(reason);
	const skills = { ...p.skills, [id]: (p.skills[id] || 0) + 1 };
	return {
		...p,
		...normalizeMastery({...p, skills, masteryVersion: 0}, data.mastery),
		skillPoints: p.skillPoints - 1,
		skills,
	};
}
export function gainJobExp(
	p: JobProgress,
	amount: number,
	data: GameData,
): number {
	const job = data.jobs.jobs.find((j) => j.id === p.jobId);
	if (!job) return 0;
	let gained = 0;
	p.jobExp += Math.max(0, Math.floor(amount));
	const table =
		job.tier === 1
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
	if (!job?.available || job.tier !== 2 || job.parent !== p.jobId) throw Error("อาชีพนี้ยังไม่เปิด");
	if (p.jobLevel < 40) throw Error("Job Lv ไม่ถึงเกณฑ์");
	if (Math.hypot(x - angel.x, z - angel.z) > angel.range)
		throw Error("กรุณาคุยกับทูตสวรรค์ที่หอนาฬิกา");
	const skills = { ...p.skills };

	return {
		...p,
		jobId,
		jobLevel: 1,
		jobExp: 0,
		skillPoints: p.skillPoints + 1,
		skills,
		// Keep the player's own bar; the new skills go in from the skill book.
		hotbar: p.hotbar.map((s) => ({ ...s })),
	};
}
export function validateHotbar(
	p: JobProgress,
	slots: HotbarSlot[],
	data: GameData,
	/** codes taken by actions (keybinds.reservedKeys); defaults to the original fixed layout */
	reserved: readonly string[] = RESERVED_KEYS,
): HotbarSlot[] {
	if (slots.length !== 10) throw Error("ต้องมี 10 ช่อง");
	const used = new Set<string>();
 const triggers=new Set<string>(),signatures=slots.filter(s=>s.signature);
 if(signatures.length>1)throw Error('เลือก Signature Mix ได้หนึ่งสูตร');
	for (const [index, slot] of slots.entries()) {
		if (
			!BINDABLE_KEY.test(slot.key) ||
			reserved.includes(slot.key) ||
			used.has(slot.key)
		)
			throw Error("ปุ่มซ้ำหรือสงวนไว้");
		used.add(slot.key);
  if(slot.mode!==undefined){
   if(slot.mode!=='autoSpell'||!slot.skill||triggers.has(slot.skill)||masteryAutoRank(p,slot.skill,data.mastery)<1)throw Error('Auto Spell ไม่ถูกต้องหรือยังไม่ปลดล็อก');
   triggers.add(slot.skill);if(triggers.size>masteryTriggerSlots(p.masteries))throw Error('ช่อง Trigger ไม่พอ');
  }
  if(slot.signature){
   const mix=data.mastery.mixes.find(m=>m.id===slot.signature);
   if(!mix||!slot.skill||!(slot.skill in mix.requires)||slot.mode||Object.entries(mix.masteries).some(([school,level])=>(p.masteries[school as keyof typeof p.masteries]??0)<level!)||Object.entries(mix.pathRanks).some(([id,rank])=>(p.skills[id]??0)<rank)||Object.keys(mix.requires).some(id=>!slots.some(s=>s.skill===id&&!s.mode)))throw Error('Mastery แรงค์ หรือส่วนประกอบ Signature Mix ไม่ครบ');
  }
		if(slot.skill?.startsWith('item:')){if(!data.items.items.some(t=>t.id===slot.skill!.slice(5)&&t.type==='consumable'&&t.effect))throw Error('ใช้ไอเทมนี้ในแถบไม่ได้');continue;}
        if (slot.skill !== null) {
			const s = data.mastery.skills.some(s=>s.id===slot.skill) ? resolveSkill(data, slot.skill, p.skills[slot.skill] || 1) : data.skills.skills.find((s) => s.id === slot.skill);
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
 hardOnly?:boolean;
 automatic?:boolean;
 skillId?:string;
 targetId?: number;
 tick?: number;
	id: "root" | "freeze" | "mdef_down" | "atk_down" | "stun" | "knockup" | "taunt" | "def_down" | "slow" | "endure" | "speed" | "guard" | "rage" | "magic_shield" | "slow_resist" | "archer_mark" | "poison_coat" | "push_resist" | "finisher_ready" | "spirit_intercept" | "burn";
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
	): TimedEffect => ({ id, remaining, value, sourceId,...(s.id==='mage_04'?{skillId:s.id}:{}) });
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
	if (s.effect === "slow") return [effect("slow", s.duration || 0, skillValue(s, "slow", level) / 100)];
	if (s.effect === "stun")
		return [effect("stun", (s.duration || 1) * (isPlayer ? (s.pvpDurationMul ?? 1) : 1))];
	if (s.effect === "guard") return [effect("guard", s.duration || 10, skillValue(s, "guard", level))];
	if (s.effect === "rage")
		return [effect("rage", s.duration || 12, skillValue(s, "atkUp", level)), effect("speed", s.duration || 12, 0.1)];
	return [];
}
/** Walking/velocity use the strongest live Slow; timing and fixed landing positions are unchanged. */
export function slowMovementMultiplier(target:{statuses:TimedEffect[]}):number{
 return 1-Math.min(1,Math.max(0,...target.statuses.filter(s=>s.id==='slow'&&s.remaining>0).map(s=>s.value)));
}
/** A one-use preparation shortens only the next newly applied Slow; existing effects remain unchanged. */
export function applySlow(target: {statuses: TimedEffect[]}, sourceId: string, remaining: number, value: number) {
 const preparation=target.statuses.find(s=>s.id==='slow_resist'&&s.remaining>0);
 if(preparation&&remaining>0){remaining*=1-Math.max(0,Math.min(1,preparation.value));target.statuses=target.statuses.filter(s=>s!==preparation);}
 target.statuses.push({id:'slow',sourceId,remaining,value});
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
		target.statuses = target.statuses.filter((s) => s.id !== effect.id || (effect.id === "speed" && s.sourceId !== effect.sourceId));
		if(effect.id==='slow')applySlow(target,effect.sourceId,effect.remaining,effect.value);else target.statuses.push({ ...effect });
	}
}
export function tickEffects(target: { statuses: TimedEffect[] }, dt: number) {
	target.statuses = target.statuses
		.map((s) => ({ ...s, remaining: s.remaining - dt }))
		.filter((s) => s.remaining > 1e-8);
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
		if (!key.startsWith("passive:") && !["attack", "basic"].includes(key))
			cd[key] = Math.max(0, cd[key] - reduction);
}

export function normalizeJob(
	p: Partial<JobProgress> & { level: number; jobsVersion?: number },
): JobProgress {
	if (!p.jobId) return migrateJob(p.level);
	const out: JobProgress = {
		...normalizeMastery(p),
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
	if (p.jobId === "villager" || p.jobId === "needs_job") {
		return { ...newJob(), jobId: "needs_job", hotbar: defaultHotbar("needs_job") };
	}
	if ((p.jobsVersion ?? 0) < 3) {
		out.skillPoints += out.skills.fighter_basics || 0;
	}
	delete out.skills.punch;
	delete out.skills.fighter_basics;
	// Item slots ("item:<id>") survive saves; ones naming an item that is no longer a usable consumable are cleared.
	out.hotbar = out.hotbar.map(s => ({ ...s, skill: ["punch", "fighter_basics"].includes(s.skill || "") || (s.skill?.startsWith("item:") && !isHotbarItem(s.skill)) ? null : s.skill }));
	return out;
}
