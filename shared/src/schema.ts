import { z } from "zod";
export const StatSchema = z.enum(["str", "agi", "vit", "int", "dex", "luk"]);
export const ElementSchema = z.enum([
	"neutral",
	"fire",
	"water",
	"wind",
	"earth",
	"holy",
	"dark",
	"ghost",
]);
export const SizeSchema = z.enum(["small", "medium", "large"]);
export const WeaponSchema = z.enum([
	"dagger",
	"mace",
	"sword1h",
	"sword2h",
	"axe",
	"spear",
	"bow",
	"staff",
	"unarmed",
]);
export const MonsterRaceSchema = z.enum([
	"formless",
	"undead",
	"brute",
	"plant",
	"insect",
	"fish",
	"demon",
	"demihuman",
	"angel",
	"dragon",
]);
export const RealmSchema = z.enum([
	"deva",
	"manussa",
	"asura",
	"preta",
	"ghost",
	"house_spirit",
	"naga",
	"water_spirit",
	"forest_spirit",
	"mythic_beast",
	"sage",
	"naraka",
]);
export const StatusIdSchema = z.enum([
	"stun",
	"slow",
	"poison",
	"burn",
	"freeze",
	"silence",
	"blind",
	"sleep",
	"curse",
	"fear",
]);
const number = z.number().finite(),
	positive = number.positive(),
	nonnegative = number.nonnegative(),
	fraction = number.min(0).max(1);
const id = z.string().min(1),
	version = { dataVersion: z.literal(1) };
export const BaseStatsSchema = z.record(StatSchema, number);
const statDelta = z.partialRecord(StatSchema, number);
export const DerivedKeySchema = z.enum([
	"maxHp",
	"maxSp",
	"atk",
	"matk",
	"hardDef",
	"hardMdef",
	"softDef",
	"softMdef",
	"hit",
	"flee",
	"crit",
	"critShield",
	"aspd",
	"castMul",
	"moveSpeed",
	"weight",
	"hpRegen",
	"spRegen",
]);
export const ModifierSchema = z.discriminatedUnion("kind", [
	z
		.object({ kind: z.literal("stat"), stat: StatSchema, value: number })
		.strict(),
	z
		.object({
			kind: z.enum(["flat", "percent"]),
			stat: DerivedKeySchema,
			value: number,
		})
		.strict(),
	z
		.object({
			kind: z.enum(["raceBonus", "raceResist"]),
			target: MonsterRaceSchema,
			value: number,
		})
		.strict(),
	z
		.object({
			kind: z.enum(["elementBonus", "elementResist"]),
			target: ElementSchema,
			value: number,
		})
		.strict(),
	z
		.object({ kind: z.literal("sizeBonus"), target: SizeSchema, value: number })
		.strict(),
	z
		.object({
			kind: z.literal("statusResist"),
			target: StatusIdSchema,
			value: number,
		})
		.strict(),
	z
		.object({
			kind: z.enum(["armourElement", "weaponElement"]),
			element: ElementSchema,
		})
		.strict(),
	z.object({ kind: z.literal("ignoreSize"), value: z.boolean() }).strict(),
]);
export const CharacterSchema = z
	.object({
		race: id,
		classId: id,
		level: z.number().int().min(1).max(99),
		baseStats: BaseStatsSchema,
		equipment: z.array(id),
		cards: z.array(id).default([]),
		modifiers: z.array(ModifierSchema).default([]),
		starterGrant: z.boolean().default(false),
		skills: z.record(z.string(), z.number().int().min(0).max(10)).default({}),
	})
	.strict();
export const StatsSchema = z
	.object({
		...version,
		baseStats: z.array(StatSchema).length(6),
		start: z.literal(1),
		pointsPerLevel: z.literal(3),
		maxStat: z.literal(99),
		maxLevel: z.literal(99),
		statResetFree: z.boolean(),
		regen: z
			.object({
				spBase: nonnegative,
				spInt: nonnegative,
				spMax: nonnegative,
				hpBase: nonnegative,
				hpVit: nonnegative,
				hpMax: nonnegative,
				outOfCombatSeconds: nonnegative,
				inCombatHpMultiplier: fraction,
				sittingMultiplier: positive,
			})
			.strict(),
		pointCosts: z
			.array(
				z
					.object({
						min: positive.int(),
						max: positive.int(),
						cost: positive.int(),
					})
					.strict(),
			)
			.length(10),
		expToNext: z.array(positive.int()).length(99),
		caps: z
			.object({
				maxDefReduction: fraction,
				maxCrit: fraction,
				hitChance: z.tuple([fraction, fraction]),
				pvpMinHit: fraction,
				maxCastReduction: fraction,
				maxMoveSpeed: positive,
				maxResist: fraction,
				maxElementResist: fraction,
				maxDamageReductionTotal: fraction,
				maxBonusPerCategory: nonnegative,
			})
			.strict(),
		defaultBuild: CharacterSchema,
	})
	.strict();
export const ElementsSchema = z
	.object({
		...version,
		names: z.record(ElementSchema, id),
		table: z.record(
			ElementSchema,
			z.record(ElementSchema, number.min(50).max(150)),
		),
	})
	.strict();
export const RacesSchema = z
	.object({
		...version,
		players: z
			.array(
				z
					.object({
						id,
						nameTh: id,
						bonus: statDelta,
						element: ElementSchema,
						size: SizeSchema,
						monsterRace: z.literal("demihuman"),
						passives: z
							.object({
								exp: fraction.optional(),
								weight: nonnegative.optional(),
								stunResist: fraction.optional(),
								spRegen: fraction.optional(),
								noShallowSlow: z.boolean().optional(),
								moveSpeed: number.optional(),
								drop: fraction.optional(),
								critShield: fraction.optional(),
								darkDamage: fraction.optional(),
								healReceived: number.optional(),
							})
							.strict(),
					})
					.strict(),
			)
			.length(6),
		monsterRaces: z.record(MonsterRaceSchema, id),
		realms: z.record(RealmSchema, id),
		sizeTable: z.record(
			WeaponSchema,
			z.record(SizeSchema, number.min(75).max(100)),
		),
	})
	.strict();
export const ClassesSchema = z
	.object({
		...version,
		classes: z
			.array(
				z
					.object({
						id,
						nameTh: id,
						hpMul: positive,
						spMul: positive,
						weapons: z.array(WeaponSchema).min(1),
						preset: BaseStatsSchema,
					})
					.strict(),
			)
			.min(1),
	})
	.strict();
export const SkillSchema = z
	.object({
		id,
		jobId: id,
		maxLevel: positive.int().max(10),
		requires: z.array(z.object({ id, level: positive.int().max(10) }).strict()),
		passive: z.boolean(),
		values: z.record(z.string(), z.array(nonnegative)).default({}),
		hits: positive.int().max(10).default(1),
		effect: z.enum(["dash", "knockup", "taunt", "endure", "heal"]).optional(),
		duration: nonnegative.optional(),
		pvpDurationMul: fraction.optional(),
		pvpEffect: z
			.object({ id: z.literal("slow"), duration: positive, value: fraction })
			.strict()
			.optional(),
		nameTh: id,
		percent: nonnegative,
		comboThirdPercent: nonnegative.optional(),
		element: z.union([ElementSchema, z.literal("weapon")]),
		type: z.enum(["physical", "magic", "heal"]),
		kind: z.enum(["basic", "single", "area", "dot", "utility"]),
		sp: nonnegative,
		cooldown: nonnegative,
		cast: nonnegative,
		range: nonnegative,
		radius: nonnegative,
		status: z
			.object({ id: StatusIdSchema, chance: fraction })
			.strict()
			.optional(),
		pvpMul: fraction.optional(),
		ignoreSize: z.boolean().optional(),
		icon: z.number().int().min(0).max(11),
		heal: z
			.object({ flat: nonnegative, vitPercent: nonnegative })
			.strict()
			.optional(),
	})
	.strict();
export const SkillsSchema = z
	.object({ ...version, skills: z.array(SkillSchema).min(1) })
	.strict();
export const MonsterSchema = z
	.object({
		id,
		nameTh: id,
		level: positive.int().max(99),
		hp: positive,
		sp: nonnegative,
		atk: nonnegative,
		matk: nonnegative,
		hardDef: nonnegative,
		softDef: nonnegative,
		hardMdef: nonnegative,
		softMdef: nonnegative,
		hit: nonnegative,
		flee: nonnegative,
		element: ElementSchema,
		race: MonsterRaceSchema,
		size: SizeSchema,
		realm: RealmSchema,
		tags: z.array(id),
		weakness: z.array(ElementSchema),
		boss: z.boolean(),
		skills: z.array(id),
		exp: nonnegative,
		jobExp: nonnegative,
		gold: z
			.tuple([nonnegative, nonnegative])
			.refine(([a, b]) => a <= b, "minimum exceeds maximum"),
		drops: z.array(z.object({ itemId: id, chance: fraction }).strict()),
		attacks: z
			.record(
				z.enum(["slam", "sweep", "charge", "spit"]),
				z.object({ percent: nonnegative, phase2Percent: nonnegative }).strict(),
			)
			.optional(),
		phase2: z
			.object({ atk: nonnegative, element: ElementSchema })
			.strict()
			.optional(),
	})
	.strict();
export const MonstersSchema = z
	.object({ ...version, monsters: z.array(MonsterSchema).min(1) })
	.strict();
export const StatusSchema = z
	.object({
		...version,
		statuses: z
			.array(
				z
					.object({
						id: StatusIdSchema,
						seconds: positive,
						resist: z.partialRecord(
							z.union([StatSchema, ElementSchema]),
							nonnegative,
						),
						effects: z
							.object({
								noMove: z.boolean().optional(),
								noSkill: z.boolean().optional(),
								moveSpeed: number.optional(),
								aspd: number.optional(),
								hpPerSecond: number.optional(),
								hardDef: number.optional(),
								fireResist: number.optional(),
								fireTaken: positive.optional(),
								waterTaken: positive.optional(),
								hit: number.optional(),
								wakeOnHit: z.boolean().optional(),
								firstHit: positive.optional(),
								atk: number.optional(),
								matk: number.optional(),
								critShield: nonnegative.optional(),
								randomFlee: z.boolean().optional(),
								ghostOnly: z.boolean().optional(),
							})
							.strict(),
					})
					.strict(),
			)
			.length(10),
		bossImmune: z.array(StatusIdSchema),
		stacking: z.literal("refresh"),
	})
	.strict();
export const PvpSchema = z
	.object({
		...version,
		kind: z.record(
			z.enum(["basic", "single", "area", "dot", "utility"]),
			fraction,
		),
		modes: z.record(
			z.enum(["duel", "freepk", "arena", "gvg"]),
			z
				.object({
					reduction: fraction,
					potions: z.boolean(),
					equalizeLevel: positive.int().nullable(),
					gear: z.enum(["standard", "equipped"]),
					minLevel: positive.int(),
				})
				.strict(),
		),
		cc: z
			.object({ window: positive, multipliers: z.array(fraction).length(4) })
			.strict(),
		heal: z.object({ window: positive, reduction: fraction }).strict(),
		potionCooldownMul: positive,
		honor: z
			.object({
				winMin: nonnegative,
				winMax: nonnegative,
				loss: number,
				repeatVictimWindow: positive,
				repeatVictimReward: z.literal(0),
				winRule: z.literal("levelGap"),
			})
			.strict(),
		karma: z
			.object({
				redNameSecondsPerKill: positive,
				redDeathItemDrops: nonnegative.int(),
				mode: z.literal("freepk"),
				requiresNonRetaliating: z.literal(true),
			})
			.strict(),
	})
	.strict();
export const ItemsSchema = z
	.object({
		...version,
		items: z
			.array(
				z
					.object({
						id,
						nameTh: id,
						type: z.enum(["weapon", "armour"]),
						weaponType: WeaponSchema.optional(),
						level: positive.int(),
						atk: nonnegative.optional(),
						matk: nonnegative.optional(),
						interval: positive.optional(),
						slots: nonnegative.int(),
						modifiers: z.array(ModifierSchema),
					})
					.strict(),
			)
			.min(1),
	})
	.strict();
export const CardsSchema = z
	.object({
		...version,
		cards: z
			.array(
				z
					.object({
						id,
						slot: z.enum(["weapon", "armour"]),
						modifiers: z.array(ModifierSchema),
					})
					.strict(),
			)
			.min(1),
	})
	.strict();
export const JobsSchema = z
	.object({
		...version,
		jobs: z.array(
			z
				.object({
					id,
					nameTh: id,
					tier: z.number().int().min(0).max(2),
					maxLevel: positive.int().max(70),
					parent: id.nullable(),
					available: z.boolean(),
				})
				.strict(),
		),
		angel: z.object({ x: number, z: number, range: positive }).strict(),
		expToNext: z
			.object({
				villager: z.array(positive).length(9),
				tier1: z.array(positive).length(49),
				tier2: z.array(positive).length(69),
			})
			.strict(),
	})
	.strict();
export const schemas = {
	jobs: JobsSchema,
	stats: StatsSchema,
	elements: ElementsSchema,
	races: RacesSchema,
	classes: ClassesSchema,
	skills: SkillsSchema,
	monsters: MonstersSchema,
	status: StatusSchema,
	pvp: PvpSchema,
	items: ItemsSchema,
	cards: CardsSchema,
};
export type GameData = {
	[K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>;
};
export type Stat = z.infer<typeof StatSchema>;
export type Element = z.infer<typeof ElementSchema>;
export type Size = z.infer<typeof SizeSchema>;
export type Weapon = z.infer<typeof WeaponSchema>;
export type MonsterRace = z.infer<typeof MonsterRaceSchema>;
export type StatusId = z.infer<typeof StatusIdSchema>;
export type CharacterInput = z.input<typeof CharacterSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Modifier = z.infer<typeof ModifierSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Monster = z.infer<typeof MonsterSchema>;
