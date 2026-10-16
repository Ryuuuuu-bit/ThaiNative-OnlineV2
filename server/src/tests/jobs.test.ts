import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createApp } from "../app.js";
import { MemoryStore } from "../store/memory.js";
import { mountRealtime } from "../realtime/index.js";
import { migrateJob, newJob } from "@thainative/shared";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function setup(t: any, production = false) {
	const store = new MemoryStore(),
		server = createApp({ store, build: "jobs" }).listen(0, "127.0.0.1");
	await once(server, "listening");
	const rt = mountRealtime(server, {
		store,
		build: "jobs",
		devJobExpMultiplier: 1000,
		production,
	});
	const base = `http://127.0.0.1:${(server.address() as any).port}`,
		guest = await fetch(base + "/api/guest", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{}",
		}),
		cookie = guest.headers.get("set-cookie")!.split(";")[0],
		c = (await (
			await fetch(base + "/api/characters", {
				method: "POST",
				headers: { Cookie: cookie, "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Job" + Date.now().toString().slice(-8) }),
			})
		).json()) as any;
	await fetch(base + `/api/characters/${c.character.id}/select`, {
		method: "POST",
		headers: { Cookie: cookie },
	});
	const sockets: WebSocket[] = [];
	async function open() {
		const ws = new WebSocket(
				base.replace("http", "ws") + "/api/ws?v=jobs&area=meadow-01",
				{ headers: { Cookie: cookie } },
			),
			messages: any[] = [];
		sockets.push(ws);
		ws.on("message", (r) => messages.push(JSON.parse(r.toString())));
		await once(ws, "open");
		ws.send(JSON.stringify({ t: "spawnReady" }));
		const until = async (fn: (m: any) => boolean) => {
			for (let i = 0; i < 250; i++) {
				const m = messages.find(fn);
				if (m) return m;
				await wait(10);
			}
			throw Error("missing message");
		};
		await until((m) => m.t === "snap");
		return {
			ws,
			messages,
			until,
			send: (m: any) => ws.send(JSON.stringify(m)),
		};
	}
	t.after(async () => {
		for (const s of sockets) s.terminate();
		await rt.close();
		server.closeAllConnections();
		await new Promise<void>((r) => server.close(() => r()));
	});
	const peer = await open(),
		room = [...rt.rooms.values()][0],
		p = room.game.players.get(c.character.id)!;
	return { store, rt, peer, room, p, c: c.character, open };
}
test("authoritative skill requests reject budget/prerequisite/max/job and unlearned act", async (t) => {
	const f = await setup(t),
		{ p, peer } = f;
	Object.assign(p, migrateJob(1));
	p.profile.classId = "swordsman";
	p.skillPoints = 20;
	let seq = 1;
	async function bad(id: string) {
		const n = peer.messages.length;
		peer.send({ t: "skillUp", id, seq: seq++ });
		await peer.until(
			(m) =>
				peer.messages.indexOf(m) >= n &&
				m.t === "ev" &&
				m.list.some((e: any) => e.type === "skillsError"),
		);
	}
	await bad("dash_strike");
	await bad("meteor");
	p.skills.slash = 10;
	await bad("slash");
	p.skills.slash = 0;
	p.skillPoints = 0;
	await bad("slash");
	p.skillPoints = 2;
	peer.send({ t: "skillUp", id: "slash", seq: seq++ });
	await peer.until(
		(m) =>
			m.t === "ev" &&
			m.list.some((e: any) => e.type === "stats" && e.job.skills.slash === 1),
	);
	assert.equal(p.skillPoints, 1);
	assert.equal(
		(await f.store.character(f.c.accountId, p.id))!.skills!.slash,
		1,
	);
	const mp = p.mp;
	peer.send({ t: "act", a: "endure", seq: seq++ });
	await wait(80);
	assert.equal(p.cd.endure || 0, 0);
	assert.ok(p.mp >= mp);
});
test("Angel job changes require Lv10 and range; learned skills and remapped bar survive reconnect", async (t) => {
	const f = await setup(t),
		{ p, peer } = f;
	let seq = 1;
	const bad = async () => {
		const n = peer.messages.length;
		peer.send({ t: "jobChange", job: "swordsman" });
		await peer.until(
			(m) =>
				peer.messages.indexOf(m) >= n &&
				m.t === "ev" &&
				m.list.some((e: any) => e.type === "skillsError"),
		);
	};
	await bad();
	p.jobLevel = 10;
	p.x = 10;
	p.z = 10;
	await bad();
	p.x = -5;
	p.z = 7;
	peer.send({ t: "jobChange", job: "swordsman" });
	await peer.until(
		(m) =>
			m.t === "ev" &&
			m.list.some(
				(e: any) => e.type === "stats" && e.job.jobId === "swordsman",
			),
	);
	assert.equal(p.jobLevel, 1);
	p.skillPoints = 5;
	peer.send({ t: "skillUp", id: "slash", seq: seq++ });
	await peer.until(
		(m) => m.t === "ev" && m.list.some((e: any) => e.job?.skills.slash === 1),
	);
	const slots = p.hotbar.map((s, i) => ({
		...s,
		skill: i === 0 ? "slash" : s.skill,
		key: i === 0 ? "KeyZ" : s.key,
	}));
	peer.send({ t: "hotbar", slots });
	await peer.until(
		(m) =>
			m.t === "ev" && m.list.some((e: any) => e.job?.hotbar[0].key === "KeyZ"),
	);
	const saved = await f.store.character(f.c.accountId, p.id);
	assert.equal(saved!.hotbar![0].key, "KeyZ");
	peer.ws.close();
	await wait(80);
	const next = await f.open();
	const snap = await next.until((m) => m.t === "snap");
	assert.equal(snap.players[0].skills.slash, 1);
	assert.equal(snap.players[0].hotbar[0].key, "KeyZ");
});
test("dev Job EXP multiplier is disabled in production rooms", async (t) => {
	const f = await setup(t, true);
	assert.equal(f.room.game.jobExpMultiplier, 1);
});
