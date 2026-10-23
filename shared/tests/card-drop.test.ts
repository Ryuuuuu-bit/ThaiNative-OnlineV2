import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGameData, rollDrops, createGame, spawn, step } from '../src/index.node.js';

const data = loadGameData();

test('TEST UAT triples every card rate and preserves non-card rates', () => {
	assert.equal(data.economy.cardDropMultiplier, 3);
	for (const monster of data.monsters.monsters) for (const drop of monster.drops) {
		const card = data.items.items.find(t => t.id === drop.item)!.type === 'card';
		const chance = Math.min(1, drop.rate * data.economy.dropMultiplier * (card ? 3 : 1));
		const isolated = { ...monster, drops: [drop] };
		assert.ok(rollDrops(isolated, () => chance - Number.EPSILON, data).length, drop.item);
		assert.deepEqual(rollDrops(isolated, () => chance, data), [], drop.item);
	}
});

test('card drop celebration is owned by the loot winner, fires once, and needs no pickup', () => {
	const game = createGame(1, data.stats.defaultBuild, 'winner', data);
	game.enemies = [];
	game.random = () => 0;
	game.equipmentRandom = () => 0;
	const enemy = spawn(game, game.p.x + 10, game.p.z, false, 'pink');
	enemy.dead = true;
	enemy.hp = 0;
	enemy.deathAge = 10;
	enemy.damageBy = { [game.p.id]: 10, other: 1 };
	step(game, .1);
	const events = game.events.filter(e => e.type === 'cardDrop');
	assert.equal(events.length, 1);
	assert.equal(events[0].playerId, game.p.id);
	assert.ok(events[0].loot.length);
	assert.ok(events[0].loot.every((d: { template: string }) => data.items.items.find(t => t.id === d.template)?.type === 'card'));
	assert.ok(game.drops.some(d => d.loot?.some(i => i.template === events[0].loot[0].template)));
	step(game, .1);
	assert.equal(game.events.filter(e => e.type === 'cardDrop').length, 1);
});

test('ordinary loot does not trigger a card celebration', () => {
	const game = createGame(1, data.stats.defaultBuild, 'hunter', data);
	game.enemies = [];
	game.random = () => 1 - Number.EPSILON;
	game.equipmentRandom = () => 1 - Number.EPSILON;
	const enemy = spawn(game, game.p.x + 10, game.p.z, false, 'pink');
	enemy.dead = true;
	enemy.hp = 0;
	enemy.deathAge = 10;
	step(game, .1);
	assert.equal(game.events.filter(e => e.type === 'cardDrop').length, 0);
});
