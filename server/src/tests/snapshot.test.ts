import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, addPlayer, loadGameData } from '@thainative/shared';
import { snapshotFrame, snapshotParts, VIEW_RANGE, VIEW_MAX_PLAYERS } from '../realtime/index.js';
const data = loadGameData();
function room(n: number, spread: (i: number) => [number, number]) {
	const g = createGame(3, data.stats.defaultBuild, 'local', data, 'city_plaza');
	g.players.clear();
	for (let i = 0; i < n; i++) { const p = addPlayer(g, 'p' + i, data.stats.defaultBuild); [p.x, p.z] = spread(i); p.name = 'P' + i; p.gold = 999; }
	return { key: 'city_plaza', game: g, tick: 1 } as any;
}
test('snapshot: own entry is private, others are slim, far players are culled, party always included', () => {
	const r = room(4, i => (i === 3 ? [VIEW_RANGE + 10, 0] : [i, 0]));
	const s = JSON.parse(snapshotFrame(r, { id: 'p0', ack: 7 } as any, snapshotParts(r), ['p3']));
	assert.equal(s.ack, 7);
	assert.equal(s.players[0].id, 'p0');
	assert.equal(s.players[0].gold, 999);
	assert.ok(s.players[0].cd && s.players[0].hotbar);
	const other = s.players.find((p: any) => p.id === 'p1');
	assert.equal(other.gold, undefined);
	assert.equal(other.cd, undefined);
	assert.equal(other.name, 'P1');
	assert.ok(s.players.some((p: any) => p.id === 'p3'), 'party member kept beyond range');
	const without = JSON.parse(snapshotFrame(r, { id: 'p0', ack: 0 } as any));
	assert.ok(!without.players.some((p: any) => p.id === 'p3'));
	assert.ok(Array.isArray(s.enemies) && Array.isArray(s.drops));
});
test('snapshot: a crowd is capped to the nearest players', () => {
	const r = room(80, i => [(i % 9) * 0.5, Math.floor(i / 9) * 0.5]);
	const s = JSON.parse(snapshotFrame(r, { id: 'p0', ack: 0 } as any));
	assert.equal(s.players.length, VIEW_MAX_PLAYERS + 1);
	assert.ok(JSON.stringify(s).length < 15000);
});
