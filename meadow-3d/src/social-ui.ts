import {mountParty,type PartyState} from './party-ui';
import {titleDefinition} from '@thainative/shared';
import './social.css';

type Send = (message: unknown) => void;
interface ChatLine { titleId?:string|null; t: 'chat'; ch: 'map' | 'party' | 'whisper' | 'system' | 'loot'; from?: string; fromId?: string; to?: string; text: string; at: number; self?: boolean }

const CHANNEL_LABEL = { map: 'ทั่วไป', party: 'ปาร์ตี้', whisper: 'กระซิบ', system: 'ระบบ', loot: 'รางวัล' } as const;
const TABS = [['all', 'ทั้งหมด'], ['chat', 'แชท'], ['party', 'ปาร์ตี้'], ['loot', 'รางวัล'], ['system', 'ระบบ']] as const;
type Tab = typeof TABS[number][0];
const MAP_LABEL: Record<string, string> = { city_plaza: 'เมือง', meadow: 'ทุ่งวุ้นจิ๋ว', forest:'ป่าหมอก',ruins:'ซากนครโบราณ',canyon:'หุบเขาหิน' };
const HELP = 'คำสั่ง: /p ข้อความ (ปาร์ตี้) · /w ชื่อ ข้อความ (กระซิบ) · /r ข้อความ (ตอบกลับ) · /invite ชื่อ · /trade ชื่อ (แลกของ) · /leave · /kick ชื่อ · /lead ชื่อ';
const MAX_LINES = 80;

/** Chat box (Enter to type), party frame and invite prompts. Server is authoritative for filtering and limits. */
export function mountSocial(options: { send: Send; you: () => string; enabled: () => boolean; onOpen?:()=>void; /** GM announcements also go up on screen. */ announce?: (text: string) => void; /** Ask a player to trade. */ trade?: (name: string) => void }) {
	const ui = document.querySelector('#ui')!;
	const box = document.createElement('section');
	box.id = 'chat';
	box.setAttribute('aria-label', 'แชท');
	box.innerHTML = '<nav id="chat-tabs" role="tablist" aria-label="กรองแชท"></nav><ol id="chat-log" aria-live="polite"></ol><form id="chat-form" autocomplete="off"><button type="button" id="chat-channel" title="เปลี่ยนช่องแชท (Tab)"></button><input id="chat-input" maxlength="120" enterkeyhint="send" placeholder="Enter เพื่อพิมพ์ · /help"><button type="submit" id="chat-send" aria-label="ส่ง">➤</button></form>';
	const toggle = document.createElement('button');
	toggle.id = 'chat-toggle';
	toggle.type = 'button';
	toggle.setAttribute('aria-label', 'แชท');
	toggle.textContent = '💬';
	ui.append(box,toggle);
	const partyUI=mountParty({...options,chat:()=>{setChannel('party');open();}});
	const log = box.querySelector<HTMLOListElement>('#chat-log')!, form = box.querySelector<HTMLFormElement>('#chat-form')!;
	const input = box.querySelector<HTMLInputElement>('#chat-input')!, channelButton = box.querySelector<HTMLButtonElement>('#chat-channel')!;
	const tabs = box.querySelector<HTMLElement>('#chat-tabs')!;
	let filter: Tab = 'all';
	try { const saved = localStorage.getItem('chat-filter'); if (TABS.some(([k]) => k === saved)) filter = saved as Tab; } catch { /* storage blocked */ }
	const setFilter = (next: Tab) => {
		filter = next;
		log.dataset.filter = next;
		for (const b of tabs.children) b.setAttribute('aria-selected', String((b as HTMLElement).dataset.tab === next));
		log.scrollTop = log.scrollHeight;
		try { localStorage.setItem('chat-filter', next); } catch { /* storage blocked */ }
	};
	for (const [key, label] of TABS) {
		const b = document.createElement('button');
		b.type = 'button';
		b.role = 'tab';
		b.dataset.tab = key;
		b.textContent = label;
		b.onclick = () => setFilter(key);
		tabs.append(b);
	}
	setFilter(filter);
	let lastLoot: { li: HTMLLIElement; xp: number; gold: number; at: number } | null = null;
	let lastItems: { li: HTMLLIElement; items: Map<string, number>; at: number } | null = null;
	const recentNotes = new Map<string, number>();
	let channel: 'map' | 'party' | 'whisper' = 'map', whisperTo = '', lastWhisper = '', party: PartyState | null = null, unread = 0;

	const setChannel = (next: typeof channel) => {
		channel = next;
		channelButton.textContent = next === 'whisper' && whisperTo ? `กระซิบ ${whisperTo}` : CHANNEL_LABEL[next];
		channelButton.dataset.ch = next;
	};
	setChannel('map');
	/** Actions on a player named in chat: whisper, party invite, trade. */
	const menu = document.createElement('div');
	menu.className = 'chat-player-menu';
	menu.hidden = true;
	box.append(menu);
	document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target as Node)) menu.hidden = true; });
	function playerMenu(name: string, anchor: HTMLElement) {
		const item = (text: string, run: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = () => { menu.hidden = true; run(); }; return b; };
		const title = document.createElement('strong');
		title.textContent = name;
		menu.replaceChildren(title,
			item('กระซิบ', () => { whisperTo = name; setChannel('whisper'); open(); }),
			item('เชิญปาร์ตี้', () => options.send({ t: 'party', op: 'invite', name })),
			...(options.trade ? [item('แลกของ', () => options.trade!(name))] : []));
		menu.style.left = anchor.offsetLeft + 'px';
		menu.style.top = Math.max(0, anchor.offsetTop - log.scrollTop) + 'px';
		menu.hidden = false;
	}
	const line = (m: ChatLine) => {
		const li = document.createElement('li');
		li.dataset.ch = m.ch;
		if (m.ch === 'party' || m.ch === 'whisper') {
			const tag = document.createElement('span');
			tag.className = 'chat-tag';
			tag.textContent = `[${CHANNEL_LABEL[m.ch]}]`;
			li.append(tag);
		} else if (!m.from) {
			const mark = document.createElement('span');
			mark.className = 'chat-mark';
			mark.textContent = m.ch === 'loot' ? '◆' : '·';
			li.append(mark);
		}
        const title=titleDefinition(m.titleId);if(title){const badge=document.createElement('span');badge.className='chat-title';badge.textContent=title.name;badge.style.color=title.color;li.append(badge);}
		if (m.from) {
			const who = document.createElement('button');
			who.type = 'button';
			who.className = 'chat-name';
			who.textContent = m.ch === 'whisper' ? (m.self ? `ถึง ${m.to}` : `จาก ${m.from}`) : m.from;
			const name = m.ch === 'whisper' && m.self ? m.to! : m.from;
			who.title = `กระซิบหา ${name}`;
			who.onclick = (e) => { if (m.self && m.ch !== 'whisper') return; playerMenu(name, e.currentTarget as HTMLElement); };
			li.append(who, document.createTextNode(': '));
		}
		const body = document.createElement('span');
		body.className = 'chat-text';
		body.textContent = m.text;
		li.append(body);
		log.append(li);
		while (log.children.length > MAX_LINES) log.firstElementChild!.remove();
		log.scrollTop = log.scrollHeight;
		box.classList.add('recent');
		clearTimeout((box as any).fade);
		(box as any).fade = setTimeout(() => box.classList.remove('recent'), 8000);
		if (!box.classList.contains('open') && m.ch !== 'system' && m.ch !== 'loot') { unread++; toggle.dataset.unread = String(Math.min(99, unread)); }
		return li;
	};
	const system = (text: string) => line({ t: 'chat', ch: 'system', text, at: Date.now() });
	const lootText = (xp: number, gold: number) => `ได้รับ ${xp.toLocaleString()} EXP · ◈ ${gold.toLocaleString()} ทอง`;
	const itemsText = (items: Map<string, number>) => `เก็บได้ ${[...items].map(([name, qty]) => `${name} ×${qty}`).join(' · ')}`;
	const bump = (li: HTMLLIElement) => { li.classList.remove('bump'); void li.offsetWidth; li.classList.add('bump'); box.classList.add('recent'); clearTimeout((box as any).fade); (box as any).fade = setTimeout(() => box.classList.remove('recent'), 8000); };
	const open = () => {
		if (!options.enabled()) return;
		box.classList.add('open', 'typing');
		unread = 0;
		delete toggle.dataset.unread;
		input.focus();
	};
	const close = () => { box.classList.remove('typing'); input.blur(); if (matchMedia('(max-width:650px)').matches) box.classList.remove('open'); };

	function submit(raw: string) {
		const text = raw.trim();
		if (!text) return;
		const [cmd, ...rest] = text.split(' ');
		const arg = rest.join(' ').trim();
		switch (cmd.toLowerCase()) {
			case '/help': system(HELP); return;
			case '/p': if (arg) options.send({ t: 'chat', ch: 'party', text: arg }); else setChannel('party'); return;
			case '/m': case '/g': if (arg) options.send({ t: 'chat', ch: 'map', text: arg }); else setChannel('map'); return;
			case '/w': {
				const [to, ...msg] = rest;
				if (!to) { system('ใช้ /w ชื่อ ข้อความ'); return; }
				whisperTo = to;
				if (msg.length) options.send({ t: 'chat', ch: 'whisper', to, text: msg.join(' ') });
				else setChannel('whisper');
				return;
			}
			case '/r': if (!lastWhisper) { system('ยังไม่มีใครกระซิบหาคุณ'); return; } if (arg) options.send({ t: 'chat', ch: 'whisper', to: lastWhisper, text: arg }); else { whisperTo = lastWhisper; setChannel('whisper'); } return;
			case '/invite': if (arg) options.send({ t: 'party', op: 'invite', name: arg }); else system('ใช้ /invite ชื่อ'); return;
			case '/trade': if (arg && options.trade) options.trade(arg); else system('ใช้ /trade ชื่อ'); return;
			case '/leave': options.send({ t: 'party', op: 'leave' }); return;
			case '/kick': if (arg) options.send({ t: 'party', op: 'kick', name: arg }); return;
			case '/lead': if (arg) options.send({ t: 'party', op: 'lead', name: arg }); return;
		}
		// Any other command is the server's to answer (it never broadcasts it); players just get "unknown command".
		if (text.startsWith('/')) { options.send({ t: 'chat', ch: 'map', text }); return; }
		if (channel === 'whisper') {
			if (!whisperTo) { system('ใช้ /w ชื่อ ข้อความ'); return; }
			options.send({ t: 'chat', ch: 'whisper', to: whisperTo, text });
		} else options.send({ t: 'chat', ch: channel, text });
	}
	form.onsubmit = e => { e.preventDefault(); submit(input.value); input.value = ''; close(); };
	input.addEventListener('keydown', e => {
		if (e.key === 'Escape') { e.preventDefault(); input.value = ''; close(); }
		if (e.key === 'Tab') { e.preventDefault(); setChannel(channel === 'map' ? (party ? 'party' : whisperTo ? 'whisper' : 'map') : channel === 'party' ? (whisperTo ? 'whisper' : 'map') : 'map'); }
	});
	channelButton.onclick = () => { setChannel(channel === 'map' ? 'party' : channel === 'party' ? 'whisper' : 'map'); input.focus(); };
	input.addEventListener('focus', () => box.classList.add('open', 'typing'));
	input.addEventListener('blur', () => { box.classList.remove('typing'); if (!matchMedia('(max-width:650px)').matches) box.classList.remove('open'); });
	toggle.onclick = () => { if (box.classList.contains('open')) { box.classList.remove('open', 'typing'); input.blur(); } else open(); };
	// Enter opens chat unless the player is already typing somewhere or a dialog is open.
	window.addEventListener('keydown', e => {
		if (e.key !== 'Enter' || e.repeat || e.isComposing) return;
		const target = e.target as HTMLElement | null;
		if (target?.matches?.('input,textarea,select,button') || target?.isContentEditable || document.querySelector('dialog[open]')) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		open();
	}, true);

	/** Own-HUD only: other players never see it. */
	function gmBadge(on: boolean) {
		let badge = document.querySelector<HTMLElement>('#gm-badge');
		if (on && !badge) {
			badge = document.createElement('b');
			badge.id = 'gm-badge';
			badge.textContent = 'GM';
			badge.title = 'บัญชีแอดมิน · พิมพ์ /gm help';
			document.querySelector('#player-name')?.after(badge);
		}
		if (badge) badge.hidden = !on;
	}


	return {
		/** Feed every server message; returns true when it was a social message. */
		receive(m: any) {
			const handled=partyUI.receive(m);
			if(m.t==='partyState'){party=m.party;if(!party&&channel==='party')setChannel('map');return true;}
			if(handled)return true;
			if (m.t === 'chat') { if (m.ch === 'whisper' && !m.self) lastWhisper = m.from; line(m); if (m.ch === 'system' && !m.from && m.text.startsWith('📢')) options.announce?.(m.text); return true; }
			if (m.t === 'chatHistory') { for (const h of m.list) line(h); return true; }
			if (m.t === 'chatError') { system(m.text); return true; }
			if (m.t === 'gmRole') { gmBadge(!!m.admin); return true; }
			return false;
		},
		/** EXP/gold from a kill; bursts within a few seconds merge into one line. */
		loot(xp: number, gold: number) {
			const now = Date.now();
			if (lastLoot && now - lastLoot.at < 6000 && log.lastElementChild === lastLoot.li) {
				lastLoot.xp += xp; lastLoot.gold += gold; lastLoot.at = now;
				lastLoot.li.querySelector('.chat-text')!.textContent = lootText(lastLoot.xp, lastLoot.gold);
				lastLoot.li.classList.remove('bump'); void lastLoot.li.offsetWidth; lastLoot.li.classList.add('bump');
				box.classList.add('recent'); clearTimeout((box as any).fade); (box as any).fade = setTimeout(() => box.classList.remove('recent'), 8000);
				return;
			}
			const li = line({ t: 'chat', ch: 'loot', text: lootText(xp, gold), at: now });
			lastLoot = { li, xp, gold, at: now };
		},
		/** Items picked up; pickups within a few seconds merge into one line, adding up repeats. */
		items(list: { name: string; qty: number }[]) {
			if (!list.length) return;
			const now = Date.now();
			if (lastItems && now - lastItems.at < 6000 && log.lastElementChild === lastItems.li) {
				for (const { name, qty } of list) lastItems.items.set(name, (lastItems.items.get(name) ?? 0) + qty);
				lastItems.at = now;
				lastItems.li.querySelector('.chat-text')!.textContent = itemsText(lastItems.items);
				bump(lastItems.li);
				return;
			}
			const items = new Map<string, number>();
			for (const { name, qty } of list) items.set(name, (items.get(name) ?? 0) + qty);
			lastItems = { li: line({ t: 'chat', ch: 'loot', text: itemsText(items), at: now }), items, at: now };
		},
		/** A game notice kept in the log: rewards and progress under รางวัล, the rest under ระบบ. Repeats within 5 s are dropped. */
		note(ch: 'system' | 'loot', text: string) {
			const now = Date.now();
			if (now - (recentNotes.get(text) ?? 0) < 5000) return;
			recentNotes.set(text, now);
			for (const [k, at] of recentNotes) if (now - at > 5000) recentNotes.delete(k);
			line({ t: 'chat', ch, text, at: now });
		},
		/** Invite from elsewhere in the UI (e.g. clicking another player). */
		invite(name: string) { partyUI.invite(name); },
		openParty:partyUI.open,
		get typing() { return document.activeElement === input; },
	};
}
