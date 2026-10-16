import {
	deriveStats,
	loadGameData,
	allocateStats,
	statPointCost,
	type CharacterInput,
	type Stat,
	type Combatant,
} from "@thainative/shared";
const data = loadGameData(),
	names: Record<Stat, string> = {
		str: "พลัง STR",
		agi: "ว่องไว AGI",
		vit: "อึด VIT",
		int: "ปัญญา INT",
		dex: "แม่นยำ DEX",
		luk: "โชค LUK",
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
				plus = document.createElement("button");
			row.className = "stat-row";
			name.textContent = names[stat];
			value.textContent = String(profile.baseStats[stat]);
			value.classList.toggle("pending", !!pending[stat]);
			bonus.textContent = "+" + (next.stats[stat] - profile.baseStats[stat]);
			plus.textContent = "+";
			plus.type = "button";
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
			row.append(name, value, bonus, plus);
			rows.append(row);
		}
		const metrics: [string, keyof Combatant, (n: number) => string][] = [
			["โจมตี ATK", "atk", fmt],
			["เวท MATK", "matk", fmt],
			["เกราะ DEF แข็ง", "hardDef", fmt],
			["ป้องกัน DEF อ่อน", "softDef", fmt],
			["เกราะเวท MDEF แข็ง", "hardMdef", fmt],
			["ป้องกันเวท MDEF อ่อน", "softMdef", fmt],
			["แม่นยำ HIT", "hit", fmt],
			["หลบหลีก FLEE", "flee", fmt],
			["คริติคอล CRIT", "crit", (n) => (n * 100).toFixed(1) + "%"],
			["โจมตี/วิ ASPD", "aspd", fmt],
			["เวลาร่าย ×", "castMul", fmt],
			["พลังชีวิต HP", "maxHp", fmt],
			["พลังสกิล SP", "maxSp", fmt],
			["ฟื้น HP/วิ (นอกต่อสู้)", "hpRegen", fmt],
			["ฟื้น SP/วิ", "spRegen", fmt],
			["ความเร็วเดิน ×", "moveSpeed", fmt],
			["น้ำหนัก", "weight", fmt],
		];
		derived.replaceChildren();
		for (const [label, key, format] of metrics) {
			const row = document.createElement("div"),
				name = document.createElement("span"),
				value = document.createElement("b");
			name.textContent = label;
			value.textContent = format(next[key] as number);
			const old = state.derived[key] as number;
			if (Math.abs((next[key] as number) - old) > 0.00001) {
				value.className = "pending";
				value.textContent = format(old) + " → " + format(next[key] as number);
			}
			row.append(name, value);
			derived.append(row);
		}
		confirm.disabled = waiting || !Object.values(pending).some(Boolean);
		button.classList.toggle("has-points", state.points >= 2);
		button.title = `สเตตัส C · ${state.points} แต้ม`;
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
