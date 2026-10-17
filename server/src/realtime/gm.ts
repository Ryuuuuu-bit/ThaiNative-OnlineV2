import { z } from "zod";
import type { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import {
	CITY_SPAWN, MEADOW_ENTRY, FOREST_ENTRY, isField, walkable, spawn, refreshStats, autoAllocateStats, resetStats,
	type Game, type MapId, type Player, type InventoryOp, type SlimeVariant,
} from "@thainative/shared";
import type { Store, Account } from "../store/types.js";
import type { AdminAccess } from "../admin.js";
import { AppError } from "../errors.js";

/** The parts of a realtime peer GM commands need. */
export interface GmPeer { ws: WebSocket; id: string; accountId: string; uid?: string; ready: boolean; room: { key: string; game: Game } }
export interface GmContext<P extends GmPeer> {
	store: Store;
	admins: AdminAccess;
	live: Map<string, P>;
	send: (ws: WebSocket, body: unknown) => void;
	social: { system(text: string): void; mute(id: string, minutes: number): boolean; unmute(id: string): boolean };
	transfer: (peer: P, destination: { mapId: MapId; x: number; z: number }) => void;
	/** The authoritative inventory/economy path (ledgered); resolves once persisted. */
	economy: (peer: P, p: Player, op: InventoryOp, req: string) => Promise<void> | undefined;
	save: (room: P["room"], id: string) => unknown;
	flush: (room: P["room"]) => void;
	sendStats: (peer: P, p: Player) => void;
	bossDue: Map<MapId, number>;
	now?: () => number;
	/** Per account: at most `limit` slash commands per `windowMs` (admins and players alike). */
	limit?: number; windowMs?: number;
}

/** Same reply for players and for unknown commands, so GM commands are not discoverable. */
export const UNKNOWN_COMMAND = "ไม่รู้จักคำสั่งนี้ · พิมพ์ /help ดูคำสั่ง";
const MAP_LABEL: Record<MapId, string> = { city_plaza: "เมือง", meadow: "ทุ่งวุ้นจิ๋ว", forest: "ป่าหมอก" };
const MAP_SPAWN: Record<MapId, { x: number; z: number }> = { city_plaza: CITY_SPAWN, meadow: MEADOW_ENTRY, forest: FOREST_ENTRY };

const UID = /^\d{9}$/;
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const coord = z.coerce.number().finite().min(-500).max(500);
/** A 9-digit UID or an online character name. */
const who = z.string().min(1).max(24);
const uid = z.string().regex(UID, "UID ต้องเป็นตัวเลข 9 หลัก");
const id = z.string().regex(/^[a-z0-9_]{1,40}$/, "รหัสไม่ถูกต้อง");
const mapId = z.enum(["city_plaza", "meadow", "forest"]);
const onOff = z.enum(["on", "off"]);
/** One schema per command: a union of the accepted argument lists. */
const shapes = <T extends [z.ZodTypeAny, ...z.ZodTypeAny[]][]>(...lists: T) => z.union(lists.map(l => z.tuple(l as any)) as any);
const COMMANDS = {
	help: { usage: "/gm help", text: "รายการคำสั่ง GM", args: shapes([] as any) },
	tp: { usage: "/gm tp <x> <z> | /gm tp <city_plaza|meadow|forest>", text: "วาร์ปไปพิกัดในแผนที่นี้ หรือไปแผนที่อื่น", args: shapes([coord, coord], [mapId]) },
	goto: { usage: "/gm goto <uid|ชื่อ>", text: "วาร์ปไปหาผู้เล่น", args: shapes([who]) },
	summon: { usage: "/gm summon <uid|ชื่อ>", text: "ดึงผู้เล่นมาหาเรา", args: shapes([who]) },
	heal: { usage: "/gm heal [uid|ชื่อ]", text: "เติม HP/SP เต็ม (ฟื้นถ้าตาย)", args: shapes([] as any, [who]) },
	level: { usage: "/gm level <1-99> [uid|ชื่อ]", text: "ตั้งเลเวล", args: shapes([int(1, 99)], [int(1, 99), who]) },
	joblevel: { usage: "/gm joblevel <n> [uid|ชื่อ]", text: "ตั้งเลเวลอาชีพ", args: shapes([int(1, 70)], [int(1, 70), who]) },
	give: { usage: "/gm give <itemId> [จำนวน 1-999] [uid|ชื่อ]", text: "ให้ไอเทม (ผ่านระบบกระเป๋า+บัญชี)", args: shapes([id], [id, int(1, 999)], [id, int(1, 999), who]) },
	gold: { usage: "/gm gold <1-100000000> [uid|ชื่อ]", text: "ให้ทอง (ผ่านระบบบัญชี)", args: shapes([int(1, 100_000_000)], [int(1, 100_000_000), who]) },
	spawn: { usage: "/gm spawn <monsterId> [จำนวน 1-20]", text: "เสกมอนสเตอร์รอบตัว (ไม่เกิดใหม่)", args: shapes([id], [id, int(1, 20)]) },
	boss: { usage: "/gm boss", text: "เรียกบอสสนามทันที หรือรีเซ็ตเลือดบอส", args: shapes([] as any) },
	kill: { usage: "/gm kill [รัศมี 1-60]", text: "ล้างมอนสเตอร์รอบตัว (ไม่มีของดรอป)", args: shapes([] as any, [int(1, 60)]) },
	god: { usage: "/gm god [on|off]", text: "อมตะ (ไม่รับดาเมจ)", args: shapes([] as any, [onOff]) },
	speed: { usage: "/gm speed <0.5-5>", text: "ตัวคูณความเร็วเดิน (1 = ปกติ)", args: shapes([z.coerce.number().finite().min(0.5).max(5)]) },
	announce: { usage: "/gm announce <ข้อความ>", text: "ประกาศถึงทุกคน", args: shapes([z.string().min(1).max(140)]) },
	kick: { usage: "/gm kick <uid|ชื่อ> [เหตุผล]", text: "เตะออกจากเกม", args: shapes([who], [who, z.string().min(1).max(80)]) },
	mute: { usage: "/gm mute <uid|ชื่อ> <นาที 1-10080>", text: "ปิดแชท", args: shapes([who, int(1, 10080)]) },
	unmute: { usage: "/gm unmute <uid|ชื่อ>", text: "เปิดแชท", args: shapes([who]) },
	who: { usage: "/gm who", text: "ผู้เล่นออนไลน์ (UID แผนที่ พิกัด)", args: shapes([] as any) },
	admin: { usage: "/gm admin add <uid> | remove <uid> | list", text: "จัดการสิทธิ์แอดมิน", args: shapes([z.enum(["add", "remove"]), uid], [z.literal("list")]) },
} as const;
type Command = keyof typeof COMMANDS;
/** Commands whose last argument is free text (joined back together). */
const REST: Partial<Record<Command, number>> = { announce: 0, kick: 1 };

export function createGm<P extends GmPeer>(ctx: GmContext<P>) {
	const { store, admins, live, send } = ctx, now = ctx.now ?? Date.now;
	const recent = new Map<string, number[]>();
	const reply = (peer: P, text: string) => send(peer.ws, { t: "chat", ch: "system", text: "[GM] " + text, at: now() });
	const player = (peer: P) => peer.room.game.players.get(peer.id);
	const fail = (text: string): never => { throw new AppError(400, "GM", text); };
	function target(peer: P, query?: string) {
		if (!query) return peer;
		const key = query.normalize("NFC").toLocaleLowerCase("en-US");
		const found = [...live.values()].find(p => p.ready && (UID.test(query) ? p.uid === query : player(p)?.name.toLocaleLowerCase("en-US") === key));
		return found ?? fail(`ไม่พบผู้เล่น "${query}" ที่ออนไลน์อยู่`);
	}
	const label = (peer: P) => `${player(peer)?.name ?? "?"} (UID ${peer.uid ?? "?"})`;
	/** Pushes the role to every live session of the account (badge + live effect, no reconnect). */
	async function pushRole(account: Account) {
		const admin = admins.isAdminAccount(await store.account(account.id));
		for (const p of live.values()) if (p.accountId === account.id && p.ready) {
			send(p.ws, { t: "gmRole", admin });
			reply(p, admin ? "คุณได้รับสิทธิ์แอดมิน พิมพ์ /gm help" : "สิทธิ์แอดมินของคุณถูกถอนแล้ว");
		}
	}
	function setLevel(peer: P, p: Player, n: number) {
		const g = peer.room.game, data = g.data, before = p.level;
		if (n > before) { while (p.level < n) { p.level++; p.statPoints += data.stats.pointsPerLevel; } Object.assign(p, autoAllocateStats(p, data)); }
		if (n < before) {
			// Refund every point, then drop the points the removed levels granted (as if never earned).
			const auto = p.autoAllocate;
			Object.assign(p, resetStats(p, { ...data, stats: { ...data.stats, statResetFree: true } }));
			p.level = n; p.statPoints = Math.max(0, p.statPoints - (before - n) * data.stats.pointsPerLevel); p.autoAllocate = auto;
			Object.assign(p, autoAllocateStats(p, data));
		}
		p.xp = 0;
		refreshStats(g, p); p.hp = p.maxHp; p.mp = p.maxMp;
		g.events.push({ type: "level", playerId: p.id, x: p.x, z: p.z, level: p.level, skillPoints: p.skillPoints, points: p.statPoints, granted: 0 });
		ctx.flush(peer.room);
	}
	function setJobLevel(peer: P, p: Player, n: number) {
		const g = peer.room.game, job = g.data.jobs.jobs.find(j => j.id === p.jobId);
		if (!job) fail("ไม่พบอาชีพ");
		if (n > job!.maxLevel) fail(`อาชีพ ${p.jobId} เลเวลสูงสุด ${job!.maxLevel}`);
		p.skillPoints = Math.max(0, p.skillPoints + n - p.jobLevel); p.jobLevel = n; p.jobExp = 0;
		refreshStats(g, p);
		g.events.push({ type: "jobLevel", playerId: p.id, x: p.x, z: p.z, jobLevel: n, skillPoints: p.skillPoints, granted: 0 });
		ctx.flush(peer.room);
	}
	async function grant(peer: P, t: P, op: InventoryOp) {
		const p = player(t) ?? fail("ผู้เล่นยังไม่พร้อม");
		const pending = ctx.economy(t, p, op, randomUUID()) ?? fail("ทำรายการไม่สำเร็จ");
		await pending.catch(e => fail((e as Error).message));
	}

	/** Runs one command for an admin; returns the reply text and the target uid for the audit log. */
	async function run(peer: P, name: Command, args: any[]): Promise<{ text: string | string[]; targetUid?: string; touched?: P }> {
		const me = player(peer) ?? fail("ตัวละครยังไม่พร้อม"), g = peer.room.game;
		switch (name) {
			case "help":
				return { text: ["คำสั่ง GM:", ...Object.values(COMMANDS).map(c => `${c.usage} — ${c.text}`)] };
			case "tp": {
				if (me.dead) fail("ฟื้นตัวก่อน (/gm heal)");
				if (args.length === 1) { const m = args[0] as MapId; ctx.transfer(peer, { mapId: m, ...MAP_SPAWN[m] }); return { text: `วาร์ปไป${MAP_LABEL[m]}แล้ว` }; }
				const [x, zz] = args as number[];
				if (!walkable(x, zz, 0.3, g.mapId)) fail(`พิกัด (${x}, ${zz}) เดินไม่ได้ใน${MAP_LABEL[g.mapId]}`);
				ctx.transfer(peer, { mapId: g.mapId, x, z: zz });
				return { text: `วาร์ปไป (${x}, ${zz}) แล้ว` };
			}
			case "goto": case "summon": {
				const t = target(peer, args[0]);
				if (t === peer) fail("เลือกผู้เล่นคนอื่น");
				const [from, to] = name === "goto" ? [peer, t] : [t, peer], dest = player(to)!, mover = player(from)!;
				if (mover.dead) fail(`${label(from)} ตายอยู่ ใช้ /gm heal ก่อน`);
				const x = walkable(dest.x + 1, dest.z, 0.3, to.room.game.mapId) ? dest.x + 1 : dest.x;
				ctx.transfer(from, { mapId: to.room.game.mapId, x, z: dest.z });
				if (name === "summon") reply(t, "ทีมงานเรียกคุณมาที่นี่");
				return { text: name === "goto" ? `วาร์ปไปหา ${label(t)} แล้ว` : `ดึง ${label(t)} มาแล้ว`, targetUid: t.uid };
			}
			case "heal": {
				const t = target(peer, args[0]), p = player(t)!;
				if (p.dead) { p.dead = false; p.reviveRemaining = 0; }
				p.hp = p.maxHp; p.mp = p.maxMp;
				return { text: `ฟื้นฟู ${label(t)} แล้ว`, targetUid: t.uid, touched: t };
			}
			case "level": { const t = target(peer, args[1]); setLevel(t, player(t)!, args[0]); return { text: `ตั้งเลเวล ${label(t)} เป็น ${args[0]}`, targetUid: t.uid, touched: t }; }
			case "joblevel": { const t = target(peer, args[1]); setJobLevel(t, player(t)!, args[0]); return { text: `ตั้งเลเวลอาชีพ ${label(t)} เป็น ${args[0]}`, targetUid: t.uid, touched: t }; }
			case "give": {
				const [template, qty = 1, query] = args as [string, number?, string?], item = g.data.items.items.find(i => i.id === template);
				if (!item) fail(`ไม่พบไอเทม "${template}"`);
				if (!item!.stackable && qty > 20) fail("ไอเทมที่ซ้อนไม่ได้ ให้ได้ครั้งละไม่เกิน 20");
				const t = target(peer, query);
				await grant(peer, t, { op: "admin", loot: [{ template, qty }] });
				return { text: `ให้ ${item!.nameTh ?? template} ×${qty} กับ ${label(t)} แล้ว`, targetUid: t.uid };
			}
			case "gold": {
				const [amount, query] = args as [number, string?], t = target(peer, query);
				if ((player(t)!.gold ?? 0) + amount > 2_000_000_000) fail("ทองจะเกินขีดจำกัด");
				await grant(peer, t, { op: "admin", gold: amount });
				return { text: `ให้ทอง ${amount.toLocaleString("en-US")} กับ ${label(t)} แล้ว`, targetUid: t.uid };
			}
			case "spawn": {
				const [monster, count = 1] = args as [string, number?], spec = g.data.monsters.monsters.find(m => m.id === monster);
				if (!spec) fail(`ไม่พบมอนสเตอร์ "${monster}"`);
				if (spec!.boss) fail("บอสใช้ /gm boss");
				if (!isField(g.mapId)) fail("เสกมอนสเตอร์ได้เฉพาะในสนาม");
				const variant = (monster.startsWith("jelly_") ? monster.slice(6) : "pink") as SlimeVariant;
				let made = 0;
				for (let i = 0; i < count * 6 && made < count; i++) {
					const a = i * 2.4, r = 2.5 + (i % 4);
					const x = me.x + Math.cos(a) * r, zz = me.z + Math.sin(a) * r;
					if (!walkable(x, zz, 0.5, g.mapId)) continue;
					spawn(g, x, zz, false, ["pink", "mint", "sky"].includes(variant) ? variant : "pink", false, monster).gm = true;
					made++;
				}
				if (!made) fail("รอบตัวไม่มีที่ว่างให้เสก");
				return { text: `เสก ${monster} ×${made} แล้ว` };
			}
			case "boss": {
				if (!isField(g.mapId)) fail("ใช้ได้เฉพาะในสนามที่มีบอส");
				const boss = g.enemies.find(e => e.boss && !e.summoned) ?? fail("แผนที่นี้ไม่มีบอส");
				ctx.bossDue.delete(g.mapId);
				if (boss.dead) { boss.respawn = 0; return { text: "บอสกำลังเกิดใหม่" }; }
				Object.assign(boss, { hp: boss.maxHp, damageBy: {}, engaged: false, bossPhase: 1, statuses: [], x: boss.homeX, z: boss.homeZ });
				return { text: "รีเซ็ตบอส (เลือดเต็ม กลับจุดเกิด) แล้ว" };
			}
			case "kill": {
				const r = (args[0] as number | undefined) ?? 20;
				let n = 0;
				for (const e of g.enemies) if (!e.dead && !e.boss && Math.hypot(e.x - me.x, e.z - me.z) <= r) {
					Object.assign(e, { hp: 0, dead: true, rewarded: true, deathAge: 0, respawn: 12, windup: 0, motion: "death", motionTime: 0, attackApplied: false });
					for (const p of g.players.values()) if (p.target === e.id) p.target = null;
					n++;
				}
				return { text: `ล้างมอนสเตอร์ ${n} ตัวในรัศมี ${r} ม.` };
			}
			case "god": { me.god = args[0] ? args[0] === "on" : !me.god; if (!me.god) delete me.god; return { text: me.god ? "เปิดอมตะ (หายเมื่อเข้าเกมใหม่)" : "ปิดอมตะ" }; }
			case "speed": { const m = args[0] as number; if (m === 1) delete me.gmSpeed; else me.gmSpeed = m; return { text: `ความเร็วเดิน ×${m}` }; }
			case "announce": ctx.social.system("📢 " + args[0]); return { text: "ประกาศแล้ว" };
			case "kick": {
				const t = target(peer, args[0]);
				if (t === peer) fail("เตะตัวเองไม่ได้");
				send(t.ws, { t: "kick", reason: "ถูกทีมงานเตะออกจากเกม" + (args[1] ? ` · ${args[1]}` : "") });
				t.ws.close(4410, "kicked by staff");
				return { text: `เตะ ${label(t)} แล้ว`, targetUid: t.uid };
			}
			case "mute": case "unmute": {
				const t = target(peer, args[0]);
				if (name === "mute") { ctx.social.mute(t.id, args[1]); reply(t, `ทีมงานปิดแชทของคุณ ${args[1]} นาที`); }
				else ctx.social.unmute(t.id);
				return { text: `${name === "mute" ? `ปิดแชท ${args[1]} นาที` : "เปิดแชท"}: ${label(t)}`, targetUid: t.uid };
			}
			case "who": {
				const list = [...live.values()].filter(p => p.ready && player(p));
				const lines = list.slice(0, 30).map(p => { const q = player(p)!; return `${q.name} · UID ${p.uid ?? "?"} · Lv.${q.level} · ${MAP_LABEL[p.room.game.mapId]} (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`; });
				return { text: [`ออนไลน์ ${list.length} คน`, ...lines, ...(list.length > 30 ? [`…และอีก ${list.length - 30} คน`] : [])] };
			}
			case "admin": {
				if (args[0] === "list") {
					const list = await store.adminAccounts();
					return { text: [`แอดมิน ${list.length} บัญชี`, ...list.map(a => `UID ${a.uid} · ${a.displayName}`)] };
				}
				const actor = { accountId: peer.accountId, uid: peer.uid ?? "" }, add = args[0] === "add", targetUid = args[1] as string;
				const { account, changed } = await store.setAdmin(targetUid, add, actor);
				await pushRole(account);
				const still = !add && admins.overridden(account) ? " (ยังเป็นแอดมินผ่าน ADMIN_IDS)" : "";
				return { text: changed ? `${add ? "เพิ่ม" : "ถอน"}สิทธิ์แอดมิน UID ${targetUid} (${account.displayName}) แล้ว${still}` : `UID ${targetUid} ${add ? "เป็นแอดมินอยู่แล้ว" : "ไม่ได้เป็นแอดมิน"}${still}`, targetUid };
			}
		}
	}

	async function command(peer: P, text: string) {
		const t = now(), times = (recent.get(peer.accountId) ?? []).filter(x => t - x < (ctx.windowMs ?? 10000));
		recent.set(peer.accountId, times);
		if (times.length >= (ctx.limit ?? 8)) { send(peer.ws, { t: "chatError", text: "ส่งคำสั่งถี่เกินไป รอสักครู่" }); return; }
		times.push(t);
		const [head, sub = "help", ...rest] = text.split(" ");
		if (head.toLowerCase() !== "/gm") { send(peer.ws, { t: "chatError", text: UNKNOWN_COMMAND }); return; }
		const actor = { actorAccountId: peer.accountId, actorUid: peer.uid };
		if (!(await admins.isAdmin(peer.accountId))) {
			await store.audit({ ...actor, action: "gm.denied", detail: { text: text.slice(0, 80) } }).catch(() => {});
			send(peer.ws, { t: "chatError", text: UNKNOWN_COMMAND });
			return;
		}
		if (live.get(peer.id) !== peer) return;
		const name = sub.toLowerCase() as Command, spec = COMMANDS[name];
		if (!spec) { reply(peer, `ไม่มีคำสั่ง "${sub}" · พิมพ์ /gm help`); return; }
		const at = REST[name], raw = at === undefined || rest.length <= at ? rest : [...rest.slice(0, at), rest.slice(at).join(" ")];
		const parsed = spec.args.safeParse(raw);
		if (!parsed.success) { reply(peer, `รูปแบบไม่ถูกต้อง · ${spec.usage}`); await store.audit({ ...actor, action: "gm." + name, detail: { args: raw, ok: false, error: "invalid" } }).catch(() => {}); return; }
		const args = parsed.data as any[];
		try {
			const out = await run(peer, name, args);
			for (const line of ([] as string[]).concat(out.text)) reply(peer, line);
			if (name !== "help" && name !== "who") ctx.save(peer.room, peer.id);
			if (out.touched && out.touched !== peer) ctx.save(out.touched.room, out.touched.id);
			await store.audit({ ...actor, action: "gm." + name, targetUid: out.targetUid, detail: { args, ok: true } });
		} catch (e) {
			const message = e instanceof AppError ? e.message : "คำสั่งล้มเหลว";
			if (!(e instanceof AppError)) console.error("GM command failed", name, e);
			reply(peer, message);
			await store.audit({ ...actor, action: "gm." + name, detail: { args, ok: false, error: message } }).catch(() => {});
		}
	}

	return {
		command(peer: P, text: string) { void command(peer, text).catch(e => console.error("GM command error", e)); },
		/** On spawn: tell an admin's client to show its GM badge (players get nothing). */
		async ready(peer: P) { if (await admins.isAdmin(peer.accountId).catch(() => false)) send(peer.ws, { t: "gmRole", admin: true }); },
		COMMANDS,
	};
}
