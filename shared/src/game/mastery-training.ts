import { gainMasteryExp, masteryUseLock, type MasterySchool } from "../mastery.js";
import type { Skill, Monster, Weapon } from "../schema.js";
import type { Game, Enemy, Player } from "./sim.js";
import {removeWisp} from './summons.js';
import { monsterExpMultiplier } from "./progression.js";
const weaponSchools: Partial<Record<Weapon, MasterySchool>> = {sword1h: "Swordsman", sword2h: "Swordsman", bow: "Archer", dagger: "Assassin", staff: "Mage", unarmed: "Boxer"};
const wounds = new WeakMap<Player, {game: Game; remaining: Map<Enemy, number>}>();
export const clearMasteryWounds = (p: Player) => { wounds.delete(p); };

/** An encounter reset/defeat cannot leave wounds or support credit for its next life. */
export function clearMasteryEncounter(g: Game, e: Enemy) {
 e.masterySupport = undefined;e.masteryPoisons=undefined;
 for(const p of g.players.values()){p.statuses=p.statuses.filter(s=>s.id!=='archer_mark'||s.targetId!==e.id);if(p.wisp?.target===e.id)removeWisp(g,p,'encounter-end');if(p.summon?.command?.target===e.id)p.summon.command.target=null;}
 for (const p of g.players.values()) wounds.get(p)?.remaining.delete(e);
}

/** Called after actual HP loss, never for HP costs or unattributed environmental damage. */
export function recordMasteryWound(g: Game, p: Player, e: Enemy | undefined, loss: number) {
 if (!e || e.dead || e.summoned || !g.enemies.includes(e) || !Number.isFinite(loss) || loss <= 0) return;
 let state = wounds.get(p);
 if (!state || state.game !== g) { state = {game: g, remaining: new Map()}; wounds.set(p, state); }
 state.remaining.set(e, (state.remaining.get(e) ?? 0) + loss);
}

/** Effective support shares one encounter cap across all actors and schools. Never call for HP costs or procs. */
export function recordMasterySupport(g: Game, caster: Player, e: Enemy | undefined, skillId: string, amount: number) {
 if (!e || e.dead || e.summoned || !g.enemies.includes(e) || caster.dead || caster.mapId !== g.mapId ||
  g.players.get(caster.id) !== caster || !Number.isFinite(amount) || amount <= 0 ||
  masteryUseLock(caster,skillId,caster.stats.weaponType,g.data.mastery)) return;
 const school=g.data.mastery.skills.find(s=>s.id===skillId)!.school;
 const support=e.masterySupport??={};
 // One monster HP bar limits repeated absorption/recovery without creating additional EXP.
 const used=Object.values(support).reduce((n,schools)=>n+Object.values(schools).reduce((n,value)=>n+value,0),0);
 const credit=Math.min(amount,Math.max(0,e.maxHp-used));if(credit<=0)return;
 const schools=support[caster.id]??={};schools[school]=(schools[school]??0)+credit;
}

/** Every HP recovery consumes wounds, including potions, regeneration and secondary item heals. */
export function restoreMasteryHp(p: Player, amount: number, g?: Game, caster?: Player, skillId = "healer_01"): number {
 if (p.dead || !Number.isFinite(amount) || amount <= 0) return 0;
 const actual = Math.max(0, Math.min(amount, p.maxHp - p.hp));
 if (actual === 0) return 0;
 const state = wounds.get(p);
 let left = actual;
 if (state) for (const [e, pending] of state.remaining) {
  const healed = Math.min(left, pending);left -= healed;
  if (g && caster && state.game === g && !e.dead && !e.summoned && g.enemies.includes(e) &&
   p.mapId === g.mapId && caster.mapId === g.mapId && !caster.dead &&
   (caster === p || g.partyMembers?.(caster.id).includes(p.id)) &&
   !masteryUseLock(caster, skillId, caster.stats.weaponType, g.data.mastery)) {
   recordMasterySupport(g,caster,e,skillId,healed);
  }
  if (healed === pending) state.remaining.delete(e);else state.remaining.set(e, pending - healed);
  if (left <= 0) break;
 }
 if (state?.remaining.size === 0) wounds.delete(p);
 p.hp += actual;
 return actual;
}

/** Only confirmed HP loss counts; item procs, reflection, misses and idle party members get no credit. */
export function recordMasteryDamage(g: Game, e: Enemy, skill: Skill, damage: number) {
 if (g.p.dead || e.dead || !Number.isFinite(damage) || damage <= 0) return;
 const school = skill.id === "basic"
  ? weaponSchools[g.p.stats.weaponType]
  : g.data.mastery.skills.find(s => s.id === skill.id && !s.passive)?.school;
 if (!school) return;
 const credit = (e.masteryDamage ??= {})[g.p.id] ??= {};
 credit[school] = (credit[school] ?? 0) + Math.max(0, Math.min(damage, e.hp));
}

/** One monster has one training budget, split by actual contributions and the existing anti-carry rule. */
export function awardMasteryTraining(g: Game, e: Enemy, spec: Monster, ownerLevel: number) {
 if (e.hp > 0 || e.summoned) return [];
 const credits = e.masteryDamage ?? {}, support = e.masterySupport ?? {};
 e.masteryDamage = undefined;
 clearMasteryEncounter(g, e);
 const supportTotal = Object.values(support).reduce((n, schools) => n + Object.values(schools).reduce((n,value)=>n+value,0), 0);
 const total = Math.max(e.maxHp, Object.values(e.damageBy).reduce((n, damage) => n + damage, 0) + supportTotal);
 const levels: {playerId: string; school: MasterySchool; mastery: number; gained: number; exp: number}[] = [];
 if (total <= 0) return levels;
 // Keep damage capped by actual HP loss before adding support; one shared budget cannot multiply.
 for (const id of new Set([...Object.keys(credits), ...Object.keys(support)])) {
  const schools = {...credits[id]}, damage = Object.values(schools).reduce((n, value) => n + value, 0);
  const factor = damage > 0 ? Math.min(1, (e.damageBy[id] ?? 0) / damage) : 0;
  for (const school of Object.keys(schools) as MasterySchool[]) schools[school]! *= factor;
  for (const [school, amount] of Object.entries(support[id]??{}) as [MasterySchool,number][]) schools[school]=(schools[school]??0)+amount;
  credits[id] = schools;
 }
 for (const [id, schools] of Object.entries(credits)) {
  const p = g.players.get(id);
  if (!p || p.dead || p.mapId !== g.mapId || Math.hypot(p.x - e.x, p.z - e.z) > 24) continue;
  const factor = Math.min(monsterExpMultiplier(p.level, spec.level), monsterExpMultiplier(ownerLevel, spec.level));
  const credited = Object.values(schools).reduce((n, damage) => n + damage, 0);
  if (credited <= 0) continue;
  const budget = spec.jobExp * credited / total * factor;
  for (const [school, damage] of Object.entries(schools) as [MasterySchool, number][]) {
   const gained = gainMasteryExp(p, school, Math.floor(budget * damage / credited), g.data);
   if (gained) levels.push({playerId: id, school, mastery: p.masteries[school], gained, exp: p.masteryExp[school]});
  }
 }
 return levels;
}
