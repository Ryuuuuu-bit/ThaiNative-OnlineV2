import test from "node:test";
import assert from "node:assert/strict";
import { loadGameData, emptyQuests, acceptQuest, questStatus, recordKill, completeQuest, normalizeQuests, objectiveProgress } from "../src/index.node.js";
const data = loadGameData();
const q = (id: string) => data.quests.quests.find(q => q.id === id)!;
test("quest chain: prerequisites and level gate, kill tracking caps at the goal", () => {
	const s = emptyQuests(), now = 1e12;
	assert.equal(questStatus(q("smith_slime"), s, 5, now), "locked");
	acceptQuest(s, "guard_first_hunt", 1, now, data);
	assert.throws(() => acceptQuest(s, "guard_first_hunt", 1, now, data), /รับเควสต์นี้แล้ว/);
	for (let i = 0; i < 12; i++) recordKill(s, "jelly_pink", data);
	assert.deepEqual(s.active.guard_first_hunt.progress, [8]);
	assert.equal(questStatus(q("guard_first_hunt"), s, 1, now), "ready");
	completeQuest(s, "guard_first_hunt", now);
	assert.equal(questStatus(q("guard_first_hunt"), s, 1, now), "done");
	assert.equal(questStatus(q("smith_slime"), s, 1, now), "locked");
	assert.equal(questStatus(q("smith_slime"), s, 2, now), "available");
	assert.throws(() => acceptQuest(s, "healer_colors", 2, now, data), /ระดับ 3/);
});
test("collect objectives read the bag; repeatable bounty cools down for 20 h", () => {
	const s = emptyQuests(), now = 1e12;
	s.done.guard_first_hunt = now;
	acceptQuest(s, "merchant_seeds", 2, now, data);
	const inv = { version: 1 as const, autoPickup: true, items: [{ id: "stack:leaf_seed", template: "leaf_seed", qty: 7, location: "bag" as const, slot: null, refine: 0, cards: [], bound: false, source: "drop" }] };
	assert.deepEqual(objectiveProgress(q("merchant_seeds"), s, inv), [5]);
	assert.equal(questStatus(q("merchant_seeds"), s, 2, now, inv), "ready");
	acceptQuest(s, "guard_bounty", 2, now, data);
	for (const m of ["jelly_pink", "jelly_mint", "jelly_sky"]) for (let i = 0; i < 7; i++) recordKill(s, m, data);
	completeQuest(s, "guard_bounty", now);
	assert.equal(questStatus(q("guard_bounty"), s, 2, now + 19 * 3600000), "cooldown");
	assert.equal(questStatus(q("guard_bounty"), s, 2, now + 20 * 3600000), "available");
});
test("saved quest state is sanitised against the current data", () => {
	const s = normalizeQuests({ active: { guard_first_hunt: { progress: [999], at: 5 }, gone: { progress: [1] } }, done: { smith_slime: 7, nope: 1 } }, data);
	assert.deepEqual(s, { active: { guard_first_hunt: { progress: [8], at: 5 } }, done: { smith_slime: 7 } });
	assert.deepEqual(normalizeQuests(null, data), emptyQuests());
});
