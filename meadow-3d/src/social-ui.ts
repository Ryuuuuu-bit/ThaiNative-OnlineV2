import './social.css';

type Send = (message: unknown) => void;
interface ChatLine { t: 'chat'; ch: 'map' | 'party' | 'whisper' | 'system' | 'loot'; from?: string; fromId?: string; to?: string; text: string; at: number; self?: boolean }
interface Member { id: string; name: string; online: boolean; level?: number; jobId?: string; hp?: number; maxHp?: number; mapId?: string; dead?: boolean }
interface PartyState { id: string; leader: string; members: Member[] }

const CHANNEL_LABEL = { map: 'ทั่วไป', party: 'ปาร์ตี้', whisper: 'กระซิบ', system: 'ระบบ', loot: 'รางวัล' } as const;
const TABS = [['all', 'ทั้งหมด'], ['chat', 'แชท'], ['party', 'ปาร์ตี้'], ['loot', 'รางวัล'], ['system', 'ระบบ']] as const;
type Tab = typeof TABS[number][0];
const MAP_LABEL: Record<string, string> = { city_plaza: 'เมือง', meadow: 'ทุ่งวุ้นจิ๋ว', forest: 'ป่าหมอก' };
const HELP = 'คำสั่ง: /p ข้อความ (ปาร์ตี้) · /w ชื่อ ข้อความ (กระซิบ) · /r ข้อความ (ตอบกลับ) · /invite ชื่อ · /leave · /kick ชื่อ · /lead ชื่อ';
const MAX_LINES = 80;

/** Chat box (Enter to type), party frame and invite prompts. Server is authoritative for filtering and limits. */
export function mountSocial(options: { send: Send; you: () => string; enabled: () => boolean }) {
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
	const partyBox = document.createElement('section');
	partyBox.id = 'party-frame';
	partyBox.hidden = true;
	partyBox.setAttribute('aria-label', 'ปาร์ตี้');
	const invites = document.createElement('div');
	invites.id = 'party-invites';
	ui.append(box, toggle, partyBox, invites);
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
	let channel: 'map' | 'party' | 'whisper' = 'map', whisperTo = '', lastWhisper = '', party: PartyState | null = null, unread = 0;

	const setChannel = (next: typeof channel) => {
		channel = next;
		channelButton.textContent = next === 'whisper' && whisperTo ? `กระซิบ ${whisperTo}` : CHANNEL_LABEL[next];
		channelButton.dataset.ch = next;
	};
	setChannel('map');
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
		if (m.from) {
			const who = document.createElement('button');
			who.type = 'button';
			who.className = 'chat-name';
			who.textContent = m.ch === 'whisper' ? (m.self ? `ถึง ${m.to}` : `จาก ${m.from}`) : m.from;
			const name = m.ch === 'whisper' && m.self ? m.to! : m.from;
			who.title = `กระซิบหา ${name}`;
			who.onclick = () => { whisperTo = name; setChannel('whisper'); open(); };
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
			case '/leave': options.send({ t: 'party', op: 'leave' }); return;
			case '/kick': if (arg) options.send({ t: 'party', op: 'kick', name: arg }); return;
			case '/lead': if (arg) options.send({ t: 'party', op: 'lead', name: arg }); return;
		}
		if (text.startsWith('/') && !['/notice', '/mute', '/unmute'].includes(cmd)) { system('ไม่รู้จักคำสั่งนี้ · ' + HELP); return; }
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

	function renderParty() {
		partyBox.hidden = !party;
		if (!party) { partyBox.replaceChildren(); return; }
		const me = options.you(), leader = party.leader === me;
		const head = document.createElement('header');
		head.innerHTML = '<b>ปาร์ตี้</b>';
		const count = document.createElement('small');
		count.textContent = `${party.members.length}/6 คน`;
		head.title = 'สมาชิกในแผนที่เดียวกันและอยู่ห่างกันไม่เกิน 30 ม. แบ่ง EXP กัน (+10% ต่อคนที่เพิ่ม)';
		const leave = document.createElement('button');
		leave.type = 'button';
		leave.textContent = 'ออก';
		leave.title = 'ออกจากปาร์ตี้';
		leave.onclick = () => options.send({ t: 'party', op: 'leave' });
		head.append(count, leave);
		const list = document.createElement('ul');
		for (const m of party.members) {
			const li = document.createElement('li');
			li.classList.toggle('offline', !m.online);
			li.classList.toggle('dead', !!m.dead);
			li.classList.toggle('me', m.id === me);
			const name = document.createElement('span');
			name.className = 'party-name';
			name.textContent = (m.id === party.leader ? '♛ ' : '') + m.name;
			const meta = document.createElement('small');
			meta.textContent = m.online ? `ระดับ ${m.level ?? '?'} · ${MAP_LABEL[m.mapId ?? ''] ?? ''}${m.dead ? ' · หมดสติ' : ''}` : 'ออฟไลน์';
			const bar = document.createElement('i');
			bar.className = 'party-hp';
			bar.style.setProperty('--hp', m.online && m.maxHp ? String(Math.max(0, Math.min(1, (m.hp ?? 0) / m.maxHp))) : '0');
			li.append(name, meta, bar);
			if (leader && m.id !== me) {
				const kick = document.createElement('button');
				kick.type = 'button';
				kick.className = 'party-kick';
				kick.textContent = '×';
				kick.title = `เชิญ ${m.name} ออก`;
				kick.onclick = () => options.send({ t: 'party', op: 'kick', id: m.id });
				li.append(kick);
			}
			list.append(li);
		}
		partyBox.replaceChildren(head, list);
	}
	function invite(m: { from: string; partyId: string }) {
		const card = document.createElement('div');
		card.className = 'party-invite';
		card.setAttribute('role', 'alertdialog');
		const text = document.createElement('p');
		text.textContent = `${m.from} ชวนเข้าปาร์ตี้`;
		const yes = document.createElement('button'), no = document.createElement('button');
		yes.type = no.type = 'button';
		yes.textContent = 'เข้าร่วม';
		no.textContent = 'ไม่ล่ะ';
		const done = () => card.remove();
		yes.onclick = () => { options.send({ t: 'party', op: 'accept', id: m.partyId }); done(); };
		no.onclick = () => { options.send({ t: 'party', op: 'decline', id: m.partyId }); done(); };
		card.append(text, yes, no);
		invites.append(card);
		setTimeout(done, 60000);
	}

	return {
		/** Feed every server message; returns true when it was a social message. */
		receive(m: any) {
			if (m.t === 'chat') { if (m.ch === 'whisper' && !m.self) lastWhisper = m.from; line(m); return true; }
			if (m.t === 'chatHistory') { for (const h of m.list) line(h); return true; }
			if (m.t === 'chatError') { system(m.text); return true; }
			if (m.t === 'partyState') { party = m.party; if (!party && channel === 'party') setChannel('map'); renderParty(); return true; }
			if (m.t === 'partyInvite') { invite(m); return true; }
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
		/** Invite from elsewhere in the UI (e.g. clicking another player). */
		invite(name: string) { options.send({ t: 'party', op: 'invite', name }); },
		get typing() { return document.activeElement === input; },
	};
}
