import test from "node:test";
import assert from "node:assert/strict";
import {
	loadGameData,
	newJob,
	gainJobExp,
	changeJob,
	learnSkill,
	skillLock,
	validateHotbar,
	deriveStats,
	createGame,
	spawn,
	action,
	step,
	refreshStats,
} from "../src/index.node.js";
const data = loadGameData();
const angel = data.jobs.angel;
function swordsmanAt40() {
	const p = newJob();
	gainJobExp(p, 1e12, data);
	return p;
}
/** A game whose hero has already become `jobId` with the given skills learned. */
function job2Game(jobId: "guardian" | "berserker", skills: Record<string, number>) {
	const g = createGame();
	g.enemies = [];
	g.random = () => 0.5;
	Object.assign(g.p, { jobId, x: 0, z: 4, fx: 1, fz: 0, skills: { ...g.p.skills, ...skills } });
	g.p.profile.classId = jobId;
	refreshStats(g, g.p);
	g.p.mp = g.p.maxMp;
	return g;
}

test("swordsman Job 40 becomes Guardian or Berserker at the angel, keeping skills and the bar", () => {
	const sword = swordsmanAt40();
	sword.skills.slash = 5;
	sword.hotbar[3] = { ...sword.hotbar[3], skill: "slash" };
	for (const id of ["guardian", "berserker"]) {
		const next = changeJob(sword, id, angel.x, angel.z, data);
		assert.equal(next.jobId, id);
		assert.equal(next.jobLevel, 1);
		assert.equal(next.skills.slash, 5, "first-job skills stay learned");
		assert.deepEqual(next.hotbar, sword.hotbar, "the player's own bar is kept");
		assert.equal(next.skillPoints, sword.skillPoints + 1);
		// Stats derive for the new class (the server sets profile.classId to the job).
		const stats = deriveStats({ ...data.stats.defaultBuild, classId: id }, data);
		assert.ok(stats.maxHp > 0);
	}
	assert.throws(() => changeJob({ ...sword, jobLevel: 39 }, "guardian", angel.x, angel.z, data), /ไม่ถึง/);
	const guardian = changeJob(sword, "guardian", angel.x, angel.z, data);
	assert.throws(() => changeJob({ ...guardian, jobLevel: 70 }, "berserker", angel.x, angel.z, data), /ยังไม่เปิด/);
});

test("Job 2 skills need the branch, prerequisites, and can still level first-job skills", () => {
	const sword = swordsmanAt40();
	assert.match(skillLock(sword, "shield_bash", data)!, /อาชีพ/);
	let guardian = changeJob(sword, "guardian", angel.x, angel.z, data);
	assert.match(skillLock(guardian, "frenzy_slash", data)!, /อาชีพ/, "Guardian cannot learn Berserker skills");
	assert.match(skillLock(guardian, "quake_slam", data)!, /กระแทกโล่/);
	for (let i = 0; i < 3; i++) guardian = learnSkill(guardian, "shield_bash", data);
	guardian = learnSkill(guardian, "quake_slam", data);
	guardian = learnSkill(guardian, "whirlwind", data);
	assert.equal(guardian.skills.quake_slam, 1);
	assert.ok(guardian.skills.whirlwind >= 1);
	const slots = guardian.hotbar.map((s, i) => ({ ...s, skill: i === 0 ? "shield_bash" : i === 1 ? "whirlwind" : s.skill }));
	assert.equal(validateHotbar(guardian, slots, data)[0].skill, "shield_bash");
	assert.throws(() => validateHotbar(guardian, slots.map((s, i) => (i === 2 ? { ...s, skill: "retribution" } : s)), data), /เรียน/);
	assert.equal(
		Object.values(data.skills.skills).filter((s) => s.jobId === "guardian" || s.jobId === "berserker").every((s) => !s.visual || data.skills.skills.some((o) => o.id === s.visual && o.jobId === "swordsman")),
		true,
		"every borrowed look is a swordsman skill",
	);
});

test("Guardian: shield bash stuns, bulwark cuts damage taken, retribution reflects, passive raises defence", () => {
	const g = job2Game("guardian", { shield_bash: 1, bulwark: 5, retribution: 5, guardian_spirit: 10 });
	const plain = deriveStats({ ...data.stats.defaultBuild, classId: "guardian" }, data);
	assert.ok(g.p.stats.hardDef > plain.hardDef, "guardian spirit raises hard DEF");
	const e = spawn(g, 1.2, 4);
	e.hp = e.maxHp = 5000;
	assert.ok(action(g, "shield_bash"));
	assert.ok(e.hp < 5000);
	assert.ok(e.statuses.some((s) => s.id === "stun" && s.remaining > 1));
	assert.ok(action(g, "bulwark"));
	assert.ok(g.p.statuses.some((s) => s.id === "guard" && Math.abs(s.value - 0.3) < 1e-9));
	// Let the monster fight back: guarded hits land, and retribution sends 15% of each back.
	e.statuses = [];
	g.p.statuses = g.p.statuses.filter((s) => s.id === "guard");
	g.events.length = 0;
	for (let i = 0; i < 120 && !g.events.some((ev: any) => ev.type === "hurt"); i++) step(g, 0.05);
	const hurt = g.events.find((ev: any) => ev.type === "hurt") as any;
	assert.ok(hurt, "the monster hit back");
	const reflected = g.events.find((ev: any) => ev.type === "hit" && ev.reflect) as any;
	assert.ok(reflected, "retribution reflected the hit");
	assert.equal(reflected.damage, Math.max(1, Math.round(hurt.amount * 0.15)));
});

test("Berserker: frenzy hits three times, blood rage costs HP and raises ATK until it ends, bloodlust heals", () => {
	const g = job2Game("berserker", { frenzy_slash: 1, blood_rage: 5, bloodlust: 5, berserk_soul: 10 });
	const plain = deriveStats({ ...data.stats.defaultBuild, classId: "berserker" }, data);
	assert.ok(g.p.stats.atk > plain.atk, "berserk soul raises ATK");
	const e = spawn(g, 1.2, 4);
	e.hp = e.maxHp = 50000;
	const hits: number[] = [];
	g.p.hp = Math.round(g.p.maxHp * 0.5);
	const hpBefore = g.p.hp;
	assert.ok(action(g, "frenzy_slash"));
	for (const ev of g.events) if ((ev as any).type === "hit" && (ev as any).skillId === "frenzy_slash") hits.push((ev as any).damage);
	assert.equal(hits.length, 3);
	assert.ok(g.events.some((ev: any) => ev.type === "hit" && ev.visual === "slash"), "hits carry the borrowed look");
	assert.ok(g.p.hp > hpBefore, "bloodlust heals from damage dealt");
	const atk = g.p.stats.atk;
	g.p.hp = g.p.maxHp;
	assert.ok(action(g, "blood_rage"));
	assert.equal(g.p.hp, g.p.maxHp - Math.round(g.p.maxHp * 0.08));
	assert.ok(Math.abs(g.p.stats.atk - atk * 1.3) < 1e-6);
	assert.ok(g.p.statuses.some((s) => s.id === "speed"));
	step(g, 12.1);
	assert.ok(!g.p.statuses.some((s) => s.id === "rage"));
	assert.ok(Math.abs(g.p.stats.atk - atk) < 1e-6, "ATK returns when rage ends");
});

test("AUTO uses the branch skills in a fight", () => {
	const g = job2Game("berserker", { frenzy_slash: 1, blade_cyclone: 1, blood_rage: 1 });
	for (const [x, z] of [[1, 4], [1.2, 4.6], [0.8, 3.4]]) {
		const e = spawn(g, x, z);
		e.hp = e.maxHp = 50000;
	}
	g.p.auto = true;
	for (let i = 0; i < 40; i++) step(g, 0.05);
	const used = new Set(g.events.filter((e: any) => e.type === "skill").map((e: any) => e.skillId));
	assert.ok(used.has("frenzy_slash"), [...used].join());
	assert.ok(used.has("blade_cyclone"), [...used].join());
	assert.ok(used.has("blood_rage"), [...used].join());
});
