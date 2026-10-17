import { DEFAULT_AUTO, AUTO_RANGES, skillTierRank, type AutoPotion, huntList, isSurvivalSkill, loadGameData, normalizeAuto, autoSkillSequence, type AutoSettings, type MapId } from "@thainative/shared";
import skillsData from "../../shared/data/skills.json";
import "./auto-ui.css";

const data = loadGameData(),
	skills = skillsData.skills as any[],
	spec = (id: string) => skills.find((s) => s.id === id);
const RANGE_TEXT: Record<keyof typeof AUTO_RANGES, string> = { near: "ใกล้", mid: "กลาง", far: "ไกล", map: "ทั้งแผนที่ปัจจุบัน" };

/**
 * ตั้งค่า AUTO window (the ⚙ beside the AUTO button). The server owns the settings and runs AUTO with
 * them; this window edits a local copy and sends it back (debounced) as {t:'autoSettings'}.
 */
export function mountAutoSettings(o: { send: (m: any) => void; player: () => any; map: () => MapId; onOpen: () => void; potion: () => { settings: AutoPotion; set(next: AutoPotion): void } }) {
	let cfg: AutoSettings = { ...DEFAULT_AUTO },
		timer = 0,
		saving = false;
	const gear = document.createElement("button");
	gear.id = "auto-settings-button";
	gear.type = "button";
	gear.title = "ตั้งค่า AUTO";
	gear.setAttribute("aria-label", "ตั้งค่า AUTO");
	document.querySelector("#auto-hunt")!.after(gear);
	const panel = document.createElement("dialog");
	panel.id = "auto-window";
	panel.setAttribute("aria-labelledby", "auto-title");
	document.body.append(panel);

	const learnedSkills = () => {
		const p = o.player(),
			bar: (string | null)[] = (p?.hotbar ?? []).map((h: any) => h.skill);
		// Same filter as the sim's autoCast: job skills only (basic attack, dodge and potion have their own handling).
		const usable = (id: string) => !!p?.skills?.[id] && !!spec(id) && !spec(id).passive && spec(id).jobId !== "common";
		// every usable hotbar skill in AUTO order, the switched-off ones included so they can be turned back on
		return autoSkillSequence({ ...cfg, off: [] }, bar, usable, Object.keys(p?.skills ?? {}), (id) => skillTierRank(data, id));
	};
	function set(patch: Partial<AutoSettings>) {
		cfg = normalizeAuto({ ...cfg, ...patch });
		draw();
		clearTimeout(timer);
		saving = true;
		status("กำลังบันทึก…");
		timer = window.setTimeout(() => o.send({ t: "autoSettings", settings: cfg }), 400);
	}
	const status = (text: string) => {
		const el = panel.querySelector(".auto-save");
		if (el) el.textContent = text;
	};
	const sw = (key: "basic" | "attackers" | "elites", label: string, note = "") =>
		`<label class="auto-row"><span><b>${label}</b>${note ? `<small>${note}</small>` : ""}</span><span class="g-switch"><input type="checkbox" data-key="${key}" ${cfg[key] ? "checked" : ""}><i></i></span></label>`;
	// HP / SP use the per-character auto-potion rule (also works outside AUTO); 'ปิด' is that rule switched off.
	const value = (key: "hp" | "mp" | "survive") => {
		if (key === "survive") return cfg.survive;
		const rule = o.potion().settings[key];
		return rule.on ? rule.at : 0;
	};
	const stepper = (key: "hp" | "mp" | "survive", label: string, note: string) =>
		`<div class="auto-row"><span><b>${label}</b><small>${note}</small></span><span class="auto-step"><button type="button" data-step="${key}:-5" aria-label="ลด">−</button><output>${value(key) ? `${value(key)}%` : "ปิด"}</output><button type="button" data-step="${key}:5" aria-label="เพิ่ม">+</button></span></div>`;

	function draw() {
		if (!panel.open) return;
		const seq = learnedSkills(),
			map = o.map(),
			mobs = huntList(map, data),
			wanted = cfg.mobs[map] ?? [],
			survivors = seq.filter((id) => isSurvivalSkill(spec(id))).map((id) => spec(id).nameTh).join(" · ");
		const skillCards = seq.length
			? seq
					.map((id, i) => {
						const s = spec(id),
							off = cfg.off.includes(id);
						return `<div class="auto-skill${off ? " off" : ""}${isSurvivalSkill(s) ? " survival" : ""}"><button type="button" class="auto-skill-card" data-toggle="${id}" title="${s.nameTh}${off ? " · ปิดอยู่" : ""}" aria-pressed="${!off}"><span class="job-icon" style="--ix:${s.icon % 4};--iy:${Math.floor(s.icon / 4)}" aria-hidden="true"></span>${off ? "" : '<i class="ok">✓</i>'}<span class="nm">${s.nameTh}</span></button><div class="auto-order"><button type="button" data-move="${id}:-1" ${i === 0 ? "disabled" : ""} aria-label="เลื่อนขึ้น">‹</button><b>${i + 1}</b><button type="button" data-move="${id}:1" ${i === seq.length - 1 ? "disabled" : ""} aria-label="เลื่อนลง">›</button></div></div>`;
					})
					.join("")
			: `<p class="auto-empty">ยังไม่มีสกิลในแถบ · เรียนสกิลแล้ววางลงแถบก่อน</p>`;
		const mobChips = mobs.length
			? `<button type="button" class="auto-chip${wanted.length ? "" : " on"}" data-mob="*">ตีทั้งหมด</button>` +
				mobs.map((m) => `<button type="button" class="auto-chip${wanted.includes(m.id) ? " on" : ""}${m.boss ? " boss" : ""}" data-mob="${m.id}">${m.name} <small>Lv ${m.level}</small></button>`).join("")
			: `<p class="auto-empty">ในเมืองไม่มีมอนสเตอร์ · เลือกได้เมื่ออยู่ในทุ่งหรือป่า</p>`;
		panel.innerHTML = `<button class="close" data-close aria-label="ปิด">×</button>
			<header class="g-head"><h2 id="auto-title">ตั้งค่า AUTO</h2><span class="g-sub">กด F เพื่อเปิด/ปิด AUTO</span></header>
			<div class="auto-grid">
				<section class="auto-card"><h3>สกิล <small>แตะเพื่อเปิด/ปิด · ‹ › เลื่อนลำดับ</small></h3>
					<div class="auto-skills">${skillCards}</div>
					<div class="auto-row col"><span><b>วิธีใช้สกิล</b><small>${cfg.mode === "cycle" ? "ใช้สกิลวนตามลำดับ ตัวถัดไปเมื่อตัวก่อนหน้าติดคูลดาวน์" : "ใช้สกิลลำดับต้นทุกครั้งที่พร้อม ตัวถัดไปใช้ตอนตัวแรกติดคูลดาวน์"}</small></span>
						<div class="auto-seg"><button type="button" data-mode="cycle" aria-pressed="${cfg.mode === "cycle"}">วนตามลำดับ</button><button type="button" data-mode="priority" aria-pressed="${cfg.mode === "priority"}">ลำดับต้นก่อนเสมอ</button></div></div>
					<div class="auto-legend"><span><i class="atk"></i>สกิลโจมตี</span><span><i class="sv"></i>สกิลเอาตัวรอด ใช้ก่อนเมื่อ HP ต่ำ</span></div>
					${sw("basic", "ตีปกติระหว่างรอสกิล", "ปิดไว้เพื่อประหยัด SP สำหรับสายเวท")}
				</section>
				<section class="auto-card"><h3>ฟื้นฟู</h3>
					${stepper("hp", "ดื่มยา HP เมื่อต่ำกว่า", "ใช้ยาแดงที่ดีที่สุดในกระเป๋า")}
					${stepper("survive", "ใช้สกิลเอาตัวรอดเมื่อ HP ต่ำกว่า", survivors || "ยังไม่มีสกิลเอาตัวรอดในแถบ")}
					${stepper("mp", "ดื่มยา SP เมื่อต่ำกว่า", "ใช้ยาฟ้าในกระเป๋า")}
					<p class="auto-note">ดื่มยาทำงานทั้งตอนเปิด AUTO และตอนเล่นเอง (ตั้งค่าที่นี่ที่เดียว) · ตั้งเป็น "ปิด" ถ้าไม่อยากดื่มเอง · ยาหมดและ HP ต่ำกว่า 25% AUTO จะถอยกลับแคมป์</p>
				</section>
				<section class="auto-card"><h3>เป้าหมาย</h3>
					<div class="auto-row col"><span><b>มอนสเตอร์ที่จะตี</b><small>${map === "city_plaza" ? "นครที่ถูกลืมเลือน" : map === "forest" ? "ป่าหมอก" : "ทุ่งวุ้นจิ๋ว"} · เลือกได้หลายตัว · จำแยกแต่ละแผนที่</small></span><div class="auto-chips">${mobChips}</div></div>
					${sw("attackers", "ตัวที่กำลังตีเราก่อน", "สู้กลับตัวที่ตีเราอยู่ แม้ไม่ได้เลือกไว้")}
					${sw("elites", "หัวหน้า / บอส ก่อน")}
					<div class="auto-row col"><span><b>รัศมีรอบตัว</b><small>เดินหามอนรอบตัวในระยะนี้</small></span>
						<div class="auto-ranges">${(Object.keys(AUTO_RANGES) as (keyof typeof AUTO_RANGES)[]).map((k) => `<button type="button" data-range="${k}" aria-pressed="${cfg.range === k}">${RANGE_TEXT[k]}${k === "map" ? "" : ` ${AUTO_RANGES[k]} ม.`}</button>`).join("")}</div></div>
					<div class="auto-row"><span><b>ของที่ตก</b><small>เก็บตามการตั้งค่าในกระเป๋า</small></span><b class="auto-good">อัตโนมัติ</b></div>
					<p class="auto-note">AUTO ทำงานเฉพาะตอนออนไลน์ · เดินเองหรือกด Esc แล้ว AUTO จะหยุด</p>
				</section>
			</div>
			<footer class="g-foot"><p class="auto-save">${saving ? "กำลังบันทึก…" : "บันทึกอัตโนมัติ"}</p><div><button type="button" data-reset>คืนค่าเริ่มต้น</button></div></footer>`;
	}

	panel.addEventListener("click", (e) => {
		const t = e.target as HTMLElement;
		if (t.closest("[data-close]")) return panel.close();
		const toggle = t.closest<HTMLElement>("[data-toggle]");
		if (toggle) {
			const id = toggle.dataset.toggle!;
			return set({ off: cfg.off.includes(id) ? cfg.off.filter((x) => x !== id) : [...cfg.off, id] });
		}
		const move = t.closest<HTMLElement>("[data-move]");
		if (move) {
			const [id, d] = move.dataset.move!.split(":"),
				seq = learnedSkills(),
				i = seq.indexOf(id),
				j = i + Number(d);
			if (i < 0 || j < 0 || j >= seq.length) return;
			[seq[i], seq[j]] = [seq[j], seq[i]];
			return set({ order: seq });
		}
		const step = t.closest<HTMLElement>("[data-step]");
		if (step) {
			const [k, d] = step.dataset.step!.split(":") as ["hp" | "mp" | "survive", string];
			if (k === "survive") return set({ survive: Math.max(0, Math.min(90, cfg.survive + Number(d))) });
			// the rule keeps 5–95; stepping below 5 switches it off
			const rule = o.potion().settings,
				// switching back on resumes the last threshold instead of starting from 5%
				next = !rule[k].on && Number(d) > 0 ? rule[k].at : value(k) + Number(d);
			o.potion().set({ ...rule, [k]: next < 5 ? { ...rule[k], on: false } : { on: true, at: Math.min(95, Math.max(5, next)) } });
			return draw();
		}
		const mode = t.closest<HTMLElement>("[data-mode]");
		if (mode) return set({ mode: mode.dataset.mode as AutoSettings["mode"] });
		const range = t.closest<HTMLElement>("[data-range]");
		if (range) return set({ range: range.dataset.range as AutoSettings["range"] });
		const mob = t.closest<HTMLElement>("[data-mob]");
		if (mob) {
			const map = o.map(),
				list = cfg.mobs[map] ?? [],
				id = mob.dataset.mob!,
				next = id === "*" ? [] : list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
				mobs = { ...cfg.mobs };
			if (next.length) mobs[map] = next;
			else delete mobs[map];
			return set({ mobs });
		}
		if (t.closest("[data-reset]")) set({ ...DEFAULT_AUTO });
	});
	panel.addEventListener("change", (e) => {
		const input = e.target as HTMLInputElement;
		const key = input.dataset.key as "basic" | "attackers" | "elites" | undefined;
		if (key) set({ [key]: input.checked });
	});
	// Typing a number key inside the window must not cast the hotbar skill underneath.
	panel.addEventListener("keydown", (e) => e.key !== "Escape" && e.stopPropagation());

	function toggle() {
		if (panel.open) return panel.close();
		o.onOpen();
		panel.showModal();
		draw();
	}
	gear.onclick = toggle;
	document.querySelector<HTMLElement>("#auto-hunt")!.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		toggle();
	});
	return {
		toggle,
		get open() {
			return panel.open;
		},
		receive(m: any) {
			if (m.t === "autoSettings") {
				// keep edits made while a save was in flight
				if (!timer || !saving) cfg = normalizeAuto(m.settings);
				saving = false;
				timer = 0;
				draw();
				status("บันทึกแล้ว");
			}
			if (m.t === "autoSettingsError") {
				saving = false;
				status(m.text);
			}
		},
	};
}
