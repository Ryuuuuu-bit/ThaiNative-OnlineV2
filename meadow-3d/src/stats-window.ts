import {
	deriveStats,
	loadGameData,
	allocateStats,
	statPointCost,
	type CharacterInput,
	type Stat,
	type Combatant,
} from "@the-beginning-online/shared";
const data = loadGameData(),
	names: Record<Stat, string> = {
		str: "พละกำลัง",
		agi: "ความว่องไว",
		vit: "ความอดทน",
		int: "สติปัญญา",
		dex: "ความแม่นยำ",
		luk: "โชค",
	};
interface State {
	profile: CharacterInput;
	points: number;
	derived: Combatant;
	autoAllocate: boolean;
	statResetFree: boolean;
}
export function mountStats(send: (message: any) => void, onOpen: () => void) {
	const panel = document.querySelector<HTMLDialogElement>("#stats-window")!,
		button = document.querySelector<HTMLButtonElement>("#stats-button")!,
		rows = document.querySelector("#stats-base")!,
		derived = document.querySelector("#stats-derived")!,
		status = document.querySelector<HTMLElement>("#stats-status")!,
		confirm = document.querySelector<HTMLButtonElement>("#stats-confirm")!,
		auto = document.querySelector<HTMLInputElement>("#stats-auto")!,
		reset = document.querySelector<HTMLButtonElement>("#stats-reset")!;
	let state: State | null = null,
		pending: Partial<Record<Stat, number>> = {},
		waiting = false,
		timer = 0;
	function draw() {
		if (!state) return;
		let profile = state.profile,
			points = state.points;
		if (Object.values(pending).some(Boolean)) {
			const preview = allocateStats(
				{
					profile,
					statPoints: points,
					autoAllocate: state.autoAllocate,
					autoAllocCursor: 0,
				},
				pending,
				data,
			);
			profile = preview.profile;
			points = preview.statPoints;
		}
		const next = deriveStats(profile, data);
		document.querySelector("#stats-points")!.textContent = String(points);
		document.querySelector("#stats-level")!.textContent = String(profile.level);
		auto.checked = state.autoAllocate;
		auto.disabled = waiting;
		reset.hidden = !state.statResetFree;
		reset.disabled = waiting;
		rows.replaceChildren();
		for (const stat of data.stats.baseStats) {
			const row = document.createElement("div"),
				name = document.createElement("span"),
				value = document.createElement("b"),
				bonus = document.createElement("small"),
				minus = document.createElement("button"),
				plus = document.createElement("button");
			row.className = "stat-row";
			name.innerHTML = `${names[stat]}<small>${stat.toUpperCase()}</small>`;
			value.textContent = String(profile.baseStats[stat]);
			value.classList.toggle("pending", !!pending[stat]);
			const extra = next.stats[stat] - profile.baseStats[stat];
			bonus.textContent = extra ? "+" + extra : "";
			minus.textContent = "−";
			minus.type = plus.type = "button";
			minus.className = "stat-step";
			plus.className = "stat-step plus";
			minus.setAttribute("aria-label", `ลด ${names[stat]}`);
			minus.disabled = waiting || !pending[stat];
			minus.onclick = () => {
				pending[stat] = Math.max(0, (pending[stat] || 0) - 1);
				if (!pending[stat]) delete pending[stat];
				draw();
			};
			plus.textContent = "+";
			plus.dataset.stat = stat;
			const cost = statPointCost(profile.baseStats[stat], data);
			plus.title = `ใช้ ${cost} แต้ม`;
			plus.setAttribute("aria-label", `เพิ่ม ${names[stat]} ใช้ ${cost} แต้ม`);
			plus.disabled = waiting || points < cost || profile.baseStats[stat] >= 99;
			plus.onclick = () => {
				pending[stat] = (pending[stat] || 0) + 1;
				status.textContent = "สีทองคือค่าตัวอย่าง · กดยืนยันเพื่อบันทึก";
				draw();
			};
			row.append(name, value, bonus, minus, plus);
			rows.append(row);
		}
		drawRadar(state.profile.baseStats, profile.baseStats);
		const groups: [string, [string, keyof Combatant, (n: number) => string][]][] = [
			["โจมตี", [["พลังโจมตี", "atk", fmt], ["พลังเวท", "matk", fmt], ["ความแม่นยำ", "hit", fmt], ["คริติคอล", "crit", (n) => (n * 100).toFixed(1) + "%"], ["โจมตีต่อวินาที", "aspd", fmt], ["เวลาร่าย ×", "castMul", fmt]]],
			["ป้องกัน", [["เกราะกายภาพ", "hardDef", fmt], ["ป้องกันกายภาพ", "softDef", fmt], ["เกราะเวท", "hardMdef", fmt], ["ป้องกันเวท", "softMdef", fmt], ["หลบหลีก", "flee", fmt]]],
			["ทั่วไป", [["พลังชีวิต", "maxHp", fmt], ["พลังสกิล", "maxSp", fmt], ["ฟื้นพลังชีวิต/วิ (นอกต่อสู้)", "hpRegen", fmt], ["ฟื้นพลังสกิล/วิ", "spRegen", fmt], ["ความเร็วเดิน ×", "moveSpeed", fmt], ["น้ำหนักสูงสุด", "weight", fmt]]],
		];
		derived.replaceChildren();
		for (const [title, metrics] of groups) {
			const group = document.createElement("section"),
				caption = document.createElement("p");
			group.className = "stats-group";
			caption.className = "caption";
			caption.textContent = title;
			group.append(caption);
			for (const [label, key, format] of metrics) {
				const row = document.createElement("div"),
					name = document.createElement("span"),
					value = document.createElement("b");
				name.textContent = label;
				value.textContent = format(next[key] as number);
				const old = state.derived[key] as number,
					diff = (next[key] as number) - old;
				if (Math.abs(diff) > 0.00001) {
					const delta = document.createElement("small");
					delta.className = "pending";
					delta.textContent = (diff > 0 ? "+" : "") + format(diff);
					value.append(delta);
				}
				row.append(name, value);
				group.append(row);
			}
			derived.append(group);
		}
		confirm.disabled = waiting || !Object.values(pending).some(Boolean);
		button.classList.toggle("has-points", state.points >= 2);
		button.title = `สเตตัส C · ${state.points} แต้ม`;
	}
	/** Hexagon of the six base stats: filled = saved, dashed = with the pending preview. */
	function drawRadar(saved: Record<Stat, number>, preview: Record<Stat, number>) {
		const svg = document.querySelector("#stats-radar")!,
			stats = data.stats.baseStats,
			R = 76,
			top = Math.max(10, Math.ceil(Math.max(...stats.map((s) => preview[s])) * 1.25)),
			at = (i: number, r: number) => [Math.cos(-Math.PI / 2 + (i * Math.PI) / 3) * r, Math.sin(-Math.PI / 2 + (i * Math.PI) / 3) * r],
			poly = (f: (s: Stat, i: number) => number) => stats.map((s, i) => at(i, f(s, i)).map((n) => n.toFixed(1)).join(",")).join(" ");
		const rings = [0.34, 0.67, 1].map((k) => `<polygon points="${poly(() => R * k)}" fill="none" stroke="rgba(255,255,255,.1)"/>`).join(""),
			labels = stats.map((s, i) => { const [x, y] = at(i, R + 15); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle">${s.toUpperCase()}</text>`; }).join(""),
			changed = stats.some((s) => preview[s] !== saved[s]);
		svg.innerHTML = rings + labels + `<polygon class="saved" points="${poly((s) => (R * Math.min(top, saved[s])) / top)}"/>` + (changed ? `<polygon class="preview" points="${poly((s) => (R * Math.min(top, preview[s])) / top)}"/>` : "");
	}
	function fmt(n: number) {
		return Number(n.toFixed(2)).toString();
	}
	function submit(message: any) {
		if (waiting) return;
		waiting = true;
		status.textContent = "กำลังให้เซิร์ฟเวอร์ตรวจสอบ…";
		send(message);
		draw();
		timer = window.setTimeout(() => {
			waiting = false;
			pending = {};
			status.textContent = "ยังไม่ได้รับคำตอบ เปิดสเตตัสใหม่หลังเชื่อมต่ออีกครั้ง";
			draw();
		}, 8000);
	}
	function toggle() {
		if (panel.open) {
			panel.close();
			return;
		}
		onOpen();
		pending = {};
		status.textContent = state
			? "เลือกสเตตัสเพื่อดูค่าตัวอย่าง"
			: "กำลังรับสเตตัสจากเซิร์ฟเวอร์…";
		panel.showModal();
		draw();
	}
	button.onclick = toggle;
	panel.querySelector<HTMLButtonElement>("[data-stats-close]")!.onclick = () =>
		panel.close();
	panel.addEventListener("close", () => {
		pending = {};
	});
	confirm.onclick = () => submit({ t: "stats", add: pending });
	document.querySelector<HTMLButtonElement>("#stats-cancel")!.onclick = () => {
		pending = {};
		status.textContent = "ยกเลิกค่าตัวอย่างแล้ว";
		draw();
	};
	auto.onchange = () => submit({ t: "autoAlloc", on: auto.checked });
	reset.onclick = () => submit({ t: "statsReset" });
	return {
		toggle,
		receive(e: any) {
			if (e.type === "statsError") {
				waiting = false;
				clearTimeout(timer);
				status.textContent = e.text;
				draw();
			}
			if (e.type === "stats") {
				const wasWaiting = waiting;
				clearTimeout(timer);
				waiting = false;
				state = {
					profile: e.profile,
					points: e.points,
					derived: e.derived,
					autoAllocate: e.autoAllocate,
					statResetFree: e.statResetFree,
				};
				if (wasWaiting) pending = {};
				status.textContent = Object.values(pending).some(Boolean)
					? "สีทองคือค่าตัวอย่าง · กดยืนยันเพื่อบันทึก"
					: "สเตตัสที่เซิร์ฟเวอร์บันทึกแล้ว";
				draw();
			}
		},
		get open() {
			return panel.open;
		},
	};
}
