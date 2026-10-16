import type { Server } from "node:http";
import { performance } from "node:perf_hooks";
import { randomInt } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { parse } from "cookie";
import {
	normalizeJob,
	learnSkill,
	changeJob,
	validateHotbar,
	skillId,
	createGame,
	addPlayer,
	withPlayer,
	step,
	action,
	setAuto,
	moveTo,
	revive,
	walkable,
	spawn,
	ARENA,
	CAMP,
	loadGameData,
	gameSkill,
	allocateStats,
	autoAllocateStats,
	resetStats,
	refreshStats,
	type Game,
	type Player,
	type Vec,
} from "@thainative/shared";
import { IntentSchema, type Intent } from "@thainative/shared";
import type { Store, Character, Progress } from "../store/types.js";
import { hashToken } from "../session.js";
interface Peer {
	ws: WebSocket;
	id: string;
	accountId: string;
	sessionHash: string;
	ready: boolean;
	ack: number;
	input: Vec;
	lastSteer: number;
	lastSeen: number;
	window: number;
	count: number;
	room: Room;
}
export interface Room {
	key: string;
	game: Game;
	peers: Map<string, Peer>;
	accounts: Map<string, string>;
	disconnected: Map<string, number>;
	tick: number;
	saveQueue: Promise<void>;
}
export interface RealtimeOptions {
	store: Store;
	build: string;
	secret?: string;
	sharedRooms?: boolean;
	reconnectMs?: number;
	tickMs?: number;
	adminIds?: string[];
	production?: boolean;
	devJobExpMultiplier?: number;
}
const round = (n: number) => Math.round(n * 1000) / 1000;
const playerKeys = [
	"id",
	"name",
	"x",
	"z",
	"fx",
	"fz",
	"hp",
	"maxHp",
	"mp",
	"maxMp",
	"level",
	"xp",
	"nextXp",
	"gold",
	"kills",
	"potions",
	"dead",
	"moving",
	"attack",
	"attackKind",
	"combo",
	"comboWindow",
	"dash",
	"invulnerable",
	"hurt",
	"auto",
	"autoState",
	"target",
	"destination",
	"statPoints",
	"jobId",
	"jobLevel",
	"jobExp",
	"skillPoints",
	"skills",
	"hotbar",
	"statuses",
	"castRemaining",
] as const;
export function snapshot(room: Room, peer: Peer) {
	const g = room.game;
	return {
		t: "snap",
		tick: room.tick,
		ack: peer.ack,
		time: g.time,
		kills: g.kills,
		bossSpawned: g.bossSpawned,
		won: g.won,
		players: [...g.players.values()].map((p) => ({
			...Object.fromEntries(
				playerKeys.map((k) => [
					k,
					typeof p[k] === "number" ? round(p[k] as number) : p[k],
				]),
			),
			cd: Object.fromEntries(
				Object.entries(p.cd).map(([k, v]) => [k, round(v)]),
			),
			moveSpeed:
				p.stats.moveSpeed *
				(1 -
					Math.max(
						0,
						...p.statuses.filter((s) => s.id === "slow").map((s) => s.value),
					)),
		})),
		enemies: g.enemies.map((e) => ({
			id: e.id,
			statuses: e.statuses,
			dataId: e.dataId,
			x: round(e.x),
			z: round(e.z),
			hp: e.hp,
			maxHp: e.maxHp,
			boss: e.boss,
			dead: e.dead,
			motion: e.motion,
			motionTime: round(e.motionTime),
			motionDuration: e.motionDuration,
			bossPhase: e.bossPhase,
			variant: e.variant,
			deathAge: round(e.deathAge),
			hurt: round(e.hurt),
			fx: round(e.fx),
			fz: round(e.fz),
			vx: round(e.vx),
			vz: round(e.vz),
			moving: e.moving,
			windup: round(e.windup),
			aimX: round(e.aimX),
			aimZ: round(e.aimZ),
			summoned: e.summoned,
			history: e.history.slice(-5),
		})),
		drops: g.drops.map((d) => ({
			...d,
			x: round(d.x),
			z: round(d.z),
			time: round(d.time),
		})),
		projectiles: g.projectiles.map((p) => ({
			...p,
			x: round(p.x),
			z: round(p.z),
		})),
	};
}
export function mountRealtime(server: Server, options: RealtimeOptions) {
	const { store } = options,
		data = loadGameData(),
		rooms = new Map<string, Room>(),
		live = new Map<string, Peer>(),
		samples: number[] = [];
	let received = 0,
		sent = 0,
		dropped = 0,
		invalid = 0,
		ticks = 0,
		lastMetric = Date.now(),
		lastIn = 0,
		lastOut = 0,
		inRate = 0,
		outRate = 0,
		closing = false;
	const wss = new WebSocketServer({
		noServer: true,
		maxPayload: 4096,
		perMessageDeflate: { threshold: 256 },
	});
	function send(ws: WebSocket, body: unknown) {
		if (ws.readyState !== WebSocket.OPEN) return;
		if (ws.bufferedAmount > 128 * 1024) {
			ws.close(4408, "slow consumer");
			return;
		}
		ws.send(JSON.stringify(body));
		sent++;
	}
	function save(room: Room, id: string, strict = false) {
		const p = room.game.players.get(id),
			accountId = room.accounts.get(id);
		if (!p || !accountId) return room.saveQueue;
		const body: Progress = {
			jobId: p.jobId,
			jobLevel: p.jobLevel,
			jobExp: p.jobExp,
			skillPoints: p.skillPoints,
			skills: { ...p.skills },
			hotbar: p.hotbar.map((s) => ({ ...s })),
			jobsVersion: 2,
			level: p.level,
			xp: Math.floor(p.xp),
			gold: p.gold,
			kills: p.kills,
			potions: p.potions,
			posX: p.dead ? CAMP.x : p.x,
			posZ: p.dead ? CAMP.z : p.z,
			baseStats: { ...p.profile.baseStats },
			race: p.profile.race,
			classId: p.profile.classId,
			statPoints: p.statPoints,
			autoAllocate: p.autoAllocate,
			autoAllocCursor: p.autoAllocCursor,
			dataVersion: 1,
		};
		const operation = room.saveQueue.then(async () => {
			await store.saveProgress(accountId, id, body);
		});
		room.saveQueue = operation.catch((e) => {
			console.error("Realtime save failed", e instanceof Error ? e.message : e);
		});
		return strict ? operation : room.saveQueue;
	}
	function flush(room: Room) {
		const list = room.game.events.splice(0);
		if (!list.length) return;
		for (const peer of room.peers.values())
			if (peer.ready) send(peer.ws, { t: "ev", tick: room.tick, list });
		for (const e of list)
			if (["level", "jobLevel"].includes(e.type)) {
				const p = room.game.players.get(String(e.playerId));
				const peer = room.peers.get(String(e.playerId));
				if (p && peer) sendStats(peer, p);
			}
		for (const e of list)
			if (["level", "jobLevel", "death", "victory"].includes(e.type)) {
				if (e.type === "victory")
					for (const id of room.game.players.keys()) void save(room, id);
				else void save(room, String(e.playerId));
			}
	}
	function sendStats(peer: Peer, p: Player) {
		send(peer.ws, {
			t: "ev",
			list: [
				{
					type: "stats",
					playerId: p.id,
					base: { ...p.profile.baseStats },
					points: p.statPoints,
					derived: p.stats,
					profile: p.profile,
					autoAllocate: p.autoAllocate,
					statResetFree: peer.room.game.data.stats.statResetFree,
					job: normalizeJob(p),
				},
			],
		});
	}
	function intent(peer: Peer, message: Intent) {
		const { room } = peer,
			g = room.game;
		if (message.t === "hello") {
			send(peer.ws, {
				t: "welcome",
				you: peer.id,
				build: options.build,
				tick: room.tick,
				dataVersion: 1,
			});
			return;
		}
		if (message.t === "ping") {
			send(peer.ws, { t: "pong", c: message.c, s: Date.now() });
			return;
		}
		if (message.t === "spawnReady") {
			if (!peer.ready) {
				peer.ready = true;
				room.disconnected.delete(peer.id);
			}
			send(peer.ws, snapshot(room, peer));
			sendStats(peer, g.players.get(peer.id)!);
			return;
		}
		if (!peer.ready) return;
		if ("seq" in message) {
			if (message.seq <= peer.ack) return;
			peer.ack = message.seq;
		}
		withPlayer(g, peer.id, () => {
			const p = g.p;
			if (
				message.t === "skillUp" ||
				message.t === "hotbar" ||
				message.t === "jobChange"
			) {
				try {
					if (p.dead) throw Error("รอฟื้นตัวก่อน");
					let next = normalizeJob(p);
					if (message.t === "skillUp") next = learnSkill(p, message.id, g.data);
					if (message.t === "hotbar")
						next = {
							...next,
							hotbar: validateHotbar(p, message.slots, g.data),
						};
					if (message.t === "jobChange") {
						next = changeJob(p, message.job, p.x, p.z, g.data);
						p.profile.classId = next.jobId;
					}
					Object.assign(p, next);
					refreshStats(g, p);
					void save(room, p.id, true)
						.then(() => sendStats(peer, p))
						.catch(() =>
							send(peer.ws, {
								t: "ev",
								list: [
									{
										type: "skillsError",
										playerId: p.id,
										text: "เปลี่ยนในรอบนี้แล้ว แต่บันทึกไม่สำเร็จ กรุณาลองใหม่",
									},
								],
							}),
						);
				} catch (e) {
					invalid++;
					send(peer.ws, {
						t: "ev",
						list: [
							{
								type: "skillsError",
								playerId: p.id,
								text: e instanceof Error ? e.message : "เปลี่ยนไม่สำเร็จ",
							},
						],
					});
				}
				return;
			}
			if (
				message.t === "stats" ||
				message.t === "statsReset" ||
				message.t === "autoAlloc"
			) {
				try {
					const next =
						message.t === "stats"
							? allocateStats(p, message.add, g.data)
							: message.t === "statsReset"
								? resetStats(p, g.data)
								: autoAllocateStats({ ...p, autoAllocate: message.on }, g.data);
					Object.assign(p, next);
					refreshStats(g, p);
					void save(room, p.id, true)
						.then(() => sendStats(peer, p))
						.catch(() => {
							sendStats(peer, p);
							send(peer.ws, {
								t: "ev",
								list: [
									{
										type: "statsError",
										playerId: p.id,
										text: "สเตตัสมีผลในรอบนี้ แต่บันทึกไม่สำเร็จ กรุณารอการเชื่อมต่อกลับมา",
									},
								],
							});
						});
				} catch (e) {
					invalid++;
					send(peer.ws, {
						t: "ev",
						list: [
							{
								type: "statsError",
								playerId: p.id,
								text: e instanceof Error ? e.message : "จัดสรรไม่สำเร็จ",
							},
						],
					});
				}
				return;
			}
			if (message.t === "steer") {
				const len = Math.hypot(message.dx, message.dz) || 1;
				peer.input = {
					x: message.dx / Math.max(1, len),
					z: message.dz / Math.max(1, len),
				};
				peer.lastSteer = Date.now();
				if (Math.hypot(message.dx, message.dz) > 0.05) {
					setAuto(g, false);
					g.target = null;
					g.destination = null;
				}
			}
			if (message.t === "move") {
				if (walkable(message.x, message.z)) {
					moveTo(g, message.x, message.z);
					peer.input = { x: 0, z: 0 };
				}
			}
			if (message.t === "target") {
				if (g.enemies.some((e) => e.id === message.id && !e.dead)) {
					g.target = message.id;
					g.destination = null;
					peer.input = { x: 0, z: 0 };
				}
			}
			if (message.t === "auto") {
				setAuto(g, message.on);
				if (!message.on) {
					g.target = null;
					g.destination = null;
				}
			}
			if (message.t === "revive" && p.dead) revive(g);
			if (message.t === "act") {
				if (message.target !== undefined) {
					const target = g.enemies.find(
						(e) => e.id === message.target && !e.dead,
					);
					const spec = g.data.skills.skills.find(
						(s) => s.id === skillId(message.a),
					);
					if (!target || !spec) return;
					const reach =
						spec.id === "basic" && target.boss
							? 2.3
							: Math.max(spec.range, spec.radius);
					if (Math.hypot(target.x - p.x, target.z - p.z) > reach) return;
					g.target = target.id;
				}
				action(g, message.a);
			}
		});
		flush(room);
	}
	server.on("upgrade", (req, socket, head) => {
		const url = new URL(req.url || "/", `http://${req.headers.host}`);
		if (url.pathname !== "/api/ws") {
			socket.destroy();
			return;
		}
		wss.handleUpgrade(req, socket, head, (ws) => {
			void (async () => {
				const origin = req.headers.origin,
					host = req.headers.host;
				const forwarded = String(req.headers["x-forwarded-proto"] || "")
					.split(",")[0]
					.trim();
				const scheme =
					forwarded === "https" ||
					(req.socket as { encrypted?: boolean }).encrypted
						? "https"
						: "http";
				if (origin && origin !== `${scheme}://${host}`) {
					ws.close(4403, "origin rejected");
					return;
				}
				const token = parse(req.headers.cookie || "").tn_session,
					hash = token ? hashToken(token, options.secret) : "",
					session = hash ? await store.session(hash) : undefined;
				const character = session?.selectedCharacterId
					? await store.character(
							session.accountId,
							session.selectedCharacterId,
						)
					: undefined;
				if (!session || !character) {
					ws.close(4401, "login and selected character required");
					return;
				}
				if (url.searchParams.get("v") !== options.build) {
					send(ws, { t: "reload" });
					ws.close(4400, "stale build");
					return;
				}
				if (url.searchParams.get("area") !== "meadow-01") {
					ws.close(4404, "unknown area");
					return;
				}
				if (ws.readyState !== WebSocket.OPEN || closing) return;
				const old = live.get(character.id);
				if (old) {
					send(old.ws, { t: "kick", reason: "opened elsewhere" });
					old.ws.close(4409, "opened elsewhere");
				}
				const key =
					"meadow-01" + (options.sharedRooms ? "" : ":" + character.id);
				let room = rooms.get(key);
				if (!room) {
					const game = createGame(randomInt(1, 0x7fffffff));
					game.jobExpMultiplier = options.production
						? 1
						: Math.max(1, Math.min(1000, options.devJobExpMultiplier || 1));
					game.players.clear();
					room = {
						key,
						game,
						peers: new Map(),
						accounts: new Map(),
						disconnected: new Map(),
						tick: 0,
						saveQueue: Promise.resolve(),
					};
					rooms.set(key, room);
				}
				if (!room.game.players.has(character.id)) {
					const profile = {
						...data.stats.defaultBuild,
						level: character.level,
						baseStats: character.baseStats,
						race: character.race,
						classId: character.classId,
					};
					const p = addPlayer(room.game, character.id, profile);
					Object.assign(p, normalizeJob(character));
					p.profile.classId = p.jobId;
					p.name = character.name;
					p.xp = character.xp;
					p.gold = character.gold;
					p.kills = character.kills;
					p.potions = character.potions;
					p.statPoints = character.statPoints;
					p.autoAllocate = character.autoAllocate ?? true;
					p.autoAllocCursor = character.autoAllocCursor ?? 0;
					const before = p.statPoints;
					Object.assign(p, autoAllocateStats(p, data));
					refreshStats(room.game, p);
					if (before !== p.statPoints)
						await store.saveProgress(session.accountId, character.id, {
							...character,
							baseStats: p.profile.baseStats,
							statPoints: p.statPoints,
							autoAllocate: p.autoAllocate,
							autoAllocCursor: p.autoAllocCursor,
						});
					if (
						character.posX !== undefined &&
						character.posZ !== undefined &&
						walkable(character.posX, character.posZ)
					) {
						p.x = character.posX;
						p.z = character.posZ;
					}
					// A not-ready character is retained for resume but excluded from simulation and snapshots.
					room.game.players.delete(character.id);
					pending.set(character.id, p);
					if (!options.sharedRooms) {
						room.game.kills = character.kills;
						if (character.kills >= 6 && !room.game.bossSpawned) {
							room.game.bossSpawned = true;
							spawn(room.game, ARENA.x, ARENA.z, true);
						}
					}
				}
				const peer: Peer = {
					ws,
					id: character.id,
					accountId: session.accountId,
					sessionHash: hash,
					ready: false,
					ack: 0,
					input: { x: 0, z: 0 },
					lastSteer: 0,
					lastSeen: Date.now(),
					window: Date.now(),
					count: 0,
					room,
				};
				live.set(peer.id, peer);
				room.peers.set(peer.id, peer);
				room.accounts.set(peer.id, peer.accountId);
				room.disconnected.delete(peer.id);
				send(ws, {
					t: "welcome",
					you: peer.id,
					build: options.build,
					tick: room.tick,
					dataVersion: 1,
				});
				ws.on("pong", () => {
					peer.lastSeen = Date.now();
				});
				ws.on("message", (raw, isBinary) => {
					if (live.get(peer.id) !== peer) return;
					received++;
					peer.lastSeen = Date.now();
					if (Date.now() - peer.window >= 1000) {
						peer.window = Date.now();
						peer.count = 0;
					}
					if (++peer.count > 30) {
						dropped++;
						return;
					}
					if (isBinary) {
						invalid++;
						return;
					}
					let body;
					try {
						body = JSON.parse(raw.toString());
					} catch {
						invalid++;
						return;
					}
					const parsed = IntentSchema.safeParse(body);
					if (!parsed.success) {
						invalid++;
						if (["stats", "statsReset", "autoAlloc"].includes(body?.t))
							send(ws, {
								t: "ev",
								list: [
									{
										type: "statsError",
										playerId: peer.id,
										text: "ค่าสเตตัสไม่ถูกต้อง กรุณาลองใหม่",
									},
								],
							});
						return;
					}
					if (parsed.data.t === "spawnReady" && pending.has(peer.id)) {
						room!.game.players.set(peer.id, pending.get(peer.id)!);
						pending.delete(peer.id);
					}
					intent(peer, parsed.data);
				});
				ws.on("close", () => {
					if (live.get(peer.id) !== peer) return;
					live.delete(peer.id);
					room!.peers.delete(peer.id);
					peer.input = { x: 0, z: 0 };
					room!.disconnected.set(peer.id, Date.now());
					void save(room!, peer.id);
				});
				ws.on("error", () => {});
			})().catch(() => ws.close(1011, "connection failed"));
		});
	});
	const pending = new Map<string, Player>();
	let previousTick = performance.now(),
		bank = 0;
	const timer = setInterval(() => {
		const begin = performance.now(),
			now = Date.now();
		bank = Math.min(250, bank + begin - previousTick);
		previousTick = begin;
		const catchup = Math.floor(bank / 50);
		bank -= catchup * 50;
		for (let substep = 0; substep < catchup; substep++) {
			ticks++;
			for (const room of rooms.values()) {
				for (const [id, at] of room.disconnected)
					if (now - at >= (options.reconnectMs ?? 60000)) {
						void save(room, id);
						room.game.players.delete(id);
						pending.delete(id);
						room.accounts.delete(id);
						room.disconnected.delete(id);
					}
				if (
					!room.peers.size &&
					!room.game.players.size &&
					!room.disconnected.size
				) {
					rooms.delete(room.key);
					continue;
				}
				room.tick++;
				const inputs = new Map<string, Vec>();
				for (const peer of room.peers.values())
					if (peer.ready) inputs.set(peer.id, peer.input);
				if (room.game.players.size)
					step(room.game, 0.05, { x: 0, z: 0 }, inputs);
				flush(room);
				if (room.tick % 2 === 0)
					for (const peer of room.peers.values())
						if (peer.ready) send(peer.ws, snapshot(room, peer));
				if (room.tick % 600 === 0)
					for (const id of room.game.players.keys()) void save(room, id);
			}
		}
		samples.push(performance.now() - begin);
		if (samples.length > 1200) samples.shift();
		if (now - lastMetric >= 1000) {
			inRate = ((received - lastIn) * 1000) / (now - lastMetric);
			outRate = ((sent - lastOut) * 1000) / (now - lastMetric);
			lastIn = received;
			lastOut = sent;
			lastMetric = now;
		}
	}, options.tickMs ?? 50);
	timer.unref();
	const heartbeat = setInterval(() => {
		for (const peer of live.values()) {
			if (Date.now() - peer.lastSeen > 30000) {
				peer.ws.terminate();
				continue;
			}
			peer.ws.ping();
			void store.session(peer.sessionHash).then((session) => {
				if (!session || session.selectedCharacterId !== peer.id) {
					send(peer.ws, { t: "kick", reason: "session ended" });
					peer.ws.close(4401, "session ended");
				}
			});
		}
	}, 15000);
	heartbeat.unref();
	return {
		rooms,
		metrics() {
			const sorted = [...samples].sort((a, b) => a - b);
			return {
				rooms: rooms.size,
				sockets: live.size,
				ticks,
				tickMs: {
					p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
					p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
				},
				messagesInPerSecond: inRate,
				messagesOutPerSecond: outRate,
				rateLimitDrops: dropped,
				invalidMessages: invalid,
			};
		},
		async close() {
			closing = true;
			clearInterval(timer);
			clearInterval(heartbeat);
			for (const peer of live.values()) peer.ws.terminate();
			await Promise.all(
				[...rooms.values()].flatMap((room) =>
					[...room.game.players.keys()].map((id) => save(room, id)),
				),
			);
			wss.close();
		},
		save,
	};
}
