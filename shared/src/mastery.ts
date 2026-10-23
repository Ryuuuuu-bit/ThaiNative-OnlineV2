import { z } from "zod";
import catalogDefinitions from "../data/mastery.json" with { type: "json" };
import type { Weapon, GameData, Skill } from "./schema.js";
import type { JobProgress } from "./jobs.js";

export const MASTERY_SCHOOLS = ["Swordsman", "Archer", "Mage", "Healer", "Summoner", "Assassin", "Boxer"] as const;
export const MasterySchoolSchema = z.enum(MASTERY_SCHOOLS);
export type MasterySchool = z.infer<typeof MasterySchoolSchema>;
const id = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const amount = z.number().finite().nonnegative();
const mastery = amount.int().max(100);
export const MasteryLevelsSchema = z.record(MasterySchoolSchema, mastery);
const emptyMasteries = () => Object.fromEntries(MASTERY_SCHOOLS.map(s => [s, 0])) as Record<MasterySchool, number>;
export const MasteryExperienceSchema = z.record(MasterySchoolSchema, amount.int().max(Number.MAX_SAFE_INTEGER));
const rank = z.number().int().min(1).max(10);
const weapon = z.enum(["any", "sword", "bow", "dagger", "unarmed"]);
const ranks = z.object({
 rank, mastery, mp: amount, cooldown: amount, cast: amount,
 params: z.record(z.string().min(1).max(40), amount), effect: z.string().min(1),
}).strict();
const skill = z.object({
 id, nameTh: z.string().min(1), school: MasterySchoolSchema,
 branch: id, passive: z.boolean(), maxRank: rank,
 requires: z.array(z.object({id, rank}).strict()), weapon,
 triggerEligible: z.boolean(), autoEvent: z.enum(["hp", "incoming", "skills"]).optional(),
 autoNote: z.string(), note: z.string(), range: amount, targets: z.number().int().positive(),
 ranks: z.array(ranks).min(1).max(10), autoRanks: z.array(ranks).max(3),
}).strict();
const mix = z.object({
 id: z.string().regex(/^M\d{2}$/), nameTh: z.string().min(1),
 masteries: z.partialRecord(MasterySchoolSchema, mastery), requires: z.record(id, rank), weapon,
 event: z.string().min(1), effect: z.string().min(1), trade: z.string().min(1),
 mp: amount, icd: z.number().finite().positive(), window: amount,
 kind: z.enum(["frostBlade", "frontlineTriage", "tauntBond", "venomRiposte", "shatterArrow", "venomTrap", "commandArrow", "retreatMedicine", "pulseSpell", "elementBond", "veilDagger", "sealedForce", "guardianThread", "venomMedicine", "mercyCombo", "petRetreat"]),
 pathRanks: z.record(id, rank), minPoints: z.number().int().positive(),
}).strict();
export const MasteryCatalogSchema = z.object({
 dataVersion: z.literal(1), revision: z.string().min(1),
 skills: z.array(skill).min(1), mixes: z.array(mix),
}).strict().superRefine((data, ctx) => {
 const problem = (path: (string | number)[], message: string) => ctx.addIssue({code: "custom", path, message});
 const byId = new Map(data.skills.map(s => [s.id, s]));
 if (byId.size !== data.skills.length) problem(["skills"], "duplicate id");
 if (new Set(data.mixes.map(m => m.id)).size !== data.mixes.length) problem(["mixes"], "duplicate id");
 for (const [i, s] of data.skills.entries()) {
  if (s.ranks.length !== s.maxRank) problem(["skills", i, "ranks"], "rank count must match maxRank");
  if (s.autoRanks.length !== (s.triggerEligible ? 3 : 0) || (s.passive && s.triggerEligible)) problem(["skills", i, "autoRanks"], "only eligible active skills have three Auto Spell ranks");
  for (const key of ["ranks", "autoRanks"] as const) for (const [j, r] of s[key].entries()) {
   if (r.rank !== j + 1) problem(["skills", i, key, j, "rank"], "ranks must be sequential");
   if (j && r.mastery < s[key][j - 1].mastery) problem(["skills", i, key, j, "mastery"], "Mastery cannot decrease with rank");
  }
  const seen = new Set<string>();
  for (const [j, req] of s.requires.entries()) {
   if (!byId.has(req.id) || req.rank > byId.get(req.id)!.maxRank || seen.has(req.id)) problem(["skills", i, "requires", j], "invalid or duplicate prerequisite");
   seen.add(req.id);
  }
 }
 const visited = new Set<string>(), visiting = new Set<string>();
 function visit(id: string) {
  if (visiting.has(id)) { problem(["skills"], "prerequisite cycle at " + id); return; }
  if (visited.has(id)) return;
  visiting.add(id);
  for (const r of byId.get(id)?.requires ?? []) visit(r.id);
  visiting.delete(id); visited.add(id);
 }
 for (const s of data.skills) visit(s.id);
 for (const [i, m] of data.mixes.entries()) {
  if (!Object.keys(m.masteries).length || !Object.keys(m.requires).length) problem(["mixes", i], "Mastery and skill requirements are required");
  for (const key of ["requires", "pathRanks"] as const) for (const [id, rank] of Object.entries(m[key])) {
   if (!byId.has(id) || rank > byId.get(id)!.maxRank) problem(["mixes", i, key, id], "invalid skill rank");
  }
  const needed = new Map<string, number>();
  function collect(id: string, rank: number) {
   if (!byId.has(id) || (needed.get(id) ?? 0) >= rank) return;
   needed.set(id, rank);
   for (const r of byId.get(id)!.requires) collect(r.id, r.rank);
  }
  for (const [id, rank] of Object.entries(m.requires)) collect(id, rank);
  if (needed.size !== Object.keys(m.pathRanks).length || [...needed].some(([id, rank]) => m.pathRanks[id] !== rank)) problem(["mixes", i, "pathRanks"], "must include exactly the paid prerequisite ranks");
  if ([...needed.values()].reduce((sum, rank) => sum + rank, 0) !== m.minPoints) problem(["mixes", i, "minPoints"], "must equal prerequisite point cost");
 }
});
export type MasteryCatalog = z.infer<typeof MasteryCatalogSchema>;
export type MasterySkill = MasteryCatalog["skills"][number];
export const ADVANCED_MASTERY_ACTIONS=[
 'archer_05','archer_06','archer_10','archer_11','archer_12','archer_13','archer_16','archer_17','archer_18','archer_19',
 'mage_05','mage_06','mage_10','mage_11','mage_12','mage_13','mage_16','mage_17','mage_18','mage_19',
 'healer_05','healer_06','healer_10','healer_11','healer_12','healer_13','healer_16','healer_17','healer_18','healer_19',
 'shaman_05','shaman_06','shaman_10','shaman_11','shaman_12','shaman_13','shaman_16','shaman_17','shaman_18','shaman_19',
 'rogue_05','rogue_06','rogue_10','rogue_11','rogue_12','rogue_13','rogue_16','rogue_17','rogue_18','rogue_19',
 'boxer_05','boxer_06','boxer_12','boxer_13','boxer_16','boxer_17','boxer_18','boxer_19',
] as const;
/** Only skills with complete authoritative action handlers enter the live action path. */
export const MASTERY_ACTIONS = ["mage_01", "healer_01", "archer_01", "rogue_01", "boxer_01", "shaman_01", "mage_02", "healer_02", "archer_02", "rogue_02", "boxer_02", "shaman_02", "mage_03", "healer_03", "archer_03", "rogue_03", "shaman_03", "boxer_03", "boxer_10", "boxer_11", "archer_04", "mage_04", "shaman_04", "healer_04", "rogue_04", "boxer_04", ...ADVANCED_MASTERY_ACTIONS] as const;
export type MasteryAction = typeof MASTERY_ACTIONS[number];
export const isMasteryAction = (id: string): id is MasteryAction => (MASTERY_ACTIONS as readonly string[]).includes(id);
export const MASTERY_PASSIVES = ['archer_07','archer_08','archer_09','archer_14','archer_15','archer_20','archer_21','mage_07','mage_08','mage_09','mage_14','mage_15','mage_20','mage_21','healer_07','healer_08','healer_09','healer_14','healer_15','healer_20','healer_21','shaman_07','shaman_08','shaman_09','shaman_14','shaman_15','shaman_20','shaman_21','rogue_07','rogue_08','rogue_09','rogue_14','rogue_15','rogue_20','rogue_21','boxer_07','boxer_08','boxer_09','boxer_14','boxer_15','boxer_20','boxer_21'] as const;
export type MasteryPassive=typeof MASTERY_PASSIVES[number];
export const isMasteryPassive=(id:string):id is MasteryPassive=>(MASTERY_PASSIVES as readonly string[]).includes(id);
export function masteryPassiveValue(data:Pick<GameData,'mastery'>,p:{skills:Record<string,number>;masteries?:MasteryProgress['masteries']},held:Weapon,id:MasteryPassive,key:string):number{
 if(id==='rogue_07'&&held!=='dagger')return 0;
 if(masteryUseLock({...p,masteries:p.masteries??emptyMasteries(),skillPoints:0},id,held,data.mastery))return 0;
 return data.mastery.skills.find(s=>s.id===id)!.ranks[p.skills[id]-1].params[key]??0;
}
export function resolveMasteryAction(data: GameData, id: MasteryAction|MasteryPassive, level = 1): Skill {
 const s = data.mastery.skills.find(s => s.id === id)!;
 const r = s.ranks[Math.max(0, Math.min(s.maxRank - 1, level - 1))];
 const heal=id.startsWith('healer_')&&r.params.heal!==undefined,magic=!!r.params.magic||id==='mage_01'||id==='mage_03'||id==='mage_04'||id==='shaman_02';
 const utility=heal||(!r.params.damage&&!r.params.petBurst);
 const area=['mage_03','mage_10','mage_12','mage_16','shaman_16','shaman_19','archer_17','boxer_12'].includes(id);
 return {
  id, nameTh: s.nameTh, jobId: "common", passive: s.passive, maxLevel: s.maxRank,
  requires: s.requires.map(r => ({id: r.id, level: r.rank})),
  values: {...Object.fromEntries(Object.keys(r.params).map(key=>[key,s.ranks.map(r=>r.params[key]??0)])),percent: s.ranks.map(r => r.params.damage ?? r.params.petBurst ?? r.params.heal ?? 0), sp: s.ranks.map(r => r.mp)},
  hits: r.params.hits ?? 1, ...(['archer_01','boxer_13'].includes(id) ? {hitInterval: .18} : {}),
  percent: r.params.damage ?? r.params.petBurst ?? r.params.heal ?? 0, sp: r.mp, cooldown: r.cooldown, cast: r.cast,
  range: s.range, radius: area ? (id==='boxer_12'?s.range:2.5) : 0, type: heal ? "heal" : magic ? "magic" : "physical", kind: utility ? "utility" : area ? "area" : "single",
  element: heal ? "holy" : ["mage_04","mage_16"].includes(id) ? "water" : ["mage_01","mage_03","mage_10","mage_12"].includes(id) ? "fire" : id === "mage_11" ? "wind"  : magic ? "neutral" : "weapon", ...(heal ? {effect: "heal" as const} : id === "mage_04" ? {effect: "slow" as const, duration: r.params.duration} : id === "boxer_10" ? {effect: "stun" as const, duration: r.params.stun} : id === "mage_01" ? {visual: "fire_bolt"} : {}),
  // shortcut: existing fire/potion/slash icon cells are temporary until each root skill passes art review.
  icon: heal || id === "healer_02" ? 4 : data.skills.skills.find(s => s.id === (magic ? "fire_bolt" : "slash"))!.icon,
 };
}
export const MasteryStateSchema = z.object({masteryVersion: z.literal(1), masteries: MasteryLevelsSchema, masteryExp: MasteryExperienceSchema.default(emptyMasteries)}).strict();
export type MasteryState = z.infer<typeof MasteryStateSchema>;
const migrationCatalog = MasteryCatalogSchema.parse(catalogDefinitions);

/** Grant only the Mastery needed by saved ranks, once; never change skills, points or the bar. */
export function normalizeMastery(p: {skills?: Record<string, number>; masteries?: unknown; masteryExp?: unknown; masteryVersion?: number}, data: MasteryCatalog = migrationCatalog): MasteryState {
 const version = p.masteryVersion ?? 0;
 if (!Number.isInteger(version) || version < 0 || version > 1) throw Error("Mastery save version is unsupported");
 if (version === 1) return MasteryStateSchema.parse({masteryVersion: 1, masteries: p.masteries, masteryExp: p.masteryExp});
 const masteries = p.masteries === undefined
  ? emptyMasteries()
  : MasteryLevelsSchema.parse(p.masteries);
 for (const s of data.skills) {
  const rank = p.skills?.[s.id] ?? 0;
  if (!Number.isInteger(rank) || rank < 0 || rank > s.maxRank) throw Error("Invalid saved skill rank: " + s.id);
  if (rank) masteries[s.school] = Math.max(masteries[s.school], s.ranks[rank - 1].mastery);
 }
 return MasteryStateSchema.parse({masteryVersion: 1, masteries, masteryExp: p.masteryExp});
}

/** Training reuses the existing level EXP table; it never grants skill points or restores HP/MP. */
export function gainMasteryExp(p: MasteryState, school: MasterySchool, amount: number, data: Pick<GameData, "stats">): number {
 if (!Number.isSafeInteger(amount) || amount <= 0 || !MASTERY_SCHOOLS.includes(school)) return 0;
 const before = p.masteries[school];
 if (before >= 100) { p.masteryExp[school] = 0; return 0; }
 p.masteryExp[school] = Math.min(Number.MAX_SAFE_INTEGER, p.masteryExp[school] + amount);
 while (p.masteries[school] < 100 && p.masteryExp[school] >= data.stats.expToNext[p.masteries[school]]) {
  p.masteryExp[school] -= data.stats.expToNext[p.masteries[school]];
  p.masteries[school]++;
 }
 if (p.masteries[school] === 100) p.masteryExp[school] = 0;
 return p.masteries[school] - before;
}
export interface MasteryProgress extends Pick<JobProgress, "skills" | "skillPoints"> {
 masteries: Record<MasterySchool, number>;
}

export function masterySkillLock(p: MasteryProgress, id: string, data: MasteryCatalog): string | null {
 const s = data.skills.find(s => s.id === id), learned = p.skills[id] ?? 0;
 if (!s) return "ไม่พบสกิล";
 if (!Number.isInteger(learned) || learned < 0 || learned > s.maxRank) return "แรงค์สกิลไม่ถูกต้อง";
 if (learned === s.maxRank) return "ระดับสูงสุด";
 if ((p.masteries[s.school] ?? 0) < s.ranks[learned].mastery) return `ต้องมี ${s.school} Mastery ${s.ranks[learned].mastery}`;
 const missing = s.requires.find(r => (p.skills[r.id] ?? 0) < r.rank);
 if (missing) return `ต้องมี ${data.skills.find(s => s.id === missing.id)!.nameTh} R${missing.rank}`;
 if (!Number.isInteger(p.skillPoints) || p.skillPoints < 1) return "แต้มสกิลไม่พอ";
 return null;
}
export function learnMasterySkill<T extends MasteryProgress>(p: T, id: string, data: MasteryCatalog): T {
 const reason = masterySkillLock(p, id, data);
 if (reason) throw Error(reason);
 return {...p, skillPoints: p.skillPoints - 1, skills: {...p.skills, [id]: (p.skills[id] ?? 0) + 1}};
}
export function masteryWeaponMatches(required: MasterySkill["weapon"], held: Weapon): boolean {
 return required === "any" || (required === "sword" ? held === "sword1h" || held === "sword2h" : held === required);
}
export function masteryUseLock(p: MasteryProgress, id: string, held: Weapon, data: MasteryCatalog, legacySwordPath = false): string | null {
 const s = data.skills.find(s => s.id === id), learned = p.skills[id] ?? 0;
 if (!s) return "ไม่พบสกิล";
 if (!Number.isInteger(learned) || learned < 1 || learned > s.maxRank) return "ต้องเรียนสกิลก่อน";
 if ((p.masteries[s.school] ?? 0) < s.ranks[learned - 1].mastery) return "Mastery ไม่ถึงแรงค์ที่เรียน";
 // Existing Sword saves predate the new paths; retain purchased casts, while learning and Mix still require the full path.
 if (!(legacySwordPath && s.school === 'Swordsman') && s.requires.some(r => (p.skills[r.id] ?? 0) < r.rank)) return "สกิลทางผ่านไม่ครบ";
 return masteryWeaponMatches(s.weapon, held) ? null : "อาวุธไม่ตรง";
}
export function masteryTriggerSlots(masteries: MasteryProgress["masteries"]): number {
 const highest = Math.max(...MASTERY_SCHOOLS.map(s => masteries[s] ?? 0));
 return highest >= 75 ? 2 : highest >= 50 ? 1 : 0;
}
export function masteryAutoRank(p: MasteryProgress, id: string, data: MasteryCatalog): number {
 const s = data.skills.find(s => s.id === id), learned = p.skills[id] ?? 0;
 if (!s?.triggerEligible || !Number.isInteger(learned) || learned < 1 || learned > s.maxRank || (p.masteries[s.school] ?? 0) < s.ranks[learned - 1].mastery) return 0;
 return Math.min(learned, Math.max(0, ...s.autoRanks.filter(r => r.mastery <= (p.masteries[s.school] ?? 0)).map(r => r.rank)));
}
