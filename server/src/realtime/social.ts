import { filterChat, cleanChat, chatAllowed, type ChatLimiter, type Player } from "@thainative/shared";
import type { WebSocket } from "ws";

/** The parts of a realtime peer the social layer needs. */
export interface SocialPeer {
	ws: WebSocket;
	id: string;
	accountId: string;
	ready: boolean;
	room: { game: { mapId: string; players: Map<string, Player> } };
}
export interface Party { id: string; leader: string; members: string[]; invites: Map<string, number> }
interface Options<P extends SocialPeer> {
	live: Map<string, P>;
	send: (ws: WebSocket, body: unknown) => void;
	/** Every slash command that reaches the server (GM commands); it is never broadcast. */
	command?: (peer: P, text: string) => void;
	now?: () => number;
	/** Offline members are dropped from their party after this long. */
	offlineMs?: number;
}
export const PARTY_MAX = 6;
const HISTORY = 20;

export function createSocial<P extends SocialPeer>(options: Options<P>) {
	const { live, send } = options, now = options.now ?? Date.now;
	const limiters = new Map<string, ChatLimiter>();
	const names = new Map<string, string>(); // characterId -> name (kept while offline for party lists)
	const lastSeen = new Map<string, number>();
	const parties = new Map<string, Party>(), partyOf = new Map<string, string>();
	const history = new Map<string, unknown[]>();
	const replyTo = new Map<string, string>();
	let partySeq = 0;
	const player = (p: P) => p.room.game.players.get(p.id);
	const nameOf = (id: string) => names.get(id) ?? "ผู้เล่น";
	const byName = (name: string) => {
		const key = name.normalize("NFC").toLocaleLowerCase("en-US");
		return [...live.values()].find(p => (player(p)?.name ?? names.get(p.id) ?? "").toLocaleLowerCase("en-US") === key);
	};
	const notify = (peer: P, text: string) => send(peer.ws, { t: "chat", ch: "system", text, at: now() });
	const error = (peer: P, text: string) => send(peer.ws, { t: "chatError", text });
	const remember = (key: string, body: unknown) => { const list = history.get(key) ?? []; list.push(body); if (list.length > HISTORY) list.shift(); history.set(key, list); };

	function partyState(party: Party) {
		return {
			t: "partyState",
			party: {
				id: party.id,
				leader: party.leader,
				members: party.members.map(id => {
					const peer = live.get(id), p = peer && player(peer);
					return p
						? { id, name: p.name, online: true, level: p.level, jobId: p.jobId, hp: Math.ceil(p.hp), maxHp: Math.ceil(p.maxHp), mapId: peer!.room.game.mapId, dead: p.dead }
						: { id, name: nameOf(id), online: false };
				}),
			},
		};
	}
	function broadcastParty(party: Party) {
		const body = partyState(party);
		for (const id of party.members) { const peer = live.get(id); if (peer?.ready) send(peer.ws, body); }
	}
	function toParty(party: Party, body: unknown) {
		for (const id of party.members) { const peer = live.get(id); if (peer?.ready) send(peer.ws, body); }
	}
	function leave(id: string, reason: "left" | "kicked" | "offline") {
		const partyId = partyOf.get(id), party = partyId ? parties.get(partyId) : undefined;
		if (!party) return;
		party.members = party.members.filter(m => m !== id);
		partyOf.delete(id);
		const peer = live.get(id);
		if (peer) send(peer.ws, { t: "partyState", party: null });
		const text = `${nameOf(id)} ${reason === "kicked" ? "ถูกเชิญออกจากปาร์ตี้" : reason === "offline" ? "ออฟไลน์นานเกินไป ออกจากปาร์ตี้" : "ออกจากปาร์ตี้"}`;
		if (party.members.length <= 1) {
			for (const m of party.members) { partyOf.delete(m); const p = live.get(m); if (p) { send(p.ws, { t: "partyState", party: null }); notify(p, "ปาร์ตี้ถูกยุบ"); } }
			parties.delete(party.id);
			return;
		}
		if (party.leader === id) party.leader = party.members.find(m => live.has(m)) ?? party.members[0];
		toParty(party, { t: "chat", ch: "system", text, at: now() });
		broadcastParty(party);
	}

	function chat(peer: P, message: { ch: "map" | "party" | "whisper"; text: string; to?: string }) {
		const me = player(peer);
		if (!me) return;
		names.set(peer.id, me.name);
		const raw = cleanChat(message.text);
		if (!raw) return;
		if (raw.startsWith("/")) { if (options.command) options.command(peer, raw); else error(peer, "ไม่รู้จักคำสั่งนี้ · พิมพ์ /help ดูคำสั่ง"); return; }
		const limiter = limiters.get(peer.id) ?? { times: [], strikes: [] };
		limiters.set(peer.id, limiter);
		const blocked = chatAllowed(limiter, raw, now());
		if (blocked) { error(peer, blocked); return; }
		const text = filterChat(raw), at = now();
		if (message.ch === "map") {
			const mapId = peer.room.game.mapId, body = { t: "chat", ch: "map", titleId: me.displayTitleId??null, from: me.name, fromId: me.id, text, at };
			remember(mapId, body);
			for (const other of live.values()) if (other.ready && other.room.game.mapId === mapId) send(other.ws, body);
			return;
		}
		if (message.ch === "party") {
			const party = parties.get(partyOf.get(peer.id) ?? "");
			if (!party) { error(peer, "ยังไม่ได้อยู่ในปาร์ตี้ · เชิญเพื่อนด้วย /invite ชื่อ"); return; }
			toParty(party, { t: "chat", ch: "party", titleId: me.displayTitleId??null, from: me.name, fromId: me.id, text, at });
			return;
		}
		const name = message.to ?? (replyTo.get(peer.id) ? nameOf(replyTo.get(peer.id)!) : "");
		const target = name ? byName(name) : undefined;
		if (!target || !target.ready) { error(peer, `ไม่พบผู้เล่น "${name || "?"}" ที่ออนไลน์อยู่`); return; }
		if (target.id === peer.id) { error(peer, "กระซิบหาตัวเองไม่ได้"); return; }
		const targetName = player(target)?.name ?? nameOf(target.id);
		replyTo.set(target.id, peer.id);
		send(target.ws, { t: "chat", ch: "whisper", titleId: me.displayTitleId??null, from: me.name, fromId: me.id, to: targetName, text, at });
		send(peer.ws, { t: "chat", ch: "whisper", titleId: me.displayTitleId??null, from: me.name, fromId: me.id, to: targetName, text, at, self: true });
	}

	/** Staff mute: blocks the player's chat for `minutes` (kept while offline). */
	function mute(id: string, minutes: number) {
		const l = limiters.get(id) ?? { times: [], strikes: [] };
		l.mutedUntil = now() + minutes * 60000;
		limiters.set(id, l);
		return true;
	}
	function unmute(id: string) {
		const l = limiters.get(id);
		if (!l?.mutedUntil) return false;
		l.mutedUntil = 0;
		return true;
	}

	function party(peer: P, message: { op: string; name?: string; id?: string }) {
		const me = player(peer);
		if (!me) return;
		names.set(peer.id, me.name);
		const current = parties.get(partyOf.get(peer.id) ?? "");
		if (message.op === "invite") {
			const target = message.name ? byName(message.name) : undefined;
			if (!target || !target.ready) { error(peer, `ไม่พบผู้เล่น "${message.name ?? ""}" ที่ออนไลน์อยู่`); return; }
			if (target.id === peer.id) { error(peer, "เชิญตัวเองไม่ได้"); return; }
			if (partyOf.has(target.id)) { error(peer, "ผู้เล่นนี้อยู่ในปาร์ตี้อื่นแล้ว"); return; }
			if (current && current.leader !== peer.id) { error(peer, "หัวหน้าปาร์ตี้เท่านั้นที่เชิญได้"); return; }
			if (current && current.members.length >= PARTY_MAX) { error(peer, `ปาร์ตี้เต็มแล้ว (${PARTY_MAX} คน)`); return; }
			const party = current ?? { id: "p" + ++partySeq, leader: peer.id, members: [peer.id], invites: new Map() };
			if (!current) { parties.set(party.id, party); partyOf.set(peer.id, party.id); broadcastParty(party); }
			party.invites.set(target.id, now() + 60000);
			names.set(target.id, player(target)?.name ?? "");
			send(target.ws, { t: "partyInvite", titleId: me.displayTitleId??null, from: me.name, fromId: me.id, partyId: party.id });
			notify(peer, `ส่งคำเชิญให้ ${player(target)?.name} แล้ว`);
			return;
		}
		if (message.op === "accept" || message.op === "decline") {
			const party = [...parties.values()].find(p => (p.invites.get(peer.id) ?? 0) > now() && (!message.id || p.id === message.id));
			if (!party) { error(peer, "คำเชิญหมดอายุแล้ว"); return; }
			party.invites.delete(peer.id);
			if (message.op === "decline") { const leader = live.get(party.leader); if (leader) notify(leader, `${me.name} ปฏิเสธคำเชิญ`); return; }
			if (current) { error(peer, "ออกจากปาร์ตี้เดิมก่อน"); return; }
			if (party.members.length >= PARTY_MAX) { error(peer, "ปาร์ตี้เต็มแล้ว"); return; }
			party.members.push(peer.id);
			partyOf.set(peer.id, party.id);
			toParty(party, { t: "chat", ch: "system", text: `${me.name} เข้าร่วมปาร์ตี้`, at: now() });
			broadcastParty(party);
			return;
		}
		if (!current) { error(peer, "ยังไม่ได้อยู่ในปาร์ตี้"); return; }
		if (message.op === "leave") { leave(peer.id, "left"); return; }
		if (current.leader !== peer.id) { error(peer, "หัวหน้าปาร์ตี้เท่านั้นที่ทำได้"); return; }
		const target = message.id ?? [...current.members].find(m => nameOf(m) === message.name);
		if (!target || !current.members.includes(target) || target === peer.id) { error(peer, "ไม่พบสมาชิกคนนี้"); return; }
		if (message.op === "kick") leave(target, "kicked");
		if (message.op === "lead") {
			current.leader = target;
			toParty(current, { t: "chat", ch: "system", text: `${nameOf(target)} เป็นหัวหน้าปาร์ตี้`, at: now() });
			broadcastParty(current);
		}
	}

	return {
		chat,
		party,
		mute,
		unmute,
		/** Members of the same party (including the player), for EXP sharing. */
		partyMembers(id: string) { return parties.get(partyOf.get(id) ?? "")?.members ?? [id]; },
		ready(peer: P) {
			const me = player(peer);
			if (me) names.set(peer.id, me.name);
			lastSeen.set(peer.id, now());
			const list = history.get(peer.room.game.mapId) ?? [];
			if (list.length) send(peer.ws, { t: "chatHistory", list });
			const party = parties.get(partyOf.get(peer.id) ?? "");
			if (party) broadcastParty(party);
		},
		/** A player's peer was replaced/closed; party membership survives short disconnects. */
		offline(id: string) { lastSeen.set(id, now()); const party = parties.get(partyOf.get(id) ?? ""); if (party) broadcastParty(party); },
		system(text: string, mapId?: string) {
			const body = { t: "chat", ch: "system", text, at: now() };
			if (mapId) remember(mapId, body);
			for (const other of live.values()) if (other.ready && (!mapId || other.room.game.mapId === mapId)) send(other.ws, body);
		},
		/** Once a second: refresh party HP bars and drop members offline for too long. */
		tick() {
			const t = now();
			for (const id of live.keys()) lastSeen.set(id, t);
			for (const party of [...parties.values()]) {
				for (const [id, until] of party.invites) if (until <= t) party.invites.delete(id);
				for (const id of [...party.members]) if (!live.has(id) && t - (lastSeen.get(id) ?? t) > (options.offlineMs ?? 300000)) leave(id, "offline");
				if (parties.has(party.id)) broadcastParty(party);
			}
			for (const id of [...limiters.keys()]) if (!live.has(id) && !(limiters.get(id)!.mutedUntil! > t)) limiters.delete(id);
		},
		parties,
	};
}
