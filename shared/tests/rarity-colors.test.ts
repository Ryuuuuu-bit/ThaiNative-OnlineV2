import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedRarity, rarityColors, type ItemRoll } from '../src/index.js';

test('item colors are white for Normal, blue for Magic, gold for Rare and red for Unique', () => {
	assert.equal(rarityColors[ownedRarity(undefined, 'common')], '#ffffff');
	for (const [quality, color] of [['magic', '#79b6ec'], ['rare', '#edc369'], ['unique', '#ef5350']] as const) {
		const roll: ItemRoll = { version: 1, itemLevel: 1, quality, affixes: [] };
		assert.equal(rarityColors[ownedRarity({ roll }, 'rare')], color);
	}
});
