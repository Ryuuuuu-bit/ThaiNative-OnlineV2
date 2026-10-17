import { setAuto } from "../src/game/sim.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
	loadGameData,
	newJob,
	migrateJob,
	learnSkill,
	skillLock,
	gainJobExp,
	changeJob,
	validateHotbar,
	resolveSkill,
	skillEffects,
	applyEffects,
	tickEffects,
	rhythmCooldowns,
	deriveStats,
	createGame,
	spawn,
	action,
	step,
	refreshStats,
} from "../src/index.node.js";
const data = loadGameData();
test("tier one and two grant one point per level including level one; Angel only offers tier two", () => {
 const p=newJob();assert.equal(p.jobId,"swordsman");assert.equal(p.skillPoints,1);
 assert.equal(gainJobExp(p,1e12,data),49);assert.equal(p.skillPoints,50);assert.equal(gainJobExp(p,1e12,data),0);
 assert.throws(()=>changeJob(p,"swordsman",data.jobs.angel.x,data.jobs.angel.z,data),/ยังไม่เปิด/);
 assert.throws(()=>changeJob(p,"guardian",data.jobs.angel.x,data.jobs.angel.z,data),/ยังไม่เปิด/);
 const two=structuredClone(data);two.jobs.jobs.find(j=>j.id==="guardian")!.available=true;
 assert.throws(()=>changeJob({...p,jobLevel:39},"guardian",data.jobs.angel.x,data.jobs.angel.z,two),/ไม่ถึง/);
 assert.throws(()=>changeJob(p,"guardian",10,10,two),/หอนาฬิกา/);
 const angel=two.jobs.angel;
 assert.equal(changeJob(p,"guardian",angel.x,angel.z+angel.range,two).jobLevel,1);
 assert.throws(()=>changeJob(p,"guardian",angel.x,angel.z+angel.range+.01,two),/หอนาฬิกา/);
 assert.equal(changeJob(p,"guardian",data.jobs.angel.x,data.jobs.angel.z,two).jobLevel,1);
 const tier2={...newJob(),jobId:"guardian"};gainJobExp(tier2,1e12,data);assert.equal(tier2.skillPoints,70);
});
test("per-level skill values, prerequisites, max level, job and point budgets", () => {
	assert.equal(resolveSkill(data, "slash", 1).percent, 180);
	assert.equal(resolveSkill(data, "slash", 10).percent, 360);
	assert.equal(resolveSkill(data, "whirlwind", 10).percent, 135);
	assert.equal(resolveSkill(data, "earth_break", 10).sp, 32);
	let p = migrateJob(1);
	assert.match(skillLock(p, "dash_strike", data)!, /ฟันเฉือน/);
	for (let i = 0; i < 3; i++) p = learnSkill(p, "slash", data);
	p = learnSkill(p, "dash_strike", data);
	assert.equal(p.skills.dash_strike, 1);
	assert.throws(
		() => learnSkill({ ...p, skillPoints: 0 }, "slash", data),
		/แต้ม/,
	);
	assert.throws(
		() =>
			learnSkill({ ...p, skills: { ...p.skills, slash: 10 } }, "slash", data),
		/สูงสุด/,
	);
	assert.throws(() => learnSkill(p, "meteor", data), /อาชีพ/);
});
test("legacy mapping preserves the two learned skills without mage meteor; hotbars validate and copy", () => {
	const p = migrateJob(3);
	assert.equal(p.skillPoints, 12);
	assert.equal(p.skills.whirlwind, 1);
	assert.equal(p.skills.earth_break, 1);
	assert.equal(p.skills.meteor, undefined);
	const slots = p.hotbar.map((s) => ({ ...s }));
	slots[0].key = "KeyQ";
	assert.equal(validateHotbar(p, slots, data)[0].key, "KeyQ");
	slots[1].key = "KeyQ";
	assert.throws(() => validateHotbar(p, slots, data), /ปุ่ม/);
	slots[1].key = "KeyW";
	assert.throws(() => validateHotbar(p, slots, data), /ปุ่ม/);
	slots[1].key = "Digit2";
	slots[2].skill = "endure";
	assert.throws(() => validateHotbar(p, slots, data), /เรียน/);
});
test("CC scales in PvP; Endure blocks knock-up but still accepts stun; statuses expire", () => {
	const dash = resolveSkill(data, "dash_strike"),
		earth = resolveSkill(data, "earth_break");
	assert.equal(skillEffects(dash, 1, "a", true)[0].remaining, 0.36);
	assert.equal(skillEffects(earth, 1, "a", true)[0].remaining, 0.48);
	assert.deepEqual(skillEffects(resolveSkill(data, "provoke"), 1, "a", true), [
		{ id: "slow", remaining: 3, value: 0.2, sourceId: "a" },
	]);
	const p = { statuses: skillEffects(resolveSkill(data, "endure"), 1, "a") };
	applyEffects(p, skillEffects(earth, 1, "b"));
	assert.equal(p.statuses.length, 1);
	applyEffects(p, skillEffects(dash, 1, "b"));
	assert.equal(p.statuses.length, 2);
	tickEffects(p, 9);
	assert.equal(p.statuses.length, 0);
});
test("passive sword, HP and regen bonuses compose; rhythm only reduces other running cooldowns", () => {
	const base = deriveStats(data.stats.defaultBuild, data),
		boost = deriveStats(
			{
				...data.stats.defaultBuild,
				skills: { sword_mastery: 5, iron_body: 3 },
			},
			data,
		);
	assert.equal(boost.atk, base.atk + 20);
	assert.ok(Math.abs(boost.maxHp - base.maxHp * 1.06) < 1e-8);
	assert.ok(boost.hpRegen > base.hpRegen * 1.15);
	const cd = { attack: 0.5, slash: 0.2, whirlwind: 3, earth_break: 0 };
	rhythmCooldowns(cd, 5);
	assert.deepEqual(cd, {
		attack: 0.5,
		slash: 0,
		whirlwind: 2.5,
		earth_break: 0,
	});
});
test("dash validates path and hits once, slam waits for cast, taunt overrides nearest target", () => {
	const g = createGame();
	g.enemies = [];
	g.random = () => 0.5;
	Object.assign(g.p, {
		x: 0,
		z: 4,
		fx: 1,
		fz: 0,
		skills: { ...g.p.skills, dash_strike: 1, provoke: 1, endure: 1 },
	});
	const e = spawn(g, 2, 4);
	e.hp = e.maxHp = 500;
	const p = g.p;
	const hp = e.hp;
	assert.ok(action(g, "dash_strike"));
	assert.ok(e.hp < hp);
	assert.ok(p.x <= 6.01);
	assert.ok(e.statuses.some((s) => s.id === "stun"));
	p.x = 16;
	p.z = 4;
	p.fx = 1;
	p.fz = 0;
	p.cd.dash_strike = 0;
	p.mp = 80;
	action(g, "dash_strike");
	assert.ok(p.x < 16.7);
	p.x = 0;
	p.z = 4;
	p.cd.earth_break = 0;
	p.mp = 80;
	e.x = 0;
	e.z = 5;
	const before = e.hp;
	action(g, "earth_break");
	assert.equal(e.hp, before);
	step(g, 0.2);
	assert.equal(e.hp, before);
	step(g, 0.21);
	assert.ok(e.hp < before);
	p.mp = 80;
	action(g, "provoke");
	assert.ok(e.statuses.some((s) => s.id === "def_down"));
	assert.ok(action(g, "endure"));
	assert.equal(p.statuses[0].id, "endure");
	step(g, 8.1);
	assert.equal(
		p.statuses.some((s) => s.id === "endure"),
		false,
	);
});
test("unlearned, passive, wrong job, SP and cooldown actions are rejected including aliases", () => {
	const g = createGame();
	assert.equal(action(g, "slash"), false);
	assert.equal(action(g, "meteor"), false);
	g.p.skills.sword_mastery = 1;
	assert.equal(action(g, "sword_mastery"), false);
	g.p.mp = 0;
	assert.equal(action(g, "whirlwind"), false);
	g.p.mp = 80;
	assert.equal(action(g, "whirlwind"), true);
	assert.equal(action(g, "spin"), false);
	assert.ok(action(g, "dash"));
	assert.equal(action(g, "dodge"), false);
});
test("third landed combo hit gains rhythm damage and reduces other cooldowns; air swings do not", () => {
	const run = (rank: number, air = false) => {
		const g = createGame();
		g.enemies = [];
		g.random = () => 0.5;
		g.p.x = 0;
		g.p.z = 4;
		g.p.skills.sword_rhythm = rank;
		g.p.combo = 1;
		g.p.comboWindow = 1;
		g.p.cd.whirlwind = 3;
		const e = spawn(g, air ? 8 : 0, 5);
		e.hp = e.maxHp = 500;
		action(g, "attack");
		return { damage: 500 - e.hp, cd: g.p.cd.whirlwind };
	};
	const base = run(0),
		boost = run(5);
	assert.ok(boost.damage > base.damage);
	assert.equal(boost.cd, 2.5);
	assert.equal(run(5, true).cd, 3);
});
test("taunt makes a farther player override the nearest player until expiry", async () => {
	const { addPlayer } = await import("../src/game/sim.js");
	const g = createGame();
	g.enemies = [];
	g.p.x = 0;
	g.p.z = 0;
	g.p.skills.provoke = 1;
	const other = addPlayer(g, "other");
	other.x = 0.2;
	other.z = 5;
	const e = spawn(g, 0, 5);
	e.cooldown = 0;
	action(g, "provoke");
	step(g, 0.05);
	assert.equal(e.motion, "hop");
	assert.ok(e.z < 5);
	for (const status of e.statuses) status.remaining = 0.01;
	step(g, 0.05);
	assert.equal(e.motion, "attack");
	assert.ok(e.aimZ > 4);
});

test("creation starts with swordsman slots and obsolete skills are absent", () => {
 const p=newJob();assert.equal(p.jobLevel,1);assert.equal(p.skillPoints,1);
 assert.deepEqual(p.hotbar.slice(0,6).map(s=>s.skill),["slash","whirlwind","dash_strike","earth_break","endure","provoke"]);
 assert.deepEqual(p.skills,{basic:1,dodge:1,potion:1});
 for(const id of ["punch","fighter_basics"]){assert.ok(!data.skills.skills.some(s=>s.id===id));assert.throws(()=>resolveSkill(data,id));}
 assert.ok(!data.jobs.jobs.some(j=>j.id==="villager"));
 assert.equal(data.jobs.jobs.filter(j=>j.tier===1).length,7);
 assert.throws(()=>newJob("mage"));assert.throws(()=>newJob("villager"));
});
test("followup migration grants once, preserves learned skills and custom bar, replaces only old defaults", async () => {
	const { normalizeJob, oldDefaultHotbars } = await import("../src/jobs.js");
	const old = {
		level: 1,
		jobsVersion: 0,
		jobId: "swordsman",
		jobLevel: 1,
		jobExp: 0,
		skillPoints: 9,
		skills: { basic: 1, dodge: 1, potion: 1, whirlwind: 1, earth_break: 1 },
		hotbar: oldDefaultHotbars()[1],
	};
	const next = normalizeJob(old);
	assert.equal(next.skillPoints, 10);
	assert.equal(next.skills.fighter_basics, undefined);
	assert.equal(next.hotbar[0].key, "Digit1");
	const custom = structuredClone(old);
	custom.hotbar[0].key = "KeyB";
	assert.equal(normalizeJob(custom).hotbar[0].key, "KeyB");
	assert.deepEqual(normalizeJob({ ...next, level: 1, jobsVersion: 3 }), next);
	assert.equal(migrateJob(99).skillPoints, 50);
	const tier1 = { ...newJob(), jobId: "swordsman", skillPoints: 1 };
	gainJobExp(tier1, 1e12, data);
	assert.equal(tier1.jobLevel, 50);
	assert.equal(tier1.skillPoints, 50);
	const tier2 = { ...newJob(), jobId: "guardian", skillPoints: 1 };
	gainJobExp(tier2, 1e12, data);
	assert.equal(tier2.jobLevel, 70);
	assert.equal(tier2.skillPoints, 70);
});

test("PvP slow affects authoritative movement and expires; 20Hz slam resolves in exactly eight ticks", () => {
	const g = createGame();
	g.enemies = [];
	g.p.x = 0;
	g.p.z = 4;
	g.p.statuses = skillEffects(resolveSkill(data, "provoke"), 1, "other", true);
	step(g, 0.1, { x: 1, z: 0 });
	assert.ok(Math.abs(g.p.x - 0.36) < 1e-8);
	step(g, 3);
	assert.equal(g.p.statuses.length, 0);
	g.p.x = 0;
	g.p.z = 4;
	g.random = () => 0.5;
	const e = spawn(g, 0, 5);
	e.hp = e.maxHp = 500;
	e.cooldown = 100;
	action(g, "earth_break");
	for (let i = 0; i < 7; i++) step(g, 0.05);
	assert.equal(e.hp, 500);
	step(g, 0.05);
	assert.ok(e.hp < 500);
});

test("normal AUTO swordsman progression reaches Job10 near fifteen minutes with slash upgrades", () => {
	const g = createGame(
		1,
		{ ...data.stats.defaultBuild, classId: "swordsman" },
		"curve",
		data,
	);
	Object.assign(g.p, learnSkill(g.p, "slash", data));
	setAuto(g, true);
	for (let n = 0; n < 24000 && g.p.jobLevel < 10; n++) {
		step(g, 0.05);
		g.events.length = 0;
		while (g.p.skillPoints > 0 && (g.p.skills.slash || 0) < 10)
			Object.assign(g.p, learnSkill(g.p, "slash", data));
	}
	assert.equal(g.p.jobLevel, 10);
	assert.ok(g.time >= 720 && g.time <= 1080, `Job10 at ${g.time}s`);
	assert.equal(g.p.skills.slash, 10);
});

test("Whirlwind reserves the original total, rounds halves, and keeps delayed hits owned by the caster", () => {
 const g=createGame();g.enemies=[];g.p.x=0;g.p.z=4;g.p.mp=80;g.random=()=>.5;
 const e=spawn(g,0,5);e.hp=e.maxHp=1000;
 assert.ok(action(g,'whirlwind'));const first=1000-e.hp,queued=g.p.whirlwindHits![0];
 assert.equal(queued.due,.25);assert.ok(Math.abs(first-queued.damage)<=1);
 step(g,.24);assert.equal(1000-e.hp,first);step(g,.01);assert.equal(1000-e.hp,first+queued.damage);assert.equal(g.p.whirlwindHits!.length,0);
 g.p.cd.whirlwind=0;g.p.mp=80;action(g,'whirlwind');const before=e.hp;g.p.dead=true;step(g,.3);assert.equal(e.hp,before);
});
