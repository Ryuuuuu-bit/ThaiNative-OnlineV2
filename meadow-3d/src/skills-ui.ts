import {resolveSkill,loadGameData} from '@thainative/shared';
import skillsData from "../../shared/data/skills.json";
import jobsData from "../../shared/data/jobs.json";
import type { HotbarSlot, JobProgress } from "@thainative/shared";
import "./skills.css";
import "./skill-art.css";
const skills = skillsData.skills as any[];
const itemTemplates=loadGameData().items.items;
const slotSpec=(id:string|null)=>id?.startsWith('item:')?itemTemplates.find(t=>t.id===id.slice(5)):skills.find(s=>s.id===id);
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
		last = "",
		more = false;
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
		if (s.passive)
			return s.id === "sword_mastery"
				? `พลังโจมตี +${at("atk", 0)} เมื่อใช้ดาบ`
				: s.id === "sword_rhythm"
					? `คอมโบสาม +${at("comboBonus", 0) * 100}% · ลดคูลดาวน์อื่น ${at("cooldownReduction", 0).toFixed(1)} วิ`
						: `พลังชีวิต +${at("hpPercent", 0) * 100}% · ฟื้นพลังชีวิต +${at("hpRegenPercent", 0) * 100}%`;
		return `${s.percent ? `${s.hits || 1}×${at("percent", s.percent).toFixed(0)}% · ` : ""}พลังสกิล ${at("sp", s.sp).toFixed(1).replace(".0", "")} · ${s.cooldown} วิ${s.effect === "taunt" ? ` · ป้องกัน −${Math.round(at("defDown", 0.05) * 100)}% 5 วิ` : s.effect === "endure" ? ` · ป้องกัน +${Math.round(at("defUp", 0.06) * 100)}% 8 วิ` : s.effect === "dash" ? " · 6 ม. สตั้น 0.6 วิ" : s.effect === "knockup" ? " · ยก 0.8 วิ ร่าย 0.4 วิ" : ""}`;
	}
	function slotsHTML(mirror = false) {
		return (job?.hotbar || [])
			.map((slot, i) => {
				const s = slotSpec(slot.skill),
					learned = !!s && (!!slot.skill?.startsWith('item:') || !!job?.skills[s.id]);
				return `<button class="job-slot ${i >= 5 ? "extra-slot" : ""} ${learned ? "" : "unlearned"} ${!s ? "vacant" : ""}" title="${s?.nameTh || "ว่าง"} · ${keyLabel(slot.key)}" data-slot="${i}" ${mirror ? 'data-mirror="true"' : ""} aria-label="ช่อง ${i + 1} ${s?.nameTh || "ว่าง"} ${keyLabel(slot.key)}"><kbd>${keyLabel(slot.key)}</kbd>${s ? slot.skill?.startsWith("item:") ? `<span class="hotbar-item">✚</span>` : icon(s) : '<span class="empty-mark">·</span>'}<small>${s?.nameTh || "ว่าง"}</small><em></em></button>`;
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
	function drawBar() {
		bar.innerHTML = slotsHTML();
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
		tree.replaceChildren();
		for (const tier of [1, 2]) {
			const section = document.createElement("section");
			section.className = "skill-tier";
			section.innerHTML = `<h3>${tier === 1 ? "นักดาบ" : "อาชีพขั้นต่อไป"}</h3>`;
			const list = skills.filter(s => s.jobId === job?.jobId);
			if (tier === 2) {
				section.innerHTML +=
					'<p class="skill-locked">ผู้พิทักษ์ / นักดาบคลั่ง<br>ระดับอาชีพ 40 · ภารกิจเร็ว ๆ นี้</p>';
				tree.append(section);
				continue;
			}
			for (const s of list) {
				const lv = level(s.id),
					lock = reason(s),
					card = document.createElement("article");
				card.className = "skill-node" + (lock && !lv ? " skill-locked" : "");
				card.dataset.skill = s.id;
				card.draggable = !s.passive && !!job.skills[s.id];
				card.title = `${s.nameTh} · ${values(s, Math.max(1, lv))}\nถัดไป: ${values(s, Math.min(s.maxLevel, lv + 1))}`;
				card.innerHTML = `${icon(s)}<div><b>${s.nameTh}</b><span>${lv}/${s.maxLevel} ${s.passive ? "· ติดตัว" : ""}${pending[s.id] ? " · รอยืนยัน" : ""}</span><p>${lv ? values(s, lv) : "ยังไม่ได้เรียน"}</p><p class="skill-next">→ ${values(s, Math.min(s.maxLevel, lv + 1))}</p><small>${s.requires.map((r: any) => `↳ ${skills.find((s) => s.id === r.id)?.nameTh} ${r.level}`).join(" · ") || "เริ่มเรียนได้ทันที"}</small><small class="lock-reason">${lock}</small></div><button data-up="${s.id}" ${lock ? "disabled" : ""} aria-label="เพิ่ม ${s.nameTh}">+</button>`;
				card.ondragstart = (e) => {document.body.classList.add('dragging-hotbar');e.dataTransfer?.setData('text/plain',s.id);};
                card.ondragend=()=>document.body.classList.remove('dragging-hotbar');
				card.onclick = (e) => {
					if ((e.target as HTMLElement).closest("[data-up]")) return;
					if (!s.passive && job?.skills[s.id]) {
						selected = s.id;
						$("#skills-status").textContent = `เลือกช่องด้านล่างเพื่อวาง ${s.nameTh}`;
					}
				};
				card.querySelector<HTMLButtonElement>("[data-up]")!.onclick = () => {
					pending[s.id] = (pending[s.id] || 0) + 1;
					draw();
				};
				section.append(card);
			}
			tree.append(section);
		}
		$("#skill-slots").innerHTML = slotsHTML(true);
		bindSlots($("#skill-slots"));
		$("#skills-confirm").toggleAttribute(
			"disabled",
			!Object.keys(pending).length,
		);
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
                        const reserved=['KeyW','KeyA','KeyS','KeyD','KeyI','KeyC','KeyK','KeyM','KeyH','KeyZ','KeyR','KeyF','KeyT','KeyJ'];
                        const uiKeys=[...document.querySelectorAll<HTMLInputElement>('#key-returnCity,#key-pickupAll')].map(el=>el.dataset.code);
                        if(!/^(Key[A-Z]|Digit[0-9]|F[0-9]+)$/.test(e.code)||reserved.includes(e.code)||uiKeys.includes(e.code)||job!.hotbar.some((s,i)=>i!==Number(el.dataset.keySlot)&&s.key===e.code)){$('#skills-status').textContent='ปุ่มนี้ถูกใช้อยู่แล้วหรือใช้ไม่ได้';return;}
						const next = job!.hotbar.map((s, i) => ({
							...s,
							key: i === Number(el.dataset.keySlot) ? e.code : s.key,
						}));
						send({ t: "hotbar", slots: next });
						$("#skills-status").textContent = "กำลังบันทึกปุ่ม…";
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
	$("#skills-settings").onclick = () => {
		$("#key-settings").hidden = !$("#key-settings").hidden;
		$("#audio-settings").hidden = $("#key-settings").hidden;
		if (!$("#key-settings").hidden) play("ui_open");
	};
	$("#angel-talk").onclick = () => {
		clear();
		angel.showModal();
		play("ui_open");
		drawAngel();
	};
	function drawAngel() {
		if (!job) return;
		$("#angel-note").textContent = "ข้าจะนำทางเจ้าสู่อาชีพขั้นสองที่ ระดับอาชีพ 40 · ยังไม่ถึงเวลา";
		$("#job-cards").innerHTML = jobsData.jobs.filter(j => j.tier === 2 && j.parent === job!.jobId)
			.map(j => `<button disabled><b>${j.nameTh}</b><small>ยังไม่ถึงเวลา · ระดับอาชีพ 40</small></button>`).join("");
	}
	return {
		get open() {
			return panel.open || angel.open;
		},
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
			if (panel.open) draw();
			if (angel.open) drawAngel();
		},
		update(p: any) {

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
