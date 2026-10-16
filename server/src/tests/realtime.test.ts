import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createApp } from "../app.js";
import { MemoryStore } from "../store/memory.js";
import { mountRealtime } from "../realtime/index.js";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fixture(t: any, sharedRooms = false) {
	const store = new MemoryStore(),
		app = createApp({ store, build: "test" }),
		server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const rt = mountRealtime(server, {
		store,
		build: "test",
		sharedRooms,
		reconnectMs: 250,
	});
	const base = `http://127.0.0.1:${(server.address() as any).port}`;
	const call = async (path: string, body?: unknown, cookie = "") => {
		const r = await fetch(base + path, {
			method: body === undefined ? "GET" : "POST",
			headers: { Cookie: cookie, "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		return {
			status: r.status,
			data: await r.json(),
			cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
		};
	};
	const make = async (name: string) => {
		const guest = await call("/api/guest", {}),
			c = await call("/api/characters", { name }, guest.cookie);
		await call(
			`/api/characters/${c.data.character.id}/select`,
			{},
			guest.cookie,
		);
		return { cookie: guest.cookie, character: c.data.character };
	};
	const sockets: WebSocket[] = [];
	function open(cookie = "", build = "test", origin?: string) {
		const ws = new WebSocket(
				base.replace("http", "ws") + `/api/ws?v=${build}&area=meadow-01`,
				{ headers: { Cookie: cookie, ...(origin ? { Origin: origin } : {}) } },
			),
			messages: any[] = [];
		ws.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
		ws.on("error", () => {});
		sockets.push(ws);
		const closed = once(ws, "close");
		return {
			ws,
			closed,
			messages,
			send: (m: unknown) => ws.send(JSON.stringify(m)),
			async until(predicate: (m: any) => boolean) {
				for (let i = 0; i < 200; i++) {
					const m = messages.find(predicate);
					if (m) return m;
					await wait(10);
				}
				throw Error("No expected WebSocket message");
			},
		};
	}
	t.after(async () => {
		for (const s of sockets) s.terminate();
		await rt.close();
		server.closeAllConnections();
		await new Promise<void>((r) => server.close(() => r()));
	});
	return { store, rt, call, make, open };
}
test("WebSocket auth, selected-character requirement, wrong build reload and spawnReady gate", async (t) => {
	const f = await fixture(t),
		anonymous = f.open();
	assert.equal((await anonymous.closed)[0], 4401);
	const bare = await f.call("/api/guest", {}),
		noCharacter = f.open(bare.cookie);
	assert.equal((await noCharacter.closed)[0], 4401);
	const user = await f.make("GateHero"),
		wrong = f.open(user.cookie, "old");
	await wrong.until((m) => m.t === "reload");
	assert.equal((await wrong.closed)[0], 4400);
	const cross = f.open(
		user.cookie,
		"test",
		"https://" + new URL(wrong.ws.url).host,
	);
	assert.equal((await cross.closed)[0], 4403);
	const peer = f.open(user.cookie);
	await peer.until((m) => m.t === "welcome");
	await wait(120);
	assert.equal(
		peer.messages.some((m) => m.t === "snap"),
		false,
	);
	assert.equal([...f.rt.rooms.values()][0].game.players.size, 0);
	peer.send({ t: "spawnReady" });
	const snap = await peer.until((m) => m.t === "snap");
	assert.equal(snap.players.length, 1);
});
test("speed clamp, range, cooldown, fake damage and rate limits cannot be bypassed", async (t) => {
	const f = await fixture(t),
		user = await f.make("IntentHero"),
		peer = f.open(user.cookie);
	await peer.until((m) => m.t === "welcome");
	peer.send({ t: "spawnReady" });
	await peer.until((m) => m.t === "snap");
	const room = [...f.rt.rooms.values()][0],
		p = room.game.players.get(user.character.id)!;
	const x = p.x,
		z = p.z;
	peer.send({ t: "steer", dx: 999, dz: 999, seq: 1 });
	await wait(150);
	assert.ok(Math.hypot(p.x - x, p.z - z) < 0.9);
	peer.send({ t: "steer", dx: 0, dz: 0, seq: 2 });
	const far = room.game.enemies.at(-1)!,
		hp = far.hp;
	peer.send({ t: "act", a: "attack", target: far.id, seq: 3 });
	await wait(50);
	assert.equal(far.hp, hp);
	assert.equal(p.cd.attack, 0);
	peer.send({ t: "act", a: "spin", seq: 4 });
	peer.send({ t: "act", a: "spin", seq: 5 });
	await wait(50);
	assert.ok(p.mp > p.maxMp - 21 && p.mp < p.maxMp - 19);
	assert.ok(p.cd.spin > 3);
	const gold = p.gold;
	peer.send({ t: "act", a: "attack", damage: 999999, seq: 6 });
	for (let i = 0; i < 200; i++) peer.send({ t: "ping", c: i });
	await wait(150);
	assert.ok(f.rt.metrics().rateLimitDrops >= 170);
	assert.ok(f.rt.metrics().invalidMessages >= 1);
	assert.equal(peer.ws.readyState, WebSocket.OPEN);
	assert.equal(p.gold, gold);
});
test("server-earned kill saves XP/gold/base stats and obsolete progress returns410", async (t) => {
	const f = await fixture(t),
		user = await f.make("EarnHero"),
		peer = f.open(user.cookie);
	await peer.until((m) => m.t === "welcome");
	peer.send({ t: "spawnReady" });
	await peer.until((m) => m.t === "snap");
	const room = [...f.rt.rooms.values()][0],
		p = room.game.players.get(user.character.id)!,
		e = room.game.enemies[0];
	p.x = e.x;
	p.z = e.z + 1;
	p.xp = 55;
	e.hp = 1;
	peer.send({ t: "act", a: "spin", target: e.id, seq: 1 });
	await peer.until(
		(m) => m.t === "ev" && m.list.some((e: any) => e.type === "level"),
	);
	await room.saveQueue;
	const saved = await f.store.character(user.character.accountId, p.id);
	assert.equal(saved!.level, 2);
	assert.equal(saved!.statPoints, 3);
	assert.ok(saved!.gold > 0);
	assert.equal(saved!.kills, 1);
	assert.deepEqual(saved!.baseStats, p.profile.baseStats);
	assert.equal(
		(
			await f.call(
				`/api/characters/${p.id}/progress`,
				{ gold: 999999 },
				user.cookie,
			)
		).status,
		410,
	);
	assert.equal(
		(await f.store.character(user.character.accountId, p.id))!.gold,
		saved!.gold,
	);
});
test("reconnect retains state, new socket kicks old, then room expires", async (t) => {
	const f = await fixture(t),
		user = await f.make("ResumeHero"),
		first = f.open(user.cookie);
	await first.until((m) => m.t === "welcome");
	first.send({ t: "spawnReady" });
	await first.until((m) => m.t === "snap");
	const room = [...f.rt.rooms.values()][0],
		p = room.game.players.get(user.character.id)!;
	p.gold = 25;
	first.ws.close();
	await first.closed;
	await wait(30);
	const second = f.open(user.cookie);
	await second.until((m) => m.t === "welcome");
	second.send({ t: "spawnReady" });
	assert.equal((await second.until((m) => m.t === "snap")).players[0].gold, 25);
	assert.equal([...f.rt.rooms.values()][0], room);
	const third = f.open(user.cookie);
	await third.until((m) => m.t === "welcome");
	const kick = await second.until((m) => m.t === "kick");
	assert.equal(kick.reason, "opened elsewhere");
	third.ws.close();
	await third.closed;
	await wait(350);
	assert.equal(f.rt.rooms.size, 0);
	assert.equal(
		(await f.store.character(user.character.accountId, p.id))!.gold,
		25,
	);
});
test("shared option joins two ready players into the same room and snapshot", async (t) => {
	const f = await fixture(t, true),
		a = await f.make("SharedOne"),
		b = await f.make("SharedTwo"),
		one = f.open(a.cookie),
		two = f.open(b.cookie);
	await one.until((m) => m.t === "welcome");
	await two.until((m) => m.t === "welcome");
	one.send({ t: "spawnReady" });
	two.send({ t: "spawnReady" });
	await one.until((m) => m.t === "snap" && m.players.length === 2);
	assert.equal(f.rt.rooms.size, 1);
	assert.equal([...f.rt.rooms.values()][0].game.players.size, 2);
});
