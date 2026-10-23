import test from "node:test";
import assert from "node:assert/strict";
import {
 loadGameData, MASTERY_SCHOOLS, MasteryCatalogSchema, MasteryLevelsSchema,
 learnMasterySkill, masterySkillLock, masteryUseLock, masteryWeaponMatches,
 masteryAutoRank, masteryTriggerSlots,
 normalizeMastery, normalizeJob, newJob, learnSkill,
 type MasteryProgress, type MasterySchool, type Weapon,
} from "../src/index.node.js";

const data = loadGameData().mastery;
const progress = (level = 100): MasteryProgress => ({
 masteries: Object.fromEntries(MASTERY_SCHOOLS.map(s => [s, level])) as Record<MasterySchool, number>,
 skills: {}, skillPoints: 90,
});
test("the shared catalog contains all 147 classless skills, 21 Auto Spells and 16 signatures", () => {
 assert.equal(data.skills.length, 147);
 for (const school of MASTERY_SCHOOLS) {
  const skills = data.skills.filter(s => s.school === school);
  assert.equal(skills.length, 21);
  assert.equal(skills.filter(s => s.passive).length, 7);
  assert.equal(skills.filter(s => s.triggerEligible).length, 3);
 }
 assert.equal(data.skills.reduce((n, s) => n + s.ranks.length, 0), 1160);
 assert.equal(data.skills.reduce((n, s) => n + s.autoRanks.length, 0), 63);
 assert.equal(data.mixes.length, 16);
 assert.deepEqual(data.skills.find(s => s.id === "mage_04")!.autoRanks.map(r => r.params.damage), [30, 40, 50]);
});

test("invalid catalog fields, duplicates, references and cycles are rejected", () => {
 const cases: ((d: typeof data) => void)[] = [
  d => { d.skills.push(structuredClone(d.skills[0])); },
  d => { d.skills[0].requires = [{id: "absent", rank: 1}]; },
  d => { d.skills[0].requires = [{id: "slash", rank: 1}]; },
  d => { d.skills[0].requires = [{id: "mage_01", rank: 1}]; d.skills.find(s => s.id === "mage_01")!.requires = [{id: "slash", rank: 1}]; },
  d => { d.skills[0].requires = [{id: "provoke", rank: 10}]; },
  d => { d.skills[0].ranks.pop(); },
  d => { d.skills[0].ranks[0].rank = 2; },
  d => { d.skills[0].ranks[0].mp = -1; },
  d => { d.skills[0].ranks[0].params.damage = Infinity; },
  d => { d.skills[0].ranks[0].mastery = 50; d.skills[0].ranks[1].mastery = 0; },
  d => { d.skills.find(s => s.passive)!.triggerEligible = true; },
  d => { d.skills.find(s => s.triggerEligible)!.autoRanks.pop(); },
 ];
 for (const change of cases) { const invalid = structuredClone(data); change(invalid); assert(!MasteryCatalogSchema.safeParse(invalid).success); }
 assert(!MasteryCatalogSchema.safeParse({...data, bypassMastery: true}).success);
});

test("Mix presets cannot omit paid prerequisites or misreport their point cost", () => {
 const cases: ((d: typeof data) => void)[] = [
  d => { d.mixes.push(structuredClone(d.mixes[0])); },
  d => { d.mixes[0].minPoints--; },
  d => { delete d.mixes[0].pathRanks.iron_body; },
  d => { d.mixes[0].pathRanks.mage_01 = 10; },
  d => { d.mixes[0].requires.absent = 1; },
  d => { d.mixes[0].masteries = {}; },
  d => { d.mixes[0].requires = {}; },
 ];
 for (const change of cases) { const invalid = structuredClone(data); change(invalid); assert(!MasteryCatalogSchema.safeParse(invalid).success); }
});

test("all seven Masteries are required and must be finite integers from zero to 100", () => {
 const levels = progress().masteries;
 assert(MasteryLevelsSchema.safeParse(levels).success);
 for (const value of [-1, 101, 1.5, NaN, Infinity, "50"]) assert(!MasteryLevelsSchema.safeParse({...levels, Mage: value}).success);
 const {Mage, ...missing} = levels;
 assert(!MasteryLevelsSchema.safeParse(missing).success);
 assert(!MasteryLevelsSchema.safeParse({...levels, Unknown: 50}).success);
});

test("learning three schools spends one shared budget and preserves the existing character", () => {
 const before = {...progress(), jobId: "swordsman", hotbar: [{key: "Digit1", skill: "slash"}]};
 const snapshot = structuredClone(before);
 let after = before;
 for (const id of ["slash", "mage_01", "healer_01"]) after = learnMasterySkill(after, id, data);
 assert.deepEqual(after.skills, {slash: 1, mage_01: 1, healer_01: 1});
 assert.equal(after.skillPoints, 87);
 assert.equal(after.jobId, "swordsman");
 assert.deepEqual(after.hotbar, before.hotbar);
 assert.deepEqual(before, snapshot);
 assert.notEqual(after.skills, before.skills);
});

test("both former sword specializations may be learned without a class gate", () => {
 let p = learnMasterySkill(progress(), "shield_bash", data);
 p = learnMasterySkill(p, "frenzy_slash", data);
 assert.deepEqual(p.skills, {shield_bash: 1, frenzy_slash: 1});
 assert.equal(p.skillPoints, 88);
});

test("normal ranks enforce local Mastery, prerequisite ranks, points and maximum rank", () => {
 let p = progress(0);
 for (let i = 0; i < 3; i++) p = learnMasterySkill(p, "slash", data);
 assert.match(masterySkillLock(p, "slash", data)!, /Mastery 25/);
 p.masteries.Swordsman = 50;
 assert.equal(masterySkillLock(p, "dash_strike", data), null);
 assert.match(masterySkillLock({...p, skills: {slash: 2}}, "dash_strike", data)!, /R3/);
 assert.match(masterySkillLock({...p, skillPoints: 0}, "slash", data)!, /แต้ม/);
 assert.match(masterySkillLock({...p, skills: {slash: 10}}, "slash", data)!, /สูงสุด/);
 for (const learned of [-1, 1.5, 11, NaN]) assert.match(masterySkillLock({...p, skills: {slash: learned}}, "slash", data)!, /ไม่ถูกต้อง/);
 const before = structuredClone(p);
 assert.throws(() => learnMasterySkill(p, "absent", data), /ไม่พบสกิล/);
 assert.deepEqual(p, before);
});

test("weapons restrict use rather than learning, with both real sword types supported", () => {
 const p = learnMasterySkill(progress(), "slash", data);
 assert.equal(masteryUseLock(p, "slash", "sword1h", data), null);
 assert.equal(masteryUseLock(p, "slash", "sword2h", data), null);
 assert.match(masteryUseLock(p, "slash", "bow", data)!, /อาวุธ/);
 assert(!masteryWeaponMatches("sword", "mace"));
 const mage = learnMasterySkill(p, "mage_01", data);
 for (const weapon of ["dagger", "mace", "sword1h", "sword2h", "axe", "spear", "bow", "staff", "unarmed"] as Weapon[]) assert.equal(masteryUseLock(mage, "mage_01", weapon, data), null);
});

test("using a skill cannot bypass learned rank, reduced Mastery or missing prerequisites", () => {
 const p = {...progress(), skills: {slash: 3, dash_strike: 1}};
 assert.equal(masteryUseLock(p, "dash_strike", "sword1h", data), null);
 assert.match(masteryUseLock({...p, masteries: {...p.masteries, Swordsman: 25}}, "dash_strike", "sword1h", data)!, /Mastery/);
 assert.match(masteryUseLock({...p, skills: {...p.skills, slash: 2}}, "dash_strike", "sword1h", data)!, /ทางผ่าน/);
 for (const learned of [0, -1, 1.5, 11, NaN]) assert.match(masteryUseLock({...p, skills: {slash: learned}}, "slash", "sword1h", data)!, /เรียน/);
 assert.match(masteryUseLock(p, "absent", "sword1h", data)!, /ไม่พบ/);
});

test("Trigger slots use highest Mastery while Auto Spell ranks use their own school", () => {
 const p = progress(0); p.skills.mage_01 = 3;
 assert.equal(masteryTriggerSlots(p.masteries), 0);
 p.masteries.Healer = 50;
 assert.equal(masteryTriggerSlots(p.masteries), 1);
 assert.equal(masteryAutoRank(p, "mage_01", data), 0);
 for (const [level, expected] of [[10, 1], [25, 2], [50, 3]]) {
  p.masteries.Mage = level;
  assert.equal(masteryAutoRank(p, "mage_01", data), expected);
 }
 p.masteries.Healer = 75;
 assert.equal(masteryTriggerSlots(p.masteries), 2);
 p.skills.mage_01 = 1;
 assert.equal(masteryAutoRank(p, "mage_01", data), 1);
 p.skills.mage_01 = 11;
 assert.equal(masteryAutoRank(p, "mage_01", data), 0);
 assert.equal(masteryAutoRank(p, "sword_mastery", data), 0);
 assert.equal(masteryAutoRank(p, "absent", data), 0);
 assert.equal(masteryTriggerSlots(progress(100).masteries), 2);
});

test("legacy migration grants only saved-rank requirements and preserves the character", () => {
 const legacy = {level: 52, jobsVersion: 3, jobId: "guardian", jobLevel: 12, jobExp: 45,
  skillPoints: 9, skills: {basic: 1, slash: 8, healer_01: 5, retired_skill: 2},
  hotbar: [{key: "KeyZ", skill: "slash"}, {key: "Digit2", skill: "item:red_small"}],
 };
 const original = structuredClone(legacy), state = normalizeJob(legacy);
 assert.deepEqual(legacy, original);
 assert.deepEqual(state.skills, legacy.skills);
 assert.deepEqual(state.hotbar, legacy.hotbar);
 assert.equal(state.skillPoints, 9);
 assert.equal(state.jobId, "guardian");
 assert.equal(state.jobLevel, 12);
 assert.equal(state.jobExp, 45);
 assert.deepEqual(state.masteries, {Swordsman: 75, Archer: 0, Mage: 0, Healer: 25, Summoner: 0, Assassin: 0, Boxer: 0});
 assert.equal(state.masteryVersion, 1);
 const again = normalizeJob({...state, level: 52, jobsVersion: 3});
 assert.deepEqual(again, state);
 again.masteries.Swordsman = 0;
 assert.equal(state.masteries.Swordsman, 75);
});

test("Mastery migration is one-time, keeps existing progress and rejects corrupt/newer saves", () => {
 const existing = progress(50).masteries;
 const state = normalizeMastery({masteries: existing, skills: {slash: 10}});
 assert.equal(state.masteries.Swordsman, 75);
 assert.equal(state.masteries.Mage, 50);
 assert.equal(existing.Swordsman, 50);
 assert.deepEqual(normalizeMastery({...state, skills: {retribution: 5}}), state);
 assert.throws(() => normalizeMastery({masteryVersion: 2}), /version/);
 assert.throws(() => normalizeMastery({masteryVersion: -1}), /version/);
 assert.throws(() => normalizeMastery({masteryVersion: 1}), /Invalid/);
 assert.throws(() => normalizeMastery({skills: {slash: 11}}), /saved skill rank/);
 assert.throws(() => normalizeMastery({masteries: {...existing, Mage: NaN}}), /Invalid/);
});

test("Sword learning charges points and requires trained local Mastery without granting it", () => {
 const legacy={...newJob(),skillPoints:12,skills:{basic:1,slash:3}};
 assert.throws(()=>learnSkill(legacy,'slash',loadGameData()),/Mastery/);
 legacy.masteries.Swordsman=25;const learned=learnSkill(legacy,'slash',loadGameData());
 assert.equal(learned.skills.slash,4);assert.equal(learned.skillPoints,11);assert.equal(learned.masteries.Swordsman,25);assert.equal(legacy.skills.slash,3);
});
