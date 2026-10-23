import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGameData } from '@the-beginning-online/shared';
import { itemIcon } from '../src/item-icon.ts';

test('every card shows its actual equipment slot and Thai hover label; other items have no badge', t => {
	const previous = globalThis.document;
	t.after(() => { globalThis.document = previous; });
	globalThis.document = { createElement: () => ({
		style: {}, dataset: {}, children: [], classList: { add() {} },
		setAttribute(key, value) { this[key] = value; },
		append(child) { this.children.push(child); },
	}) };
	const data = loadGameData();
	const names = { weapon: 'อาวุธ', armour: 'เกราะ', shield: 'โล่', garment: 'ผ้าคลุม', footgear: 'รองเท้า', accessory: 'เครื่องประดับ' };
	for (const card of data.cards.cards) {
		const icon = itemIcon(card), [badge] = icon.children;
		assert.equal(icon.children.length, 1, card.id);
		assert.equal(badge.dataset.cardSlot, card.slot, card.id);
		assert.equal(badge.role, 'img');
		assert.equal(badge['aria-label'], `ใส่การ์ดใน: ${names[card.slot]}`);
		assert.equal(icon.title, badge['aria-label']);
	}
	for (const item of data.items.items.filter(i => i.type !== 'card')) assert.equal(itemIcon(item).children.length, 0, item.id);
});
