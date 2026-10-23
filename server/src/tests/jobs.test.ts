import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { createApp } from "../app.js";
import { MemoryStore } from "../store/memory.js";
import { mountRealtime, snapshotParts } from "../realtime/index.js";
import { migrateJob, newJob, spawn, createSummon, createWisp, addPlayer, applyPlayerBurn } from "@the-beginning-online/shared";
import {GATES} from '@the-beginning-online/shared/maps';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function setup(t: any, production = false, field = false) {
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
				body: JSON.stringify({ jobId:"swordsman",name: "Job" + Date.now().toString().slice(-8) }),
			})
		).json()) as any;
	await fetch(base + `/api/characters/${c.character.id}/select`, {
		method: "POST",
		headers: { Cookie: cookie },
	});
	if(field)await store.saveProgress(c.character.accountId,c.character.id,{...c.character,mapId:'meadow',posX:0,posZ:4});
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
	return { store, rt, peer, room, p, c: c.character, open, base, cookie };
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
test("Angel cannot grant tier one; learned skills and remapped bar survive reconnect", async (t) => {
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
	await bad();
	p.skillPoints = 5;
	peer.send({ t: "skillUp", id: "slash", seq: seq++ });
	await peer.until(
		(m) => m.t === "ev" && m.list.some((e: any) => e.job?.skills.slash === 1),
	);
	const slots = p.hotbar.map((s, i) => ({
		...s,
		skill: i === 0 ? "slash" : s.skill,
		key: i === 0 ? "KeyV" : s.key,
	}));
	peer.send({ t: "hotbar", slots });
	await peer.until(
		(m) =>
			m.t === "ev" && m.list.some((e: any) => e.job?.hotbar[0].key === "KeyV"),
	);
	const saved = await f.store.character(f.c.accountId, p.id);
	assert.equal(saved!.hotbar![0].key, "KeyV");
	peer.ws.close();
	await wait(80);
	const next = await f.open();
	const snap = await next.until((m) => m.t === "snap");
	assert.equal(snap.players[0].skills.slash, 1);
	assert.equal(snap.players[0].hotbar[0].key, "KeyV");
});
test("dev Job EXP multiplier is disabled in production rooms", async (t) => {
	const f = await setup(t, true);
	assert.equal(f.room.game.jobExpMultiplier, 1);
});

test("Mastery survives authoritative skill save and reconnect; client Mastery injection is rejected", async (t) => {
 const f=await setup(t),{p,peer}=f;
 p.masteries.Mage=37;p.masteries.Healer=64;p.masteryExp.Mage=23;
 peer.send({t:"skillUp",id:"slash",seq:1});
 const event=await peer.until(m=>m.t==="ev"&&m.list.some((e:any)=>e.type==="stats"&&e.job.skills.slash===1));
 assert.equal(event.list.find((e:any)=>e.type==="stats").job.masteries.Mage,37);
 const saved=(await f.store.character(f.c.accountId,p.id))!;
 assert.equal(saved.masteries!.Healer,64);assert.equal(saved.masteryVersion,1);
 assert.equal(saved.masteryExp!.Mage,23);
 peer.send({t:"skillUp",id:"slash",seq:2,masteries:{Mage:100}});
 await wait(50);assert.equal(p.skills.slash,1);assert.equal(p.masteries.Mage,37);
 peer.ws.close();await wait(80);
 const next=await f.open(),snap=await next.until(m=>m.t==="snap");
 assert.equal(snap.players.find((p:any)=>p.id===f.c.id).masteries.Healer,64);
 assert.equal(snap.players.find((p:any)=>p.id===f.c.id).masteries.Mage,37);
 assert.equal(snap.players.find((p:any)=>p.id===f.c.id).masteryExp.Mage,23);
});

test('root skills learn, cast and persist over WebSocket without trusting client heal values',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f;room.game.enemies=[];p.x=0;p.z=4;p.skillPoints=6;
 peer.send({t:'skillUp',id:'healer_01',seq:1});
 await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills.healer_01===1));
 p.stats.hpRegen=0;p.stats.spRegen=0;p.stats.matk=100;p.hp=p.maxHp-20;const mp=p.mp;
 peer.send({t:'act',a:'healer_01',ally:p.id,amount:9999,seq:2});await wait(80);assert.equal(p.mp,mp);assert.equal(p.hp,p.maxHp-20);
 peer.send({t:'act',a:'healer_01',ally:p.id,seq:3});
 await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.type==='heal'&&e.playerId===p.id));
 assert.equal(p.hp,p.maxHp);assert(p.mp<mp);assert(p.cd.healer_01>0);
 peer.send({t:'skillUp',id:'mage_01',seq:4});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills.mage_01===1));
 for(const [i,id] of ['archer_01','rogue_01','boxer_01'].entries()){peer.send({t:'skillUp',id,seq:5+i});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const roots=['healer_01','mage_01','archer_01','rogue_01','boxer_01'];
 const slots=p.hotbar.map((s,i)=>({...s,skill:roots[i]??null}));peer.send({t:'hotbar',slots});
 await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='healer_01'));
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.mage_01,1);assert.equal(saved.skills!.healer_01,1);assert.equal(saved.skillPoints,1);
 peer.ws.close();await wait(80);const next=await f.open(),snap=await next.until(m=>m.t==='snap'),own=snap.players.find((v:any)=>v.id===p.id);
 for(const [i,id]of roots.entries()){assert.equal(own.skills[id],1);assert.equal(own.hotbar[i].skill,id);}
});

test('server validates physical root weapons, emits two Archer hits and clears staged hits/combo on travel',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.x=0;p.z=4;p.skillPoints=2;
 peer.send({t:'skillUp',id:'archer_01',seq:1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills.archer_01===1));
 const e=spawn(g,3,4);e.hp=e.maxHp=10000;e.cooldown=999;p.stats.hit=1000;p.stats.crit=0;p.stats.spRegen=0;const mp=p.mp;
 peer.send({t:'act',a:'archer_01',target:e.id,seq:2});await wait(60);assert.equal(e.hp,10000);assert.equal(p.mp,mp);
 p.stats.weaponType='bow';peer.send({t:'act',a:'archer_01',target:e.id,seq:3});
 await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='archer_01'&&v.hitIndex===2));
 assert(e.hp<10000);assert(p.mp<mp);
 const hits=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]).filter((v:any)=>v.type==='hit'&&v.skillId==='archer_01');
 assert.deepEqual(hits.map((v:any)=>v.hitIndex),[1,2]);assert.equal(hits[0].cast,hits[1].cast);
 p.whirlwindHits=[{id:e.id,due:g.time+5,damage:1,crit:false,breakdown:{},skillId:'archer_01',level:1}];p.boxerCombo={steps:3,until:g.time+10};p.target=null;
 p.skills.shaman_01=1;assert(createSummon(g,p,1));
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');
 assert.equal(p.whirlwindHits!.length,0);assert.equal(p.boxerCombo,undefined);assert.equal(p.summon,undefined);
});

test('Summoner learns/casts with authoritative resources, snapshots reject injected pet state and clear on reconnect',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f;room.game.enemies=[];
 peer.send({t:'skillUp',id:'shaman_01',seq:1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills.shaman_01===1));
 p.stats.spRegen=0;const mp=p.mp,n=peer.messages.length;peer.send({t:'act',a:'shaman_01',seq:2});
 const snap=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.id===p.id&&v.summon));const pet=p.summon!;
 assert.equal(p.mp,mp-35);assert(p.cd.shaman_01>0);
 assert.equal(snap.players.find((v:any)=>v.id===p.id).summon.ownerId,p.id);
 const publicState=JSON.parse(snapshotParts(room).others.get(p.id)!);assert.equal(publicState.summon.id,pet.id);assert.equal(publicState.masteries,undefined);
 peer.send({t:'act',a:'shaman_01',pet:{hp:99999},seq:3});await wait(50);assert.equal(p.summon,pet);assert.equal(p.summon!.hp,pet.maxHp);
 peer.ws.close();await wait(80);assert.equal(p.summon,undefined);
 const next=await f.open(),rejoined=await next.until(m=>m.t==='snap');assert.equal(rejoined.players.find((v:any)=>v.id===p.id).summon,null);
});

test('magic ward learns and casts through WebSocket with private capacity, strict selectors and travel cleanup',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f;room.game.enemies=[];p.masteries.Mage=10;p.skillPoints=3;
 for(const [i,id] of ['mage_01','mage_02'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'mage_02':null}));peer.send({t:'hotbar',slots});
 await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='mage_02'));
 p.stats.matk=100;p.stats.spRegen=0;const mp=p.mp;
 peer.send({t:'act',a:'mage_02',target:123,seq:3});peer.send({t:'act',a:'mage_02',ally:p.id,seq:4});peer.send({t:'act',a:'mage_02',amount:99999,seq:5});
 await wait(60);assert.equal(p.mp,mp);assert(!p.statuses.some(s=>s.id==='magic_shield'));
 const n=peer.messages.length;peer.send({t:'act',a:'mage_02',seq:6});
 const snap=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.statuses.some((s:any)=>s.id==='magic_shield')));
 assert.equal(p.mp,mp-16);assert(p.cd.mage_02>0);assert.equal(snap.players.find((v:any)=>v.id===p.id).statuses.find((s:any)=>s.id==='magic_shield').value,120);
 const publicState=JSON.parse(snapshotParts(room).others.get(p.id)!);assert.equal(publicState.statuses.find((s:any)=>s.id==='magic_shield').value,undefined);
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');
 assert(!p.statuses.some(s=>s.id==='magic_shield'));const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.mage_02,1);
});

test('Healer preparation validates selectors, persists ranks and keeps server buff time on a quick reconnect',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f;room.game.enemies=[];p.masteries.Healer=10;p.skillPoints=3;
 for(const [i,id]of ['healer_01','healer_02'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 p.stats.spRegen=0;const mp=p.mp;peer.send({t:'act',a:'healer_02',target:123,seq:3});peer.send({t:'act',a:'healer_02',ally:'00000000-0000-4000-8000-000000000000',seq:4});
 await wait(60);assert.equal(p.mp,mp);const n=peer.messages.length;
 peer.send({t:'act',a:'healer_02',ally:p.id,seq:5});
 const snap=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.statuses.some((s:any)=>s.id==='slow_resist')));
 assert.equal(p.mp,mp-12);assert(p.cd.healer_02>0);assert.equal(snap.players.find((v:any)=>v.id===p.id).statuses.find((s:any)=>s.id==='slow_resist').value,.15);
 const remaining=p.statuses.find(s=>s.id==='slow_resist')!.remaining;
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.healer_02,1);assert.equal((saved as any).statuses,undefined);
 peer.ws.close();await wait(80);const next=await f.open(),rejoined=await next.until(m=>m.t==='snap'),own=rejoined.players.find((v:any)=>v.id===p.id);
 assert.equal(own.skills.healer_02,1);const buff=own.statuses.find((s:any)=>s.id==='slow_resist');assert(buff);assert(buff.remaining<=remaining);
});

test('mark and coating learn/use over WebSocket with target authority, exact resources, poison ticks and travel cleanup',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.skillPoints=4;p.masteries.Archer=10;p.masteries.Assassin=10;p.stats.spRegen=0;
 for(const [i,id]of ['archer_01','archer_02','rogue_01','rogue_02'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:['archer_02','rogue_02'][i]??null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='archer_02'));
 p.x=0;p.z=4;p.stats.spRegen=0;p.mp=Math.min(50,p.maxMp);p.stats.weaponType='bow';p.stats.hit=1000;p.stats.crit=0;p.stats.atk=61;const e=spawn(g,4,4);e.hp=e.maxHp=10000;e.cooldown=999;
 const mp=p.mp,n=peer.messages.length;peer.send({t:'act',a:'archer_02',target:e.id,seq:5});
 const marked=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.statuses.some((s:any)=>s.id==='archer_mark')));
 assert.equal(marked.players.find((v:any)=>v.id===p.id).statuses.find((s:any)=>s.id==='archer_mark').targetId,e.id);assert.equal(p.mp,mp-10);p.target=null;
 const before=p.mp;peer.send({t:'act',a:'rogue_02',target:e.id,seq:6});peer.send({t:'act',a:'rogue_02',ally:p.id,seq:7});peer.send({t:'act',a:'rogue_02',poison:9999,seq:8});
 await wait(60);assert.equal(p.mp,before);p.stats.weaponType='sword1h';peer.send({t:'act',a:'rogue_02',seq:9});
 await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='skillImpact'&&v.skillId==='rogue_02'));assert.equal(p.mp,before-12);
 e.x=1;p.x=0;peer.send({t:'act',a:'attack',target:e.id,seq:10});await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='poisonApplied'));p.target=null;
 await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='rogue_02'&&v.dot));assert(!p.statuses.some(s=>s.id==='poison_coat'));assert((e.masteryDamage?.[p.id].Assassin??0)>0);
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.archer_02,1);assert.equal(saved.skills!.rogue_02,1);assert.equal(saved.hotbar![1].skill,'rogue_02');
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');await wait(60);
 assert(!p.statuses.some(s=>s.id==='archer_mark'||s.id==='poison_coat'));assert.equal(e.masteryPoisons?.length??0,0);
});

test('disconnect immediately removes only the departing owner poison even when the room stops ticking',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];const e=spawn(g,4,4);e.cooldown=999;const other=addPlayer(g,'other');Object.assign(other,newJob());other.skills={rogue_01:1,rogue_02:1};other.masteries.Assassin=10;
 e.masteryPoisons=[{owner:p.id,remaining:4,tick:0,damage:37,ticks:4},{owner:'other',remaining:4,tick:0,damage:40,ticks:4}];
 p.skills.shaman_01=1;p.skills.shaman_02=1;p.masteries.Summoner=10;assert(createWisp(g,p,1,e.id));
 p.skills.healer_01=1;p.skills.healer_03=1;p.masteries.Healer=25;other.skills.healer_01=1;other.skills.healer_03=1;other.masteries.Healer=25;g.partyMembers=()=>[p.id,other.id];other.x=p.x;other.z=p.z;
 p.healingOverTime={casterId:other.id,mapId:g.mapId,level:1,next:g.time+1,until:g.time+5,ticksLeft:5,amount:100};other.healingOverTime={casterId:p.id,mapId:g.mapId,level:1,next:g.time+1,until:g.time+5,ticksLeft:5,amount:100};
 peer.ws.close();await wait(80);assert.equal(e.masteryPoisons!.some(s=>s.owner===p.id),false);assert.equal(e.masteryPoisons!.some(s=>s.owner==='other'),true);assert.equal(p.wisp,undefined);assert.equal(p.healingOverTime,undefined);assert.equal(other.healingOverTime,undefined);
});

test('Boxer stance learns/casts over WebSocket, rejects selectors/results and cleanses only one Slow',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f;room.game.enemies=[];p.masteries.Boxer=10;p.skillPoints=2;
 for(const [i,id]of ['boxer_01','boxer_02'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 p.stats.spRegen=0;p.stats.weaponType='bow';p.mp=Math.min(50,p.maxMp);p.statuses=[{id:'slow',sourceId:'weak',remaining:8,value:.2},{id:'slow',sourceId:'strong',remaining:8,value:.8},{id:'root',sourceId:'root',remaining:8,value:1}];
 const mp=p.mp,def=p.stats.hardDef;peer.send({t:'act',a:'boxer_02',target:123,seq:3});peer.send({t:'act',a:'boxer_02',ally:p.id,seq:4});peer.send({t:'act',a:'boxer_02',pushResist:100,seq:5});await wait(60);assert.equal(p.mp,mp);
 const n=peer.messages.length;peer.send({t:'act',a:'boxer_02',seq:6});const snap=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.statuses.some((s:any)=>s.id==='push_resist')));
 const own=snap.players.find((v:any)=>v.id===p.id);assert.equal(own.statuses.find((s:any)=>s.id==='push_resist').value,.1);assert.equal(own.statuses.filter((s:any)=>s.id==='slow').length,1);assert(own.statuses.some((s:any)=>s.id==='root'));
 assert.equal(p.mp,mp-12);assert.equal(p.stats.hardDef,def);assert(p.cd.boxer_02>0);assert.equal((await f.store.character(f.c.accountId,p.id))!.skills!.boxer_02,1);
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert(!p.statuses.some(s=>s.id==='push_resist'));
});

test('wisp pays MP/cast/CD through WebSocket, coexists with the main pet and exposes only server-owned state',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Summoner=10;p.skillPoints=2;
 for(const [i,id]of ['shaman_01','shaman_02'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 p.stats.spRegen=0;p.stats.matk=100;p.mp=Math.min(60,p.maxMp);p.x=0;p.z=4;const e=spawn(g,4,4);e.hp=e.maxHp=10000;e.cooldown=999;assert(createSummon(g,p,1));const pet=p.summon;
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'shaman_02':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='shaman_02'));
 p.stats.spRegen=0;p.stats.matk=100;p.mp=Math.min(60,p.maxMp);
 const mp=p.mp,n=peer.messages.length;peer.send({t:'act',a:'shaman_02',target:e.id,seq:3});const snap=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.wisp));p.target=null;const w=p.wisp!;
 assert.equal(p.mp,mp-18);assert(p.cd.shaman_02>0);assert.equal(p.summon,pet);assert.equal(snap.players.find((v:any)=>v.id===p.id).wisp.target,e.id);
 const pub=JSON.parse(snapshotParts(room).others.get(p.id)!);assert.equal(pub.wisp.id,w.id);assert.equal(pub.masteries,undefined);
 peer.send({t:'act',a:'shaman_02',target:e.id,wisp:{hitsLeft:999},seq:4});await wait(60);assert.equal(p.wisp,w);assert.equal(p.wisp!.hitsLeft,3);
 await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='shaman_02'&&v.wispId===w.id));assert.equal(p.summon,pet);
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});const moved=await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert.equal(p.wisp,undefined);assert.equal(moved.players.find((v:any)=>v.id===p.id).wisp,null);
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.shaman_02,1);assert.equal(saved.hotbar![0].skill,'shaman_02');assert.equal((saved as any).wisp,undefined);
});

test('fire area learns and casts over WebSocket at a fixed center with real radius and no three-target cap',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Mage=25;p.skillPoints=2;
 for(const [i,id]of ['mage_01','mage_03'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'mage_03':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='mage_03'));
 p.x=0;p.z=4;p.stats.matk=100;p.stats.spRegen=0;p.mp=Math.min(60,p.maxMp);
 const enemies=[[4,4],[4.5,4],[4,5],[3.5,3.5],[6.5,4],[6.51,4]].map(([x,z])=>{const e=spawn(g,x,z);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',remaining:99,value:1}];return e;});
 const mp=p.mp;peer.send({t:'act',a:'mage_03',target:enemies[0].id,seq:3});await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='skill'&&v.skillId==='mage_03'));p.target=null;
 await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='mage_03'));assert(enemies.slice(0,5).every(e=>e.hp<10000));assert.equal(enemies[5].hp,10000);assert.equal(p.mp,mp-20);assert(p.cd.mage_03>0);
 const events=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]),impact=events.find((v:any)=>v.type==='skillImpact'&&v.skillId==='mage_03');assert.equal(impact.r,2.5);assert.equal(events.filter((v:any)=>v.type==='hit'&&v.skillId==='mage_03').length,5);
 p.cd.mage_03=0;const after=p.mp;peer.send({t:'act',a:'mage_03',target:enemies[0].id,radius:999,damage:99999,seq:4});await wait(60);assert.equal(p.mp,after);assert.equal(p.cd.mage_03,0);
 assert.equal((await f.store.character(f.c.accountId,p.id))!.skills!.mage_03,1);
});

test('HoT validates selectors, creates server-owned snapshots and heals through real WebSocket ticks before travel cleanup',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f;room.game.enemies=[];p.masteries.Healer=25;p.skillPoints=2;
 for(const [i,id]of ['healer_01','healer_03'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'healer_03':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='healer_03'));
 p.stats.matk=101;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=Math.min(50,p.maxMp);p.hp=p.maxHp-30;const mp=p.mp;
 peer.send({t:'act',a:'healer_03',target:123,seq:3});peer.send({t:'act',a:'healer_03',ally:'00000000-0000-4000-8000-000000000000',seq:4});peer.send({t:'act',a:'healer_03',ally:p.id,amount:99999,seq:5});await wait(60);assert.equal(p.mp,mp);
 const n=peer.messages.length;peer.send({t:'act',a:'healer_03',ally:p.id,seq:6});const snap=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.healingOverTime));
 assert.equal(p.hp,p.maxHp-30);assert.equal(p.mp,mp-14);assert.equal(snap.players.find((v:any)=>v.id===p.id).healingOverTime.casterId,p.id);
 const pub=JSON.parse(snapshotParts(room).others.get(p.id)!);assert.equal(pub.healingOverTime.casterId,p.id);assert.equal(pub.masteries,undefined);
 await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='heal'&&v.skillId==='healer_03'&&v.hot));assert.equal(p.hp,p.maxHp-10);assert.equal(p.masteryExp.Healer,0);
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});const moved=await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert.equal(p.healingOverTime,undefined);assert.equal(moved.players.find((v:any)=>v.id===p.id).healingOverTime,null);
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.healer_03,1);assert.equal(saved.hotbar![0].skill,'healer_03');assert.equal((saved as any).healingOverTime,undefined);
});

test('world join rejects a migrated villager until the authenticated job choice is saved',async t=>{
 const store=new MemoryStore(),server=createApp({store,build:'picker'}).listen(0,'127.0.0.1');await once(server,'listening');
 const rt=mountRealtime(server,{store,build:'picker'}),sockets:WebSocket[]=[];
 t.after(async()=>{for(const ws of sockets)ws.terminate();await rt.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
 const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const guest=await fetch(base+'/api/guest',{method:'POST'}),cookie=guest.headers.get('set-cookie')!.split(';')[0],account=(await guest.json() as any).account;
 const c=await store.createCharacter(account.id,'WaitingHero','waitinghero');await store.saveProgress(account.id,c.id,{...c,jobId:'villager',classId:'villager',jobsVersion:2});
 await fetch(base+`/api/characters/${c.id}/select`,{method:'POST',headers:{Cookie:cookie}});
 const connect=()=>{const ws=new WebSocket(base.replace('http','ws')+'/api/ws?v=picker&area=meadow-01',{headers:{Cookie:cookie}});sockets.push(ws);return ws;};
 const rejected=connect();const [code]=await once(rejected,'close');assert.equal(code,4412);assert.equal(rt.rooms.size,0);
 const choice=await fetch(base+`/api/characters/${c.id}/job`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({jobId:'swordsman'})});assert.equal(choice.status,200);
 const accepted=connect();const [raw]=await once(accepted,'message');assert.equal(JSON.parse(raw.toString()).t,'welcome');
});


test('Archer fan learns/saves/equips and uses authoritative aim, cast, resources and front-sector targets over WebSocket',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Archer=25;p.skillPoints=2;
 for(const [i,id]of ['archer_01','archer_03'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'archer_03':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='archer_03'));
 p.x=0;p.z=4;p.stats.weaponType='bow';p.stats.atk=100;p.stats.hit=1000;p.stats.crit=0;p.stats.spRegen=0;p.mp=Math.min(50,p.maxMp);p.cd.attack=999;
 const foes=[[3,4],[2,5],[2,3],[5,4],[7,4],[-.1,4],[1,6],[7.1,4]].map(([x,z])=>{const e=spawn(g,x,z);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',remaining:99,value:1}];return e;});
 const mp=p.mp;peer.send({t:'act',a:'archer_03',target:foes[0].id,fx:-1,fz:0,seq:3});peer.send({t:'act',a:'archer_03',ally:p.id,seq:4});await wait(60);assert.equal(p.mp,mp);
 peer.send({t:'act',a:'archer_03',target:foes[0].id,seq:5});await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='skill'&&v.skillId==='archer_03'));p.target=null;
 await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='archer_03'));assert(foes.slice(0,5).every(e=>e.hp<10000));assert(foes.slice(5).every(e=>e.hp===10000));assert.equal(p.mp,mp-16);assert(p.cd.archer_03>0);
 const events=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]);assert.equal(events.filter((v:any)=>v.type==='hit'&&v.skillId==='archer_03').length,5);assert.equal(events.find((v:any)=>v.type==='skillImpact'&&v.skillId==='archer_03').angle,90);
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.archer_03,1);assert.equal(saved.hotbar![0].skill,'archer_03');
});

test('Rogue fan caps real WebSocket damage at three and applies coating only to the selected primary',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Assassin=25;p.skillPoints=3;
 for(const [i,id]of ['rogue_01','rogue_02','rogue_03'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'rogue_03':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='rogue_03'));
 p.x=0;p.z=4;p.stats.weaponType='dagger';p.stats.atk=100;p.stats.hit=1000;p.stats.crit=0;p.stats.spRegen=0;p.mp=Math.min(60,p.maxMp);p.cd.attack=999;
 const foes=[[1,4],[2,4],[3,4],[5,4],[-.1,4]].map(([x,z])=>{const e=spawn(g,x,z);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',remaining:99,value:1}];return e;});
 peer.send({t:'act',a:'rogue_02',seq:4});await peer.until(m=>m.t==='snap'&&m.players.some((v:any)=>v.statuses.some((s:any)=>s.id==='poison_coat')));const mp=p.mp;
 peer.send({t:'act',a:'rogue_03',target:foes[3].id,targets:foes.map(e=>e.id),seq:5});await wait(60);assert.equal(p.mp,mp);
 peer.send({t:'act',a:'rogue_03',target:foes[3].id,seq:6});await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='rogue_03'));p.target=null;
 assert.equal(p.mp,mp-16);assert(p.cd.rogue_03>0);assert.equal(foes[3].masteryPoisons?.length,1);assert(foes.filter((_,i)=>i!==3).every(e=>!e.masteryPoisons));assert.equal(foes[2].hp,10000);assert.equal(foes[4].hp,10000);
 const hits=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]).filter((v:any)=>v.type==='hit'&&v.skillId==='rogue_03');assert.deepEqual(hits.map((v:any)=>v.id),[foes[3].id,foes[0].id,foes[1].id]);
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.rogue_03,1);assert.equal(saved.hotbar![0].skill,'rogue_03');
});


test('pet command validates real WebSocket ownership/reach/results, pays costs, buffs one normal strike and clears on travel',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Summoner=25;p.skillPoints=2;
 for(const [i,id]of ['shaman_01','shaman_03'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'shaman_03':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='shaman_03'));
 p.x=0;p.z=4;p.stats.matk=100;p.stats.spRegen=0;p.stats.weaponType='bow';p.mp=Math.min(60,p.maxMp);p.cd.attack=999;
 const e=spawn(g,1.4,4);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',remaining:99,value:1}];const mp=p.mp;
 peer.send({t:'act',a:'shaman_03',target:e.id,seq:3});await wait(60);assert.equal(p.mp,mp);assert.equal(p.cd.shaman_03||0,0);assert.equal(e.hp,10000);
 assert(createSummon(g,p,1));const pet=p.summon!;pet.cooldown=999;
 peer.send({t:'act',a:'shaman_03',target:e.id,petId:pet.id,nextBonus:999,seq:4});peer.send({t:'act',a:'shaman_03',ally:p.id,seq:5});await wait(60);assert.equal(p.mp,mp);assert.equal(pet.command,undefined);
 const near=e.x;e.x=5;peer.send({t:'act',a:'shaman_03',target:e.id,seq:6});await wait(60);assert.equal(p.mp,mp);e.x=near;
 const n=peer.messages.length;peer.send({t:'act',a:'shaman_03',target:e.id,seq:7});await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='shaman_03'&&v.petId===pet.id));p.target=null;
 assert.equal(p.mp,mp-12);assert(p.cd.shaman_03>0);assert.equal(p.summon,pet);assert.equal(pet.command!.target,e.id);assert.equal(pet.command!.nextBonus,20);
 const events=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]),cast=events.find((v:any)=>v.type==='skill'&&v.skillId==='shaman_03');assert.equal(cast.petId,pet.id);
 const pub=JSON.parse(snapshotParts(room).others.get(p.id)!);assert.equal(pub.summon.id,pet.id);assert.equal(pub.summon.command.nextBonus,20);assert.equal(pub.masteries,undefined);
 pet.cooldown=0;await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='shaman_01'&&v.petId===pet.id));assert.equal(pet.command!.nextBonus,0);
 const normal=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]).find((v:any)=>v.type==='hit'&&v.skillId==='shaman_01'&&v.petId===pet.id);assert.equal(normal.breakdown.base,42);
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});const moved=await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert.equal(p.summon,undefined);assert.equal(moved.players.find((v:any)=>v.id===p.id).summon,null);
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.shaman_03,1);assert.equal(saved.hotbar![0].skill,'shaman_03');assert.equal((saved as any).summon,undefined);
});


test('Boxer combo preparation, fixed-stun elbow and finisher learn/cast/save over WebSocket with server-owned one-use bonuses',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Boxer=75;p.skillPoints=6;
 const learn=['boxer_01','boxer_01','boxer_01','boxer_03','boxer_10','boxer_11'];
 for(const [i,id]of learn.entries()){const expected=learn.slice(0,i+1).filter(v=>v===id).length;peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===expected));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:['boxer_03','boxer_10','boxer_11'][i]??null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[2].skill==='boxer_11'));
 p.x=0;p.z=4;p.stats.atk=100;p.stats.hit=1000;p.stats.crit=0;p.stats.weaponType='unarmed';p.stats.spRegen=0;p.mp=p.maxMp=200;p.cd.attack=999;
 const e=spawn(g,1,4);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',remaining:99,value:1}];let seq=10;
 const request=async(id:string,predicate:(v:any)=>boolean)=>{const n=peer.messages.length;peer.send({t:'act',a:id,target:id==='boxer_03'?undefined:e.id,seq:seq++});return peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='ev'&&m.list.some(predicate));};
 const mp=p.mp;peer.send({t:'act',a:'boxer_03',seq:seq++});await wait(60);assert.equal(p.mp,mp);assert.equal(p.cd.boxer_03||0,0);
 for(let n=0;n<3;n++){p.cd.boxer_01=0;await request('boxer_01',v=>v.type==='hit'&&v.skillId==='boxer_01');}assert.equal(p.boxerCombo!.steps,3);
 await request('boxer_10',v=>v.type==='hit'&&v.skillId==='boxer_10');assert.equal(p.boxerCombo!.steps,3);const stunEvent=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]).find((v:any)=>v.type==='hit'&&v.skillId==='boxer_10');assert.equal(stunEvent.breakdown.base,160);assert(e.statuses.some(s=>s.id==='stun'&&s.remaining<=.5));
 const before=p.mp;peer.send({t:'act',a:'boxer_03',target:e.id,seq:seq++});peer.send({t:'act',a:'boxer_03',boxerCombo:{steps:3},seq:seq++});peer.send({t:'act',a:'boxer_11',target:e.id,boxerBonus:999,seq:seq++});await wait(60);assert.equal(p.mp,before);assert.equal(p.boxerCombo!.steps,3);
 await request('boxer_03',v=>v.type==='skillImpact'&&v.skillId==='boxer_03');assert.equal(p.mp,before-10);assert.equal(p.boxerCombo,undefined);assert.equal(p.statuses.find(s=>s.id==='finisher_ready')!.value,10);
 const own=await peer.until(m=>m.t==='snap'&&m.players.some((v:any)=>v.id===p.id&&v.statuses.some((s:any)=>s.id==='finisher_ready')));assert.equal(own.players.find((v:any)=>v.id===p.id).statuses.find((s:any)=>s.id==='finisher_ready').value,10);
 await request('boxer_11',v=>v.type==='hit'&&v.skillId==='boxer_11');p.target=null;assert.equal(p.mp,before-30);assert(!p.statuses.some(s=>s.id==='finisher_ready'));assert(p.cd.boxer_11>0);
 const finish=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]).find((v:any)=>v.type==='hit'&&v.skillId==='boxer_11');assert(Math.abs(finish.breakdown.base-253)<1e-8);
 const pub=JSON.parse(snapshotParts(room).others.get(p.id)!);assert.equal(pub.boxerCombo,null);assert.equal(pub.masteries,undefined);
 p.boxerCombo={steps:1,until:g.time+4};p.cd.boxer_03=0;await request('boxer_03',v=>v.type==='skillImpact'&&v.skillId==='boxer_03');
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert.equal(p.boxerCombo,undefined);assert(!p.statuses.some(s=>s.id==='finisher_ready'));
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.boxer_01,3);for(const id of ['boxer_03','boxer_10','boxer_11'])assert.equal(saved.skills![id],1);assert.equal(saved.hotbar![2].skill,'boxer_11');assert.equal((saved as any).boxerCombo,undefined);assert.equal((saved as any).statuses,undefined);
});


test('Archer speed learns/saves/casts over WebSocket, preserves Root/Slow and sends the actual movement multiplier',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f;room.game.enemies=[];p.masteries.Archer=25;p.skillPoints=2;
 for(const [i,id]of ['archer_01','archer_04'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'archer_04':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='archer_04'));
 p.x=0;p.z=4;p.stats.spRegen=0;p.mp=Math.min(50,p.maxMp);p.stats.weaponType='staff';p.statuses=[{id:'root',sourceId:'fixture',remaining:10,value:1},{id:'slow',sourceId:'fixture',remaining:10,value:.5}];const mp=p.mp,base=p.stats.moveSpeed;
 peer.send({t:'act',a:'archer_04',target:123,seq:3});peer.send({t:'act',a:'archer_04',ally:p.id,seq:4});peer.send({t:'act',a:'archer_04',speed:999,seq:5});await wait(60);assert.equal(p.mp,mp);
 const n=peer.messages.length;peer.send({t:'act',a:'archer_04',seq:6});const snap=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.statuses.some((s:any)=>s.sourceId==='archer_04')));
 const own=snap.players.find((v:any)=>v.id===p.id);assert.equal(p.mp,mp-12);assert(p.cd.archer_04>0);assert(own.statuses.some((s:any)=>s.id==='root'));assert(own.statuses.some((s:any)=>s.id==='slow'));assert(Math.abs(own.moveSpeed-base*1.12*.5)<1e-8);
 peer.send({t:'steer',dx:1,dz:0,seq:7});await wait(100);assert.equal(p.x,0);p.statuses=p.statuses.filter(s=>s.id!=='root');p.attack=0;await peer.until(m=>m.t==='snap'&&m.players.some((v:any)=>v.id===p.id&&v.x>0));assert(p.x>0);
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert(!p.statuses.some(s=>s.sourceId==='archer_04'));
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.archer_04,1);assert.equal(saved.hotbar![0].skill,'archer_04');
});

test('water seal uses real WebSocket target/cast/MATK/Slow rules, rejects injected results and saves its rank/bar',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Mage=25;p.skillPoints=2;
 for(const [i,id]of ['mage_01','mage_04'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'mage_04':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='mage_04'));
 p.x=0;p.z=4;p.stats.matk=100;p.stats.spRegen=0;p.stats.weaponType='bow';p.mp=Math.min(60,p.maxMp);p.cd.attack=999;
 const foes=[4,4.2].map(x=>{const e=spawn(g,x,4);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',remaining:99,value:1}];return e;});const mp=p.mp;
 peer.send({t:'act',a:'mage_04',target:foes[0].id,damage:99999,slow:1,seq:3});peer.send({t:'act',a:'mage_04',ally:p.id,seq:4});await wait(60);assert.equal(p.mp,mp);
 peer.send({t:'act',a:'mage_04',target:foes[0].id,seq:5});await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='skill'&&v.skillId==='mage_04'));p.target=null;assert.equal(foes[0].hp,10000);assert.equal(p.mp,mp-14);
 await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='hit'&&v.skillId==='mage_04'));assert(foes[0].hp<10000);assert.equal(foes[1].hp,10000);assert(p.cd.mage_04>0);
 const slow=foes[0].statuses.find(s=>s.id==='slow')!;assert.equal(slow.value,.25);assert(slow.remaining>1.5&&slow.remaining<=2);assert(!foes[0].statuses.some(s=>s.id==='stun'||s.id==='knockup'));
 const hit=peer.messages.flatMap(m=>m.t==='ev'?m.list:[]).find((v:any)=>v.type==='hit'&&v.skillId==='mage_04');assert.equal(hit.element,'water');assert.equal(hit.breakdown.base,90);
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.mage_04,1);assert.equal(saved.hotbar![0].skill,'mage_04');
});


test('one-hit spirit learns/casts/saves over WebSocket, rejects selectors/results and consumes on one real enemy impact',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Summoner=25;p.skillPoints=2;
 for(const [i,id]of ['shaman_01','shaman_04'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'shaman_04':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='shaman_04'));
 p.x=0;p.z=4;p.stats.spRegen=0;p.stats.hpRegen=0;p.stats.softMdef=0;p.mp=Math.min(50,p.maxMp);p.hp=p.maxHp=10000;p.stats.weaponType='dagger';const mp=p.mp;
 const e=spawn(g,4,4);e.hp=e.maxHp=10000;e.cooldown=999;e.wander=999;
 peer.send({t:'act',a:'shaman_04',target:e.id,seq:3});peer.send({t:'act',a:'shaman_04',ally:p.id,seq:4});peer.send({t:'act',a:'shaman_04',intercept:999,seq:5});await wait(60);assert.equal(p.mp,mp);
 const n=peer.messages.length;peer.send({t:'act',a:'shaman_04',seq:6});const snap=await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.statuses.some((s:any)=>s.id==='spirit_intercept')));
 assert.equal(p.mp,mp-20);assert(p.cd.shaman_04>0);assert.equal(p.summon,undefined);assert.equal(snap.players.find((v:any)=>v.id===p.id).statuses.find((s:any)=>s.id==='spirit_intercept').value,.1);
 const pub=JSON.parse(snapshotParts(room).others.get(p.id)!);assert.equal(pub.statuses.find((s:any)=>s.id==='spirit_intercept').value,undefined);assert.equal(pub.masteries,undefined);
 g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:p.x,z:p.z,vx:0,vz:0,life:1,damage:100,phase:1});await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='spiritIntercept'&&v.skillId==='shaman_04'));
 assert.equal(p.hp,9910);assert(!p.statuses.some(s=>s.id==='spirit_intercept'));assert.equal(e.masterySupport![p.id].Summoner,10);
 p.invulnerable=0;const second=peer.messages.length;g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:p.x,z:p.z,vx:0,vz:0,life:1,damage:100,phase:1});await peer.until(m=>peer.messages.indexOf(m)>=second&&m.t==='ev'&&m.list.some((v:any)=>v.type==='hurt'));assert.equal(p.hp,9810);
 p.cd.shaman_04=0;p.mp=mp;const recast=peer.messages.length;peer.send({t:'act',a:'shaman_04',seq:7});await peer.until(m=>peer.messages.indexOf(m)>=recast&&m.t==='snap'&&m.players.some((v:any)=>v.statuses.some((s:any)=>s.id==='spirit_intercept')));
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert(!p.statuses.some(s=>s.id==='spirit_intercept'));
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.shaman_04,1);assert.equal(saved.hotbar![0].skill,'shaman_04');assert.equal((saved as any).statuses,undefined);
});

test('cleanse learns/saves over WebSocket, rejects client-authored status/results and removes real ticking Burn before travel cleanup',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Healer=25;p.skillPoints=2;
 for(const [i,id]of ['healer_01','healer_04'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'healer_04':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='healer_04'));
 p.stats.matk=101;p.stats.hpRegen=0;p.stats.spRegen=0;p.hp=p.maxHp=1000;p.mp=Math.min(50,p.maxMp);const mp=p.mp;
 peer.send({t:'act',a:'healer_04',target:123,seq:3});peer.send({t:'act',a:'healer_04',ally:'00000000-0000-4000-8000-000000000000',seq:4});peer.send({t:'act',a:'healer_04',ally:p.id,burn:true,amount:9999,seq:5});await wait(60);assert.equal(p.mp,mp);assert(!p.statuses.some(s=>s.id==='burn'));
 assert(applyPlayerBurn(g,p));const n=peer.messages.length;await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='snap'&&m.players.some((v:any)=>v.hp===970));assert.equal(p.hp,970);
 peer.send({t:'act',a:'healer_04',ally:p.id,seq:6});await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='skillImpact'&&v.skillId==='healer_04'&&v.cleansed==='burn'));
 assert.equal(p.hp,1000);assert.equal(p.mp,mp-18);assert(p.cd.healer_04>0);assert(!p.statuses.some(s=>s.id==='burn'));assert.equal(p.masteryExp.Healer,0);
 assert(applyPlayerBurn(g,p));p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert(!p.statuses.some(s=>s.id==='burn'));
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.healer_04,1);assert.equal(saved.hotbar![0].skill,'healer_04');assert.equal((saved as any).statuses,undefined);
});

test('smoke and qi push learn/save through WebSocket, reject target/results and broadcast real field/forced movement',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];g.random=()=>.5;p.masteries.Assassin=p.masteries.Boxer=25;p.skillPoints=4;
 for(const [i,id]of ['rogue_01','rogue_04','boxer_01','boxer_04'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 const slots=p.hotbar.map((s,i)=>({...s,skill:i===0?'rogue_04':i===1?'boxer_04':null}));peer.send({t:'hotbar',slots});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].skill==='rogue_04'));
 p.x=0;p.z=4;p.stats.spRegen=0;p.stats.hpRegen=0;p.mp=p.maxMp=100;p.cd.attack=999;const e=spawn(g,1,4);e.hp=e.maxHp=10000;e.cooldown=e.wander=999;
 peer.send({t:'act',a:'rogue_04',target:e.id,seq:5});peer.send({t:'act',a:'boxer_04',ally:p.id,seq:6});peer.send({t:'act',a:'boxer_04',push:999,seq:7});await wait(60);assert.equal(p.mp,100);assert.equal(g.smokeFields.length,0);assert.equal(e.x,1);
 peer.send({t:'act',a:'rogue_04',seq:8});const snap=await peer.until(m=>m.t==='snap'&&m.smokeFields?.length===1);assert.equal(snap.smokeFields[0].ownerId,p.id);assert.equal(p.mp,82);
 peer.send({t:'act',a:'boxer_04',seq:9});await peer.until(m=>m.t==='ev'&&m.list.some((v:any)=>v.type==='skillDisplace'&&v.skillId==='boxer_04'));assert(Math.abs(e.x-3)<1e-8);assert.equal(e.hp,10000);assert.equal(p.mp,64);assert(e.statuses.some(s=>s.id==='slow'));
 p.x=GATES.meadow.north.x;p.z=GATES.meadow.north.z;peer.send({t:'travel',gate:'north'});const moved=await peer.until(m=>m.t==='snap'&&m.mapId==='city_plaza');assert.equal(moved.smokeFields.length,0);
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.rogue_04,1);assert.equal(saved.skills!.boxer_04,1);assert.equal(saved.hotbar![0].skill,'rogue_04');assert.equal((saved as any).smokeFields,undefined);
});

test('classless stat passives learn/save/reconnect with real derived stats, never refill MP or enter the bar',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f;room.game.enemies=[];p.masteries.Mage=p.masteries.Assassin=100;p.skillPoints=3;p.mp=0;p.stats.spRegen=0;
 const before={mp:p.maxMp,flee:p.stats.flee,cast:p.stats.castMul};
 for(const [i,id]of ['mage_07','mage_08','rogue_07'].entries()){peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));}
 assert(Math.abs(p.maxMp-before.mp*1.02)<1e-8);assert.equal(p.stats.flee,before.flee);assert(Math.abs(p.stats.castMul-Math.max(.5,before.cast*.99))<1e-8);assert(p.mp<1);
 const n=peer.messages.length;peer.send({t:'hotbar',slots:p.hotbar.map((s,i)=>({...s,skill:i===0?'mage_07':s.skill}))});await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='ev'&&m.list.some((e:any)=>e.type==='skillsError'));assert(!p.hotbar.some(s=>s.skill==='mage_07'));
 const saved=(await f.store.character(f.c.accountId,p.id))!;assert.equal(saved.skills!.mage_08,1);assert.equal(saved.masteries!.Mage,100);
 peer.ws.close();await once(peer.ws,'close');await wait(80);const next=await f.open();await next.until(m=>m.t==='snap'&&m.players.some((v:any)=>v.skills?.mage_08===1));const restored=[...f.rt.rooms.values()].flatMap(r=>[...r.game.players.values()]).find(v=>v.id===p.id)!;assert(Math.abs(restored.maxMp-before.mp*1.02)<1e-8);assert.equal(restored.stats.flee,before.flee);
});


test('Auto Spell modes and Mix persist through the real hotbar WebSocket; injected results and combat swaps fail',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;
 g.enemies=[];p.masteries=Object.fromEntries(Object.keys(p.masteries).map(k=>[k,100])) as typeof p.masteries;
 p.skills={...p.skills,...Object.fromEntries(g.data.mastery.skills.map(s=>[s.id,s.maxRank]))};p.lastCombat=-Infinity;
 const slots=p.hotbar.map((s,i)=>({...s,skill:['mage_01','mage_04','archer_01'][i]??null,...(i===0?{mode:'autoSpell'}:i===1?{signature:'M05'}:{})}));
 const mark=peer.messages.length;peer.send({t:'hotbar',slots});await peer.until(m=>peer.messages.indexOf(m)>=mark&&m.t==='ev'&&m.list.some((e:any)=>e.job?.hotbar[0].mode==='autoSpell'));
 const stored=(await f.store.character(f.c.accountId,p.id))!;assert.equal(stored.hotbar![0].mode,'autoSpell');assert.equal(stored.hotbar![1].signature,'M05');
 const saved=structuredClone(p.hotbar);peer.send({t:'hotbar',slots:slots.map((s,i)=>i===0?{...s,rank:3,damage:99999}:s)});await wait(40);assert.deepEqual(p.hotbar,saved);
 p.lastCombat=g.time;const n=peer.messages.length;peer.send({t:'hotbar',slots:slots.map(s=>({...s,signature:undefined}))});await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='ev'&&m.list.some((e:any)=>e.type==='skillsError'));assert.deepEqual(p.hotbar,saved);
 peer.ws.close();await once(peer.ws,'close');const resumed=await f.open();const snap=await resumed.until(m=>m.t==='snap'&&m.players.some((a:any)=>a.hotbar?.[0].mode==='autoSpell'));assert.equal(snap.players.find((a:any)=>a.id===p.id).hotbar[1].signature,'M05');
});

test('new ally healing validates party ownership and the public snapshot exposes only visual state',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];
 p.masteries.Healer=100;p.skills={...p.skills,...Object.fromEntries(g.data.mastery.skills.filter(s=>s.school==='Healer').map(s=>[s.id,s.maxRank]))};p.skills.healer_05=1;
 const ally=addPlayer(g,'00000000-0000-4000-8000-000000000099',g.data.stats.defaultBuild);ally.x=p.x+.5;ally.z=p.z;ally.hp=1;ally.stats.hpRegen=0;ally.cd.attack=999;p.mp=p.maxMp;p.stats.spRegen=0;p.hp=p.maxHp;const mp=p.mp;
 peer.send({t:'act',a:'healer_05',ally:ally.id,seq:1});await wait(50);assert.equal(p.mp,mp);
 g.partyMembers=()=>[p.id,ally.id];const n=peer.messages.length;peer.send({t:'act',a:'healer_05',ally:ally.id,seq:2});await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='ev'&&m.list.some((e:any)=>e.type==='heal'&&e.playerId===ally.id));assert(ally.hp>1);assert.equal(p.mp,mp-g.data.mastery.skills.find(s=>s.id==='healer_05')!.ranks[0].mp);
 const events=peer.messages.slice(n).flatMap(m=>m.t==='ev'?m.list:[]);for(const event of events){assert.equal(event.inventory,undefined);assert.equal(event.profile,undefined);assert.equal(event.hotbar,undefined);}
 const pub=JSON.parse(snapshotParts(room).others.get(p.id)!);assert.equal(pub.skills,undefined);assert.equal(pub.hotbar,undefined);assert.equal(pub.masteries,undefined);assert('masteryFx' in pub);
});

test('all38 remaining passives learn and persist through real WebSocket with strict ranks and no hotbar injection',async t=>{
 const f=await setup(t,false,true),{p,peer,room}=f,g=room.game;g.enemies=[];
 p.masteries=Object.fromEntries(Object.keys(p.masteries).map(k=>[k,100])) as typeof p.masteries;
 p.skills={...p.skills,...Object.fromEntries(g.data.mastery.skills.map(s=>[s.id,s.maxRank]))};p.skillPoints=1000;p.mp=0;
 const old=new Set(['archer_07','mage_07','mage_08','rogue_07']),ids=g.data.mastery.skills.filter(s=>s.passive&&s.school!=='Swordsman'&&!old.has(s.id)).map(s=>s.id);assert.equal(ids.length,38);
 for(const [i,id]of ids.entries()){if(i&&i%20===0)await wait(1050);const payPath=(key:string)=>{for(const r of g.data.mastery.skills.find(s=>s.id===key)!.requires){p.skills[r.id]=Math.max(p.skills[r.id]??0,r.rank);payPath(r.id);}};payPath(id);p.skills[id]=0;const n=peer.messages.length;peer.send({t:'skillUp',id,seq:i+1});await peer.until(m=>peer.messages.indexOf(m)>=n&&m.t==='ev'&&m.list.some((e:any)=>e.job?.skills[id]===1));assert.equal(p.skills[id],1);}
 assert.equal(p.skillPoints,962);const stored=(await f.store.character(f.c.accountId,p.id))!;for(const id of ids)assert(stored.skills![id]>=1,id);
 const bar=structuredClone(p.hotbar);peer.send({t:'hotbar',slots:p.hotbar.map((s,i)=>({...s,skill:i===0?'healer_07':s.skill}))});await wait(50);assert.deepEqual(p.hotbar,bar);
 peer.ws.close();await once(peer.ws,'close');const resumed=await f.open();const snap=await resumed.until(m=>m.t==='snap'&&m.players.some((v:any)=>v.skills?.boxer_21===1));for(const id of ids)assert(snap.players.find((v:any)=>v.id===p.id).skills[id]>=1,id);
});
