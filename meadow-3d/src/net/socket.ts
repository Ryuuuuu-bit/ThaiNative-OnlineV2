type Callbacks = {
	message: (message: any) => void;
	status: (state: string) => void;
};
export class GameSocket {
	ws: WebSocket | null = null;
	seq = 0;
	ping = 0;
	you = "";
	connected = false;
	stopped = false;
	wantSpawn = false;
	private attempt = 0;
	private retries = 0;
	private moveKey = "";
	private lastMove = 0;
	private pending: any;
	private pings: number[] = [];
	private reconnectTimer = 0;
	private generation = 0;
	constructor(private callbacks: Callbacks) {
		this.connect();
		window.addEventListener("pagehide", () => this.close());
		setInterval(() => {
			this.flush();
			if (this.connected) this.send({ t: "ping", c: Date.now() });
		}, 2000);
		setInterval(() => this.flush(), 50);
	}
	private async connect() {
		if (this.stopped) return;
		const generation = ++this.generation;
		this.callbacks.status(this.attempt ? "reconnecting" : "connecting");
		let v = import.meta.env.VITE_BUILD_ID || "dev";
		if (import.meta.env.DEV) {
			try {
				v = (await fetch("/api/config").then((r) => r.json())).build;
			} catch {
				this.callbacks.status("offline");
				return;
			}
		}
		if (this.stopped || generation !== this.generation) return;
		const url = new URL("/api/ws", location.href);
		url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
		url.searchParams.set("area", "meadow-01");
		url.searchParams.set("v", v);
		this.ws = new WebSocket(url);
		this.ws.onopen = () => {
			if (generation !== this.generation) return;
			this.send({ t: "hello" });
		};
		this.ws.onmessage = (e) => {
			if (generation !== this.generation) return;
			let message;
			try {
				message = JSON.parse(e.data);
			} catch {
				return;
			}
			if (message.t === "welcome") {
				this.you = message.you;
				this.connected = true;
				this.attempt = 0;
				this.retries = 0;
				this.moveKey = "";
				this.callbacks.status("connected");
				if (this.wantSpawn) this.send({ t: "spawnReady" });
			}
			if (message.t === "pong") {
				this.pings.push(Math.max(0, Date.now() - message.c));
				this.pings = this.pings.slice(-5);
				this.ping = [...this.pings].sort((a, b) => a - b)[
					Math.floor(this.pings.length / 2)
				];
			}
			if (message.t === "reload") {
				this.stopped = true;
				location.reload();
				return;
			}
			if (message.t === "kick") {
				this.stopped = true;
				this.callbacks.status(
					message.reason === "opened elsewhere" ? "opened elsewhere" : "kicked",
				);
			}
			this.callbacks.message(message);
		};
		this.ws.onclose = () => {
			if (generation !== this.generation || this.stopped) return;
			this.connected = false;
			this.pending = undefined;
			this.callbacks.status(++this.retries >= 5 ? "offline" : "reconnecting");
			this.reconnectTimer = window.setTimeout(
				() => this.connect(),
				Math.min(30000, 500 * 2 ** this.attempt++),
			);
		};
		this.ws.onerror = () => {};
	}
	ready() {
		this.wantSpawn = true;
		if (this.connected) this.send({ t: "spawnReady" });
	}
	send(message: any) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return this.seq;
		if (message.t === "move" || message.t === "steer") {
			const key = JSON.stringify(message);
			if (key === this.moveKey) return this.seq;
			if (performance.now() - this.lastMove < 50) {
				this.pending = message;
				return this.seq;
			}
			this.moveKey = key;
			this.lastMove = performance.now();
		} else {
			this.flush();
			if (message.t === "target" || message.t === "auto") this.moveKey = "";
		}
		if (["move", "steer", "act"].includes(message.t))
			message = { ...message, seq: ++this.seq };
		this.ws.send(JSON.stringify(message));
		return this.seq;
	}
	private flush() {
		if (this.pending && performance.now() - this.lastMove >= 50) {
			const pending = this.pending;
			this.pending = undefined;
			this.send(pending);
		}
	}
	retry() {
		this.stopped = false;
		clearTimeout(this.reconnectTimer);
		this.generation++;
		this.ws?.close();
		this.attempt = 0;
		this.retries = 0;
		this.connect();
	}
	close() {
		this.stopped = true;
		clearTimeout(this.reconnectTimer);
		this.ws?.close();
	}
}
