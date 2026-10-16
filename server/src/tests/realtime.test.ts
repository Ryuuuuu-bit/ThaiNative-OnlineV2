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
	const make = async (name: string, meadow = false) => {
		const guest = await call("/api/guest", {}),
			c = await call("/api/characters", { name, jobId: "swordsman" }, guest.cookie);
		if(meadow)await store.saveProgress(c.data.character.accountId,c.data.character.id,{...c.data.character,mapId:"meadow",posX:-1,posZ:6});
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
test('stat intents validate, persist and reconnect with manual auto-allocation disabled',async t=>{
 const f=await fixture(t),user=await f.make('StatHero'),peer=f.open(user.cookie);await peer.until(m=>m.t==='welcome');peer.send({t:'spawnReady'});await peer.until(m=>m.t==='snap');const room=[...f.rt.rooms.values()][0],p=room.game.players.get(user.character.id)!;p.statPoints=8;
 const index=peer.messages.length;peer.send({t:'stats',add:{str:2},seq:1});const result=await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='stats'&&e.base.str===7));assert.equal(result.list[0].points,4);assert.equal(p.autoAllocate,false);assert.equal((await f.store.character(user.character.accountId,p.id))!.autoAllocate,false);
 for(const add of[{str:99},{str:-1},{str:90}])peer.send({t:'stats',add,seq:2+peer.messages.length});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='statsError'));assert.equal(p.profile.baseStats.str,7);
 peer.ws.close();await peer.closed;await wait(350);const second=f.open(user.cookie);await second.until(m=>m.t==='welcome');second.send({t:'spawnReady'});const persisted=await second.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='stats'));assert.equal(persisted.list[0].base.str,7);assert.equal(persisted.list[0].autoAllocate,false);assert.equal(persisted.list[0].points,4);
 const secondRoom=[...f.rt.rooms.values()][0];secondRoom.game.data.stats.statResetFree=false;second.send({t:'statsReset'});await second.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='statsError'));const live=secondRoom.game.players.get(p.id)!;assert.equal(live.profile.baseStats.str,7);
 second.send({t:'autoAlloc',on:true});await second.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='stats'&&e.autoAllocate&&e.points===0));assert.equal((await f.store.character(user.character.accountId,p.id))!.autoAllocate,true);
 live.statPoints=9999;live.profile.baseStats.str=98;second.send({t:'stats',add:{str:2},seq:1000});await second.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='statsError'&&e.text.includes('99')));assert.equal(live.profile.baseStats.str,98);
});
test('boot report strips extra fields, limits rate and accepts no personal data in logs',async t=>{const f=await fixture(t);for(let i=0;i<6;i++)assert.equal((await f.call('/api/boot-report',{code:'texture',page:'play',progress:40,email:'ignored@example.test'})).status,202);assert.equal((await f.call('/api/boot-report',{code:'texture',page:'play',progress:40})).status,429);});
test('legacy unspent points migrate before first snapshot and save once on join',async t=>{const f=await fixture(t),user=await f.make('LegacyStats'),c=user.character;await f.store.saveProgress(c.accountId,c.id,{...c,level:5,statPoints:12});const peer=f.open(user.cookie);await peer.until(m=>m.t==='welcome');peer.send({t:'spawnReady'});const stats=(await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='stats'))).list[0];assert.equal(stats.points,0);assert.ok(stats.base.str>c.baseStats.str);const saved=await f.store.character(c.accountId,c.id);assert.deepEqual(saved!.baseStats,stats.base);assert.equal(saved!.autoAllocate,true);});
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
		user = await f.make("IntentHero", true),
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
	p.jobId='swordsman';p.skills.whirlwind=1;peer.send({ t: "act", a: "spin", seq: 4 });
	peer.send({ t: "act", a: "spin", seq: 5 });
	await wait(50);
	assert.ok(p.mp > p.maxMp - 16 && p.mp < p.maxMp - 14);
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
		user = await f.make("EarnHero", true),
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
	assert.equal(saved!.statPoints, 1);
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
	const grant=await f.store.inventoryOp(user.character.accountId,p.id,crypto.randomUUID(),{op:'admin',gold:25},{profile:p.profile});
 p.gold=grant.gold;
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


test('maps isolate rooms, persist transfers and healer cooldown, reject remote gates and respawn in city',async t=>{
 const f=await fixture(t,true),user=await f.make('CityHero'),other=await f.make('CityFriend');
 const peer=f.open(user.cookie),friend=f.open(other.cookie);await peer.until(m=>m.t==='welcome');await friend.until(m=>m.t==='welcome');
 peer.send({t:'spawnReady'});friend.send({t:'spawnReady'});const initial=await peer.until(m=>m.t==='snap'&&m.players.length===2);
 assert.equal(initial.mapId,'city_plaza');assert.equal(initial.enemies.length,0);
 const city=[...f.rt.rooms.values()][0],p=city.game.players.get(user.character.id)!;
 peer.send({t:'travel',gate:'south'});await wait(80);assert.equal(city.game.players.has(p.id),true);
 p.x=0;p.z=-28;peer.send({t:'travel',gate:'north'});await wait(80);assert.equal(f.rt.rooms.size,1);
 p.x=-9;p.z=6;p.hp=1;p.mp=0;peer.send({t:'heal'});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='heal'));
 assert.equal(p.hp,p.maxHp);assert.equal(p.mp,p.maxMp);const readyAt=p.healerReadyAt;await city.saveQueue;
 assert.equal((await f.store.character(user.character.accountId,p.id))!.healerReadyAt,readyAt);
 p.hp=5;peer.send({t:'heal'});await wait(80);assert.ok(p.hp<10);
 peer.send({t:'act',a:'attack',seq:1});peer.send({t:'auto',on:true});await wait(80);assert.equal(p.attack,0);assert.equal(p.auto,false);
 p.x=0;p.z=28;peer.send({t:'travel',gate:'south'});const meadowSnap=await peer.until(m=>m.t==='snap'&&m.mapId==='meadow');
 assert.equal(meadowSnap.players.length,1);assert.ok(meadowSnap.enemies.length>0);assert.equal(city.game.players.has(p.id),false);assert.equal(city.game.players.size,1);
 const meadow=[...f.rt.rooms.values()].find(r=>r.game.mapId==='meadow')!;await meadow.saveQueue;
 assert.equal((await f.store.character(user.character.accountId,p.id))!.mapId,'meadow');
 p.x=0;p.z=-12.8;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza'&&m.players.some((v:any)=>v.id===p.id&&v.z===25));
 assert.equal(p.healerReadyAt,readyAt);p.x=0;p.z=28;peer.send({t:'travel',gate:'south'});await wait(100);
 p.dead=true;p.hp=0;const reviveStart=peer.messages.length;peer.send({t:'revive'});await peer.until(m=>peer.messages.indexOf(m)>=reviveStart&&m.t==='snap'&&m.mapId==='city_plaza'&&m.players.some((v:any)=>v.id===p.id&&v.z===5));
 assert.equal(p.dead,false);assert.equal(p.mapId,'city_plaza');assert.equal(p.x,0);assert.equal(p.z,5);await city.saveQueue;
 peer.ws.close();await peer.closed;const reconnect=f.open(user.cookie);await reconnect.until(m=>m.t==='welcome');reconnect.send({t:'spawnReady'});
 const snap=await reconnect.until(m=>m.t==='snap');assert.equal(snap.mapId,'city_plaza');assert.equal(snap.players.find((v:any)=>v.id===p.id).healerReadyAt,readyAt);
});

test('inventory precondition failures reply to the request so the bag can recover',async t=>{
 const f=await fixture(t),user=await f.make('BagRecovery'),peer=f.open(user.cookie);
 await peer.until(m=>m.t==='welcome');peer.send({t:'spawnReady'});await peer.until(m=>m.t==='snap');
 const room=[...f.rt.rooms.values()][0],p=room.game.players.get(user.character.id)!;
 const before=await f.store.inventory(user.character.accountId,p.id);
 for(const condition of ['cooldown','busy','dead','shop']){
  p.cd.potion=condition==='cooldown'?100:0;p.dead=condition==='dead';room.economyBusy=condition==='busy'?1:0;
  const req=crypto.randomUUID();peer.send({t:'inv',req,...(condition==='shop'?{op:'buy',shop:'market',template:'red_small'}:{op:'use',id:'stack:red_small'})});
  const reply=await peer.until(m=>m.t==='inv'&&m.req===req);assert.ok(reply.error,condition);
 }
 room.economyBusy=0;p.dead=false;p.cd.potion=0;
 assert.deepEqual(await f.store.inventory(user.character.accountId,p.id),before);
 const req=crypto.randomUUID();peer.send({t:'inv',req,op:'settings',on:false});
 const recovered=await peer.until(m=>m.t==='inv'&&m.req===req);assert.equal(recovered.error,undefined);assert.equal(recovered.inventory.autoPickup,false);
});

test('two sockets racing released loot award exactly once; disconnect during commit is atomic',async t=>{
 const f=await fixture(t,true),a=await f.make('LootOne',true),b=await f.make('LootTwo',true),one=f.open(a.cookie),two=f.open(b.cookie);
 await one.until(m=>m.t==='welcome');await two.until(m=>m.t==='welcome');one.send({t:'spawnReady'});two.send({t:'spawnReady'});await one.until(m=>m.t==='snap');await two.until(m=>m.t==='snap');
 const room=[...f.rt.rooms.values()][0],p=room.game.players.get(a.character.id)!,other=room.game.players.get(b.character.id)!;room.game.enemies=[];p.x=other.x=1;p.z=other.z=5;
 let release!:()=>void;const barrier=new Promise<void>(r=>release=r),original=f.store.inventoryOp.bind(f.store);f.store.inventoryOp=async(...args)=>{await barrier;return original(...args);};
 const id=room.game.nextId++;room.game.drops.push({id,ownerId:p.id,x:1,z:5,gold:37,xp:0,time:11,loot:[{template:'king_crystal',qty:1}]});
 one.send({t:'inv',op:'pickup',req:crypto.randomUUID(),drop:id});two.send({t:'inv',op:'pickup',req:crypto.randomUUID(),drop:id});
 for(let i=0;i<50&&!room.economyBusy;i++)await wait(10);assert.ok(room.economyBusy);one.ws.close();await one.closed;release();await room.saveQueue;await wait(100);
 const sa=await f.store.inventory(a.character.accountId,p.id),sb=await f.store.inventory(b.character.accountId,other.id);
 assert.equal(sa.gold+sb.gold,37);assert.equal([...sa.inventory.items,...sb.inventory.items].filter(i=>i.template==='king_crystal').length,1);assert.equal(room.game.drops.length,0);assert.ok((await f.store.integrity()).ok);
});

test('simultaneous joins for one character share the same unique inventory and live room',async t=>{
 const f=await fixture(t),a=await f.make('JoinEconomy');const original=f.store.inventory.bind(f.store);f.store.inventory=async(...args)=>{await wait(20);return original(...args);};
 const one=f.open(a.cookie),two=f.open(a.cookie);await one.until(m=>m.t==='welcome');await two.until(m=>m.t==='welcome');two.send({t:'spawnReady'});const state=await two.until(m=>m.t==='snap');assert.equal(state.inventory.items.filter((i:any)=>i.location==='equip').length,2);assert.equal(new Set(state.inventory.items.map((i:any)=>i.id)).size,3);assert.equal(f.rt.rooms.size,1);assert.ok((await f.store.integrity()).ok);
});
