import {resolveSkill,loadGameData} from '@thainative/shared';
import skillsData from "../../shared/data/skills.json";
import jobsData from "../../shared/data/jobs.json";
import type { HotbarSlot, JobProgress } from "@thainative/shared";
import "./skills.css";
import "./skill-art.css";
import { itemIconCell } from "./item-icon";
import { BINDABLE_KEY } from "@thainative/shared";
import { takenByActions } from "./keys";
const skills = skillsData.skills as any[];
const itemTemplates=loadGameData().items.items;
const slotSpec=(id:string|null)=>id?.startsWith('item:')?itemTemplates.find(t=>t.id===id.slice(5)):skills.find(s=>s.id===id);
/** Consumables that can sit on the bar (HP, MP and speed potions). */
const barItems=itemTemplates.filter(t=>t.type==='consumable'&&t.effect);
const POTION_CD=skills.find(s=>s.id==='potion')?.cooldown||1;
const itemIconHTML=(template:string,extra='')=>{const c=itemIconCell(template);return `<span class="item-icon${c.v2?' item-icon-v2':''} ${extra}" style="background-position:${c.position}" aria-hidden="true"></span>`;};
/** How many of this template the bag holds (equipped or stored copies do not count). */
export function bagCount(inventory:{items:{template:string;qty:number;location:string}[]}|undefined,template:string){return (inventory?.items||[]).filter(i=>i.template===template&&i.location==='bag').reduce((n,i)=>n+i.qty,0);}
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
	document.querySelector<T>(s)!;
export const keyLabel = (key: string) =>
	key.replace("Digit", "").replace("Key", "");
export function mountSkills(
	send: (message: any) => void,
	clear: () => void,
	act: (id: string) => void,
	play: (id: string) => void = () => {},
) {
	let confirmedJob: string | undefined;
	let job: JobProgress | null = null,
		pending: Record<string, number> = {},
		selected: string | null = null,
		detailId: string | null = null,
		last = "",
		more = false,
		inventory: any;
	const panel = $<HTMLDialogElement>("#skills-window"),
		angel = $<HTMLDialogElement>("#angel-window");
	const bar = $("#job-hotbar");
	function level(id: string) {
		return (job?.skills[id] || 0) + (pending[id] || 0);
	}
	function owner(jobId: string) {
		let j = jobsData.jobs.find((j) => j.id === job?.jobId);
		while (j) {
			if (j.id === jobId) return true;
			j = jobsData.jobs.find((p) => p.id === j?.parent);
		}
		return jobId === "common";
	}
	function reason(s: any) {
		if (!job) return "กำลังรับข้อมูล";
		if (!owner(s.jobId)) return "อาชีพไม่ตรง";
		if (level(s.id) >= s.maxLevel) return "ระดับสูงสุด";
		const req = s.requires.find((r: any) => level(r.id) < r.level);
		if (req)
			return `ต้องมี ${skills.find((s) => s.id === req.id)?.nameTh} ระดับ ${req.level}`;
		if (job.skillPoints - Object.values(pending).reduce((a, b) => a + b, 0) < 1)
			return "แต้มสกิลไม่พอ";
		return "";
	}
	const icon = (s: any) =>
		`<span class="job-icon" style="--ix:${s.icon % 4};--iy:${Math.floor(s.icon / 4)}" aria-hidden="true"></span>`;
	function values(s: any, lv: number) {
		const at = (key: string, fallback: number) =>
			s.values?.[key]?.[Math.max(0, lv - 1)] ?? fallback;
		const pct = (v: number) => Math.round(v * 100);
		if (s.passive && s.id === "guardian_spirit") return `ป้องกัน +${pct(at("defPercent", 0))}% · พลังชีวิต +${pct(at("hpPercent", 0))}%`;
		if (s.passive && s.id === "retribution") return `สะท้อนความเสียหายระยะประชิด ${pct(at("reflect", 0))}% กลับใส่ผู้โจมตี`;
		if (s.passive && s.id === "berserk_soul") return `พลังโจมตี +${pct(at("atkPercent", 0))}%`;
		if (s.passive && s.id === "bloodlust") return `ดูดเลือด ${pct(at("lifesteal", 0))}% ของความเสียหายที่ทำ`;
		if (s.passive)
			return s.id === "sword_mastery"
				? `พลังโจมตี +${at("atk", 0)} เมื่อใช้ดาบ`
				: s.id === "sword_rhythm"
					? `คอมโบสาม +${at("comboBonus", 0) * 100}% · ลดคูลดาวน์อื่น ${at("cooldownReduction", 0).toFixed(1)} วิ`
						: `พลังชีวิต +${at("hpPercent", 0) * 100}% · ฟื้นพลังชีวิต +${at("hpRegenPercent", 0) * 100}%`;
		return `${s.percent ? `${s.hits || 1}×${at("percent", s.percent).toFixed(0)}% · ` : ""}พลังสกิล ${at("sp", s.sp).toFixed(1).replace(".0", "")} · ${s.cooldown} วิ${s.effect === "taunt" ? ` · ป้องกัน −${Math.round(at("defDown", 0.05) * 100)}% ${s.duration ?? 5} วิ` : s.effect === "endure" ? ` · ป้องกัน +${Math.round(at("defUp", 0.06) * 100)}% 8 วิ` : s.effect === "dash" ? ` · ${s.range} ม. สตั้น ${s.duration} วิ` : s.effect === "knockup" ? ` · ยก ${s.duration} วิ ร่าย ${s.cast} วิ` : s.effect === "stun" ? ` · สตั้น ${s.duration} วิ` : s.effect === "guard" ? ` · ลดความเสียหายที่ได้รับ ${pct(at("guard", 0.1))}% ${s.duration} วิ` : s.effect === "rage" ? ` · พลังโจมตี +${pct(at("atkUp", 0.1))}% เร็วขึ้น 10% ${s.duration} วิ · เสียพลังชีวิต ${pct(at("hpCost", 0.08))}%` : ""}`;
	}
	function slotsHTML(mirror = false) {
		return (job?.hotbar || [])
			.map((slot, i) => {
				const s = slotSpec(slot.skill),
					learned = !!s && (!!slot.skill?.startsWith('item:') || !!job?.skills[s.id]);
				return `<button class="job-slot ${i >= 5 ? "extra-slot" : ""} ${slot.skill?.startsWith("item:") ? "item-slot" : ""} ${learned ? "" : "unlearned"} ${!s ? "vacant" : ""}" title="${s?.nameTh || "ว่าง"} · ${keyLabel(slot.key)}" data-slot="${i}" ${slot.skill?.startsWith("item:") ? `data-item="${slot.skill.slice(5)}"` : ""} ${mirror ? 'data-mirror="true"' : ""} aria-label="ช่อง ${i + 1} ${s?.nameTh || "ว่าง"} ${keyLabel(slot.key)}"><kbd>${keyLabel(slot.key)}</kbd>${s ? slot.skill?.startsWith("item:") ? `${itemIconHTML(slot.skill.slice(5),'hotbar-potion')}<b class="slot-count"></b>` : icon(s) : '<span class="empty-mark">·</span>'}<small>${s?.nameTh || "ว่าง"}</small><em></em></button>`;
			})
			.join("");
	}
	function assign(index: number, id: string | null) {
		if (!job) return;
		const next = job.hotbar.map((s, i) => ({
			...s,
			skill: i === index ? id : s.skill,
		}));
		send({ t: "hotbar", slots: next });
		$("#skills-status").textContent = "กำลังบันทึกแถบสกิล…";
		selected = null;
	}
	function bindSlots(root: HTMLElement) {
		root.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
			el.onclick = () => {
				const i = Number(el.dataset.slot);
				if (selected) assign(i, selected);
				else if (!el.dataset.mirror) {
					const id = job?.hotbar[i].skill;
					if (id) act(id);
				}
			};
			el.ondragover = (e) => e.preventDefault();
			el.ondrop = (e) => {
				e.preventDefault();
				const id = e.dataTransfer?.getData("text/plain");
				if (id && (skills.some(s=>s.id===id)||id.startsWith('item:'))) assign(Number(el.dataset.slot), id);
			};
			el.oncontextmenu = (e) => {
				e.preventDefault();
				assign(Number(el.dataset.slot), null);
			};
		});
	}
	/** Auto-potion highlight per template, kept across bar redraws (a stats refresh follows every drink). */
	const flashUntil: Record<string, number> = {};
	function drawBar() {
		const html = slotsHTML();
		if (bar.dataset.html !== html) { bar.innerHTML = html; bar.dataset.html = html; }
		for (const [template, until] of Object.entries(flashUntil))
			if (until > performance.now()) bar.querySelectorAll(`[data-item="${template}"]`).forEach((el) => el.classList.add("auto-drank"));
		bar.classList.toggle("show-extra", more);
		bindSlots(bar);
	}
	function draw() {
		if (!job) return;
		$("#skills-job").textContent =
			`${jobsData.jobs.find((j) => j.id === job?.jobId)?.nameTh} · ระดับอาชีพ ${job.jobLevel}`;
		$("#skill-points").textContent = String(
			job.skillPoints - Object.values(pending).reduce((a, b) => a + b, 0),
		);
		const tree = $("#skills-tree");
		tree.innerHTML = '<div class="sk-list"></div><aside class="sk-detail" aria-live="polite"></aside>';
		// The whole job line: a second job keeps learning its first job's skills. Newest job first.
		const chain: typeof jobsData.jobs = [];
		for (let j = jobsData.jobs.find((j) => j.id === job?.jobId); j && !chain.includes(j); j = jobsData.jobs.find((p) => p.id === j?.parent)) chain.push(j);
		const list = chain.flatMap((j) => skills.filter((s) => s.jobId === j.id)),
			listEl = tree.querySelector<HTMLElement>(".sk-list")!;
		if (!list.some((s) => s.id === detailId)) detailId = list[0]?.id ?? null;
		for (const line of chain)
		for (const passive of [false, true]) {
			const group = list.filter((s) => s.jobId === line.id && !!s.passive === passive);
			if (!group.length) continue;
			const caption = document.createElement("p");
			caption.className = "caption";
			caption.textContent = (chain.length > 1 ? line.nameTh + " · " : "") + (passive ? "ติดตัว" : "กดใช้");
			listEl.append(caption);
			for (const s of group) {
				const lv = level(s.id),
					learned = job.skills[s.id] || 0,
					lock = reason(s),
					card = document.createElement("article");
				card.className = "skill-node" + (lock && !lv ? " skill-locked" : "") + (s.id === detailId ? " sk-selected" : "");
				card.dataset.skill = s.id;
				card.draggable = !s.passive && !!job.skills[s.id];
				const pips = Array.from({ length: s.maxLevel }, (_, i) => `<i class="${i < learned ? "on" : i < lv ? "new" : ""}"></i>`).join("");
				const meta = lock && !lv ? `<span class="lock-reason">${lock}</span>` : s.passive ? values(s, Math.max(1, lv)) : `พลังสกิล ${s.sp} · คูลดาวน์ ${s.cooldown} วิ`;
				card.innerHTML = `${icon(s)}<div class="sk-text"><b>${s.nameTh}<small>Lv ${lv} / ${s.maxLevel}</small></b><span class="sk-meta">${meta}</span></div><span class="sk-pips" aria-hidden="true">${pips}</span><button data-up="${s.id}" ${lock ? "disabled" : ""} aria-label="เพิ่ม ${s.nameTh}">+</button>`;
				card.ondragstart = (e) => {document.body.classList.add('dragging-hotbar');e.dataTransfer?.setData('text/plain',s.id);};
				card.ondragend=()=>document.body.classList.remove('dragging-hotbar');
				card.onclick = (e) => {
					if ((e.target as HTMLElement).closest("[data-up]")) return;
					detailId = s.id;
					if (!s.passive && job?.skills[s.id]) {
						selected = s.id;
						$("#skills-status").textContent = `เลือกช่องด้านล่างเพื่อวาง ${s.nameTh}`;
					}
					draw();
				};
				card.querySelector<HTMLButtonElement>("[data-up]")!.onclick = () => {
					pending[s.id] = (pending[s.id] || 0) + 1;
					detailId = s.id;
					draw();
				};
				listEl.append(card);
			}
		}
		const caption = document.createElement("p");
		caption.className = "caption";
		caption.textContent = "ยา · ลากใส่แถบได้";
		listEl.append(caption);
		for (const t of barItems) {
			const card = document.createElement("article"),
				id = "item:" + t.id;
			card.className = "skill-node item-node" + (selected === id ? " sk-selected" : "");
			card.dataset.skill = id;
			card.draggable = true;
			card.innerHTML = `${itemIconHTML(t.id, "job-icon-item")}<div class="sk-text"><b>${t.nameTh}<small>มี ${bagCount(inventory, t.id)}</small></b><span class="sk-meta">${t.effect === "hp" ? `ฟื้นพลังชีวิต ${t.amount}` : t.effect === "sp" ? `ฟื้นพลังสกิล ${t.amount}` : "เร่งความเร็ว 60 วิ"} · คูลดาวน์ยา ${POTION_CD} วิ</span></div>`;
			card.ondragstart = (e) => {document.body.classList.add('dragging-hotbar');e.dataTransfer?.setData('text/plain', id);};
			card.ondragend = () => document.body.classList.remove('dragging-hotbar');
			card.onclick = () => {
				selected = id;
				$("#skills-status").textContent = `เลือกช่องด้านล่างเพื่อวาง ${t.nameTh}`;
				draw();
			};
			listEl.append(card);
		}
		const d = list.find((s) => s.id === detailId);
		if (d) {
			const lv = level(d.id),
				nextLv = Math.min(d.maxLevel, lv + 1),
				lock = reason(d),
				reqs = d.requires.map((r: any) => `${skills.find((s) => s.id === r.id)?.nameTh} Lv ${r.level}${level(r.id) >= r.level ? " ✓" : ""}`).join(" · ");
			tree.querySelector(".sk-detail")!.innerHTML = `<span class="sk-big job-icon" style="--ix:${d.icon % 4};--iy:${Math.floor(d.icon / 4)}" aria-hidden="true"></span><h3>${d.nameTh}</h3><div class="sk-tags"><span>${d.passive ? "ติดตัว" : "กดใช้"}</span><span>Lv ${lv} / ${d.maxLevel}</span></div><dl><dt>ตอนนี้</dt><dd>${lv ? values(d, lv) : "ยังไม่ได้เรียน"}</dd>${lv < d.maxLevel ? `<dt>ระดับถัดไป · Lv ${nextLv}</dt><dd class="skill-next">${values(d, nextLv)}</dd>` : ""}</dl><p class="sk-req${lock && lock !== "ระดับสูงสุด" ? " bad" : ""}">${reqs ? "ต้องการ " + reqs : "เริ่มเรียนได้ทันที"}${lock ? ` · ${lock}` : ""}</p>${nextJobHTML()}`;
		}
		$("#skill-slots").innerHTML = slotsHTML(true);
		bindSlots($("#skill-slots"));
		$("#skills-confirm").toggleAttribute(
			"disabled",
			!Object.keys(pending).length,
		);
		drawKeys();
	}
	/** Hotbar key fields (shown in the settings window). Runs on every job update, not only with the skill book open. */
	function drawKeys() {
		if (!job) return;
		const keyStatus = (text: string) => ((document.querySelector("#key-status") ?? $("#skills-status")).textContent = text);
		$("#key-settings").innerHTML = (job.hotbar || [])
			.map(
				(s, i) =>
					`<label>ช่อง ${i + 1}<input data-key-slot="${i}" value="${keyLabel(s.key)}" aria-label="ปุ่มช่อง ${i + 1}" readonly></label>`,
			)
			.join("");
		$("#key-settings")
			.querySelectorAll<HTMLInputElement>("input")
			.forEach(
				(el) =>
					(el.onkeydown = (e) => {
						if(e.code==='Tab')return;
                        e.preventDefault();e.stopPropagation();
                        // Action keys are rebindable now: the live table says which codes they hold.
                        if(!BINDABLE_KEY.test(e.code)||takenByActions().includes(e.code)||job!.hotbar.some((s,i)=>i!==Number(el.dataset.keySlot)&&s.key===e.code)){keyStatus('ปุ่มนี้ถูกใช้อยู่แล้วหรือใช้ไม่ได้');return;}
						const next = job!.hotbar.map((s, i) => ({
							...s,
							key: i === Number(el.dataset.keySlot) ? e.code : s.key,
						}));
						send({ t: "hotbar", slots: next });
						keyStatus("กำลังบันทึกปุ่ม…");
					}),
			);
	}
	$("#skills-confirm").onclick = () => {
		for (const [id, count] of Object.entries(pending))
			for (let i = 0; i < count; i++) send({ t: "skillUp", id });
		pending = {};
		$("#skills-status").textContent = "กำลังยืนยันกับเซิร์ฟเวอร์…";
		draw();
	};
	$("#skills-cancel").onclick = () => {
		pending = {};
		selected = null;
		draw();
		$("#skills-status").textContent = "ยกเลิกตัวอย่างแล้ว";
	};
	$("#skills-close").onclick = () => panel.close();
	$("#angel-close").onclick = () => angel.close();
	$("#skills-more").onclick = () => {
		more = !more;
		document.body.classList.toggle("more-skills", more);
		bar.classList.toggle("show-extra", more);
		$("#skills-more").setAttribute("aria-expanded", String(more));
	};
	$("#skills-reset-keys").onclick = () => {
		if (job)
			send({
				t: "hotbar",
				slots: job.hotbar.map((s, i) => ({
					...s,
					key: "Digit" + ((i + 1) % 10),
				})),
			});
	};
	$("#angel-talk").onclick = () => {
		clear();
		choosing = null;
		angel.showModal();
		play("ui_open");
		drawAngel();
	};
	// Second-job branches the angel offers; the server re-checks job, level and distance.
	const BRANCH_NOTES: Record<string, string> = {
		guardian: "แนวหน้าโล่เหล็ก · ทนทาน ดึงศัตรู สะท้อนความเสียหาย",
		berserker: "ดาบคลั่งไม่ถอย · ตีแรง โจมตีหลายครั้ง ดูดเลือดจากศัตรู",
	};
	let choosing: string | null = null;
	/** Hint toward the second job; empty once the player has one (or the line has none). */
	function nextJobHTML() {
		const branches = jobsData.jobs.filter((j) => j.tier === 2 && j.parent === job?.jobId);
		return branches.length ? `<p class="sk-next-job">อาชีพขั้นต่อไป: ${branches.map((j) => j.nameTh).join(" / ")} · ระดับอาชีพ 40 · คุยกับทูตสวรรค์ที่หอนาฬิกา</p>` : "";
	}
	function drawAngel() {
		if (!job) return;
		const current = jobsData.jobs.find((j) => j.id === job!.jobId);
		const branches = jobsData.jobs.filter((j) => j.tier === 2 && j.parent === job!.jobId);
		if (current?.tier === 2) {
			$("#angel-note").textContent = `เจ้าก้าวสู่เส้นทาง${current.nameTh}แล้ว ขอพรให้ดาบของเจ้าไม่สั่นคลอน`;
			$("#job-cards").innerHTML = "";
			return;
		}
		const ready = job.jobLevel >= 40;
		$("#angel-note").textContent = !branches.some((j) => j.available)
			? "เส้นทางอาชีพขั้นสองของเจ้ายังไม่เปิด"
			: !ready
				? `ข้าจะนำทางเจ้าสู่อาชีพขั้นสองที่ระดับอาชีพ 40 · ตอนนี้ ${job.jobLevel}`
				: choosing
					? `แน่ใจหรือไม่? เมื่อเป็น${branches.find((j) => j.id === choosing)?.nameTh}แล้วจะเปลี่ยนกลับไม่ได้ · กดอีกครั้งเพื่อยืนยัน`
					: "เลือกเส้นทางของเจ้า สกิลนักดาบทั้งหมดยังติดตัวไป";
		$("#job-cards").innerHTML = branches
			.map((j) => {
				const open = j.available && ready;
				const note = !j.available ? "ยังไม่เปิด" : !ready ? "ต้องการระดับอาชีพ 40" : choosing === j.id ? "กดเพื่อยืนยัน" : BRANCH_NOTES[j.id] || "";
				return `<button data-job="${j.id}" ${open ? "" : "disabled"} class="${choosing === j.id ? "choosing" : ""}"><b>${j.nameTh}</b><small>${note}</small></button>`;
			})
			.join("");
		$("#job-cards").querySelectorAll<HTMLButtonElement>("button[data-job]").forEach((b) => {
			b.onclick = () => {
				const id = b.dataset.job!;
				if (choosing !== id) {
					choosing = id;
					play("ui_open");
					drawAngel();
					return;
				}
				choosing = null;
				$("#angel-note").textContent = "ทูตสวรรค์กำลังประทานพร…";
				send({ t: "jobChange", job: id });
			};
		});
	}
	return {
		get open() {
			return panel.open || angel.open;
		},
		drawKeys,
		toggle() {
			if (panel.open) panel.close();
			else {
				clear();
				pending = {};
				draw();
				panel.showModal();
				play("ui_open");
			}
		},
		key(code: string) {
			const s = job?.hotbar.find((s) => s.key === code);
			if (s?.skill) {
				act(s.skill);
				return true;
			}
			return !!s;
		},
		receive(e: any) {
			if (e.type === "skillsError") {
				$("#skills-status").textContent = e.text;
				$("#angel-note").textContent = e.text;
				return;
			}
			if (e.type !== "stats" || !e.job) return;
			if (confirmedJob && confirmedJob !== e.job.jobId) play("job_change");
			confirmedJob = e.job.jobId;
			job = e.job;
			pending = {};
			$("#skills-button").classList.toggle("has-points", job!.skillPoints > 0);
			$("#skills-status").textContent =
				"ลากสกิล หรือแตะสกิลแล้วเลือกช่อง · คลิกขวาที่ช่องเพื่อล้าง";
			drawBar();
			drawKeys();
			const ks = document.querySelector("#key-status");
			if (ks?.textContent === "กำลังบันทึกปุ่ม…") ks.textContent = "บันทึกแล้ว";
			if (panel.open) draw();
			if (angel.open) drawAngel();
		},
		/** Briefly highlights the bar slots holding this potion (auto-potion fired). */
		flash(template: string) {
			flashUntil[template] = performance.now() + 900;
			bar.querySelectorAll<HTMLElement>(`[data-item="${template}"]`).forEach((el) => {
				el.classList.remove("auto-drank");
				void el.offsetWidth;
				el.classList.add("auto-drank");
			});
			setTimeout(() => {
				if ((flashUntil[template] ?? 0) <= performance.now() + 1) bar.querySelectorAll(`[data-item="${template}"]`).forEach((el) => el.classList.remove("auto-drank"));
			}, 900);
		},
		update(p: any) {
			inventory = p.inventory;

			const key =
				JSON.stringify(p.hotbar || []) + JSON.stringify(p.skills || {});
			if (p.jobId && key !== last) {
				last = key;
				job = {
					jobId: p.jobId,
					jobLevel: p.jobLevel,
					jobExp: p.jobExp,
					skillPoints: p.skillPoints,
					skills: p.skills,
					hotbar: p.hotbar,
				};
				drawBar();
			}
			bar.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
				const id = job?.hotbar[Number(el.dataset.slot)].skill,
					cd = id ? p.cd[id.startsWith('item:')?'potion':id] || 0 : 0;
				el.classList.toggle('low-sp',!!id&&!id.startsWith('item:')&&p.mp<resolveSkill(loadGameData(),id,p.skills[id]||1).sp);
				if(id?.startsWith('item:')){
					const n=bagCount(p.inventory,id.slice(5)),count=el.querySelector('.slot-count');
					if(count&&count.textContent!==String(n))count.textContent=String(n);
					el.classList.toggle('out',n===0);
					el.style.setProperty('--cd-sweep',`${Math.min(1,cd/POTION_CD)*360}deg`);
				}
                el.classList.toggle("cooling", cd > 0.05);
				el.querySelector("em")!.textContent = cd > 0.05 ? cd.toFixed(1) : "";
			});
			const near =
				p.mapId === "city_plaza" && !p.dead && Math.hypot(p.x - jobsData.angel.x, p.z - jobsData.angel.z) <=
				jobsData.angel.range;
			$("#angel-talk").hidden = !near;

		},
	};
}
