import {applyInventory,starterInventory,inventoryWeight,redPotion,equipped,rollDrops,type Inventory,type InventoryOp} from "../inventory.js";
import {
	migrateJob,
	newJob,
	resolveSkill,
	skillId,
	skillValue,
	belongsToJob,
	gainJobExp,
	skillEffects,
	applyEffects,
	tickEffects,
	rhythmCooldowns,
	type JobProgress,
	type TimedEffect,
} from "../jobs.js";
import { loadGameData } from "../load.js";
import { deriveStats, monsterStats, type Combatant } from "../derive.js";
import { computeDamage } from "../damage.js";
import { autoAllocateStats } from "../allocation.js";
import type { GameData, CharacterInput, Skill } from "../schema.js";
import { CITY_SPAWN, HEALER, type MapId } from "./maps.js";
const DEFAULT_DATA = loadGameData();
import { MONSTER_MOTIONS } from "./monster-motion-data.js";
export type Action = string;
export type SlimeVariant = "pink" | "mint" | "sky";
export type KingAttack = "slam" | "sweep" | "charge" | "spit" | "summon";
export type MonsterMotion =
	| keyof typeof MONSTER_MOTIONS.slime
	| keyof typeof MONSTER_MOTIONS.king;
export interface Vec {
	x: number;
	z: number;
}
export interface Enemy extends Vec {
	mapId?: MapId;
	statuses: TimedEffect[];
	dataId: string;
	damageBy: Record<string, number>;
 lastEngagedAt?:number;
	id: number;
	hp: number;
	maxHp: number;
	boss: boolean;
	dead: boolean;
	respawn: number;
	homeX: number;
	homeZ: number;
	aggro: number;
	cooldown: number;
	windup: number;
	aimX: number;
	aimZ: number;
	hurt: number;
	phase: number;
	wander: number;
	wx: number;
	wz: number;
	motion: MonsterMotion;
	motionTime: number;
	motionDuration: number;
	bossPhase: 1 | 2;
	variant: SlimeVariant;
	deathAge: number;
	rewarded: boolean;
	attackApplied: boolean;
	patternIndex: number;
	history: KingAttack[];
	engaged: boolean;
		summoned: boolean;
	/** Data-driven AI tuning (jellies use built-in defaults). */
	behavior?: import('../schema.js').GameData['monsters']['monsters'][number]['behavior'];
	startX: number;
	startZ: number;
	fx: number;
	fz: number;
	vx: number;
	vz: number;
	moving: boolean;
}
export type AutoState = "seek" | "fight" | "retreat" | "idle";
export interface Player extends Vec, JobProgress {
 /** ตั้งค่า AUTO for this account (server-side; never sent in snapshots). */
 autoCfg?: AutoSettings; autoNext?: string | null;
   bossReadyAt?:number; reviveRemaining?:number;
 /** Field-boss cooldowns other than the King (which keeps bossReadyAt). */
 bossCooldowns?: Record<string, number>;
 quests?: import('../quests.js').QuestState;
 whirlwindHits?:{id:number;due:number;damage:number;crit:boolean;breakdown:any;impact?:number}[];
 inventory?:Inventory; autoSeconds:number;
 mapId: MapId;
 healerReadyAt: number;
 returnReadyAt?:number; returnRemaining?:number;
 audioSettings?: import('../audio-settings.js').AudioSettings;
	statuses: TimedEffect[];
	castRemaining: number;
	jobsVersion: number;
	id: string;
	name: string;
	stats: Combatant;
	profile: CharacterInput;
	kills: number;
	statPoints: number;
	autoAllocate: boolean;
	autoAllocCursor: number;
	lastCombat: number;
	target: number | null;
	destination: Vec | null;
	autoTimer: number;
	autoPath: Vec[];
	autoGoal: Vec | null;
	autoCharge: number;
	auto: boolean;
	autoState: AutoState;
	hp: number;
	maxHp: number;
	mp: number;
	maxMp: number;
	level: number;
	xp: number;
	nextXp: number;
	gold: number;
	potions: number;
	dead: boolean;
	fx: number;
	fz: number;
	moving: boolean;
	attack: number;
	attackKind: string;
	combo: number;
	comboWindow: number;
	dash: number;
	invulnerable: number;
	hurt: number;
	cd: Record<Action, number>;
}
export interface Event extends Vec {
	type: string;
	[key: string]: any;
}
export interface Drop extends Vec {
 loot?:{template:string;qty:number}[]; pending?:boolean; noticeAt?:number; blocked?:boolean; boss?:boolean; bossId?:string;
	ownerId: string;
	id: number;
	gold: number;
	xp: number;
	jobExp?: number;
	time: number;
}
export interface Projectile extends Vec {
	attack?: string;
	id: number;
	owner: number;
	vx: number;
	vz: number;
	life: number;
	damage: number;
	phase: 1 | 2;
}
export { CAMP, ARENA, OBSTACLES, water, walkable } from "./collision.js";
import { CAMP, ARENA, walkable, moveSliding as move } from "./collision.js";
import { MEADOW_SPAWNS, FOREST_SPAWNS, FIELD_BOSS, isField, nearestCamp, FOREST_ENTRY } from "./maps.js";
/** The map of the game currently being stepped (the sim is synchronous, so one at a time). */
let activeMap: MapId = "meadow";
const walk = (x: number, z: number, r = 0.3) => walkable(x, z, r, activeMap);
const campFor = (m: MapId, p: Vec) => nearestCamp(m, p.x, p.z) ?? CAMP;
/** Cooldown until this player can fight / loot a field boss again. */
export function bossReadyAt(p: Pick<Player, "bossReadyAt" | "bossCooldowns">, dataId: string) {
	return dataId === "king_jelly" ? p.bossReadyAt ?? 0 : p.bossCooldowns?.[dataId] ?? 0;
}
export function setBossCooldown(p: Pick<Player, "bossReadyAt" | "bossCooldowns">, dataId: string, until: number) {
	if (dataId === "king_jelly") p.bossReadyAt = until;
	else (p.bossCooldowns ??= {})[dataId] = until;
}
export { CD } from "./constants.js";
import { CD, ACTION_SKILLS } from "./constants.js";
import { AUTO_RANGES, DEFAULT_AUTO, autoCastOrder, autoSkillSequence, isSurvivalSkill, wantedMonsters, type AutoSettings } from "../auto-settings.js";
export const KING_PATTERN: KingAttack[] = [
	"slam",
	"sweep",
	"charge",
	"spit",
	"summon",
];
export function createGame(
	seed = 123,
	profile: CharacterInput = DEFAULT_DATA.stats.defaultBuild,
	id = "local",
	data: GameData = DEFAULT_DATA,
 mapId: MapId = "meadow",
) {
	let n = seed;
	const random = () => {
		n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
		return n / 4294967296;
	};
	const stats = deriveStats(profile, data);
	const job =
		profile.classId === "swordsman" ? newJob() : migrateJob(profile.level);
	let p: Player = {
		...job,
 mapId, healerReadyAt: 0, autoSeconds:0,
		statuses: [],
		castRemaining: 0,
		jobsVersion: 3,
		id,
		name: "Aerin",
		stats,
		profile: structuredClone(profile),
		kills: 0,
		statPoints: 0,
		autoAllocate: true,
		autoAllocCursor: 0,
		lastCombat: -Infinity,
		target: null,
		destination: null,
		autoTimer: 0,
		autoPath: [],
		autoGoal: null,
		autoCharge: -1,
		auto: false,
		autoState: "idle",
		x: -1,
		z: 6,
		hp: 120,
		maxHp: 120,
		mp: 80,
		maxMp: 80,
		level: 1,
		xp: 0,
		nextXp: 60,
		gold: 0,
		potions: 5,
		dead: false,
		fx: 0,
		fz: -1,
		moving: false,
		attack: 0,
		attackKind: "",
		combo: 0,
		comboWindow: 0,
		dash: 0,
		invulnerable: 0,
		hurt: 0,
		cd: { attack: 0, spin: 0, meteor: 0, dash: 0, potion: 0 },
	};
	p.profile.skills = { ...p.skills };
	p.stats = deriveStats(p.profile, data);
	p.hp = p.maxHp = p.stats.maxHp;
	p.mp = p.maxMp = p.stats.maxSp;
	p.level = profile.level;
	p.nextXp = data.stats.expToNext[p.level - 1];
	const g = {
		data, mapId,
  inventoryCommit: undefined as undefined | ((p:Player,op:InventoryOp,done:()=>void)=>void),
 /** Party lookup for EXP sharing; returns the player's party member ids (including the player). */
 partyMembers: undefined as undefined | ((id:string)=>string[]),
		jobExpMultiplier: 1,
		players: new Map([[id, p]]),
		get p() {
			return p;
		},
		set p(v: Player) {
			p = v;
		},
		get target() {
			return p.target;
		},
		set target(v: number | null) {
			p.target = v;
		},
		get destination() {
			return p.destination;
		},
		set destination(v: Vec | null) {
			p.destination = v;
		},
		get autoTimer() {
			return p.autoTimer;
		},
		set autoTimer(v: number) {
			p.autoTimer = v;
		},
		get autoPath() {
			return p.autoPath;
		},
		set autoPath(v: Vec[]) {
			p.autoPath = v;
		},
		get autoGoal() {
			return p.autoGoal;
		},
		set autoGoal(v: Vec | null) {
			p.autoGoal = v;
		},
		get autoCharge() {
			return p.autoCharge;
		},
		set autoCharge(v: number) {
			p.autoCharge = v;
		},
		time: 0,
		random,
		enemies: [] as Enemy[],
		events: [] as Event[],
		drops: [] as Drop[],
		projectiles: [] as Projectile[],
		nextId: 1,
		kills: 0,
		wallTime:0,bossSpawned: false,
		won: false,
		meteors: [] as {
			ownerId: string;
			x: number;
			z: number;
			time: number;
			skillId?: string;
			level?: number;
		}[],
	};
			if (mapId === "meadow") {
		for (const s of MEADOW_SPAWNS) spawn(g, s.x, s.z, false, s.variant, false, s.dataId);
	} else if (mapId === "forest") {
		for (const s of FOREST_SPAWNS) spawn(g, s.x, s.z, false, "pink", false, s.dataId);
		Object.assign(p, FOREST_ENTRY, { fx: 1, fz: 0 });
	}
	else Object.assign(p, CITY_SPAWN, { fx: 0, fz: 1 });
	// Field boss: present from the start, then back `respawnMinutes` after each death (see bossTimer).
		if (mapId === "meadow" || mapId === "forest")
		[FIELD_BOSS[mapId]].forEach((rule) => {
			spawn(g, rule.x, rule.z, true, "pink", false, rule.dataId);
			g.bossSpawned = true;
		});

	return g;
}
export type Game = ReturnType<typeof createGame>;
export function withPlayer<T>(g: Game, id: string, run: () => T): T {
	const previous = g.p;
	const p = g.players.get(id);
	if (!p) throw new Error("Unknown player");
	g.p = p;
	try {
		return run();
	} finally {
		g.p = previous;
	}
}
export function addPlayer(
	g: Game,
	id: string,
	profile: CharacterInput = g.data.stats.defaultBuild,
) {
	const p = createGame(1, profile, id, g.data, g.mapId).p;
	g.players.set(id, p);
	return p;
}
export function refreshStats(g: Game, p: Player) {
	if(p.inventory){p.profile.equipment=equipped(p.inventory);p.potions=p.inventory.items.filter(i=>i.location==='bag'&&g.data.items.items.find(t=>t.id===i.template)?.effect==='hp').reduce((n,i)=>n+i.qty,0);}
 p.profile.level = p.level;
	p.profile.skills = { ...p.skills };
	p.stats = deriveStats(p.profile, g.data);
	const endure = p.statuses.find((s) => s.id === "endure");
	if (endure) {
		p.stats.hardDef *= 1 + endure.value;
		p.stats.softDef *= 1 + endure.value;
	}
	p.maxHp = p.stats.maxHp;
	p.maxMp = p.stats.maxSp;
	p.hp = Math.min(p.hp, p.maxHp);
	p.mp = Math.min(p.mp, p.maxMp);
	p.nextXp = g.data.stats.expToNext[p.level - 1];
}
function topDamage(g: Game, e: Enemy) {
	return (
		Object.entries(e.damageBy).sort(
			(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
		)[0]?.[0] || g.p.id
	);
}

export function gameSkill(g: Game, a: Action) {
	return resolveSkill(g.data, skillId(a), g.p.skills[skillId(a)] || 1);
}
function duration(e: Enemy, motion: MonsterMotion) {
	return (
		(MONSTER_MOTIONS[e.boss ? "king" : "slime"] as any)[motion]?.duration || 1
	);
}
function setMotion(e: Enemy, motion: MonsterMotion) {
	if (e.motion !== motion) {
		e.motion = motion;
		e.motionTime = 0;
		e.motionDuration = duration(e, motion);
		e.attackApplied = false;
	}
}
export function spawn(
	g: Game,
	x: number,
	z: number,
	boss = false,
		variant: SlimeVariant = "pink",
	summoned = false,
	explicitId?: string,
) {
	const dataId = explicitId ?? (boss
			? "king_jelly"
			: summoned
				? "jelly_summon"
				: `jelly_${variant}`),
		spec = g.data.monsters.monsters.find((m) => m.id === dataId)!;
	boss = spec.boss;
	const hp = spec.hp;
	const e: Enemy = {
		dataId,
		statuses: [],
		damageBy: {},
		id: g.nextId++,
		x,
		z,
		hp,
		maxHp: hp,
		boss,
		dead: false,
		respawn: 0,
		homeX: x,
		homeZ: z,
		aggro: 0,
		cooldown: 0.8,
		windup: 0,
		aimX: x,
		aimZ: z,
		hurt: 0,
		phase: g.random() * 6.28,
		wander: 0,
		wx: x,
		wz: z,
		motion: "idle",
		motionTime: 0,
		motionDuration: boss ? 1.8 : 1.65,
		bossPhase: 1,
		variant,
		deathAge: 0,
		rewarded: false,
		attackApplied: false,
		patternIndex: 0,
		history: [],
		engaged: false,
				summoned,
		behavior: spec.behavior,
		mapId: g.mapId,
		startX: x,
		startZ: z,
		fx: 0,
		fz: 1,
		vx: 0,
		vz: 0,
		moving: false,
	};
	g.enemies.push(e);
	return e;
}
function emit(g: Game, type: string, data: any = {}) {
	g.events.push({ type, x: g.p.x, z: g.p.z, playerId: g.p.id, ...data });
}
function warn(
	g: Game,
	e: Enemy,
	x: number,
	z: number,
	r: number,
	time: number,
) {
	emit(g, "warning", { x, z, r, duration: time, id: e.id, attack: e.motion });
}
function reward(g: Game, e: Enemy) {
	if (e.rewarded) return;
	e.rewarded = true;
	const spec = g.data.monsters.monsters.find((m) => m.id === e.dataId)!,
		ownerId = topDamage(g, e);
	g.drops.push({
		ownerId,
  boss:e.boss, bossId:e.boss?e.dataId:undefined,
 loot:rollDrops(spec,g.random,g.data,g.players.get(ownerId)?.autoSeconds||0,g.players.get(ownerId)?.stats.dropBonus||0),
		id: g.nextId++,
		x: e.x,
		z: e.z,
		gold:
			spec.gold[0] + Math.floor(g.random() * (spec.gold[1] - spec.gold[0] + 1)),
		xp: spec.exp,
		jobExp: spec.jobExp,
		time: 0,
	});
	if (e.boss) {
		g.won = true;
		emit(g, "victory");
	}
}
function defeat(g: Game, e: Enemy) {
	e.dead = true;
	e.deathAge = 0;
		e.respawn = e.boss ? (g.mapId === "meadow" || g.mapId === "forest" ? FIELD_BOSS[g.mapId].respawnMinutes * 60 : 1800) : 12;
	e.windup = 0;
	e.hurt = 0;
	setMotion(e, "death");
	g.kills++;
	const winner = g.players.get(topDamage(g, e));
	if (winner) winner.kills++;
	for (const p of g.players.values()) if (p.target === e.id) p.target = null;
		emit(g, "kill", {
		x: e.x,
		z: e.z,
		id: e.id,
		dataId: e.dataId,
		ownerId: winner?.id,
		boss: e.boss,
		variant: e.variant,
	});
	if (e.boss) {
		g.projectiles = g.projectiles.filter((p) => p.owner !== e.id);
		for (const minion of g.enemies)
			if (minion.summoned && !minion.dead) {
				minion.dead = true;
				minion.deathAge = 0;
				minion.rewarded = true;
				setMotion(minion, "death");
			}
	}
		}
/** Seconds until the field boss is back (0 while it is alive or on maps without one). */
export function bossTimer(g: Game) {
	const boss = g.enemies.find((e) => e.boss && !e.summoned);
	return boss && boss.dead ? Math.max(0, boss.respawn) : 0;
}
/** Restores a map-wide schedule (e.g. a room created while the boss is still on its timer). */
export function setBossTimer(g: Game, seconds: number) {
	const boss = g.enemies.find((e) => e.boss && !e.summoned);
	if (!boss || seconds <= 0) return;
	boss.dead = true;
	boss.rewarded = true;
	boss.deathAge = 99;
	boss.respawn = seconds;
	boss.hp = boss.maxHp;
	setMotion(boss, "death");
}
function hit(g: Game, e: Enemy, skill: Skill, third = false, prepared?:{damage:number;crit:boolean;breakdown:any;impact?:number}) {
	if (e.dead) return false;
	const defender = monsterStats(
		g.data.monsters.monsters.find((m) => m.id === e.dataId)!,
		g.data,
		e.bossPhase === 2,
	);
	const defDown = e.statuses.find((s) => s.id === "def_down");
	if (defDown) {
		defender.hardDef *= 1 - defDown.value;
		defender.softDef *= 1 - defDown.value;
	}
	const rhythm = g.p.skills.sword_rhythm || 0;
	if (third && rhythm)
		skill = {
			...skill,
			comboThirdPercent:
				(skill.comboThirdPercent || 170) *
				(1 +
					skillValue(
						resolveSkill(g.data, "sword_rhythm", rhythm),
						"comboBonus",
						rhythm,
					)),
		};
	const result = prepared ? {...prepared,hit:true} : computeDamage(
		g.p.stats,
		defender,
		skill,
		{ rng: g.random, comboThird: third },
		g.data,
	);
	if (!result.hit) {
		emit(g, "miss", {
			x: e.x,
			z: e.z,
			id: e.id,
			boss: e.boss,
			breakdown: result.breakdown,
		});
		return false;
	}
	let damage = prepared ? prepared.damage : Math.round(
		result.damage * (e.boss && e.motion === "stun" ? 1.25 : 1),
	);
	const crit = result.crit;
	if (damage > 0) g.p.lastCombat = g.time;
	e.lastEngagedAt=g.time;
	e.damageBy[g.p.id] = (e.damageBy[g.p.id] || 0) + Math.min(damage, e.hp);
	e.hp = Math.max(0, e.hp - damage);
	applyEffects(e, skillEffects(skill, g.p.skills[skill.id] || 1, g.p.id));
	e.hurt = 0.18;
	e.aggro = e.boss ? 30 : 10;
	if (!e.boss) {
		const dx = e.x - g.p.x,
			dz = e.z - g.p.z,
			d = Math.hypot(dx, dz) || 1;
		move(e, (dx / d) * 0.23, (dz / d) * 0.23);
	}
	emit(g, "hit", {
        skillId:skill.id,hitIndex:prepared?.impact,
		x: e.x,
		z: e.z,
		id: e.id,
		damage,
		crit,
		breakdown: {
			...result.breakdown,
			scriptedStunMul: e.boss && e.motion === "stun" ? 1.25 : 1,
			beforeStun: result.damage,
		},
		element: skill.element,
		boss: e.boss,
		variant: e.variant,
	});
	if (e.hp === 0) {
		defeat(g, e);
		return true;
	}
	if (e.boss && e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
		e.bossPhase = 2;
		e.windup = 0;
		setMotion(e, "transform");
		g.projectiles = g.projectiles.filter((p) => p.owner !== e.id);
		emit(g, "phase2", { x: e.x, z: e.z, id: e.id });
	} else if (e.boss && (e.motion === "idle" || e.motion === "move"))
		setMotion(e, "hit");
	return true;
}
function hurt(
	g: Game,
	amount: number,
	source?: Enemy,
	attack = source?.motion,
) {
	const p = g.p;
	if (p.dead) return;
	if (p.invulnerable > 0) {
		emit(g, "evade");
		return;
	}
	let breakdown;
	if (source) {
		const spec = g.data.monsters.monsters.find((m) => m.id === source.dataId)!,
			attacker = monsterStats(spec, g.data, source.bossPhase === 2);
		const basic = gameSkill(g, "attack"),
			pattern = spec.attacks?.[attack as "slam"];
		const skill = source.boss
			? {
					...basic,
					kind: "area" as const,
					percent: pattern
						? source.bossPhase === 2
							? pattern.phase2Percent
							: pattern.percent
						: basic.percent,
				}
			: basic;
		const result = computeDamage(
			attacker,
			p.stats,
			skill,
			{ rng: g.random },
			g.data,
		);
		if (!result.hit) {
			emit(g, "miss", { defender: "player", breakdown: result.breakdown });
			return;
		}
		amount = result.damage;
		breakdown = result.breakdown;
	}
	p.hp = Math.max(0, p.hp - amount);
	if (amount > 0) p.lastCombat = g.time;
	if (!p.statuses.some((s) => s.id === "endure")) p.hurt = 0.3;
	p.invulnerable = 0.55;
	emit(g, "hurt", { amount, breakdown });
	if (p.hp === 0) {
		p.dead = true;p.reviveRemaining=5;
		setAuto(g, false);
		g.target = null;
		g.destination = null;
		emit(g, "death", { xpLost: deathPenalty(p, g.data) });
	}
}
/** Adds base and job EXP (EXP bonus applies to base EXP), runs level-ups and emits a pickup event. */
export function grantExp(g: Game, r: Player, baseXp: number, jobExp: number, extra: Record<string, unknown> = {}) {
	const before = g.p;
	g.p = r;
	const jobLevels = gainJobExp(r, Math.round(jobExp * (g.jobExpMultiplier || 1)), g.data);
	if (jobLevels) emit(g, "jobLevel", { jobLevel: r.jobLevel, skillPoints: r.skillPoints, granted: jobLevels });
	const xp = Math.round(baseXp * (1 + r.stats.expBonus));
	r.xp += xp;
	emit(g, "pickup", { gold: 0, ...extra, xp });
	while (r.level < g.data.stats.maxLevel && r.xp >= r.nextXp) {
		r.xp -= r.nextXp;
		r.level++;
		r.statPoints += g.data.stats.pointsPerLevel;
		Object.assign(r, autoAllocateStats(r, g.data));
		refreshStats(g, r);
		r.hp = r.maxHp;
		r.mp = r.maxMp;
		emit(g, "level", { level: r.level, skillPoints: r.skillPoints, points: r.statPoints, granted: g.data.stats.pointsPerLevel });
	}
	g.p = before;
}
export const PARTY_SHARE_RANGE = 30;
/** Party EXP: living members on this map within range split the kill's EXP evenly, +10% per extra member. */
export function expShares(g: Game, p: Player, xp: number, jobExp: number) {
	const ids = g.partyMembers?.(p.id) ?? [p.id];
	const members = ids
		.map(id => g.players.get(id))
		.filter((m): m is Player => !!m && (m === p || (!m.dead && Math.hypot(m.x - p.x, m.z - p.z) <= PARTY_SHARE_RANGE)));
	if (members.length <= 1) return [{ player: p, xp, jobExp, shared: false }];
	const bonus = 1 + 0.1 * (members.length - 1);
	return members.map(m => ({ player: m, xp: Math.floor((xp * bonus) / members.length), jobExp: Math.floor((jobExp * bonus) / members.length), shared: true }));
}
/** Base EXP lost on death: a share of this level's requirement, never below 0 and never a de-level. */
export function deathPenalty(p: Pick<Player, "level" | "xp" | "nextXp">, data: GameData) {
	const rule = data.economy.deathPenalty;
	if (p.level < rule.minLevel || p.level >= data.stats.maxLevel) return 0;
	const lost = Math.min(Math.floor(p.xp), Math.floor(p.nextXp * rule.percent));
	p.xp -= lost;
	return lost;
}
export function action(g: Game, a: Action) {
 activeMap = g.mapId;
 if(g.p.inventory&&a!=='potion'&&inventoryWeight(g.p.inventory,g.data)>=g.p.stats.weight*g.data.economy.attackWeightRatio){emit(g,'notice',{text:'น้ำหนักเกิน 90% โจมตีไม่ได้'});return false;}
 if(g.mapId==='city_plaza' && a!=='potion'){emit(g,"notice",{text:"เขตปลอดภัย ใช้สกิลต่อสู้ในเมืองไม่ได้"});return false;}
	const p = g.p,
		skill = g.data.skills.skills.some((s) => s.id === skillId(a))
			? gameSkill(g, a)
			: null;
	if (
		!skill ||
		skill.passive ||
		!p.skills[skill.id] ||
		!belongsToJob(p.jobId, skill.jobId, g.data) ||
		p.dead ||
		p.castRemaining > 0 ||
		p.statuses.some((s) => s.id === "stun" || s.id === "knockup") ||
		(p.cd[
			skill.id === "basic" ? "attack" : skill.id === "dodge" ? "dash" : skill.id
		] || 0) > 0
	)
		return false;
	if (a === "attack" || a === "basic") {
		if (p.dash > 0) return false;
		p.combo = p.comboWindow > 0 ? (p.combo + 1) % 3 : 0;
		p.comboWindow = 1.1;
		p.attack = 0.34;
		p.attackKind = "slash";
		p.cd.attack = p.combo === 2 ? 0.55 : skill.cooldown;
		const preferred = p.auto
			? g.enemies.find(
					(e) =>
						e.id === g.target &&
						!e.dead &&
						Math.hypot(e.x - p.x, e.z - p.z) < (e.boss ? 2.3 : 1.8),
				)
			: undefined;
		const nearby =
			preferred ||
			g.enemies
				.filter((e) => !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < 2.3)
				.sort(
					(a, b) =>
						Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
				)[0];
		if (nearby) {
			const d = Math.hypot(nearby.x - p.x, nearby.z - p.z) || 1;
			p.fx = (nearby.x - p.x) / d;
			p.fz = (nearby.z - p.z) / d;
		}
		emit(g, "slash", { dx: p.fx, dz: p.fz, combo: p.combo });
		let connected = false;
		for (const e of [...g.enemies]) {
			const dx = e.x - p.x,
				dz = e.z - p.z,
				d = Math.hypot(dx, dz);
			if (
				!e.dead &&
				d < (e.boss ? 2.3 : 1.8) &&
				(dx * p.fx + dz * p.fz) / (d || 1) > -0.2
			)
				connected = hit(g, e, skill, p.combo === 2) || connected;
		}
		if (p.combo === 2 && connected)
			rhythmCooldowns(p.cd, p.skills.sword_rhythm || 0, g.data);
		return true;
	}
	if (!["dodge", "potion"].includes(skill.id)) {
		const level = p.skills[skill.id] || 1;
		const target =
			g.enemies.find((e) => e.id === g.target && !e.dead) ||
			g.enemies
				.filter((e) => !e.dead)
				.sort(
					(a, b) =>
						Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
				)[0];
		if (
			skill.kind === "single" &&
			skill.effect !== "dash" &&
			(!target ||
				Math.hypot(target.x - p.x, target.z - p.z) >
					skill.range + (target.boss ? 0.5 : 0))
		)
			return false;
		if (p.mp < skill.sp) {
			emit(g, "notice", { text: "SP ไม่พอ รอพลังฟื้นสักครู่" });
			return false;
		}
		if (skill.kind === "single" && target) {
			const d = Math.hypot(target.x - p.x, target.z - p.z) || 1;
			p.fx = (target.x - p.x) / d;
			p.fz = (target.z - p.z) / d;
		}
		p.mp -= skill.sp;
		p.cd[skill.id] = skill.cooldown;
		if (skill.id === "whirlwind") p.cd.spin = skill.cooldown;
		p.attack =
			skill.id === "whirlwind"
				? 0.6
				: skill.effect === "dash"
					? 0.5
					: skill.cast || 0.5;
		p.attackKind =
			skill.id === "whirlwind"
				? "spin"
				: skill.id === "slash"
					? "slash"
					: skill.effect === "dash"
						? "dash_strike"
						: "meteor";
		emit(g, "skill", {
			skillId: skill.id,
			duration: skill.cast || 0.7,
			dx: p.fx,
			dz: p.fz,
		});
		if (skill.effect === "heal") {
			const amount = Math.min(
				p.maxHp - p.hp,
				skillValue(skill, "heal", level) + p.stats.stats.vit * 2,
			);
			p.hp += amount;
			emit(g, "heal", { amount });
			return true;
		}
		if (skill.effect === "endure") {
			p.hurt = 0;
			applyEffects(p, skillEffects(skill, level, p.id));
			refreshStats(g, p);
			return true;
		}
		if (skill.effect === "taunt") {
			for (const e of g.enemies)
				if (!e.dead && Math.hypot(e.x - p.x, e.z - p.z) <= skill.radius) {
					applyEffects(e, skillEffects(skill, level, p.id));
					e.aggro = 5;
				}
			return true;
		}
		if (skill.effect === "dash") {
			if (target && Math.hypot(target.x - p.x, target.z - p.z) <= skill.range) {
				const d = Math.hypot(target.x - p.x, target.z - p.z) || 1;
				p.fx = (target.x - p.x) / d;
				p.fz = (target.z - p.z) / d;
			}
			const seen = new Set<number>();
			const start = { x: p.x, z: p.z };
			g.destination = null;
			g.target = null;
			for (let n = 0; n < Math.round(skill.range / 0.1); n++) {
				const x = p.x + p.fx * 0.1,
					z = p.z + p.fz * 0.1;
				if (!walk(x, z, 0.35)) break;
				p.x = x;
				p.z = z;
				for (const e of [...g.enemies])
					if (
						!e.dead &&
						!seen.has(e.id) &&
						Math.hypot(e.x - x, e.z - z) < (e.boss ? 1.3 : 0.9)
					) {
						seen.add(e.id);
						hit(g, e, skill);
					}
			}
			emit(g, "dashTrail", {
				fromX: start.x,
				fromZ: start.z,
				toX: p.x,
				toZ: p.z,
			});
			return true;
		}
		if (skill.cast > 0) {
			p.castRemaining = skill.cast;
			g.meteors.push({
				ownerId: p.id,
				x: skill.range && target ? target.x : p.x,
				z: skill.range && target ? target.z : p.z,
				time: skill.cast,
				skillId: skill.id,
				level,
			});
			return true;
		}
		const targets =
			skill.kind === "single"
				? target
					? [target]
					: []
				: g.enemies.filter(
						(e) => !e.dead && Math.hypot(e.x - p.x, e.z - p.z) <= skill.radius,
					);
        for (const e of [...targets]) {
            if(skill.id==='whirlwind') {
                // Reserve both original rolls now, then divide their exact integer total.
                const defender=monsterStats(g.data.monsters.monsters.find(m=>m.id===e.dataId)!,g.data,e.bossPhase===2);
                const defDown=e.statuses.find(s=>s.id==='def_down');if(defDown){defender.hardDef*=1-defDown.value;defender.softDef*=1-defDown.value;}
                const rolls=Array.from({length:skill.hits},()=>computeDamage(p.stats,defender,skill,{rng:g.random,comboThird:false},g.data));
                const total=rolls.reduce((n,r)=>n+Math.round(r.damage*(e.boss&&e.motion==='stun'?1.25:1)),0);
                const prepared={impact:1,damage:Math.ceil(total/2),crit:rolls.some(r=>r.crit),breakdown:rolls[0].breakdown};
                hit(g,e,skill,false,prepared);
                (p.whirlwindHits??=[]).push({id:e.id,due:g.time+.25,...prepared,impact:2,damage:Math.floor(total/2)});
            } else for(let i=0;i<skill.hits;i++)hit(g,e,skill);
        }
		return true;
	}
	if (skill.id === "dodge") {
		p.cd.dash = CD.dash;
		p.dash = 0.22;
		p.invulnerable = 0.35;
		g.target = null;
		g.destination = null;
		emit(g, "dash", { dx: p.fx, dz: p.fz });
		return true;
	}
	if (skill.id === "potion" && p.inventory) {
  const best=redPotion(p.inventory,g.data);if(!best||p.hp>=p.maxHp||p.cd.potion>0)return false;
  if(g.inventoryCommit){g.inventoryCommit(p,{op:'use',id:best.id},()=>{});return true;}
  const out=applyInventory({gold:p.gold,inventory:p.inventory},{op:'use',id:best.id},p.profile,g.data,()=>String(g.nextId++));p.inventory=out.state.inventory;p.hp=Math.min(p.maxHp,p.hp+out.effect!.amount);p.cd.potion=skill.cooldown;refreshStats(g,p);return true;
 }
 if (skill.id === "potion") {
		if (p.potions <= 0) {
			emit(g, "notice", { text: "ยาหมดแล้ว กลับไปฟื้นพลังที่แคมป์" });
			return false;
		}
		if (p.hp >= p.maxHp) return false;
		const amount = Math.min(
			computeDamage(p.stats, p.stats, skill, { rng: g.random }, g.data).damage,
			p.maxHp - p.hp,
		);
		p.hp += amount;
		p.potions--;
		p.cd.potion = skill.cooldown;
		emit(g, "heal", { amount });
		return true;
	}
	return false;
}
export function revive(g: Game) {
	const p = g.p;
 if((p.reviveRemaining??0)>0)return;
	setAuto(g, false);
	p.mapId = "city_plaza";
 p.x = CITY_SPAWN.x;
 p.z = CITY_SPAWN.z;
 p.fx=0;p.fz=1;
 p.statuses=[]; p.castRemaining=0; p.destination=null; p.target=null;
	p.hp = p.maxHp;
	p.mp = p.maxMp;
	if(!p.inventory)p.potions = 5;
	p.dead = false;
	p.invulnerable = 3;
	p.dash = 0;
	p.attack = 0;
	p.hurt = 0;
	const otherLiving = [...g.players.values()].some(
		(other) => other.id !== p.id && !other.dead,
	);
	if (!otherLiving) {
		g.projectiles = [];
		for (const e of g.enemies) {
			e.aggro = 0;
			e.windup = 0;
			if (!e.dead) {
				setMotion(e, "idle");
				e.cooldown = 1;
				e.engaged = false;
			}
		}
	}
	emit(g, "notice", { text: "พักฟื้นแล้ว พร้อมออกผจญภัยอีกครั้ง" });
}
export function setAuto(g: Game, enabled: boolean) {
	enabled = enabled && !g.p.dead && g.mapId!=="city_plaza";
	if (g.p.auto === enabled) return;
	g.p.auto = enabled;
	g.p.autoState = enabled ? "seek" : "idle";
	g.autoTimer = 0;
	g.autoPath = [];
	g.autoGoal = null;
	g.autoCharge = -1;
	g.destination = null;
	if (!enabled) g.target = null;
	emit(g, "notice", {
		text: enabled ? "ออโต้ เปิด · แตะจอยหรือกด WASD เพื่อหยุด" : "ออโต้ ปิด",
	});
}
/** The manual ground command keeps its original direct steering. AUTO supplies routed waypoints. */
export function moveTo(g: Game, x: number, z: number, manual = true) {
	activeMap = g.mapId;
	if (manual) {
		setAuto(g, false);
		g.target = null;
	}
	g.destination = { x, z };
}
function clearSegment(a: Vec, b: Vec) {
	const count = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2);
	for (let i = 1; i <= count; i++)
		if (
			!walk(
				a.x + ((b.x - a.x) * i) / count,
				a.z + ((b.z - a.z) * i) / count,
				0.4,
			)
		)
			return false;
	return true;
}
/** Bounded 8-neighbour grid search, only when a straight path is obstructed. */
function route(from: Vec, to: Vec): Vec[] {
	if (clearSegment(from, to)) return [{ ...to }];
	const key = (v: Vec) => `${v.x},${v.z}`,
		start = { x: Math.round(from.x), z: Math.round(from.z) },
		queue = [start];
	const parents = new Map<string, Vec | null>([[key(start), null]]);
	let end: Vec | undefined;
	// Bounded so a far or unreachable goal on a large map cannot stall the room tick.
	for (let i = 0; i < queue.length && i < 6000; i++) {
		const v = queue[i];
		if (Math.hypot(v.x - to.x, v.z - to.z) < 1.5 && clearSegment(v, to)) {
			end = v;
			break;
		}
		for (const [dx, dz] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1],
		]) {
			const n = { x: v.x + dx, z: v.z + dz };
			if (
				parents.has(key(n)) ||
				!walk(n.x, n.z, 0.4) ||
				!clearSegment(i === 0 ? from : v, n)
			)
				continue;
			parents.set(key(n), v);
			queue.push(n);
		}
	}
	if (!end) return [];
	const path: Vec[] = [{ ...to }];
	for (let v: Vec | null = end; v; v = parents.get(key(v)) || null)
		path.unshift(v);
	while (path.length > 1 && clearSegment(from, path[1])) path.shift();
	return path;
}
function navigate(g: Game, goal: Vec, reach = 0): Vec {
	const p = g.p;
	// Enemies use .3 clearance and may stand closer to a rock than our .4 route margin.
	// Route to a melee approach point instead of requiring their exact centre to be traversable.
	if (reach && !walk(goal.x, goal.z, 0.4)) {
		const angle = Math.atan2(p.z - goal.z, p.x - goal.x);
		const approach = Array.from({ length: 12 }, (_, i) => ({
			x: goal.x + Math.cos(angle + (i * Math.PI) / 6) * (reach - 0.3),
			z: goal.z + Math.sin(angle + (i * Math.PI) / 6) * (reach - 0.3),
		})).find((v) => walk(v.x, v.z, 0.4));
		if (approach) goal = approach;
	}
	if (
		!g.autoGoal ||
		Math.hypot(goal.x - g.autoGoal.x, goal.z - g.autoGoal.z) > 0.65 ||
		!g.autoPath.length
	) {
		g.autoGoal = { ...goal };
		g.autoPath = route(p, goal);
	}
	while (
		g.autoPath.length &&
		Math.hypot(g.autoPath[0].x - p.x, g.autoPath[0].z - p.z) < 0.2
	)
		g.autoPath.shift();
	const next = g.autoPath[0];
	if (!next) {
		g.destination = null;
		return { x: 0, z: 0 };
	}
	moveTo(g, next.x, next.z, false);
	const d = Math.hypot(next.x - p.x, next.z - p.z) || 1;
	return { x: (next.x - p.x) / d, z: (next.z - p.z) / d };
}
function autoDodge(g: Game) {
	const p = g.p;
	if (p.cd.dash > 0 || p.dash > 0) return;
	for (const e of g.enemies) {
		if (
			e.dead ||
			!e.boss ||
			e.attackApplied ||
			!["slam", "sweep", "charge", "spit"].includes(e.motion)
		)
			continue;
		const speed = e.bossPhase === 2 ? 1.3 : 1,
			impact = e.motion === "slam" ? 0.85 : e.motion === "sweep" ? 0.7 : 0.8,
			remaining = (impact - e.motionTime) / speed;
		let cx = e.motion === "slam" ? e.aimX : e.x,
			cz = e.motion === "slam" ? e.aimZ : e.z;
		let radius = e.motion === "slam" ? 2.6 : e.motion === "sweep" ? 3.5 : 1.2;
		if (e.motion === "charge") {
			const dx = e.aimX - e.startX,
				dz = e.aimZ - e.startZ,
				l = dx * dx + dz * dz || 1,
				t = Math.max(
					0,
					Math.min(1, ((p.x - e.startX) * dx + (p.z - e.startZ) * dz) / l),
				);
			cx = e.startX + dx * t;
			cz = e.startZ + dz * t;
			radius = 1.55;
		}
		const earlyCharge =
			e.motion === "charge" && remaining > 0 && g.autoCharge !== e.patternIndex;
		if (
			Math.hypot(p.x - cx, p.z - cz) >= radius ||
			(!earlyCharge && (remaining < 0 || remaining > 0.15))
		)
			continue;
		let angle = Math.atan2(p.z - cz, p.x - cx);
		if (Math.hypot(p.x - cx, p.z - cz) < 0.05)
			angle =
				e.motion === "charge"
					? Math.atan2(e.fz, e.fx) + Math.PI / 2
					: Math.atan2(p.z - e.z, p.x - e.x);
		// Prefer outward movement; rotate away from terrain if the ideal escape is blocked.
		for (const offset of [0, 0.5, -0.5, 1, -1, Math.PI]) {
			const dx = Math.cos(angle + offset),
				dz = Math.sin(angle + offset),
				end = { x: p.x + dx * 3.08, z: p.z + dz * 3.08 };
			if (!clearSegment(p, end)) continue;
			p.fx = dx;
			p.fz = dz;
			if (action(g, "dash")) {
				g.autoCharge = e.patternIndex;
				g.autoPath = [];
				g.autoGoal = null;
			}
			return;
		}
	}
}
function autoStep(g: Game, dt: number): Vec {
	const p = g.p,
		still = { x: 0, z: 0 };
	autoDodge(g);
	if (p.dash > 0) return still;
	g.autoTimer -= dt;
	if (g.autoTimer <= 0) {
		g.autoTimer += 0.2;
		const cfg = p.autoCfg ?? DEFAULT_AUTO;
		if (cfg.hpPotion && p.hp < p.maxHp * cfg.hpPotion / 100 && p.potions > 0) action(g, "potion");
		else if (cfg.mpPotion && p.mp < p.maxMp * cfg.mpPotion / 100) autoDrinkSp(g);
		if (p.hp < p.maxHp * 0.25 && p.potions === 0) p.autoState = "retreat";
		const retreat = p.autoState === "retreat" && p.hp < p.maxHp * 0.9;
		const target = autoPickTarget(g, cfg);
		g.target = target?.id ?? null;
		const reach = target ? (target.boss ? 2.3 : 1.8) : 0,
			d = target ? Math.hypot(target.x - p.x, target.z - p.z) : Infinity;
		p.autoState = retreat
			? "retreat"
			: target
				? d < reach
					? "fight"
					: "seek"
				: "idle";
				const camp = campFor(g.mapId, p), atCamp = Math.hypot(p.x - camp.x, p.z - camp.z) < 1;
		if (target && d < reach && (!retreat || atCamp)) {
			p.fx = (target.x - p.x) / (d || 1);
			p.fz = (target.z - p.z) / (d || 1);
			autoCast(g, cfg);
		}
	}
	const target = g.enemies.find((e) => e.id === g.target && !e.dead);
	const retreat = p.autoState === "retreat",
				atCamp = Math.hypot(p.x - campFor(g.mapId, p).x, p.z - campFor(g.mapId, p).z) < 1;
	if (target) {
		const d = Math.hypot(target.x - p.x, target.z - p.z),
			reach = target.boss ? 2.3 : 1.8;
		if (d < reach && (!retreat || atCamp)) {
			p.fx = (target.x - p.x) / (d || 1);
			p.fz = (target.z - p.z) / (d || 1);
			if ((p.autoCfg ?? DEFAULT_AUTO).basic) action(g, "attack");
			g.destination = null;
			if (!retreat) p.autoState = "fight";
			return still;
		}
		if (!retreat) {
			p.autoState = "seek";
			return navigate(g, target, reach);
		}
	}
		if (retreat) return atCamp ? still : navigate(g, campFor(g.mapId, p));
	p.autoState = target ? "seek" : "idle";
	return Math.hypot(p.x, p.z) < 0.4 ? still : navigate(g, { x: 0, z: 0 });
}
/**
 * AUTO target. A monster fighting this player comes first (with `attackers`), then bosses (with
 * `elites`), then the nearest one in range on the map's hunt list. The current target is kept
 * unless another is clearly better, so AUTO does not flip between two close monsters.
 */
function autoPickTarget(g: Game, cfg: AutoSettings) {
	const p = g.p,
		R = AUTO_RANGES[cfg.range],
		wanted = wantedMonsters(cfg, g.mapId),
		dist = (e: Enemy) => Math.hypot(e.x - p.x, e.z - p.z),
		fighting = (e: Enemy) => cfg.attackers && e.aggro > 0 && (e.engaged || (e.damageBy[p.id] ?? 0) > 0) && dist(e) < 6,
		allowed = (e: Enemy) => !wanted || wanted.has(e.dataId) || fighting(e),
		living = g.enemies.filter((e) => !e.dead && !e.summoned || (!e.dead && fighting(e)));
	const score = (e: Enemy) => (fighting(e) ? -1000 : 0) + (cfg.elites && e.boss ? -500 : 0) + dist(e);
	const pool = living.filter((e) => allowed(e) && (dist(e) <= R || fighting(e)));
	const best = pool.sort((a, b) => score(a) - score(b))[0];
	const current = pool.find((e) => e.id === g.target);
	return current && (!best || score(current) - 2 <= score(best)) ? current : best;
}
/** Cast the first ready skill in the player's AUTO order (cycle / priority, survival first when low). */
function autoCast(g: Game, cfg: AutoSettings) {
	const p = g.p,
		hotbar = (p.hotbar ?? []).map((h) => h.skill),
		spec = (id: string) => g.data.skills.skills.find((s) => s.id === id),
		seq = autoSkillSequence(cfg, hotbar, (id) => !!p.skills[id] && !spec(id)?.passive && !!spec(id)),
		order = autoCastOrder(seq, cfg, p.hp / p.maxHp, p.autoNext ?? null, (id) => isSurvivalSkill(spec(id)));
	for (const id of order) {
		if ((p.cd[id] || 0) > 0 || p.mp < gameSkill(g, id).sp) continue;
		if (action(g, id)) {
			p.autoNext = seq[(seq.indexOf(id) + 1) % seq.length] ?? null;
			return true;
		}
	}
	return false;
}
/** AUTO's SP potion: the first SP drink in the bag, on the shared potion cooldown. */
function autoDrinkSp(g: Game) {
	const p = g.p;
	if (!p.inventory || (p.cd.potion || 0) > 0 || p.mp >= p.maxMp) return false;
	const item = p.inventory.items.find((i) => i.location === "bag" && g.data.items.items.find((t) => t.id === i.template)?.effect === "sp");
	if (!item) return false;
	if (g.inventoryCommit) { g.inventoryCommit(p, { op: "use", id: item.id }, () => {}); return true; }
	const out = applyInventory({ gold: p.gold, inventory: p.inventory }, { op: "use", id: item.id }, p.profile, g.data, () => String(g.nextId++));
	p.inventory = out.state.inventory;
	if (out.effect?.kind === "sp") p.mp = Math.min(p.maxMp, p.mp + out.effect.amount);
	p.cd.potion = gameSkill(g, "potion").cooldown;
	refreshStats(g, p);
	return true;
}
function face(e: Enemy, x: number, z: number) {
	const d = Math.hypot(x - e.x, z - e.z) || 1;
	e.fx = (x - e.x) / d;
	e.fz = (z - e.z) / d;
}
function startKingAttack(g: Game, e: Enemy) {
	const attack = KING_PATTERN[e.patternIndex++ % KING_PATTERN.length];
	setMotion(e, attack);
	e.history.push(attack);
	e.startX = e.x;
	e.startZ = e.z;
	e.aimX = g.p.x;
	e.aimZ = g.p.z;
	face(e, e.aimX, e.aimZ);
	const speed = e.bossPhase === 2 ? 1.3 : 1;
	e.windup =
		(attack === "slam"
			? 0.85
			: attack === "sweep"
				? 0.7
				: attack === "summon"
					? 0.9
					: 0.8) / speed;
	if (attack === "charge") {
		e.aimX = e.x + e.fx * 6;
		e.aimZ = e.z + e.fz * 6;
		for (const t of [0.25, 0.5, 0.75, 1])
			warn(g, e, e.x + e.fx * 6 * t, e.z + e.fz * 6 * t, 1.1, e.windup);
	} else
		warn(
			g,
			e,
			attack === "slam" ? e.aimX : e.x,
			attack === "slam" ? e.aimZ : e.z,
			attack === "slam"
				? 2.6
				: attack === "sweep"
					? 3.5
					: attack === "summon"
						? 2.3
						: 1.2,
			e.windup,
		);
	emit(g, "kingAttack", {
		x: e.x,
		z: e.z,
		id: e.id,
		attack,
		phase: e.bossPhase,
	});
}
function summon(g: Game, e: Enemy) {
	// Cap lingering summons, while each summon cast still creates exactly three.
	const living = g.enemies.filter((m) => m.summoned && !m.dead);
	for (const old of living.slice(0, Math.max(0, living.length - 6))) {
		old.dead = true;
		old.rewarded = true;
		old.deathAge = 0;
		setMotion(old, "death");
	}
	const ids: number[] = [];
	for (let i = 0; i < 3; i++) {
		let x = e.x,
			z = e.z;
		for (let j = 0; j < 12; j++) {
			const a = (i / 3) * Math.PI * 2 + j * 0.27,
				tx = e.x + Math.cos(a) * 2.2,
				tz = e.z + Math.sin(a) * 2.2;
			if (walk(tx, tz)) {
				x = tx;
				z = tz;
				break;
			}
		}
		const minion = e.dataId === "king_jelly" ? undefined : (Object.values(FIELD_BOSS).find((r) => r.dataId === e.dataId)?.minion ?? undefined);
		const m = spawn(
			g,
			x,
			z,
			false,
			e.bossPhase === 2 ? (i % 2 ? "sky" : "mint") : "pink",
			true,
			minion,
		);
		if (minion) m.summoned = true;
		m.aggro = 30;
		ids.push(m.id);
	}
	emit(g, "summon", { x: e.x, z: e.z, id: e.id, minions: ids });
}
function kingStep(g: Game, e: Enemy, dt: number) {
	const p = g.p,
		dx = p.x - e.x,
		dz = p.z - e.z,
		d = Math.hypot(dx, dz) || 1;
	if (d < 9) e.aggro = 10;
	if (!e.engaged && e.aggro > 0) {
		e.engaged = true;
		setMotion(e, "roar");
		face(e, p.x, p.z);
		return;
	}
	const speed = e.bossPhase === 2 ? 1.3 : 1;
	if (["slam", "sweep", "charge", "spit", "summon"].includes(e.motion)) {
		const t = e.motionTime;
		e.windup = Math.max(0, e.windup - dt);
		if (e.motion === "slam") {
			if (t >= 0.55 && t < 0.85) {
				const k = Math.min(1, (t - 0.55) / 0.3);
				const x = e.startX + (e.aimX - e.startX) * k,
					z = e.startZ + (e.aimZ - e.startZ) * k;
				move(e, x - e.x, z - e.z);
			}
			if (t >= 0.85 && !e.attackApplied) {
				e.attackApplied = true;
				for (const victim of g.players.values())
					if (Math.hypot(victim.x - e.aimX, victim.z - e.aimZ) < 2.6)
						withPlayer(g, victim.id, () => hurt(g, 0, e));
				emit(g, "slam", { x: e.aimX, z: e.aimZ, id: e.id });
			}
		}
		if (e.motion === "sweep" && t >= 0.7 && !e.attackApplied) {
			e.attackApplied = true;
			for (const victim of g.players.values())
				if (Math.hypot(victim.x - e.x, victim.z - e.z) < 3.5)
					withPlayer(g, victim.id, () => hurt(g, 0, e));
			emit(g, "sweep", { x: e.x, z: e.z, id: e.id });
		}
		if (e.motion === "charge" && t >= 0.8 && t < 1.4) {
			move(e, e.fx * 10 * dt * speed, e.fz * 10 * dt * speed);
			if (!e.attackApplied && Math.hypot(p.x - e.x, p.z - e.z) < 1.55) {
				e.attackApplied = true;
				hurt(g, 0, e);
			}
		}
		if (e.motion === "spit" && t >= 0.8 && !e.attackApplied) {
			e.attackApplied = true;
			const a = Math.atan2(e.fz, e.fx);
			for (const delta of [-0.25, 0, 0.25])
				g.projectiles.push({
					id: g.nextId++,
					owner: e.id,
					attack: "spit",
					x: e.x + e.fx * 1.1,
					z: e.z + e.fz * 1.1,
					vx: Math.cos(a + delta) * 4.5 * speed,
					vz: Math.sin(a + delta) * 4.5 * speed,
					life: 2.5,
					damage: e.bossPhase === 2 ? 16 : 12,
					phase: e.bossPhase,
				});
			emit(g, "spit", { x: e.x, z: e.z, id: e.id });
		}
		if (e.motion === "summon" && t >= 0.9 && !e.attackApplied) {
			e.attackApplied = true;
			summon(g, e);
		}
		if (t >= e.motionDuration) {
			if (e.motion === "slam") {
				setMotion(e, "stun");
				emit(g, "stun", { x: e.x, z: e.z, id: e.id });
			} else {
				setMotion(e, "idle");
				e.cooldown = e.bossPhase === 2 ? 0.6 : 1.1;
			}
		}
		return;
	}
	if (["hit", "stun", "roar", "transform"].includes(e.motion)) {
		if (e.motionTime >= e.motionDuration) {
			const prior = e.motion;
			setMotion(e, "idle");
			e.cooldown =
				prior === "transform" ? 0.25 : prior === "stun" ? 0.45 : 0.25;
		}
		return;
	}
	if (e.aggro <= 0) {
		setMotion(e, "idle");
		return;
	}
	if (d > 6) {
		setMotion(e, "move");
		move(e, (dx / d) * 1.5 * dt * speed, (dz / d) * 1.5 * dt * speed);
	} else {
		setMotion(e, "idle");
		if (e.cooldown <= 0) startKingAttack(g, e);
	}
}
const JELLY_BEHAVIOR = { ai: "melee" as const, speed: 2.2, aggroRange: 2.6, attackRange: 1.35, lunge: 5, cooldown: 1.5, windup: 0.5 };
/** Regular monsters: jelly defaults, or the monster's data-driven behavior (melee lunge or ranged caster). */
function slimeStep(g: Game, e: Enemy, dt: number) {
	const b = e.behavior ?? { ...JELLY_BEHAVIOR, speed: e.variant === "pink" ? 2 : 2.2 };
	const p = g.p,
		dx = p.x - e.x,
		dz = p.z - e.z,
		d = Math.hypot(dx, dz) || 1;
	if (d < b.aggroRange) e.aggro = Math.max(e.aggro, 6);
	if (e.motion === "attack") {
		e.windup = Math.max(0, b.windup - e.motionTime);
		if (b.ai === "ranged") {
			if (e.motionTime >= b.windup && !e.attackApplied) {
				e.attackApplied = true;
				const spec = g.data.monsters.monsters.find((m) => m.id === e.dataId)!;
				const a = Math.atan2(p.z - e.z, p.x - e.x), v = b.projectileSpeed ?? 6;
				g.projectiles.push({ id: g.nextId++, owner: e.id, attack: "bolt", x: e.x + Math.cos(a) * 0.6, z: e.z + Math.sin(a) * 0.6, vx: Math.cos(a) * v, vz: Math.sin(a) * v, life: (b.attackRange + 1.5) / v, damage: Math.round(spec.matk * (0.85 + g.random() * 0.3)), phase: 1 });
				emit(g, "bolt", { x: e.x, z: e.z, id: e.id });
			}
		} else if (e.motionTime >= b.windup && e.motionTime < b.windup + 0.18) {
			move(e, e.fx * b.lunge * dt, e.fz * b.lunge * dt);
			if (!e.attackApplied && Math.hypot(p.x - e.x, p.z - e.z) < b.attackRange + 0.35) {
				e.attackApplied = true;
				hurt(g, 0, e);
			}
		}
		if (e.motionTime >= e.motionDuration) {
			setMotion(e, "idle");
			e.cooldown = b.cooldown;
		}
		return;
	}
	if (e.aggro > 0) {
		const ranged = b.ai === "ranged";
		if (e.cooldown <= 0 && d < b.attackRange && (!ranged || d >= (b.keepAway ?? 0) * 0.6)) {
			face(e, p.x, p.z);
			setMotion(e, "attack");
			e.windup = b.windup;
			if (!ranged) warn(g, e, p.x, p.z, 0.9, b.windup);
		} else if (ranged && d < (b.keepAway ?? 0)) {
			setMotion(e, "hop");
			move(e, (-dx / d) * b.speed * dt, (-dz / d) * b.speed * dt);
		} else if (d > (ranged ? b.attackRange * 0.9 : 1.0)) {
			setMotion(e, "hop");
			move(e, (dx / d) * b.speed * dt, (dz / d) * b.speed * dt);
		} else setMotion(e, "idle");
	} else {
		e.wander -= dt;
		if (e.wander <= 0) {
			e.wander = 2 + g.random() * 3;
			e.wx = e.homeX + (g.random() - 0.5) * 3;
			e.wz = e.homeZ + (g.random() - 0.5) * 3;
		}
		const x = e.wx - e.x,
			z = e.wz - e.z,
			length = Math.hypot(x, z);
		if (length > 0.2) {
			setMotion(e, "hop");
			move(e, (x / length) * 0.45 * dt, (z / length) * 0.45 * dt);
		} else setMotion(e, "idle");
	}
}
function playerStep(g: Game, dt: number, input: Vec) {
	const p = g.p;
 if(p.auto)p.autoSeconds+=dt;
	const hadEndure = p.statuses.some((s) => s.id === "endure");
	tickEffects(p, dt);
	if (hadEndure !== p.statuses.some((s) => s.id === "endure"))
		refreshStats(g, p);
	p.castRemaining = p.castRemaining - dt < 1e-8 ? 0 : p.castRemaining - dt;
	for (const a of Object.keys(p.cd) as Action[])
		p.cd[a] = p.cd[a] - dt < 1e-8 ? 0 : p.cd[a] - dt;
	for (const a of ["attack", "comboWindow", "invulnerable", "hurt"] as const)
		p[a] = Math.max(0, p[a] - dt);
	if (!p.dead) {
 const canRegen=!p.inventory||inventoryWeight(p.inventory,g.data)<p.stats.weight*g.data.economy.regenWeightRatio;
 if(canRegen){
		p.mp = Math.min(p.maxMp, p.mp + dt * p.stats.spRegen);
				if (isField(g.mapId) && Math.hypot(p.x - campFor(g.mapId, p).x, p.z - campFor(g.mapId, p).z) < 2)
			p.hp = Math.min(p.maxHp, p.hp + dt * 20);
		else
			p.hp = Math.min(
				p.maxHp,
				p.hp +
					dt *
						p.stats.hpRegen *
						(g.time - p.lastCombat >= g.data.stats.regen.outOfCombatSeconds
							? 1
							: g.data.stats.regen.inCombatHpMultiplier),
			);
 }
		if (
			p.castRemaining > 0 ||
			p.statuses.some((s) => s.id === "stun" || s.id === "knockup")
		) {
			p.moving = false;
			return;
		}
		let ix = input.x,
			iz = input.z;
		if (Math.hypot(ix, iz) > 0.05) {
			setAuto(g, false);
			g.target = null;
			g.destination = null;
		}
		if (p.auto) {
			const direction = autoStep(g, dt);
			ix = direction.x;
			iz = direction.z;
		}
		const target = g.enemies.find((e) => e.id === g.target && !e.dead);
		if (!p.auto && target) {
			const dx = target.x - p.x,
				dz = target.z - p.z,
				d = Math.hypot(dx, dz);
			if (d > (target.boss ? 2 : 1.4)) {
				ix = dx / d;
				iz = dz / d;
			} else {
				ix = iz = 0;
				action(g, "attack");
			}
		} else if (!p.auto && g.destination) {
			const dx = g.destination.x - p.x,
				dz = g.destination.z - p.z,
				d = Math.hypot(dx, dz);
			if (d > 0.15) {
				ix = dx / d;
				iz = dz / d;
			} else g.destination = null;
		}
		if (p.dash > 0) {
			const t = Math.min(dt, p.dash);
			move(p, p.fx * 14 * t, p.fz * 14 * t);
			p.dash = Math.max(0, p.dash - dt);
			p.moving = true;
		} else {
			const d = Math.hypot(ix, iz);
			p.moving = d > 0.05;
			if (p.moving) {
				ix /= Math.max(1, d);
				iz /= Math.max(1, d);
				p.fx = ix;
				p.fz = iz;
				const speed =
					(p.auto && p.autoState === "idle" ? 1.8 : p.attack > 0 ? 1.6 : 4.5) *
					p.stats.moveSpeed * (1+Math.max(0,...p.statuses.filter(s=>s.id==='speed').map(s=>s.value))) *
					(1 -
						Math.max(
							0,
							...p.statuses.filter((s) => s.id === "slow").map((s) => s.value),
						));
				move(p, ix * speed * dt, iz * speed * dt);
			}
		}
	}
}
export function step(
	g: Game,
	dt: number,
	input: Vec = { x: 0, z: 0 },
	inputs?: Map<string, Vec>,
) {
		g.time += dt;
	activeMap = g.mapId;
	const previous = g.p;
	for (const p of g.players.values()) {
		g.p = p;
                if(p.dead||!isField(g.mapId))p.whirlwindHits=[];
        const due=(p.whirlwindHits??[]).filter(h=>h.due<=g.time+1e-9);p.whirlwindHits=(p.whirlwindHits??[]).filter(h=>h.due>g.time+1e-9);
        for(const h of due){const enemy=g.enemies.find(e=>e.id===h.id&&!e.dead);if(enemy)hit(g,enemy,resolveSkill(g.data,'whirlwind',p.skills.whirlwind||1),false,h);}
		playerStep(
			g,
			dt,
			inputs?.get(p.id) || (p === previous ? input : { x: 0, z: 0 }),
		);
	}
	if(g.mapId === "city_plaza"){g.p=previous;return;}
	for (const e of [...g.enemies]) {
		tickEffects(e, dt);
		const forced = e.statuses.find((s) => s.id === "taunt");
		const taunter = forced ? g.players.get(forced.sourceId) : undefined;
		const nearest =
			taunter && !taunter.dead
				? taunter
				: [...g.players.values()]
						.filter((p) => !p.dead)
						.sort(
							(a, b) =>
								Math.hypot(a.x - e.x, a.z - e.z) -
								Math.hypot(b.x - e.x, b.z - e.z),
						)[0];
		if (nearest) g.p = nearest;
		const p = g.p;
		e.hurt = Math.max(0, e.hurt - dt);
		e.cooldown = Math.max(0, e.cooldown - dt);
		e.aggro = Math.max(0, e.aggro - dt);
		e.vx = e.vz = 0;
		e.moving = false;
		if (e.dead) {
			e.deathAge += dt;
			e.motionTime = e.deathAge;
			e.respawn -= dt;
			if (e.deathAge >= duration(e, "death")) reward(g, e);
			if (e.respawn <= 0 && !e.summoned) {
				e.dead = false;
				e.hp = e.maxHp;
				e.x = e.homeX;
				e.z = e.homeZ;
				e.aggro = 0;
				e.windup = 0;
				e.rewarded = false;
				e.deathAge = 0;
								e.damageBy = {};e.bossPhase=1;e.engaged=false;
				setMotion(e, "idle");
				if (e.boss) emit(g, "boss");
			}
			continue;
		}
        if(e.boss&&Object.keys(e.damageBy).length&&(g.time-(e.lastEngagedAt??g.time)>=30||!Object.keys(e.damageBy).some(id=>{const p=g.players.get(id);return p&&!p.dead;}))){e.hp=e.maxHp;e.damageBy={};e.engaged=false;e.bossPhase=1;e.statuses=[];e.x=e.homeX;e.z=e.homeZ;setMotion(e,'idle');}
		if (!nearest) {
			e.windup = 0;
			setMotion(e, "idle");
			continue;
		}
		const x = e.x,
			z = e.z;
		e.motionTime +=
			dt * (e.boss && e.bossPhase === 2 && e.motion !== "transform" ? 1.3 : 1);
		if (e.statuses.some((s) => s.id === "stun" || s.id === "knockup")) continue;
		if (e.boss) kingStep(g, e, dt);
		else slimeStep(g, e, dt);
		e.vx = (e.x - x) / dt;
		e.vz = (e.z - z) / dt;
		e.moving = Math.hypot(e.vx, e.vz) > 0.01;
		if (e.moving) {
			const v = Math.hypot(e.vx, e.vz);
			e.fx = e.vx / v;
			e.fz = e.vz / v;
		}
	}
	for (let i = g.projectiles.length - 1; i >= 0; i--) {
		const projectile = g.projectiles[i];
		projectile.life -= dt;
		projectile.x += projectile.vx * dt;
		projectile.z += projectile.vz * dt;
		for (const p of g.players.values())
			if (
				!p.dead &&
				Math.hypot(p.x - projectile.x, p.z - projectile.z) < 0.55
			) {
				g.p = p;
				if (projectile.attack === "bolt") hurt(g, Math.max(1, Math.round(projectile.damage * (1 - Math.min(0.5, (p.stats.softMdef ?? 0) / 200)))));
				else hurt(
					g,
					projectile.damage,
					g.enemies.find((e) => e.id === projectile.owner),
					projectile.attack as MonsterMotion,
				);
				projectile.life = 0;
				break;
			}
		if (projectile.life <= 0 || !walk(projectile.x, projectile.z, 0.05))
			g.projectiles.splice(i, 1);
	}
	for (let i = g.meteors.length - 1; i >= 0; i--) {
		const m = g.meteors[i];
		m.time -= dt;
		if (m.time <= 1e-8) {
			const owner = g.players.get(m.ownerId);
			if (owner) {
				g.p = owner;
				if (owner.dead) {
					g.meteors.splice(i, 1);
					continue;
				}
				emit(g, "skillImpact", {
					x: m.x,
					z: m.z,
					skillId: m.skillId || "meteor",
				});
				const skill = resolveSkill(g.data, m.skillId || "meteor", m.level || 1);
				for (const e of [...g.enemies])
					if (!e.dead && Math.hypot(e.x - m.x, e.z - m.z) < skill.radius)
						hit(g, e, skill);
			}
			g.meteors.splice(i, 1);
		}
	}
 for (const d of [...g.drops]) {
  d.time+=dt;if(d.time>=60&&!d.pending){g.drops=g.drops.filter(v=>v!==d);continue;}if(d.pending||d.blocked)continue;
  const candidates=[...g.players.values()].filter(p=>!p.dead&&(!d.boss||g.wallTime>=bossReadyAt(p,d.bossId??'king_jelly'))&&(p.id===d.ownerId||d.time>=g.data.economy.lootOwnershipSeconds)&&(!p.auto||p.id===d.ownerId)&&(!p.auto||p.inventory?.autoPickup!==false)).sort((a,b)=>Math.hypot(a.x-d.x,a.z-d.z)-Math.hypot(b.x-d.x,b.z-d.z));
  const p=candidates[0];if(!p)continue;g.p=p;
  const dx=p.x-d.x,dz=p.z-d.z,dist=Math.hypot(dx,dz);
  if(dist<4&&d.time>.25){const speed=Math.min(dist,dt*9);d.x+=dx/(dist||1)*speed;d.z+=dz/(dist||1)*speed;}
  if(dist<.45){
   const done=()=>{const before=g.p;
								for (const share of expShares(g, p, d.xp, d.jobExp || 0))
					grantExp(g, share.player, share.xp, share.jobExp, { gold: share.player === p ? d.gold : 0, shared: share.shared });
				g.p = p;
        if(d.boss)setBossCooldown(p,d.bossId??'king_jelly',g.wallTime+600000);g.drops=g.drops.filter(drop=>drop!==d);g.p=before;
   };
   if(g.inventoryCommit){
    if(d.blocked)continue;
    d.pending=true;g.inventoryCommit(p,{op:'pickup',id:String(d.id),gold:d.gold,loot:d.loot??[]},done);
   }else if(p.inventory){try{const out=applyInventory({gold:p.gold,inventory:p.inventory},{op:'pickup',gold:d.gold,loot:d.loot??[]},p.profile,g.data,()=>String(g.nextId++));p.gold=out.state.gold;p.inventory=out.state.inventory;refreshStats(g,p);done();}catch{d.noticeAt=g.time;d.blocked=true;}}
   else{p.gold+=d.gold;done();}
  }
 }

	for(const p of g.players.values())if(p.dead)p.reviveRemaining=Math.max(0,(p.reviveRemaining??0)-dt);
	g.p = previous;
	g.enemies = g.enemies.filter((e) => !e.summoned || !e.dead || e.deathAge < 3);
}

/** Wall-clock cooldown survives room changes, reconnects and server restarts. */
export function healerHeal(g: Game, now: number) {
 const p=g.p;
 if(g.mapId!=='city_plaza'||p.dead||Math.hypot(p.x-HEALER.x,p.z-HEALER.z)>3) return false;
 if(now<p.healerReadyAt){emit(g,'notice',{text:`พักก่อน อีก ${Math.ceil((p.healerReadyAt-now)/1000)} วินาที`});return false;}
 const amount=p.maxHp-p.hp;p.hp=p.maxHp;p.mp=p.maxMp;p.healerReadyAt=now+60000;
 emit(g,'heal',{amount});emit(g,'notice',{text:'ฟื้น HP / SP เต็มแล้ว'});return true;
}
