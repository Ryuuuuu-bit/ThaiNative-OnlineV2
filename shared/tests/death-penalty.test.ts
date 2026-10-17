import test from "node:test";
import assert from "node:assert/strict";
import { deathPenalty, loadGameData } from "../src/index.node.js";
const data = loadGameData();
test("death costs 1% of the level requirement from level 10, never de-levels", () => {
	const low = { level: 9, xp: 500, nextXp: 1172 };
	assert.equal(deathPenalty(low, data), 0);
	assert.equal(low.xp, 500);
	const p = { level: 10, xp: 900, nextXp: 1700 };
	assert.equal(deathPenalty(p, data), 17);
	assert.equal(p.xp, 883);
	const empty = { level: 12, xp: 5, nextXp: 3574 };
	assert.equal(deathPenalty(empty, data), 5);
	assert.equal(empty.xp, 0);
	assert.equal(empty.level, 12);
});
