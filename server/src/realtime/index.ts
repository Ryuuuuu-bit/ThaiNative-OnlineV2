import {applyInventory,equipped,inventoryWeight,type InventoryOp,normalizeAuto,DEFAULT_UI} from '@thainative/shared';
import { CITY_BUILDINGS, CITY_SPAWN, travelDestination, healerHeal, isField, BOSS_RESPAWN_MS, bossTimer, setBossTimer, type MapId } from "@thainative/shared";
import { normalizeQuests, acceptQuest, questStatus, questTurnInItems, completeQuest, recordKill, recordStore, giverPosition, QUEST_TALK_RANGE, grantExp } from "@thainative/shared";
import {needsJob} from '../store/progress.js';
import type { Server } from "node:http";
import { performance } from "node:perf_hooks";
import { randomUUID, randomInt } from "node:crypto";
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
import { IntentSchema, normalizeAutoPotion, type Intent } from "@thainative/shared";
import type { Store, Character, Progress } from "../store/types.js";
import { hashToken } from "../session.js";
import { createSocial } from "./social.js";
interface Peer {
 leaseOwner?:string; busy?:number; deferred?:Intent[]; uiLoading?:boolean;
 ui?:import('@thainative/shared').UISettings;
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
 joining?:number; leases?:Map<string,string>; quarantined?:boolean; dropRequests?:Map<string,string>;
}
export interface RealtimeOptions {
	store: Store;
	build: string;
	secret?: string;
	sharedRooms?: boolean;
	heartbeatMs?:number;pruneMs?:number;reconnectMs?: number;
	tickMs?: number;
		adminIds?: string[];
	/** Internet cafés share one public IP, so keep these generous. */
	ipMaxSockets?: number; ipUpgradesPerMinute?: number;
	production?: boolean;
	devJobExpMultiplier?: number;
}
const round = (n: number) => Math.round(n * 1000) / 1000;
const playerKeys = [
	"id", "reviveRemaining", "bossReadyAt", "bossCooldowns", "mapId", "healerReadyAt", "returnRemaining", "returnReadyAt",
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
/** Fields other players need to render someone (keeps shared-room snapshots small). */
const publicKeys = ["id","name","x","z","fx","fz","hp","maxHp","level","jobId","dead","moving","attack","attackKind","combo","dash","invulnerable","hurt","castRemaining","mapId"] as const;
const num = (v: unknown) => (typeof v === "number" ? round(v) : v);
function ownEntry(p: Player) {
	return {
		...Object.fromEntries(playerKeys.map((k) => [k, num(p[k])])),
		cd: Object.fromEntries(Object.entries(p.cd).map(([k, v]) => [k, round(v)])),
		moveSpeed: p.stats.moveSpeed * (1 + Math.max(0, ...p.statuses.filter((s) => s.id === "speed").map((s) => s.value))) * (1 - Math.max(0, ...p.statuses.filter((s) => s.id === "slow").map((s) => s.value))),
	};
}
function publicEntry(p: Player) {
	return { ...Object.fromEntries(publicKeys.map((k) => [k, num(p[k])])), statuses: p.statuses.map((s) => ({ id: s.id, remaining: round(s.remaining) })) };
}
/** Everything in a snapshot that is the same for every viewer, serialised once per room per send. */
export function snapshotParts(room: Room) {
	const g = room.game;
	const others = new Map<string, string>();
	for (const p of g.players.values()) others.set(p.id, JSON.stringify(publicEntry(p)));
	// Entities are serialised once per room; each viewer then joins only those within ENTITY_RANGE (bosses always).
	const entity = <T extends { x: number; z: number }>(list: T[], map: (v: T) => unknown, always = (_v: T) => false) => list.map((v) => ({ x: v.x, z: v.z, always: always(v), json: JSON.stringify(map(v)) }));
	const enemies = entity(g.enemies, (e) => ({ id: e.id, statuses: e.statuses, dataId: e.dataId, x: round(e.x), z: round(e.z), hp: e.hp, maxHp: e.maxHp, boss: e.boss, dead: e.dead, motion: e.motion, motionTime: round(e.motionTime), motionDuration: e.motionDuration, bossPhase: e.bossPhase, variant: e.variant, deathAge: round(e.deathAge), hurt: round(e.hurt), fx: round(e.fx), fz: round(e.fz), vx: round(e.vx), vz: round(e.vz), moving: e.moving, windup: round(e.windup), aimX: round(e.aimX), aimZ: round(e.aimZ), summoned: e.summoned }), (e) => e.boss);
	const drops = entity(g.drops, (d) => ({ ...d, x: round(d.x), z: round(d.z), time: round(d.time) }));
	const projectiles = entity(g.projectiles, (p) => ({ ...p, x: round(p.x), z: round(p.z) }));
	const world = (me?: { x: number; z: number }) => {
		const pick = (list: typeof enemies) => list.filter((v) => !me || v.always || Math.abs(v.x - me.x) <= ENTITY_RANGE && Math.abs(v.z - me.z) <= ENTITY_RANGE).map((v) => v.json).join(",");
		return '"enemies":[' + pick(enemies) + '],"drops":[' + pick(drops) + '],"projectiles":[' + pick(projectiles) + "]";
	};
	return { others, world };
}
/** One viewer's snapshot as a JSON string: own entry carries private fields, others are public only. */
/** Interest management: other players beyond this range, or past the nearest cap, are left out of a viewer's snapshot. */
export const VIEW_RANGE = 32, VIEW_MAX_PLAYERS = 30, ENTITY_RANGE = 40;
export function snapshotFrame(room: Room, peer: Peer, parts = snapshotParts(room), always: string[] = []) {
	const g = room.game, me = g.players.get(peer.id);
	const head = JSON.stringify({ t: "snap", mapId: g.mapId, bossIn: Math.ceil(bossTimer(g)), weight: me?.inventory ? inventoryWeight(me.inventory, g.data) : 0, weightLimit: me?.stats.weight, tick: room.tick, ack: peer.ack, time: g.time, kills: g.kills, bossSpawned: g.bossSpawned, won: g.won });
		const players: string[] = me ? [JSON.stringify(ownEntry(me))] : [];
	let nearby = [...g.players.values()].filter((p) => p.id !== peer.id && (!me || always.includes(p.id) || Math.hypot(p.x - me.x, p.z - me.z) <= VIEW_RANGE));
	if (me && nearby.length > VIEW_MAX_PLAYERS)
		nearby = nearby.map((p) => ({ p, d: always.includes(p.id) ? -1 : Math.hypot(p.x - me.x, p.z - me.z) })).sort((a, b) => a.d - b.d).slice(0, VIEW_MAX_PLAYERS).map((x) => x.p);
	for (const p of nearby) players.push(parts.others.get(p.id) ?? JSON.stringify(publicEntry(p)));
	return head.slice(0, -1) + ',"players":[' + players.join(",") + "]," + parts.world(me) + "}";
}
export function snapshot(room: Room, peer: Peer) {
	return JSON.parse(snapshotFrame(room, peer));
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
	const activeJoins=new Set<Promise<void>>();
 const ipLimits=new Map<string,{active:number;count:number;until:number}>();
 const joins=new Map<string,Promise<void>>(), saves=new Map<string,Promise<void>>();
 const wss = new WebSocketServer({
		noServer: true,
		maxPayload: 4096,
		perMessageDeflate: { threshold: 256 },
	});
	function send(ws: WebSocket, body: unknown) {
		if (ws.readyState !== WebSocket.OPEN) return;
				if (ws.bufferedAmount > 512 * 1024) {
			ws.close(4408, "slow consumer");
			return;
		}
		ws.send(typeof body === "string" ? body : JSON.stringify(body));
		sent++;
	}
 const social=createSocial<Peer>({live,send,adminIds:options.adminIds});
 function economy(peer:Peer,p:Player,op:InventoryOp,req:string,done=()=>{}) {
  const room=peer.room,g=room.game;
  if(op.op==='pickup'){
   if(peer.busy){const d=g.drops.find(d=>String(d.id)===op.id);if(d)d.pending=false;return;}
   try{applyInventory({inventory:p.inventory!,gold:p.gold},op,p.profile,data,randomUUID);}catch(error){const d=g.drops.find(d=>String(d.id)===op.id);if(d){d.pending=false;d.blocked=true;}send(peer.ws,{t:'ev',list:[{type:'notice',playerId:p.id,text:(error as Error).message}]});return;}
  }
  peer.busy=(peer.busy||0)+1;
  const operation=room.saveQueue.then(async()=>{
   const result=await store.inventoryOp(peer.accountId,p.id,req,op,{leaseOwner:peer.leaseOwner,bossLoot:op.op==='pickup'?(g.drops.find(d=>String(d.id)===op.id&&d.boss)?.bossId??(g.drops.some(d=>String(d.id)===op.id&&d.boss)?'king_jelly':undefined)):undefined,profile:structuredClone(p.profile),room:room.key,tick:room.tick});
   const latest=result.duplicate?await store.inventory(peer.accountId,p.id):result;
   p.inventory=latest.inventory;p.gold=latest.gold;refreshStats(g,p);
   if(result.error){if(op.op==='pickup')room.dropRequests?.delete(op.id!);throw Error(result.error);}
   if(result.effect&&!result.duplicate){const e=result.effect;if(e.kind==='hp'){const amount=Math.min(e.amount,p.maxHp-p.hp);p.hp+=amount;g.events.push({type:'heal',playerId:p.id,x:p.x,z:p.z,amount:Math.round(amount)});}if(e.kind==='sp')p.mp=Math.min(p.maxMp,p.mp+e.amount);if(e.kind==='speed')p.statuses.push({id:'speed',sourceId:p.id,remaining:60,value:e.amount});p.cd.potion=data.skills.skills.find(s=>s.id==='potion')!.cooldown;}
      done();if(op.op==='store'&&p.quests&&recordStore(p.quests,data).length)sendQuests(peer,p);if(op.op==='pickup')void save(room,p.id);sendStats(peer,p);send(peer.ws,{t:'inv',req,inventory:p.inventory,gold:p.gold});
   if(op.op==='pickup'){room.dropRequests?.delete(op.id!);}
   if(op.op==='pickup')send(peer.ws,{t:'ev',list:[{type:'itemPickup',playerId:p.id,loot:op.loot}]});
  });
    const settled=operation;
  room.saveQueue=operation.catch(e=>{
   const d=g.drops.find(d=>String(d.id)===op.id);if(op.op==='pickup'&&d){d.pending=false;d.noticeAt=g.time;d.blocked=true;}
   send(peer.ws,{t:'inv',req,error:(e as Error).message});send(peer.ws,{t:'ev',list:[{type:'notice',playerId:p.id,text:(e as Error).message}]});
  }).finally(()=>{peer.busy!--;while(!peer.busy&&peer.deferred?.length&&live.get(peer.id)===peer&&!closing)intent(peer,peer.deferred.shift()!,true);});
  return settled;
 }
 function sendQuests(peer:Peer,p:Player){send(peer.ws,{t:'quests',state:p.quests??{active:{},done:{}}});}
 const questBusy=new Set<string>();
 function questIntent(peer:Peer,p:Player,message:{op:'accept'|'turnIn'|'abandon';id:string}){
  const room=peer.room,g=room.game,q=data.quests.quests.find(q=>q.id===message.id);
  const fail=(text:string)=>send(peer.ws,{t:'questError',id:message.id,text});
  if(!q){fail('ไม่พบเควสต์');return;}
  p.quests??={active:{},done:{}};
  if(message.op==='abandon'){if(!p.quests.active[q.id]){fail('ยังไม่ได้รับเควสต์นี้');return;}delete p.quests.active[q.id];void save(room,p.id);sendQuests(peer,p);return;}
  const at=giverPosition(q.giver);
  if(p.dead||g.mapId!=='city_plaza'||Math.hypot(p.x-at.x,p.z-at.z)>QUEST_TALK_RANGE){fail('ไปคุยกับผู้ให้เควสต์ก่อน');return;}
  if(message.op==='accept'){
   try{acceptQuest(p.quests,q.id,p.level,Date.now(),data);}catch(e){fail((e as Error).message);return;}
   void save(room,p.id);sendQuests(peer,p);send(peer.ws,{t:'ev',list:[{type:'notice',playerId:p.id,text:`รับเควสต์ · ${q.nameTh}`}]});return;
  }
  if(questStatus(q,p.quests,p.level,Date.now(),p.inventory)!=='ready'){fail('ยังทำเควสต์ไม่ครบ');return;}
  if(questBusy.has(p.id)||peer.busy){fail('กำลังบันทึก กรุณารอสักครู่');return;}
  questBusy.add(p.id);
  const op={op:'quest' as const,loot:questTurnInItems(q),reward:q.rewards.items,gold:q.rewards.gold};
  const done=()=>{
   if(!p.quests?.active[q.id])return;
   completeQuest(p.quests,q.id,Date.now());
   grantExp(g,p,q.rewards.exp,q.rewards.jobExp,{quest:q.id});
   g.events.push({type:'questComplete',playerId:p.id,x:p.x,z:p.z,id:q.id,text:q.complete,rewards:q.rewards});
   flush(room);void save(room,p.id);sendQuests(peer,p);
  };
  const pending=economy(peer,p,op,randomUUID(),done);
  if(pending)void pending.catch(()=>{}).finally(()=>questBusy.delete(p.id));else questBusy.delete(p.id);
 }
 const bossDue=new Map<MapId,number>();
 function getRoom(mapId: MapId, id: string): Room {
  const key=mapId+(options.sharedRooms?'':':'+id);
  let room=rooms.get(key);
  if(!room){
   const game=createGame(randomInt(1,0x7fffffff),data.stats.defaultBuild,'local',data,mapId);
   game.jobExpMultiplier=options.production?1:Math.max(1,Math.min(1000,options.devJobExpMultiplier||1));
   game.partyMembers=id=>social.partyMembers(id);
   game.players.clear();
   room={key,game,peers:new Map(),accounts:new Map(),disconnected:new Map(),tick:0,saveQueue:Promise.resolve()};
   rooms.set(key,room);
   // Field bosses run on one schedule per map, surviving empty rooms being recycled.
   const due=isField(mapId)?bossDue.get(mapId):undefined;
   if(due&&due>Date.now())setBossTimer(game,(due-Date.now())/1000);
   const current=room;
   game.inventoryCommit=(p,op,done)=>{
    const peer=current.peers.get(p.id);if(!peer){const d=current.game.drops.find(d=>String(d.id)===op.id);if(d)d.pending=false;return;}
    current.dropRequests??=new Map();let req:string=randomUUID();if(op.op==='pickup'){const key=op.id!;req=current.dropRequests.get(key)||req;current.dropRequests.set(key,req);}
    economy(peer,p,op,req,done);
   };
  }
  return room;
 }
 function transfer(peer: Peer, destination: {mapId:MapId;x:number;z:number}) {
  const source=peer.room,p=source.game.players.get(peer.id)!;
  const target=getRoom(destination.mapId,peer.id);
  source.peers.delete(peer.id);source.game.players.delete(peer.id);source.accounts.delete(peer.id);source.disconnected.delete(peer.id);
  source.game.meteors=source.game.meteors.filter(m=>m.ownerId!==peer.id);
  Object.assign(p,destination,{target:null,destination:null,auto:false,autoState:'idle',autoPath:[],autoGoal:null,autoUnreachable:undefined,attack:0,dash:0,castRemaining:0,statuses:[],moving:false});
  if(destination.mapId==='city_plaza'&&destination.x===CITY_SPAWN.x&&destination.z===CITY_SPAWN.z){p.fx=0;p.fz=1;}
  refreshStats(target.game,p);
  peer.input={x:0,z:0};peer.room=target;
  target.game.players.set(p.id,p);target.peers.set(p.id,peer);target.accounts.set(p.id,peer.accountId);(target.leases??=new Map()).set(p.id,peer.leaseOwner!);
  target.saveQueue=Promise.all([source.saveQueue,target.saveQueue]).then(()=>{});
  void save(target,p.id);
  send(peer.ws,snapshotFrame(target,peer));
 }
	function save(room: Room, id: string, strict = false) {
		const p = room.game.players.get(id),
			accountId = room.accounts.get(id),leaseOwner=room.leases?.get(id);
		if (!p || !accountId) return room.saveQueue;
		const operation = room.saveQueue.then(async () => {
        const body: Progress = {
						bossReadyAt:p.bossReadyAt,bossCooldowns:{...p.bossCooldowns},autoSeconds:p.autoSeconds,quests:p.quests,
 jobId: p.jobId,
			jobLevel: p.jobLevel,
			jobExp: p.jobExp,
			skillPoints: p.skillPoints,
			skills: { ...p.skills },
			audioSettings: p.audioSettings,
			autoPotion: p.autoPotion && { hp: { ...p.autoPotion.hp }, mp: { ...p.autoPotion.mp } },
			hotbar: p.hotbar.map((s) => ({ ...s })),
			jobsVersion: 3,
			level: p.level,
			xp: Math.floor(p.xp),
			gold: p.gold,
			kills: p.kills,
			potions: p.potions,
			mapId: p.dead ? "city_plaza" : p.mapId,
 healerReadyAt: p.healerReadyAt, returnReadyAt:p.returnReadyAt,
 posX: p.dead ? CITY_SPAWN.x : p.x,
			posZ: p.dead ? CITY_SPAWN.z : p.z,
			baseStats: { ...p.profile.baseStats },
			race: p.profile.race,
			classId: p.profile.classId,
			statPoints: p.statPoints,
			autoAllocate: p.autoAllocate,
			autoAllocCursor: p.autoAllocCursor,
			dataVersion: 1,
		};
			await store.saveProgress(accountId, id, body,leaseOwner);
		});
		room.saveQueue = operation.catch((e) => {
			console.error("Realtime save failed", e instanceof Error ? e.message : e);
		});
		const saved=room.saveQueue;saves.set(id,saved);void saved.finally(()=>{if(saves.get(id)===saved)saves.delete(id);});
		return strict ? operation : room.saveQueue;
	}
		function flush(room: Room) {
		const list = room.game.events.splice(0);
		if (!list.length) return;
		for (const e of list) if (e.type === "kill" && e.boss && (room.game.mapId === "meadow" || room.game.mapId === "forest")) bossDue.set(room.game.mapId, Date.now() + BOSS_RESPAWN_MS(room.game.mapId));
		for (const e of list)
			if (e.type === "kill" && e.dataId && e.ownerId) {
				const ids = social.partyMembers(String(e.ownerId));
				for (const id of ids) {
					const member = room.game.players.get(id);
					if (!member?.quests || member.dead || (id !== e.ownerId && Math.hypot(member.x - e.x, member.z - e.z) > data.quests.shareRange)) continue;
					if (recordKill(member.quests, String(e.dataId), data).length) { const peer = room.peers.get(id); if (peer) sendQuests(peer, member); }
				}
			}
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
				if (e.type === "victory"){
					for (const id of room.game.players.keys()) void save(room, id);
					const winner=room.game.players.get(String(e.playerId));if(winner)social.system(`✦ ${winner.name} ปราบราชาวุ้นสำเร็จ!`);
				}
				else void save(room, String(e.playerId));
			}
	}
	function sendStats(peer: Peer, p: Player) {
 if(!peer.ui&&!peer.uiLoading){peer.uiLoading=true;void store.uiSettings(peer.accountId).then(settings=>{peer.ui=settings;const {auto,...ui}=settings;p.autoCfg=normalizeAuto(auto);send(peer.ws,{t:'uiSettings',settings:ui});send(peer.ws,{t:'autoSettings',settings:p.autoCfg});}).catch(()=>send(peer.ws,{t:'uiSettingsError',text:'โหลดการตั้งค่าไม่สำเร็จ'})).finally(()=>{peer.uiLoading=false;});}
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
					audioSettings: p.audioSettings,
					autoPotion: p.autoPotion,
					job: normalizeJob(p),
				},
			],
		});
	}
	function intent(peer: Peer, message: Intent, queued=false) {
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
            const p=g.players.get(peer.id);if(p)send(peer.ws,{t:"inv",inventory:p.inventory,gold:p.gold});
			if (!peer.ready) {
				peer.ready = true;
				room.disconnected.delete(peer.id);
			}
			send(peer.ws, snapshotFrame(room, peer));
			sendStats(peer, g.players.get(peer.id)!);
						social.ready(peer);
			{const qp=g.players.get(peer.id);if(qp)sendQuests(peer,qp);}
			return;
		}
		if (!peer.ready) return;
		if (message.t === "chat") { social.chat(peer, message); return; }
				if (message.t === "party") { social.party(peer, message); return; }
		if (message.t === "quest") { const qp=g.players.get(peer.id);if(qp)questIntent(peer,qp,message); return; }
		if (!queued && "seq" in message) {
			if (message.seq <= peer.ack) return;
			peer.ack = message.seq;
		}
        const player=g.players.get(peer.id)!;
        if(!player.autoCfg&&peer.ui?.auto)player.autoCfg=normalizeAuto(peer.ui.auto);
        if(peer.busy&&(['travel','revive','returnCity'].includes(message.t)||(message.t==='inv'&&message.op==='use'))){(peer.deferred??=[]).push(message);return;}
        if(message.t==='inv'){
         const reject=(error:string)=>send(peer.ws,{t:'inv',req:message.req,error});
         if(player.dead){reject('รอฟื้นตัวก่อน');return;}
         if(message.op==='pickup'){const d=g.drops.find(d=>d.id===message.drop);if(d)d.blocked=false;if(d&&!d.pending&&(d.ownerId===player.id||d.time>=data.economy.lootOwnershipSeconds)&&Math.hypot(player.x-d.x,player.z-d.z)<4){moveTo(g,d.x,d.z);}return;}
         if(message.op==='buy'||message.op==='sell'){const npc=CITY_BUILDINGS.find(b=>b.id===message.shop);if(g.mapId!=='city_plaza'||!npc||Math.hypot(player.x-npc.talk.x,player.z-npc.talk.z)>=3){reject('ไปพบพ่อค้าก่อน');return;}}
         if(message.op==='store'||message.op==='retrieve'){const keeper=CITY_BUILDINGS.find(b=>b.id==='storage')!;if(g.mapId!=='city_plaza'||Math.hypot(player.x-keeper.talk.x,player.z-keeper.talk.z)>=3){reject('ไปพบคนเฝ้าคลังก่อน');return;}}
         if(message.op==='use'&&(player.cd.potion>0||peer.busy)){reject('รอคูลดาวน์ยาหรือการบันทึกก่อน');return;}
         economy(peer,player,message,message.req);return;
        }
        if(message.t==='autoSettings'){
 const auto=normalizeAuto(message.settings);player.autoCfg=auto;const merged={...(peer.ui??DEFAULT_UI),auto};peer.ui=merged;
 void store.saveUISettings(peer.accountId,merged).then(()=>send(peer.ws,{t:'autoSettings',settings:auto})).catch(()=>send(peer.ws,{t:'autoSettingsError',text:'บันทึกตั้งค่า AUTO ไม่สำเร็จ'}));return;
 }
        if(message.t==='uiSettings'){
 const reserved=['KeyI','KeyH','KeyZ','Escape','KeyW','KeyA','KeyS','KeyD','KeyK','KeyC','KeyI','KeyM','KeyR','KeyF','KeyT','KeyJ'];
 const bindings=Object.values(message.settings.keys);
 if(new Set(bindings).size!==bindings.length||Object.entries(message.settings.keys).some(([name,k])=> !/^(Key[A-Z]|Digit[0-9]|F[0-9]+)$/.test(k)||(reserved.includes(k)&&k!==(name==='returnCity'?'KeyH':'KeyZ'))||player.hotbar.some(s=>s.key===k))){send(peer.ws,{t:'uiSettingsError',text:'ปุ่มนี้ถูกใช้อยู่แล้ว'});return;}
 const merged={...message.settings,...(peer.ui?.auto?{auto:peer.ui.auto}:{})};void store.saveUISettings(peer.accountId,merged).then(()=>{peer.ui=merged;send(peer.ws,{t:'uiSettings',settings:message.settings});}).catch(()=>send(peer.ws,{t:'uiSettingsError',text:'บันทึกการตั้งค่าไม่สำเร็จ'}));return;
 }

 if(message.t==='returnCity'){
 if(player.dead||g.mapId==='city_plaza'||Date.now()<(player.returnReadyAt||0)||g.enemies.some(e=>e.boss&&!e.dead&&e.engaged)){
 send(peer.ws,{t:'ev',list:[{type:'notice',playerId:peer.id,text:'ยังกลับเมืองไม่ได้: อยู่ในเมือง รอคูลดาวน์ หรือต่อสู้กับราชาวุ้น'}]});return;}
 if(!player.returnRemaining){player.returnRemaining=5;withPlayer(g,peer.id,()=>{setAuto(g,false);player.target=null;player.destination=null;});peer.input={x:0,z:0};}return;
 }
 if(message.t==='pickupAll'){
 if(!player.dead)for(const d of g.drops){d.blocked=false;}
 if(!player.dead)for(const d of g.drops)if(!d.pending&&(d.ownerId===player.id||d.time>=data.economy.lootOwnershipSeconds)&&Math.hypot(d.x-player.x,d.z-player.z)<=4){d.x=player.x;d.z=player.z;d.time=Math.max(.26,d.time);}return;
 }
 if(player.returnRemaining&&(['move','target','act','travel','auto'].includes(message.t)||(message.t==='steer'&&Math.hypot(message.dx,message.dz)>.05)))player.returnRemaining=0;

        if(message.t==='travel'){
         const destination=travelDestination(g.mapId,message.gate,player);
         if(destination)transfer(peer,destination);
         else send(peer.ws,{t:'ev',list:[{type:'notice',playerId:peer.id,text:'หมอกหนาเกินไป ยังผ่านไม่ได้'}]});
         return;
        }
        if(message.t==='revive' && player.dead){
         if((player.reviveRemaining??0)>0)return;
         withPlayer(g,peer.id,()=>revive(g));flush(room);transfer(peer,{mapId:'city_plaza',...CITY_SPAWN});return;
        }
		withPlayer(g, peer.id, () => {
			const p = g.p;
 if(message.t==="heal"){if(healerHeal(g,Date.now()))void save(room,p.id);return;}
            if (message.t === "autoPotion") {
              p.autoPotion = { hp: { ...message.settings.hp }, mp: { ...message.settings.mp } };
              void save(room, p.id, true).then(() => send(peer.ws, {t:"autoPotion", settings:p.autoPotion})).catch(() => send(peer.ws, {t:"autoPotionError"}));
              return;
            }
            if (message.t === "audioSettings") {
              p.audioSettings = { ...message.settings };
              void save(room, p.id, true).then(() => send(peer.ws, {t:"audioSettings", settings:p.audioSettings})).catch(() => send(peer.ws, {t:"audioSettingsError"}));
              return;
            }
			if (
				message.t === "skillUp" ||
				message.t === "hotbar" ||
				message.t === "jobChange"
			) {
				try {
					if (p.dead) throw Error("รอฟื้นตัวก่อน");
					if(message.t==='hotbar'&&message.slots.some(s=>Object.values(peer.ui?.keys??{returnCity:'KeyH',pickupAll:'KeyZ'}).includes(s.key)))throw Error('ปุ่มนี้ใช้กับกลับเมืองหรือเก็บรอบตัวแล้ว');
                    let next = normalizeJob(p);
					if (message.t === "skillUp") next = learnSkill(p, message.id, g.data);
					if (message.t === "hotbar")
						next = {
							...next,
							hotbar: validateHotbar(p, message.slots, g.data),
						};
					if (message.t === "jobChange") {
						if(g.mapId!=="city_plaza")throw Error("ไปพบทูตสวรรค์ในเมืองก่อน");
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
				if (walkable(message.x, message.z,.3,g.mapId)) {
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
			if (message.t === "act") {
 if(g.mapId==="city_plaza"){action(g,message.a);return;}
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
		if(closing){socket.destroy();return;}
        const ip=(options.production?String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',').at(-1)!.trim():req.socket.remoteAddress||'unknown'),now=Date.now();
        for(const[k,v]of ipLimits)if(v.until<=now&&!v.active)ipLimits.delete(k);
        let limit=ipLimits.get(ip);if(!limit){limit={active:0,count:0,until:now+60000};ipLimits.set(ip,limit);}if(limit.until<=now){limit.count=0;limit.until=now+60000;}
        if(++limit.count>(options.ipUpgradesPerMinute??60)||limit.active>=(options.ipMaxSockets??30)){socket.destroy();return;}
        limit.active++;socket.once('close',()=>{limit!.active--;});
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
		if (url.pathname !== "/api/ws") {
			socket.destroy();
			return;
		}
		wss.handleUpgrade(req, socket, head, (ws) => {
            let connectedPeer:Peer|undefined;
            ws.on('error',()=>{});
            ws.on('close',()=>{
             const peer=connectedPeer;if(!peer||live.get(peer.id)!==peer)return;
             live.delete(peer.id);peer.room.peers.delete(peer.id);peer.input={x:0,z:0};
             peer.room.disconnected.set(peer.id,Date.now());social.offline(peer.id);if(!closing)void save(peer.room,peer.id);
            });
			const task=(async () => {
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
				if(session?.selectedCharacterId)await saves.get(session.selectedCharacterId);
				let character = session?.selectedCharacterId
					? await store.character(
							session.accountId,
							session.selectedCharacterId,
						)
					: undefined;
				if (!session || !character) {
					ws.close(4401, "login and selected character required");
					return;
				}
				if (needsJob(character)) {
					ws.close(4412, "job selection required");
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
				const priorJoin=joins.get(character.id)||Promise.resolve();let releaseJoin!:()=>void;
                const gateJoin=new Promise<void>(resolve=>releaseJoin=resolve),join=priorJoin.then(()=>gateJoin);joins.set(character.id,join);await priorJoin;
                let claimed:string|undefined,joined=false,joiningRoom:Room|undefined,created=false;
                try {
                if(ws.readyState!==WebSocket.OPEN||closing)return;
                const old = live.get(character.id);
				if (old) {
					send(old.ws, { t: "kick", reason: "เข้าสู่ระบบจากที่อื่น" });
					old.ws.close(4409, "opened elsewhere");await save(old.room,old.id,true);
				}
                claimed=randomUUID();await store.claimLease(character.id,claimed);
                const refreshed=await store.character(session.accountId,character.id);if(!refreshed)throw Error('Character disappeared');character=refreshed;
                if(ws.readyState!==WebSocket.OPEN||closing)return;
                const characterId=character.id;let room=[...rooms.values()].find(r=>r.accounts.has(characterId)&&(r.game.players.has(characterId)||pending.has(characterId)))||getRoom(character.mapId||'city_plaza',character.id);
                joiningRoom=room;room.joining=(room.joining??0)+1;const mapId=room.game.mapId;

				if (!room.game.players.has(character.id)&&!pending.has(character.id)) {
					const profile = {
						...data.stats.defaultBuild,
						level: character.level,
						baseStats: character.baseStats,
						race: character.race,
						classId: character.classId,
					};
					await room.saveQueue;const economyState=await store.inventory(session.accountId,character.id);
                    if(ws.readyState!==WebSocket.OPEN||closing){return;}
                    created=true;const p = addPlayer(room.game, character.id, profile);p.inventory=economyState.inventory;p.gold=economyState.gold;
                    p.profile.equipment=equipped(p.inventory);
					Object.assign(p, normalizeJob(character));
                    p.audioSettings = character.audioSettings;
                    p.autoPotion = normalizeAutoPotion(character.autoPotion);
 	 p.quests=normalizeQuests(character.quests,data);p.bossReadyAt=character.bossReadyAt||0;p.bossCooldowns={...(character.bossCooldowns??{})};p.returnReadyAt=character.returnReadyAt||0;p.healerReadyAt=character.healerReadyAt||0;p.autoSeconds=character.autoSeconds||0;
					p.profile.classId = p.jobId;
					p.name = character.name;
					p.xp = character.xp;
					
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
						walkable(character.posX, character.posZ,.3,mapId)
					) {
						p.x = character.posX;
						p.z = character.posZ;
					}
					// A not-ready character is retained for resume but excluded from simulation and snapshots.
					room.game.players.delete(character.id);
					pending.set(character.id, p);
				}
				if(ws.readyState!==WebSocket.OPEN||closing){pending.delete(character.id);room.game.players.delete(character.id);return;}
                const leaseOwner=claimed;
                if(ws.readyState!==WebSocket.OPEN||closing){await store.releaseLease(character.id,leaseOwner);pending.delete(character.id);return;}
                const peer: Peer = {
                    leaseOwner,
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
				(room.leases??=new Map()).set(peer.id,leaseOwner);connectedPeer=peer;joined=true;
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
						peer.room.game.players.set(peer.id, pending.get(peer.id)!);
						pending.delete(peer.id);
					}
					intent(peer, parsed.data);
				});

				ws.on("error", () => {});
                } finally {if(joiningRoom)joiningRoom.joining!--;if(!joined){if(created&&joiningRoom){pending.delete(character.id);joiningRoom.game.players.delete(character.id);}if(joiningRoom&&!joiningRoom.joining&&!joiningRoom.peers.size&&!joiningRoom.game.players.size)rooms.delete(joiningRoom.key);if(claimed)await store.releaseLease(character.id,claimed).catch(e=>console.error('Join lease rollback failed',e));}releaseJoin();if(joins.get(character.id)===join)joins.delete(character.id);}
			})();activeJoins.add(task);void task.catch(error=>{console.error('Join failed',error);ws.close(1011,'connection failed');}).finally(()=>activeJoins.delete(task));
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
                if(room.quarantined)continue;
                try {
				for (const [id, at] of room.disconnected)
					if (now - at >= (options.reconnectMs ?? 60000)) {
						void save(room, id);
						room.game.players.delete(id);
						pending.delete(id);
						room.accounts.delete(id);
						room.disconnected.delete(id);
					}
				if (
					!room.peers.size && !room.joining &&
					!room.game.players.size &&
					!room.disconnected.size &&
                    !live.has(room.key.slice(room.key.indexOf(':')+1))
				) {
					rooms.delete(room.key);
					continue;
				}
				room.tick++;room.game.wallTime=now;
				const inputs = new Map<string, Vec>();
				for (const peer of room.peers.values())
					if (peer.ready) inputs.set(peer.id, peer.input);
				if (room.game.players.size)
					step(room.game, 0.05, { x: 0, z: 0 }, inputs);
				for(const peer of [...room.peers.values()]){
 const p=room.game.players.get(peer.id);if(!p?.returnRemaining||peer.busy)continue;
 if(p.dead||p.moving||room.game.events.some(e=>e.type==='hurt'&&e.playerId===p.id)||room.game.enemies.some(e=>e.boss&&!e.dead&&e.engaged)){p.returnRemaining=0;continue;}
 p.returnRemaining=Math.max(0,p.returnRemaining-.05);
 if(p.returnRemaining<1e-8){p.returnRemaining=0;p.returnReadyAt=now+60000;transfer(peer,{mapId:'city_plaza',...CITY_SPAWN});}
 }
 flush(room);
				let parts: ReturnType<typeof snapshotParts> | undefined;
				if (room.tick % 2 === 0)
					for (const peer of room.peers.values())
												if (peer.ready) {
							// A backed-up socket skips this frame (snapshots are superseded) instead of growing the buffer.
							if (peer.ws.bufferedAmount > 64 * 1024) { dropped++; continue; }
							parts ??= snapshotParts(room);
							send(peer.ws, snapshotFrame(room, peer, parts, social.partyMembers(peer.id)));
						}
				if (room.tick % 600 === 0)
					for (const id of room.game.players.keys()) void save(room, id);
                }catch(error){
                 console.error('Room quarantined',room.key,error);room.quarantined=true;
                 for(const peer of room.peers.values()){void save(room,peer.id);send(peer.ws,{t:'kick',reason:'เซิร์ฟเวอร์ขัดข้อง กรุณาเข้าใหม่'});peer.ws.close(1011,'room failed');}void room.saveQueue.finally(()=>rooms.delete(room.key));
                }
			}
		}
		if (catchup && ticks % 20 < catchup) social.tick();
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
            if(peer.leaseOwner)void store.renewLease(peer.id,peer.leaseOwner).then(ok=>{if(!ok){send(peer.ws,{t:'kick',reason:'เข้าสู่ระบบจากที่อื่น'});peer.ws.close(4409,'opened elsewhere');}}).catch(e=>console.error('Lease heartbeat failed',e));
			void store.session(peer.sessionHash).then((session) => {
				if (!session || session.selectedCharacterId !== peer.id) {
					send(peer.ws, { t: "kick", reason: "session ended" });
					peer.ws.close(4401, "session ended");
				}
			}).catch(error=>console.error('Heartbeat failed',error));
		}
	}, options.heartbeatMs??15000);
	heartbeat.unref();
 const prune=setInterval(()=>{void store.pruneRequests().catch(e=>console.error('Request prune failed',e));},options.pruneMs??3600000);prune.unref();
 const economyNightly=setInterval(()=>{void store.integrity().catch(e=>console.error('ECONOMY_ALERT',String(e)));},86400000);economyNightly.unref();
	return {
		rooms,
        healthy:()=>!closing&&performance.now()-previousTick<2000,
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
			if(closing)return;closing = true;
			clearInterval(timer);
			clearInterval(heartbeat);clearInterval(prune);clearInterval(economyNightly);const closingPeers=[...live.values()];
			for (const ws of wss.clients) ws.terminate();
            await Promise.allSettled([...activeJoins]);
			await Promise.all(
				[...rooms.values()].flatMap((room) =>
					[...room.game.players.keys()].map((id) => save(room, id)),
				),
			);
			await Promise.all([...saves.values()]);
			await Promise.all(closingPeers.filter(p=>p.leaseOwner).map(p=>store.releaseLease(p.id,p.leaseOwner!).catch(e=>console.error('Lease release failed',e))));
			wss.close();
		},
		save,
		social,
	};
}
