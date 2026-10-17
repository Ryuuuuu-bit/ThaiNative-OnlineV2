import {CITY_SPAWN} from '@thainative/shared/maps';
import { predictMovement } from "@thainative/shared/movement";
import {
	reconcileMovement,
	type PendingMovement,
} from "@thainative/shared/prediction";
import type { Action, Game, Player } from "@thainative/shared";
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export class NetworkWorld {
	game = {
		p: {
			jobId:"swordsman",jobLevel:1,jobExp:0,skillPoints:0,skills:{},hotbar:[],statuses:[],castRemaining:0,
            id: "",
			name: "",
			x: CITY_SPAWN.x,
			z: CITY_SPAWN.z,
			fx: 0,
			fz: -1,
			hp: 0,
			maxHp: 1,
			mp: 0,
			maxMp: 1,
			level: 1,
			xp: 0,
			nextXp: 60,
			gold: 0,
			potions: 0,
			dead: false,
			moving: false,
			auto: false,
			autoState: "idle",
			attack: 0,
			attackKind: "",
			combo: 0,
			comboWindow: 0,
			dash: 0,
			invulnerable: 0,
			hurt: 0,
			cd: { attack: 0, spin: 0, meteor: 0, dash: 0, potion: 0 },
		} as unknown as Player,
		enemies: [],
		drops: [],
		projectiles: [],
		events: [],
		target: null,
		destination: null,
		kills: 0,
		bossSpawned: false,
		won: false,
		time: 0,
	} as Pick<
		Game,
		| "p"
		| "enemies"
		| "drops"
		| "projectiles"
		| "events"
		| "target"
		| "destination"
		| "kills"
		| "bossSpawned"
		| "won"
		| "time"
	>;
	others: any[] = [];
	ready = false;
	lastTick = 0;
	ack = 0;
	private previous: any;
	private latest: any;
	private received = 0;
	private prediction = { x: -1, z: 6 };
	private pending: PendingMovement[] = [];
	private correction = { x: 0, z: 0 };
	private correctionAge = 0.15;
	private flash: { kind: string; until: number } | null = null;
	constructor() {
		this.game.enemies = [];
	}
	receive(snap: any, you: string, now: number) {
		const own = snap.players.find((p: any) => p.id === you);
		if (!own) return;
        if(this.latest?.mapId!==snap.mapId){this.pending=[];this.ready=false;this.latest=undefined;this.flash=null;}
        this.game.p.mapId=snap.mapId;
		const result = reconcileMovement(
			own,
			this.prediction,
			snap.ack,
			this.pending,
		);
		if (!this.ready || result.snap) {
			this.prediction = { ...result.position };
			this.correction = { x: 0, z: 0 };
		} else {
			this.correction = {
				x: this.prediction.x - result.position.x,
				z: this.prediction.z - result.position.z,
			};
			this.prediction = { ...result.position };
		}
		this.pending = result.pending;
		this.correctionAge = 0;
		this.previous = this.latest || snap;
		this.latest = snap;
		this.received = now;
		this.lastTick = snap.tick;
		this.ack = snap.ack;
		this.ready = true;
		this.game.p.id = you;
 if(snap.inventory)this.game.p.inventory=snap.inventory;(this.game.p as any).carryWeight=snap.weight;(this.game.p as any).weightLimit=snap.weightLimit;
	}
	animate(a: Action, now: number) {
		if (a === "dash") {
			this.flash = { kind: "dash", until: now + 220 };
			return;
		}
		if (a === "attack" || a === "spin" || a === "meteor")
			this.flash = {
				kind: a === "attack" ? "slash" : a,
				until: now + (a === "attack" ? 340 : a === "spin" ? 600 : 800),
			};
	}
	update(
		now: number,
		dt: number,
		input: { x: number; z: number },
		seq: number,
	) {
		if (!this.ready) return;
		const a = this.previous,
			b = this.latest,
			p = b.players.find((p: any) => p.id === this.game.p.id);
		if (!p) return;
		const span = Math.max(50, (b.time - a.time) * 1000),
			t = Math.max(0, Math.min(1, 1 + (now - this.received - 100) / span));
		const blend = (list: any[], old: any[]) =>
			list.map((v) => {
				const before = old.find((x) => x.id === v.id);
				if (!before) return { ...v };
				return {
					...v,
					x: lerp(before.x, v.x, t),
					z: lerp(before.z, v.z, t),
					motionTime:
						v.motion === before.motion
							? lerp(before.motionTime || 0, v.motionTime || 0, t)
							: v.motionTime,
				};
			});
		this.game.enemies = blend(b.enemies, a.enemies);
		this.game.drops = blend(b.drops, a.drops);
		this.game.projectiles = blend(b.projectiles, a.projectiles);
		this.others = blend(
			b.players.filter((v: any) => v.id !== p.id),
			a.players,
		);
		Object.assign(this.game.p, p);
		this.game.target = p.target;
		this.game.destination = p.destination;
		this.game.kills = b.kills;
		this.game.time = b.time;
		this.game.bossSpawned = b.bossSpawned;
		(this.game as any).bossIn = b.bossIn ?? 0;
		this.game.won = b.won;
		if (!p.dead && !p.auto && p.dash <= 0 && p.castRemaining <= 0 && !p.statuses?.some((s:any)=>s.id==='stun'||s.id==='knockup')) {
			let direction = input;
			if (Math.hypot(input.x, input.z) < 0.05 && p.destination) {
				const dx = p.destination.x - this.prediction.x,
					dz = p.destination.z - this.prediction.z,
					d = Math.hypot(dx, dz);
				direction = d > 0.15 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
			}
			const speed = (p.attack > 0 ? 1.6 : 4.5) * (p.moveSpeed || 1);
			this.prediction = predictMovement({...this.prediction,mapId:p.mapId}, direction, dt, speed);
			if (Math.hypot(direction.x, direction.z) > 0.01) {
				this.pending.push({ seq, input: direction, dt, speed });
				if (this.pending.length > 180) this.pending.shift();
				this.game.p.fx = direction.x;
				this.game.p.fz = direction.z;
				this.game.p.moving = true;
			}
		} else {
			this.prediction = { x: p.x, z: p.z };
		}
		this.correctionAge += dt;
		const fade = Math.max(0, 1 - this.correctionAge / 0.15);
		this.game.p.x = this.prediction.x + this.correction.x * fade;
		this.game.p.z = this.prediction.z + this.correction.z * fade;
		if (this.flash && now < this.flash.until && !p.dead) {
			if (this.flash.kind === "dash")
				this.game.p.dash = Math.max(0, (this.flash.until - now) / 1000);
			else {
				this.game.p.attack = Math.max(0, (this.flash.until - now) / 1000);
				this.game.p.attackKind = this.flash.kind;
			}
		} else this.flash = null;
	}
}
