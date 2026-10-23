import type { GameData } from '@the-beginning-online/shared';
import { itemIcon, CARD_SLOT_NAMES } from './item-icon.ts';
import { cardEffects } from './card-text.ts';

export function mountCardDrop(data: GameData) {
	const popup = document.createElement('section');
	popup.id = 'card-drop-popup';
	popup.hidden = true;
	popup.setAttribute('role', 'status');
	popup.setAttribute('aria-live', 'polite');
	popup.innerHTML = '<div class="card-drop-panel"><header><small>✦ CARD DROP ✦</small><h2>ยินดีด้วย!</h2><p>คุณพบการ์ดจากการผจญภัย</p></header><div class="card-drop-list"></div><footer><p>เก็บการ์ดที่ดรอปเพื่อรับเข้ากระเป๋า</p><button type="button" aria-label="ปิดแจ้งเตือนการ์ด">ผจญภัยต่อ</button></footer></div>';
	document.querySelector('#ui')!.append(popup);
	const list = popup.querySelector('.card-drop-list')!;
	let timer = 0;
	const close = () => { popup.hidden = true; window.clearTimeout(timer); };
	popup.querySelector('button')!.onclick = close;
	return {
		show(loot: { template: string; qty: number }[]) {
			const cards = loot.flatMap(drop => {
				const template = data.items.items.find(t => t.id === drop.template && t.type === 'card');
				return template ? [{ template, qty: drop.qty }] : [];
			});
			if (!cards.length) return;
			if (popup.hidden) list.replaceChildren();
			for (const { template, qty } of cards) {
				const row = document.createElement('article'), art = document.createElement('div'), info = document.createElement('div');
				art.className = 'card-drop-art';
				art.append(itemIcon(template));
				const name = document.createElement('h3'), slot = document.createElement('p'), effects = document.createElement('p');
				name.textContent = `${template.nameTh} ×${qty}`;
				const card = data.cards.cards.find(c => c.id === template.id);
				slot.textContent = `การ์ดสำหรับ: ${CARD_SLOT_NAMES[card?.slot ?? ''] ?? card?.slot ?? 'อุปกรณ์'}`;
				slot.className = 'card-drop-slot';
				effects.textContent = cardEffects(data, template.id);
				effects.className = 'card-drop-effects';
				info.append(name, slot, effects); row.append(art, info); list.append(row);
			}
			window.clearTimeout(timer);
			popup.hidden = false;
			timer = window.setTimeout(close, 10000);
		},
	};
}
