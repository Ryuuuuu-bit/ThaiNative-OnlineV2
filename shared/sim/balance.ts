import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
	loadGameData,
	deriveStats,
	monsterStats,
	buildForLevel,
	computeDamage,
	seededRng,
	type Combatant,
	type GameData,
	type Skill,
} from "../src/index.node.js";
export interface Options {
	levels: number[];
	classes: string[];
	monster: string;
	runs: number;
	seed: number;
	pvp: boolean;
}
export const MODEL = {
	stepSeconds: 0.05,
	maxSeconds: 600,
	walkSeconds: 2,
	bossUptime: 0.35,
	bossWindowSeconds: 4,
	bossIncomingInterval: 2,
	smallIncomingInterval: 1.5,
	consumables: false,
	notes:
		"TTK is offensive kill time, including lost races (not censored). Win rate races HP concurrently; no potions, camp, movement, summons or scripted stun. Boss damage uptime 35% in 4s windows models telegraph/reposition time; enemy attacks still occur every 2s. SP regen uses shared per-second values; HP in-combat regen is 20% of its per-second value. Training weapon copies for stub classes retain +5 ATK, 0 MATK, .44s interval. PvP starts at full HP/SP, no tactical downtime; simultaneous kills split win credit 50/50.",
};
export function parseOptions(args: string[]): Options {
	const o: Options = {
		levels: [1, 10, 30, 50, 99],
		classes: ["novice_knight", "archer", "mage"],
		monster: "all",
		runs: 1000,
		seed: 1,
		pvp: false,
	};
	for (let i = 0; i < args.length; i++) {
		const flag = args[i];
		if (flag === "--pvp") {
			o.pvp = true;
			continue;
		}
		if (!["--level", "--class", "--monster", "--runs", "--seed"].includes(flag))
			throw new Error(`Unknown option ${flag}`);
		const value = args[++i];
		if (!value || value.startsWith("--"))
			throw new Error(`Missing value for ${flag}`);
		if (flag === "--level") o.levels = value.split(",").map(Number);
		if (flag === "--class") o.classes = value.split(",");
		if (flag === "--monster") o.monster = value;
		if (flag === "--runs") o.runs = Number(value);
		if (flag === "--seed") o.seed = Number(value);
	}
	if (
		!o.levels.length ||
		o.levels.some((l) => !Number.isInteger(l) || l < 1 || l > 99)
	)
		throw new Error("--level must be integers 1–99");
	if (!Number.isInteger(o.runs) || o.runs < 1 || o.runs > 100000)
		throw new Error("--runs must be 1–100000");
	if (!Number.isInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff)
		throw new Error("--seed must be a uint32");
	return o;
}
export function simulatorPlayer(
	classId: string,
	level: number,
	data: GameData,
) {
	const build = buildForLevel(classId, level, data),
		job = data.classes.classes.find((c) => c.id === classId)!;
	if (
		!build.equipment.some(
			(id) => data.items.items.find((i) => i.id === id)?.type === "weapon",
		)
	) {
		const training = data.items.items.find((i) => i.id === "training_sword")!;
		const local = {
			...data,
			items: {
				...data.items,
				items: [
					...data.items.items,
					{ ...training, id: "sim_training", weaponType: job.weapons[0] },
				],
			},
		};
		return deriveStats(
			{ ...build, equipment: [...build.equipment, "sim_training"] },
			local,
		);
	}
	return deriveStats(build, data);
}
function rankedSkills(
	a: Combatant,
	d: Combatant,
	data: GameData,
	mode?: "duel" | "gvg",
) {
	return data.skills.skills
		.filter((s) => s.type !== "heal" && s.kind !== "utility")
		.map((skill) => ({
			skill,
			score: computeDamage(
				{ ...a, crit: 0 },
				d,
				skill,
				{ rng: () => 0.5, mode },
				data,
			).damage,
		}))
		.sort((a, b) => b.score - a.score);
}
/** One actor's offensive timeline. Damage-taking is recorded concurrently, so losing trials
 * still have a finite potential TTK without silently dropping losses from percentiles. */
export function trial(
	a: Combatant,
	d: Combatant,
	data: GameData,
	rng: () => number,
	mode?: "duel" | "gvg",
	bossUptime = MODEL.bossUptime,
) {
	const ranked = rankedSkills(a, d, data, mode),
		incoming = rankedSkills(d, a, data, mode),
		basic = data.skills.skills.find((s) => s.id === "basic")!;
	const available = new Map<string, number>(),
		incomingCd = new Map<string, number>();
	let hp = d.maxHp,
		ownHp = a.maxHp,
		sp = a.maxSp,
		enemySp = d.maxSp,
		combo = 0,
		enemyCombo = 0,
		next = 0,
		enemyNext = 0,
		won = true,
		landed = 0,
		lastCombat=-Infinity,
		hitsToDie: number | undefined;
	let pending: { at: number; skill: Skill; third: boolean } | undefined;
	let enemyPending: { at: number; skill: Skill; third: boolean } | undefined;
	const dt = MODEL.stepSeconds;
	for (let t = 0; t <= MODEL.maxSeconds; t += dt) {
		sp = Math.min(a.maxSp, sp + a.spRegen * dt);
		enemySp = Math.min(d.maxSp, enemySp + d.spRegen * dt);
		const hpMultiplier=t-lastCombat>=data.stats.regen.outOfCombatSeconds?1:data.stats.regen.inCombatHpMultiplier;
		hp = Math.min(d.maxHp, hp + d.hpRegen * hpMultiplier * dt);
		if (won) ownHp = Math.min(a.maxHp, ownHp + a.hpRegen * hpMultiplier * dt);
		if (pending && t >= pending.at) {
			const impact = computeDamage(
				a,
				d,
				pending.skill,
				{ rng, mode, comboThird: pending.third },
				data,
			).damage;hp-=impact;if(impact>0)lastCombat=t;
			pending = undefined;
		}
		const aliveBeforeImpact = won;
		if (enemyPending && t >= enemyPending.at) {
			const hit = computeDamage(
				d,
				a,
				enemyPending.skill,
				{ rng, mode, comboThird: enemyPending.third },
				data,
			);
			ownHp -= hit.damage;
			if(hit.damage>0)lastCombat=t;
			if (hit.hit) landed++;
			enemyPending = undefined;
		}
		if (ownHp <= 0 && won) {
			won = false;
			hitsToDie = landed;
		}
		if (hp <= 0)
			return {
				ttk: Number(t.toFixed(3)),
				won,
				draw: aliveBeforeImpact && ownHp <= 0,
				hitsToDie: hitsToDie ?? landed,
				censored: false,
			};
		const window =
			!d.boss ||
			t % MODEL.bossWindowSeconds < MODEL.bossWindowSeconds * bossUptime;
		if (!pending && t >= next && window) {
			const skill = ranked.find(
				(s) => s.skill.sp <= sp && (available.get(s.skill.id) || 0) <= t,
			)?.skill;
			if (skill) {
				sp -= skill.sp;
				available.set(skill.id, t + skill.cooldown);
				const third = skill.id === "basic" && ++combo % 3 === 0;
				const cast = skill.cast * a.castMul;
				pending = { at: t + cast, skill, third };
				next = t + cast + 1 / a.aspd;
			}
		}
		if (t >= enemyNext && !enemyPending) {
			const skill = d.isPlayer
				? incoming.find(
						(s) =>
							s.skill.sp <= enemySp && (incomingCd.get(s.skill.id) || 0) <= t,
					)?.skill
				: basic;
			if (skill) {
				enemySp -= skill.sp;
				incomingCd.set(skill.id, t + skill.cooldown);
				const third =
					d.isPlayer && skill.id === "basic" && ++enemyCombo % 3 === 0;
				const cast = skill.cast * d.castMul;
				enemyPending = { at: t + cast, skill, third };
				enemyNext = t + cast + 1 / d.aspd;
			}
		}
	}
	return {
		ttk: MODEL.maxSeconds,
		won: false,
		draw: false,
		hitsToDie: hitsToDie ?? landed,
		censored: true,
	};
}
function summary(values: number[]) {
	const sorted = [...values].sort((a, b) => a - b);
	return {
		mean: values.reduce((a, b) => a + b, 0) / values.length,
		p10: sorted[Math.floor((sorted.length - 1) * 0.1)],
		p90: sorted[Math.floor((sorted.length - 1) * 0.9)],
	};
}
function landedHitBudget(
	attacker: Combatant,
	defender: Combatant,
	skill: Skill,
	data: GameData,
	rng: () => number,
	mode?: "duel" | "gvg",
) {
	let hp = defender.maxHp,
		hits = 0;
	while (hp > 0 && hits < 100000) {
		// Count landed hits rather than attack attempts: force only the physical hit roll,
		// retaining the seeded crit and variance rolls. No regen in this isolated budget.
		let first = true;
		const hitRng = () => {
			if (first) {
				first = false;
				return 0;
			}
			return rng();
		};
		hp -= computeDamage(
			attacker,
			defender,
			skill,
			{ rng: hitRng, mode },
			data,
		).damage;
		hits++;
	}
	return hits;
}
export function runBalance(options: Options, data: GameData) {
	for (const id of options.classes)
		if (!data.classes.classes.some((c) => c.id === id))
			throw new Error(`Unknown class ${id}`);
	const monsters = data.monsters.monsters.filter(
		(m) => options.monster === "all" || m.id === options.monster,
	);
	if (!options.pvp && !monsters.length)
		throw new Error(`Unknown monster ${options.monster}`);
	const rows = [];
	let sequence = 0;
	for (const level of options.levels)
		for (const classId of options.classes) {
			const a = simulatorPlayer(classId, level, data);
			const opponents = options.pvp
				? options.classes.flatMap((id) =>
						(["duel", "gvg"] as const).map((mode) => ({
							id,
							stats: simulatorPlayer(id, level, data),
							mode,
							exp: 0,
						})),
					)
				: monsters.map((m) => ({
						id: m.id,
						stats: monsterStats(m, data),
						mode: undefined,
						exp: m.exp,
					}));
			for (const opponent of opponents) {
				const seed = (options.seed + Math.imul(++sequence, 0x9e3779b1)) >>> 0,
					rng = seededRng(seed),
					trials = Array.from({ length: options.runs }, () =>
						trial(a, opponent.stats, data, rng, opponent.mode),
					);
				const ttk = summary(trials.map((t) => t.ttk)),
					drawRate = trials.filter((t) => t.draw).length / options.runs,
					winRate =
						trials.filter((t) => t.won).length / options.runs + drawRate * 0.5;
				// Lethal landed-hit budget has no regen and is also defined for winning trials.
				const incoming = data.skills.skills.find((s) => s.id === "basic")!;
				const hits = summary(
					Array.from({ length: options.runs }, () =>
						landedHitBudget(
							opponent.stats,
							a,
							incoming,
							data,
							rng,
							opponent.mode,
						),
					),
				);
				const flags = [];
				if (options.pvp && (ttk.mean < 4 || ttk.mean > 20))
					flags.push("PvP TTK outside 4–20s");
				if (
					!options.pvp &&
					!opponent.stats.boss &&
					(ttk.mean < 1 || ttk.mean > 60)
				)
					flags.push("normal TTK outside 1–60s");
				if (level === opponent.stats.level && hits.mean < 3)
					flags.push("equal-level survival below 3 landed hits");
				rows.push({
					classId,
					level,
					opponent: opponent.id,
					opponentLevel: opponent.stats.level,
					mode: opponent.mode ?? "pve",
					seed,
					runs: options.runs,
					ttk,
					hitsToDie: hits,
					expPerMinute:
						(opponent.exp * (1 + a.expBonus) * winRate * 60) /
						(ttk.mean + MODEL.walkSeconds),
					winRate,
					drawRate,
					censored: trials.filter((t) => t.censored).length,
					flags,
				});
			}
		}
	return { dataVersion: 1, options, model: MODEL, rows };
}
export function markdown(report: ReturnType<typeof runBalance>) {
	return (
		`# Stats balance — ${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" })}\n\nSeed ${report.options.seed}; ${report.options.runs} runs/row. Flags are shown in red in HTML-capable Markdown.\n\n${MODEL.notes}\n\n| Class | Lv | Opponent | Mode | TTK mean/p10/p90 s | Hits mean/p10/p90 | EXP/min | Win | Flags |\n|---|---:|---|---|---:|---:|---:|---:|---|\n` +
		report.rows
			.map(
				(r) =>
					`| ${r.classId} | ${r.level} | ${r.opponent} | ${r.mode} | ${r.ttk.mean.toFixed(2)}/${r.ttk.p10.toFixed(2)}/${r.ttk.p90.toFixed(2)} | ${r.hitsToDie.mean.toFixed(1)}/${r.hitsToDie.p10}/${r.hitsToDie.p90} | ${r.expPerMinute.toFixed(1)} | ${(100 * r.winRate).toFixed(0)}% | ${r.flags.length ? `<span style="color:#c33">🔴 ${r.flags.join("; ")}</span>` : "—"} |`,
			)
			.join("\n") +
		"\n"
	);
}
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	try {
		const options = parseOptions(process.argv.slice(2)),
			report = runBalance(options, loadGameData());
		console.log(
			"CLASS          LV OPPONENT       MODE  TTK mean/p10/p90     HITS mean/p10/p90   EXP/min WIN  FLAGS",
		);
		for (const r of report.rows) {
			const line = [
				r.classId.padEnd(14),
				String(r.level).padStart(2),
				r.opponent.padEnd(14),
				r.mode.padEnd(5),
				`${r.ttk.mean.toFixed(2)}/${r.ttk.p10.toFixed(2)}/${r.ttk.p90.toFixed(2)}`.padEnd(
					20,
				),
				`${r.hitsToDie.mean.toFixed(1)}/${r.hitsToDie.p10}/${r.hitsToDie.p90}`.padEnd(
					18,
				),
				r.expPerMinute.toFixed(1).padStart(7),
				`${(r.winRate * 100).toFixed(0)}%`.padStart(4),
				r.flags.join("; "),
			].join(" ");
			console.log(r.flags.length ? `\x1b[31m${line}\x1b[0m` : line);
		}
		const out = new URL("../../sim/out/", import.meta.url);
		mkdirSync(out, { recursive: true });
		const date = new Intl.DateTimeFormat("en-CA", {
				timeZone: "Asia/Bangkok",
			}).format(new Date()),
			name = `balance-${date}${options.pvp ? "-pvp" : ""}`;
		writeFileSync(
			new URL(`${name}.json`, out),
			JSON.stringify(report, null, 2) + "\n",
		);
		writeFileSync(new URL(`${name}.md`, out), markdown(report));
		console.log(`Saved shared/sim/out/${name}.{json,md}`);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	}
}
