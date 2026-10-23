import {resolveSkill,loadGameData,isMasteryAction,isMasteryPassive,MASTERY_SCHOOLS,masterySkillLock,masteryAutoRank,masteryTriggerSlots,resolveAutomaticSkill,automaticCause} from '@the-beginning-online/shared';
import constellation from "./mastery-layout.json";
import {masteryAncestors,masteryCurve} from "./mastery-paths";
import {masteryCamera} from "./mastery-camera";
import paintedIcons from "../art/mastery-icons/manifest.json";
import skillsData from "../../shared/data/skills.json";
import jobsData from "../../shared/data/jobs.json";
import type { HotbarSlot, JobProgress } from "@the-beginning-online/shared";
import "./skills.css";
import "./skill-art.css";
import "./mastery-panel.css";
import { itemIconCell } from "./item-icon";
import { BINDABLE_KEY } from "@the-beginning-online/shared";
import { takenByActions } from "./keys";
const gameData=loadGameData();
const schoolNames:Record<string,string>={Swordsman:"ดาบ",Archer:"ธนู",Mage:"เวท",Healer:"เยียวยา",Summoner:"อัญเชิญ",Assassin:"ลอบเร้น",Boxer:"หมัด"};
const schoolColors=["#cdac79","#a4ba7d","#96b8d8","#d2c291","#a5c3b1","#c4a1b6","#cd9f88"];
const legacySkills = skillsData.skills as any[];
const skills:any[]=gameData.mastery.skills.map(plan=>{
 const live=(isMasteryAction(plan.id)||isMasteryPassive(plan.id))?resolveSkill(gameData,plan.id):legacySkills.find(s=>s.id===plan.id);
 return {...(live??{id:plan.id,nameTh:plan.nameTh,passive:plan.passive,maxLevel:plan.maxRank,requires:plan.requires.map(r=>({id:r.id,level:r.rank})),icon:0,sp:plan.ranks[0].mp,range:plan.range,percent:0}),school:plan.school,plan,legacyRuntime:!!live&&!isMasteryAction(plan.id)&&!isMasteryPassive(plan.id)};
}).concat(legacySkills.filter(s=>!gameData.mastery.skills.some(p=>p.id===s.id)));
const itemTemplates=loadGameData().items.items;
const slotSpec=(id:string|null)=>id?.startsWith('item:')?itemTemplates.find(t=>t.id===id.slice(5)):id&&isMasteryAction(id)?resolveSkill(loadGameData(),id):skills.find(s=>s.id===id);
/** Consumables that can sit on the bar (HP, MP and speed potions). */
const barItems=itemTemplates.filter(t=>t.type==='consumable'&&t.effect);
const POTION_CD=skills.find(s=>s.id==='potion')?.cooldown||1;
const ELEMENT_TH=gameData.elements.names as Record<string,string>;
const BASIC=skills.find(s=>s.id==='basic');
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
		viewJob: string | null = null,
		last = "",
		more = false,
		inventory: any,
		derived: { atk: number; matk: number; weaponElement?: string } | null = null;
	const panel = $<HTMLDialogElement>("#skills-window"),
		angel = $<HTMLDialogElement>("#angel-window");
	const bar = $("#job-hotbar");
    const camera=masteryCamera(constellation.size);
    let mapTarget:string|null="all";
    let mapWidth=0,mapHeight=0;
    function paintCamera(){
     const viewport=panel.querySelector<HTMLElement>(".mastery-viewport"),world=panel.querySelector<HTMLElement>(".mastery-world");
     if(!viewport||!world)return;
     const c=camera.state;
     world.style.transform=`translate(${c.x}px,${c.y}px) scale(${c.scale})`;
     viewport.classList.toggle("overview",c.scale<.53);
     world.style.setProperty("--node-label-scale",String(Math.max(1,.9/c.scale)));
     world.style.setProperty("--label-scale",String(Math.max(1,.18/c.scale)));
     const zoom=panel.querySelector(".mastery-zoom");if(zoom)zoom.textContent=`${Math.round(c.scale*100)}%`;
    }
    function positionMap(){
     const viewport=panel.querySelector<HTMLElement>(".mastery-viewport");
     if(!viewport||!panel.open)return;
     const w=viewport.clientWidth,h=viewport.clientHeight;
     if(w!==mapWidth||h!==mapHeight){
      if(!mapTarget)mapTarget=viewJob==="all"?"all":detailId;
      mapWidth=w;mapHeight=h;
     }
     if(mapTarget==="all")camera.fit(w,h);
     else if(mapTarget){
      const point=(constellation.nodes as Record<string,{x:number;y:number}>)[mapTarget],hub=constellation.hubs.find(s=>s.name===mapTarget);
      if(point){
       const ancestors=masteryAncestors(gameData.mastery.skills,mapTarget),ids=new Set([mapTarget,...ancestors,...gameData.mastery.skills.filter(s=>s.requires.some(r=>r.id===mapTarget)).map(s=>s.id)]);
       const points=[...ids].map(id=>(constellation.nodes as Record<string,{x:number;y:number}>)[id]),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
       const left=Math.min(...xs)-100,right=Math.max(...xs)+100,top=Math.min(...ys)-100,bottom=Math.max(...ys)+100;
       camera.focus((left+right)/2,(top+bottom)/2,w,h,Math.min(1,w/(right-left),h/(bottom-top))*.94);
      }
      else if(hub){
       const points=gameData.mastery.skills.filter(s=>s.school===hub.name).map(s=>(constellation.nodes as Record<string,{x:number;y:number}>)[s.id]);
       const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs)-100,right=Math.max(...xs)+100,top=Math.min(...ys)-100,bottom=Math.max(...ys)+100;
       camera.focus((left+right)/2,(top+bottom)/2,w,h,Math.min(w/(right-left),h/(bottom-top))*.94);
      }
     }else camera.bound(w,h);
     mapTarget=null;paintCamera();
    }
    new ResizeObserver(positionMap).observe(panel);
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
        if(s.plan){
         if(!s.legacyRuntime&&!isMasteryAction(s.id)&&!isMasteryPassive(s.id))return "ยังไม่เปิดให้เรียน";
         return masterySkillLock({...job,skills:{...job.skills,...Object.fromEntries(Object.keys(pending).map(id=>[id,level(id)]))},skillPoints:job.skillPoints-Object.values(pending).reduce((a,b)=>a+b,0)},s.id,gameData.mastery)??"";
        }
		if (!owner(s.jobId)) return "อาชีพไม่ตรง";
		if (level(s.id) >= s.maxLevel) return "ระดับสูงสุด";
		const req = s.requires.find((r: any) => level(r.id) < r.level);
		if (req)
			return `ต้องมี ${skills.find((s) => s.id === req.id)?.nameTh} ระดับ ${req.level}`;
		if (job.skillPoints - Object.values(pending).reduce((a, b) => a + b, 0) < 1)
			return "แต้มสกิลไม่พอ";
		return "";
	}
	const icon = (s: any,extra="") => {
        const art=(paintedIcons.icons as Record<string,{file:string}>)[s.id];
        const style=art?`background-image:url('/assets/mastery-painted/${art.file}');background-position:center;background-size:100% 100%`:`--ix:${s.icon % 4};--iy:${Math.floor(s.icon / 4)}`;
        return `<span class="job-icon ${extra}" style="${style}" aria-hidden="true"></span>`;
    };
	function values(s: any, lv: number) {
        if(s.plan&&!s.legacyRuntime){const r=s.plan.ranks[Math.max(0,Math.min(s.plan.maxRank-1,lv-1))],effect=r.effect.replace(/\d+(?:\.\d+)?/g,(n:string)=>String(Math.round(Number(n)*100)/100));return s.passive?effect:`${effect} · MP ${r.mp} · CD ${r.cooldown} วิ · ร่าย ${r.cast} วิ · ระยะ ${s.range} ม.`;}
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
		return `${s.percent ? `${s.hits || 1}×${at("percent", s.percent).toFixed(0)}% · ` : ""}พลังสกิล ${at("sp", s.sp).toFixed(1).replace(".0", "")} · ${s.cooldown} วิ${effectText(s, lv)}`;
	}
	function effectText(s: any, lv: number) {
		const at = (key: string, fallback: number) => s.values?.[key]?.[Math.max(0, lv - 1)] ?? fallback;
		const pct = (v: number) => Math.round(v * 100);
		return `${s.effect === "taunt" ? ` · ป้องกัน −${Math.round(at("defDown", 0.05) * 100)}% ${s.duration ?? 5} วิ` : s.effect === "endure" ? ` · ป้องกัน +${Math.round(at("defUp", 0.06) * 100)}% 8 วิ` : s.effect === "dash" ? ` · ${s.range} ม. สตั้น ${s.duration} วิ` : s.effect === "knockup" ? ` · ยก ${s.duration} วิ ร่าย ${s.cast} วิ` : s.effect === "stun" ? ` · สตั้น ${s.duration} วิ` : s.effect === "guard" ? ` · ลดความเสียหายที่ได้รับ ${pct(at("guard", 0.1))}% ${s.duration} วิ` : s.effect === "rage" ? ` · พลังโจมตี +${pct(at("atkUp", 0.1))}% เร็วขึ้น 10% ${s.duration} วิ · เสียพลังชีวิต ${pct(at("hpCost", 0.08))}%` : ""}`;
	}
	/** Damage breakdown for attack skills: kind, reach and element up top, then this level against the next,
	 *  estimated from the player's current ATK/MATK before the target's armour and element. */
	function damageHTML(s: any, lv: number, nextLv: number) {
		const magic = s.type === "magic", power = derived ? (magic ? derived.matk : derived.atk) : 0;
		const hits = s.hits || 1;
		const at = (key: string, fallback: number, l: number) => s.values?.[key]?.[Math.max(0, l - 1)] ?? fallback;
		const per = (l: number) => at("percent", s.percent, l), sp = (l: number) => at("sp", s.sp, l);
		const est = (pct: number) => Math.round(power * pct / 100);
		const n = (v: number) => v.toLocaleString("th-TH");
		const element = s.element === "weapon"
			? `ตามอาวุธ${derived?.weaponElement ? ` (${ELEMENT_TH[derived.weaponElement] ?? derived.weaponElement})` : ""}`
			: ELEMENT_TH[s.element] ?? s.element;
		const reach = s.kind === "area" ? `วงกว้าง · รัศมี ${s.radius || s.range} ม.` : `เป้าเดียว · ระยะ ${s.range} ม.`;
		const chips = [magic ? "เวท" : "กายภาพ", `ธาตุ ${element}`, reach, hits > 1 ? `ตี ${hits} ครั้ง` : "", `คูลดาวน์ ${s.cooldown} วิ`, s.cast ? `ร่าย ${s.cast} วิ` : "ใช้ทันที"]
			.filter(Boolean).map((c) => `<span>${c}</span>`).join("");
		const col = (l: number) => {
			if (!l) return { hit: "—", total: "—", dps: "—", sp: "—" };
			const p = per(l), total = p * hits;
			return {
				hit: `${Math.round(p)}%${power ? `<small>≈ ${n(est(p))}</small>` : ""}`,
				total: power ? `≈ ${n(est(total))}` : `${Math.round(total)}%`,
				dps: power ? `≈ ${n(Math.round(est(total) / Math.max(0.1, s.cooldown + (s.cast || 0))))}` : "—",
				sp: sp(l).toFixed(1).replace(".0", ""),
			};
		};
		const now = col(lv), next = lv < s.maxLevel ? col(nextLv) : null;
		const row = (label: string, k: keyof ReturnType<typeof col>) =>
			`<tr><th>${label}</th><td>${now[k]}</td>${next ? `<td class="nx">${next[k]}</td>` : ""}</tr>`;
		const basic = BASIC?.percent || 100;
		const ratio = (per(Math.max(1, lv)) * hits) / basic;
		const effect = effectText(s, Math.max(1, lv)).replace(/^ · /, "");
		return `<section class="sk-dmg"><h4>ความเสียหาย</h4><div class="sk-chips">${chips}</div>
			<table><thead><tr><th></th><th>${lv ? `ตอนนี้ · Lv ${lv}` : "ยังไม่ได้เรียน"}</th>${next ? `<th class="nx">Lv ${nextLv}</th>` : ""}</tr></thead><tbody>
			${row(hits > 1 ? "ต่อครั้ง" : "ความเสียหาย", "hit")}${hits > 1 ? row(`รวม ${hits} ครั้ง`, "total") : ""}${row("เฉลี่ยต่อวินาที", "dps")}${row("ใช้พลังสกิล", "sp")}
			</tbody></table>
			${effect ? `<p class="sk-eff">ผลพิเศษ · ${effect}</p>` : ""}
			<p class="sk-note">แรงกว่าโจมตีปกติ ×${ratio.toFixed(1)}${power ? ` · ≈ คิดจาก${magic ? "พลังเวท" : "พลังโจมตี"} ${n(Math.round(power))} ตอนนี้ ก่อนหักเกราะและธาตุของศัตรู` : ""}</p></section>`;
	}
	function slotsHTML(mirror = false) {
		return (job?.hotbar || [])
			.map((slot, i) => {
				const s = slot.mode==='autoSpell'&&slot.skill&&job?resolveAutomaticSkill(gameData,slot.skill,Math.max(1,masteryAutoRank(job,slot.skill,gameData.mastery))):slotSpec(slot.skill),
					learned = !!s && (!!slot.skill?.startsWith('item:') || !!job?.skills[s.id]);
				const isItem = !!slot.skill?.startsWith("item:");
				const extra = mirror && s ? (isItem ? `<b class="slot-count">${bagCount(inventory, slot.skill!.slice(5))}</b>` : `<i class="slot-sp">${Math.round(s.values?.sp?.[Math.max(0, level(s.id) - 1)] ?? s.sp ?? 0) || ""}</i>`) : isItem && s ? '<b class="slot-count"></b>' : "";
				const target = mirror && selected ? " slot-target" : "";
				const label = mirror && selected && !s ? "แตะเพื่อวาง" : `${slot.mode==='autoSpell'?'AS · ':''}${slot.signature?slot.signature+' · ':''}${s?.nameTh || "ว่าง"}`;
				return `<button class="job-slot ${i >= 5 ? "extra-slot" : ""} ${isItem ? "item-slot" : ""} ${learned ? "" : "unlearned"} ${!s ? "vacant" : ""}${target}" title="${label} · ${keyLabel(slot.key)}" data-slot="${i}" ${isItem ? `data-item="${slot.skill!.slice(5)}"` : ""} ${mirror ? 'data-mirror="true"' : ""} aria-label="ช่อง ${i + 1} ${label} ${keyLabel(slot.key)}"><kbd>${keyLabel(slot.key)}</kbd>${s ? isItem ? itemIconHTML(slot.skill!.slice(5), 'hotbar-potion') : icon(s) : '<span class="empty-mark">+</span>'}${extra}${slot.mode?'<b class="slot-mode" aria-hidden="true">AS</b>':''}${slot.signature?`<b class="slot-mix" aria-hidden="true">${slot.signature}</b>`:''}<small>${label}</small><em></em>${mirror && s ? '<span class="slot-clear" role="button" aria-label="ล้างช่อง">×</span>' : ""}</button>`;
			})
			.join("");
	}
    function drawModes(){
     if(!job)return;
     let root=panel.querySelector<HTMLElement>('#mastery-loadout');if(!root){root=document.createElement('section');root.id='mastery-loadout';$('#skill-slots').after(root);}
     const used=job.hotbar.filter(s=>s.mode==='autoSpell').length,limit=masteryTriggerSlots(job.masteries);
     const causes={hp:'HP ข้ามลงถึง 40%',incoming:'เสีย HP สะสม 15% ใน 6 วิ',skills:'ใช้สกิลปกติครบ 3 ครั้ง'};
     root.innerHTML=`<h3>Auto Spell · ${job.hotbar.filter(s=>s.mode==='autoSpell').length}/${masteryTriggerSlots(job.masteries)} ช่อง</h3><p>ใช้พื้นที่ในแถบ 10 ช่อง · สูงสุด 1 ครั้ง/วินาที · ไม่เรียกต่อกันเอง</p><div class="mastery-mode-grid">${job.hotbar.map((slot,i)=>{
      const plan=gameData.mastery.skills.find(s=>s.id===slot.skill),rank=slot.skill?masteryAutoRank(job!,slot.skill,gameData.mastery):0;
      if(!plan?.triggerEligible)return '';
      return `<label>${keyLabel(slot.key)} · ${plan.nameTh}<select data-mode="${i}" aria-label="โหมดช่อง ${i+1}"><option value="manual" ${!slot.mode?'selected':''}>ใช้ปกติ</option><option value="autoSpell" ${slot.mode?'selected':''} ${rank&&(slot.mode||used<limit)?'':'disabled'}>Auto Spell R${rank||'—'}</option></select><small>${rank?causes[automaticCause(plan)]:'ต้องเรียนสกิลและฝึก Mastery ให้ถึงเกณฑ์'}${rank?` · MP ${resolveAutomaticSkill(gameData,plan.id,rank).sp}`:''}</small></label>`;
     }).join('')}</div><label>Mix ที่ใช้งาน<select id="mastery-mix" aria-label="เลือก Mix"><option value="">ไม่ใช้ Mix</option>${gameData.mastery.mixes.map(m=>{
      const ready=Object.entries(m.masteries).every(([school,n])=>(job!.masteries[school as keyof typeof job.masteries]??0)>=n!)&&Object.entries(m.pathRanks).every(([id,n])=>(job!.skills[id]??0)>=n)&&Object.keys(m.requires).every(id=>job!.hotbar.some(s=>s.skill===id&&!s.mode));
      return `<option value="${m.id}" ${job!.hotbar.some(s=>s.signature===m.id)?'selected':''} ${ready?'':'disabled'}>${m.id} · ${m.nameTh} · MP ${m.mp} / ${m.icd} วิ${ready?'':' · ยังขาด Mastery/Rank/ช่องส่วนประกอบ'}</option>`;
     }).join('')}</select></label><p>Mix ใช้สกิลส่วนประกอบแบบปกติ · เลือกได้ 1 สูตร · เปลี่ยนเมื่อพ้นการต่อสู้ 5 วินาที</p>`;
     root.querySelectorAll<HTMLSelectElement>('[data-mode]').forEach(el=>el.onchange=()=>{const next=job!.hotbar.map((s,i)=>({...s,...(i===Number(el.dataset.mode)?{mode:el.value==='autoSpell'?'autoSpell' as const:undefined}:{})}));send({t:'hotbar',slots:next});});
     root.querySelector<HTMLSelectElement>('#mastery-mix')!.onchange=e=>{const id=(e.target as HTMLSelectElement).value,m=gameData.mastery.mixes.find(m=>m.id===id),anchor=m?job!.hotbar.findIndex(s=>s.skill&&s.skill in m.requires&&!s.mode):-1;send({t:'hotbar',slots:job!.hotbar.map((s,i)=>({...s,signature:i===anchor?id:undefined}))});};
    }
	function assign(index: number, id: string | null) {
		if (!job) return;
		const next = job.hotbar.map((s, i) => ({
			...s,
			skill: i === index ? id : s.skill,
            ...(i===index?{mode:undefined,signature:undefined}:{}),
		}));
		send({ t: "hotbar", slots: next });
		$("#skills-status").textContent = "กำลังบันทึกแถบสกิล…";
		selected = null;
	}
	function bindSlots(root: HTMLElement) {
		root.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
			el.onclick = (e) => {
				const i = Number(el.dataset.slot);
				if ((e.target as HTMLElement).closest(".slot-clear")) { assign(i, null); return; }
				if (selected) assign(i, selected);
				else if (!el.dataset.mirror) {
					const id = job?.hotbar[i].skill;
					if (id && !job?.hotbar[i].mode) act(id);
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
        const focusedSkill=(document.activeElement as HTMLElement)?.closest<HTMLElement>('[data-sk]')?.dataset.sk;
        const focusedLearn=(document.activeElement as HTMLElement)?.dataset.learn;
		$("#skills-title").textContent="ผังดวงดาวสกิล";
		$("#skills-job").textContent = "147 สกิลในผังเดียว · ฝึก Mastery แยกกันทั้ง 7 ศาสตร์";
		$("#skill-points").textContent = String(
			job.skillPoints - Object.values(pending).reduce((a, b) => a + b, 0),
		);
		const tree = $("#skills-tree");
		if (!viewJob || (!["all","items"].includes(viewJob)&&!MASTERY_SCHOOLS.some(s=>s===viewJob)))viewJob="all";
        const spent=(ids:string[])=>ids.reduce((n,id)=>n+level(id),0);
        const names=schoolNames;
        const tabs=[`<button type="button" data-view="all" aria-pressed="${viewJob==="all"}" tabindex="${viewJob==="all"?0:-1}">ผังดวงดาว<small>147 สกิล · 7 ศาสตร์</small></button>`,...MASTERY_SCHOOLS.map(s=>`<button type="button" data-view="${s}" aria-pressed="${viewJob===s}" tabindex="${viewJob===s?0:-1}">${names[s]}<small>Mastery ${job!.masteries[s]??0} · ${spent(skills.filter(v=>v.school===s).map(v=>v.id))} แต้ม</small></button>`),`<button type="button" data-view="items" aria-pressed="${viewJob==="items"}" tabindex="${viewJob==="items"?0:-1}">ยา<small>ลากใส่แถบได้</small></button>`].join("");
        tree.innerHTML=`<nav class="sk-tabs" role="toolbar" aria-label="เน้นศาสตร์ในผังเดียว">${tabs}</nav><div class="sk-main"><div class="sk-tree-wrap"><svg class="sk-lines" aria-hidden="true"></svg><div class="sk-grid"></div></div><aside class="sk-detail" aria-live="polite"></aside></div>`;
        tree.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b=>{
         b.onclick=()=>{viewJob=b.dataset.view!;mapTarget="all";if(viewJob!=="all"&&viewJob!=="items"){detailId=skills.find(s=>s.school===viewJob)?.id??null;}selected=null;draw();tree.querySelector<HTMLButtonElement>(`[data-view="${viewJob}"]`)?.focus();};
         b.onkeydown=e=>{const tabs=[...tree.querySelectorAll<HTMLButtonElement>("[data-view]")],index=tabs.indexOf(b);let next=index;if(e.key==="ArrowRight")next=(index+1)%tabs.length;else if(e.key==="ArrowLeft")next=(index+tabs.length-1)%tabs.length;else if(e.key==="Home")next=0;else if(e.key==="End")next=tabs.length-1;else return;e.preventDefault();tabs[next].click();};
        });
		const grid = tree.querySelector<HTMLElement>(".sk-grid")!;

		if (viewJob === "items") {
			grid.classList.add("sk-items", "pot-list");
			const slotOf = (id: string) => (job?.hotbar || []).findIndex((h) => h.skill === id);
			const potEffect = (t: (typeof barItems)[number]) => t.effect === "hp" ? `+${t.amount!.toLocaleString("en-US")} HP` : t.effect === "sp" ? `+${t.amount!.toLocaleString("en-US")} SP` : `เร็ว +${Math.round(t.amount! * 100)}% · 60 วิ`;
			const cdNote = document.createElement("p");
			cdNote.className = "pot-cd";
			cdNote.innerHTML = `<i aria-hidden="true"></i>ยาทุกชนิดใช้ <b>คูลดาวน์ร่วม ${POTION_CD} วิ</b> · กดปุ่มลัดหรือดับเบิลคลิกการ์ดเพื่อดื่มทันที`;
			grid.append(cdNote);
			for (const [effect, label] of [["hp", "ฟื้นพลังชีวิต (HP)"], ["sp", "ฟื้นพลังสกิล (SP)"], ["speed", "เสริมพลัง"]] as const) {
				const group = barItems.filter((t) => t.effect === effect);
				if (!group.length) continue;
				const head = document.createElement("div");
				head.className = `pot-group pot-${effect}`;
				head.textContent = label;
				const cards = document.createElement("div");
				cards.className = "pot-cards";
				for (const t of group) {
					const id = "item:" + t.id, own = bagCount(inventory, t.id), at = slotOf(id);
					const card = document.createElement("article");
					card.className = `pot-card pot-${effect}` + (own ? "" : " zero") + (selected === id ? " sk-selected" : "");
					card.dataset.skill = id;
					card.draggable = true;
					card.tabIndex = 0;
					card.innerHTML = `${at >= 0 ? `<span class="pot-slot">ช่อง ${keyLabel(job!.hotbar[at].key)}</span>` : ""}<span class="pot-own">${own ? "×" + own : "0"}</span>${itemIconHTML(t.id, "job-icon-item")}<b></b><span class="pot-amt">${potEffect(t)}</span>`;
					card.querySelector("b")!.textContent = t.nameTh;
					card.ondragstart = (e) => { document.body.classList.add("dragging-hotbar"); e.dataTransfer?.setData("text/plain", id); };
					card.ondragend = () => document.body.classList.remove("dragging-hotbar");
					card.onclick = () => { selected = selected === id ? null : id; $("#skills-status").textContent = selected ? `เลือกช่องด้านล่างเพื่อวาง ${t.nameTh}` : ""; draw(); };
					card.ondblclick = () => { if (own) act(id); };
					card.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); } };
					cards.append(card);
				}
				grid.append(head, cards);
			}
			const chosen = barItems.find((t) => "item:" + t.id === selected);
			const detail = tree.querySelector<HTMLElement>(".sk-detail")!;
			if (!chosen) detail.innerHTML = `<p class="sk-empty">เลือกยาเพื่อดูรายละเอียดและวางลงแถบลัด หรือลากการ์ดลงช่องด้านล่างได้เลย · ยาใช้คูลดาวน์ร่วมกัน ${POTION_CD} วิ</p>`;
			else {
				const id = "item:" + chosen.id, at = slotOf(id), own = bagCount(inventory, chosen.id), bar = job!.hotbar;
				const firstEmpty = bar.findIndex((h) => !h.skill);
				detail.innerHTML = `<div class="pot-head pot-${chosen.effect}"><span class="pot-big">${itemIconHTML(chosen.id, "job-icon-item")}</span><div><h3></h3><small>${chosen.effect === "speed" ? "เร่งความเร็วชั่วคราว" : "ฟื้นฟูทันทีเมื่อดื่ม"}</small></div></div>
					<dl class="pot-kv"><dt>ผล</dt><dd class="pot-amt">${potEffect(chosen)}</dd><dt>มีในกระเป๋า</dt><dd>${own.toLocaleString("en-US")} ขวด</dd><dt>คูลดาวน์</dt><dd>${POTION_CD} วิ (ร่วมกับยาอื่น)</dd><dt>อยู่ในแถบ</dt><dd class="${at >= 0 ? "on" : ""}">${at >= 0 ? "ช่อง " + keyLabel(bar[at].key) : "ยังไม่ได้วาง"}</dd></dl>
					<h4>ใส่ลงแถบ</h4><div class="pot-put"></div>
					<p class="pot-auto">ดื่มอัตโนมัติเมื่อ HP/SP ต่ำ ตั้งได้ใน <button type="button" class="pot-auto-link">ตั้งค่า AUTO</button></p>`;
				detail.querySelector("h3")!.textContent = chosen.nameTh;
				const put = detail.querySelector<HTMLElement>(".pot-put")!;
				bar.forEach((h, i) => {
					const b = document.createElement("button");
					b.type = "button";
					const other = slotSpec(h.skill);
					b.textContent = `${keyLabel(h.key)}${i === at ? " ✓" : !h.skill ? " ·ว่าง" : ""}`;
						b.setAttribute("aria-label", `ใส่ช่อง ${keyLabel(h.key)}${h.skill ? " แทน " + (other?.nameTh ?? "") : " (ว่าง)"}`);
					b.title = h.skill ? `แทนที่ ${other?.nameTh ?? ""}` : "ช่องว่าง";
					b.className = i === at ? "on" : i === firstEmpty ? "rec" : "";
					b.onclick = () => assign(i, id);
					put.append(b);
				});
				detail.querySelector<HTMLButtonElement>(".pot-auto-link")!.onclick = () => { panel.close(); document.querySelector<HTMLElement>("#auto-settings-button")?.click(); };
			}
		} else {

            const list=skills.filter(s=>s.plan);
            if(!list.some(s=>s.id===detailId))detailId=list[0]?.id??null;
            const wrap=tree.querySelector<HTMLElement>(".sk-tree-wrap")!;
            wrap.classList.add("mastery-map");
            tree.querySelector(".sk-main")!.classList.toggle("mastery-overview",viewJob==="all");
            const overview=viewJob==="all",ancestors=masteryAncestors(gameData.mastery.skills,detailId!),children=list.filter(s=>s.requires.some((r:any)=>r.id===detailId));
            const related=new Set([detailId,...ancestors,...children.map(s=>s.id)]);
            wrap.classList.toggle("mastery-focused",!overview);
            wrap.innerHTML=`<div class="mastery-tools"><button type="button" data-map="fit">ดูทั้งผัง</button><button type="button" data-map="out" aria-label="ย่อผัง">−</button><output class="mastery-zoom" aria-label="ระดับซูม"></output><button type="button" data-map="in" aria-label="ขยายผัง">+</button><button type="button" data-map="focus">ดาวที่เลือก</button><label class="mastery-search"><span>ค้นหาสกิล</span><input type="search" placeholder="ชื่อสกิล / ID" aria-label="ค้นหาดาวสกิล"></label><div class="mastery-results" hidden></div></div><div class="mastery-viewport" tabindex="0" role="region" aria-label="ผังดวงดาว 147 สกิล ลากเพื่อเลื่อน ใช้ลูกศรเลื่อนและบวกลบซูม"><div class="mastery-world"><svg viewBox="0 0 3600 3600" aria-hidden="true"></svg><div class="mastery-center"><b>147</b><span>สกิล · 7 ศาสตร์</span></div><div class="mastery-stars"></div></div><div class="mastery-route-key">${overview?"ผังเดียวทุกศาสตร์ · เลือกดาวเพื่อดูเส้นทางเรียน":`<b>${names[viewJob!]}</b><span class="path-before">เส้นทึบ · ทางก่อนหน้า</span><span class="path-next">เส้นประ · สกิลถัดไป</span>`}</div><span class="mastery-map-hint">ลากเลื่อน · ล้อเมาส์ซูม · แตะดาวดูรายละเอียด</span></div>`;
            const viewport=wrap.querySelector<HTMLElement>(".mastery-viewport")!;
            const world=wrap.querySelector<HTMLElement>(".mastery-world")!;
            const nodes=constellation.nodes as Record<string,{x:number;y:number}>;
            world.querySelector("svg")!.innerHTML=[560,1100,1450].map(r=>`<circle class="mastery-ring" cx="1800" cy="1800" r="${r}"/>`).join("")+constellation.edges.map(e=>{
             const target=list.find(s=>s.id===e.to)!;

             const a=nodes[e.from],b=nodes[e.to],curve=masteryCurve(a,b),before=!overview&&(e.to===detailId||ancestors.has(e.to)),next=!overview&&e.from===detailId;
             const kind=before?"before":next?"next":"context",color=schoolColors[MASTERY_SCHOOLS.indexOf(target.school)];
             return `<path class="mastery-edge ${kind} ${level(e.from)>=e.rank?'met':''}" style="--school:${color}" data-edge-to="${e.to}" d="${curve.path}"/>${before||next?`<g class="mastery-edge-rank" data-edge-to="${e.to}" transform="translate(${curve.label.x},${curve.label.y})"><rect x="-21" y="-13" width="42" height="26" rx="9"/><text text-anchor="middle" dominant-baseline="central">R${e.rank}</text></g>`:""}`;
            }).join("");
            world.querySelector(".mastery-stars")!.innerHTML=list.map(s=>{
             const p=nodes[s.id],lv=level(s.id),lock=reason(s),state=lv?"learned":lock?"locked":"avail",color=schoolColors[MASTERY_SCHOOLS.indexOf(s.school)];
             return `<button type="button" class="mastery-star ${state}${!overview&&!related.has(s.id)?" unrelated":""}${s.passive?" passive":""}${s.id===detailId?" sel":""}${pending[s.id]?" pending":""}" data-sk="${s.id}" style="left:${p.x}px;top:${p.y}px;--school:${color}" draggable="${!s.passive&&!!job!.skills[s.id]}" aria-pressed="${s.id===detailId}" aria-label="${s.nameTh} ระดับ ${lv}/${s.maxLevel} ${lock||'เรียนได้'}" title="${s.nameTh} · ${lv}/${s.maxLevel}${lock?' · '+lock:''}">${icon(s)}<span class="mastery-star-name">${s.nameTh}</span><small>${lv}/${s.maxLevel}${s.passive?' · ติดตัว':''}</small></button>`;
            }).join("")+constellation.hubs.map((h,i)=>{
             const a=h.angle*Math.PI/180;return `<button type="button" class="mastery-school" data-school="${h.name}" style="left:${1800+Math.cos(a)*1640}px;top:${1800+Math.sin(a)*1640}px;--school:${schoolColors[i]}">${names[h.name]}<small>Mastery ${job!.masteries[h.name]??0}</small></button>`;
            }).join("");
            function choose(id:string){
             const s=list.find(s=>s.id===id);if(!s)return;
             detailId=id;viewJob=s.school;mapTarget=id;
             if(!s.passive&&job?.skills[id]){selected=id;$("#skills-status").textContent=`เลือกช่องด้านล่างเพื่อวาง ${s.nameTh}`;}
             else selected=null;
             draw();
             if(matchMedia('(max-width:650px)').matches)tree.querySelector('.sk-detail')?.scrollIntoView({block:'nearest'});
            }
            wrap.querySelectorAll<HTMLButtonElement>("[data-sk]").forEach(node=>{
             node.onclick=()=>choose(node.dataset.sk!);
             node.ondragstart=e=>{document.body.classList.add('dragging-hotbar');e.dataTransfer?.setData('text/plain',node.dataset.sk!);};
             node.ondragend=()=>document.body.classList.remove('dragging-hotbar');
             node.onfocus=()=>{
              const p=nodes[node.dataset.sk!],c=camera.state,x=p.x*c.scale+c.x,y=p.y*c.scale+c.y;
              if(c.scale<.53||x<40||y<40||x>viewport.clientWidth-40||y>viewport.clientHeight-40){camera.focus(p.x,p.y,viewport.clientWidth,viewport.clientHeight);paintCamera();}
             };
            });
            wrap.querySelectorAll<HTMLButtonElement>("[data-school]").forEach(b=>b.onclick=()=>tree.querySelector<HTMLButtonElement>(`[data-view="${b.dataset.school}"]`)?.click());
            wrap.querySelectorAll<HTMLButtonElement>("[data-map]").forEach(b=>b.onclick=()=>{
             const w=viewport.clientWidth,h=viewport.clientHeight;
             if(b.dataset.map==="fit"){viewJob="all";mapTarget="all";selected=null;draw();}
             else if(b.dataset.map==="focus"){mapTarget=detailId;positionMap();}
             else{camera.zoom(b.dataset.map==="in"?1.25:.8,w/2,h/2,w,h);paintCamera();}
            });
            const results=wrap.querySelector<HTMLElement>(".mastery-results")!;
            wrap.querySelector<HTMLInputElement>("input")!.oninput=e=>{
             const q=(e.target as HTMLInputElement).value.trim().toLocaleLowerCase();
             results.replaceChildren();results.hidden=!q;
             if(!q)return;
             const found=list.filter(s=>(s.nameTh+s.id+names[s.school]).toLocaleLowerCase().includes(q));
             for(const s of found.slice(0,12)){const b=document.createElement("button");b.type="button";b.textContent=`${s.nameTh} · ${names[s.school]}`;b.onclick=()=>choose(s.id);results.append(b);}
             if(!found.length)results.textContent="ไม่พบสกิล";
            };
            viewport.addEventListener("wheel",e=>{e.preventDefault();const r=viewport.getBoundingClientRect();camera.zoom(Math.exp(-e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top,viewport.clientWidth,viewport.clientHeight);paintCamera();},{passive:false});
            let drag:{id:number;x:number;y:number}|null=null;
            viewport.onpointerdown=e=>{if((e.target as HTMLElement).closest("button"))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};viewport.setPointerCapture(e.pointerId);};
            viewport.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;camera.pan(e.clientX-drag.x,e.clientY-drag.y,viewport.clientWidth,viewport.clientHeight);drag={id:e.pointerId,x:e.clientX,y:e.clientY};paintCamera();};
            viewport.onpointerup=viewport.onpointercancel=()=>{drag=null;};
            viewport.onkeydown=e=>{
             if(e.target!==viewport)return;
             const moves:Record<string,[number,number]>={ArrowLeft:[80,0],ArrowRight:[-80,0],ArrowUp:[0,80],ArrowDown:[0,-80]},w=viewport.clientWidth,h=viewport.clientHeight;
             if(moves[e.key])camera.pan(...moves[e.key],w,h);
             else if(e.key==="Home")camera.fit(w,h);
             else if(["+","=","-"].includes(e.key))camera.zoom(e.key==="-"?.8:1.25,w/2,h/2,w,h);
             else return;
             e.preventDefault();e.stopPropagation();paintCamera();
            };
            requestAnimationFrame(positionMap);
			const d = list.find((s) => s.id === detailId);
			if (d) {
				const lv = level(d.id),
					nextLv = Math.min(d.maxLevel, lv + 1),
					lock = reason(d),
					learned = job.skills[d.id] || 0,
					pips = Array.from({ length: d.maxLevel }, (_, i) => `<i class="${i < learned ? "on" : i < lv ? "new" : ""}"></i>`).join(""),
					reqs = d.requires.map((r: any) => `<button type="button" data-route="${r.id}" class="${level(r.id) >= r.level ? "ok" : "no"}">${level(r.id) >= r.level ? "✓" : "✗"} ${skills.find((s) => s.id === r.id)?.nameTh} R${r.level} ←</button>`).join(""),
					left = job.skillPoints - Object.values(pending).reduce((a, b) => a + b, 0);
				tree.querySelector(".sk-detail")!.innerHTML = `<div class="sk-dhead">${icon(d,"sk-big")}<div><h3>${d.nameTh}</h3><small>${d.passive ? "ติดตัว · ไม่ต้องกดใช้" : `กดใช้ · ${d.kind === "area" ? "วงกว้าง" : d.kind === "single" ? "เป้าเดียว" : "สนับสนุน"}`}</small><div class="sk-pips">${pips}</div></div><span class="sk-dlv">Lv ${lv}/${d.maxLevel}<small>${learned ? "เรียนแล้ว" : lock && lock !== "แต้มสกิลไม่พอ" ? "ยังไม่ปลด" : "เรียนได้"}</small></span></div>
					<button type="button" class="sk-learn primary" data-learn="${d.id}" ${lock ? "disabled" : ""}>${lock ? lock : lv ? "อัปเลเวล · ใช้ 1 แต้ม" : "เรียนสกิล · ใช้ 1 แต้ม"}</button>
                    <section class="mastery-steps"><h4>ต้องเรียนก่อน</h4><div class="sk-reqs">${reqs||"<span>เริ่มเรียนได้โดยไม่มีสกิลก่อนหน้า</span>"}</div>${children.length?`<h4>สกิลถัดไป</h4><div class="mastery-next">${children.map(s=>`<button type="button" data-route="${s.id}">${s.nameTh}<small>${s.requires.filter((r:any)=>r.id===d.id).map((r:any)=>`ต้อง R${r.level}`).join(" · ")} →</small></button>`).join("")}</div>`:""}</section>
                    ${!d.passive && d.type!=="heal" && d.percent > 0 ? damageHTML(d, lv, nextLv) : `<dl><dt>ตอนนี้</dt><dd>${lv ? values(d, lv) : "ยังไม่ได้เรียน"}</dd>${lv < d.maxLevel ? `<dt>ระดับถัดไป · Lv ${nextLv}</dt><dd class="skill-next">${values(d, nextLv)}</dd>` : ""}</dl>`}
					${d.plan?`${!d.legacyRuntime?`<p class="sk-note">${d.plan.note}</p>`:""}<p class="sk-note">Mastery ${d.school} ${d.plan.ranks[Math.max(0,nextLv-1)].mastery} · ${d.plan.weapon==='any'?'ทุกอาวุธ':d.plan.weapon==='sword'?'ดาบ':d.plan.weapon==='bow'?'ธนู':d.plan.weapon==='dagger'?'มีด':'มือเปล่า'}</p>`:""}
                    <div class="sk-reqs"><span class="${left > 0 ? "ok" : "no"}">${left > 0 ? "✓" : "✗"} แต้มสกิลเหลือ ${left}</span></div>

					`;
				tree.querySelectorAll<HTMLButtonElement>("[data-route]").forEach(b=>{
                 b.onclick=()=>choose(b.dataset.route!);
                });
				tree.querySelector<HTMLElement>("[data-learn]")!.onclick = () => { pending[d.id] = (pending[d.id] || 0) + 1; $("#skills-status").textContent=`เตรียมอัป ${d.nameTh} · กดยืนยันเรียนสกิลด้านล่าง`; draw(); };
			}
		}
		$("#skill-slots").innerHTML = slotsHTML(true);
		bindSlots($("#skill-slots"));
        drawModes();
		$("#skills-confirm").toggleAttribute(
			"disabled",
			!Object.keys(pending).length,
		);
		drawKeys();
		if(focusedLearn)tree.querySelector<HTMLButtonElement>(`[data-learn="${focusedLearn}"]`)?.focus();
        else if(focusedSkill)tree.querySelector<HTMLButtonElement>(`[data-sk="${focusedSkill}"]`)?.focus({preventScroll:true});
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
                viewJob="all";mapTarget="all";
				draw();
				panel.showModal();
                panel.querySelector<HTMLButtonElement>('[data-view="all"]')?.focus();
				play("ui_open");
			}
		},
		key(code: string) {
			const s = job?.hotbar.find((s) => s.key === code);
			if (s?.skill) {
				if(!s.mode)act(s.skill);
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
			if (e.type === "stats" && e.derived) {
				const changed = !derived || derived.atk !== e.derived.atk || derived.matk !== e.derived.matk;
				derived = { atk: e.derived.atk, matk: e.derived.matk, weaponElement: e.derived.weaponElement };
				if (changed && !e.job && panel.open) draw();
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
				JSON.stringify([p.hotbar,p.skills,p.masteries,p.masteryExp,p.skillPoints]);
			if (p.jobId && key !== last) {
				last = key;
				job = {
					jobId: p.jobId,
					jobLevel: p.jobLevel,
					jobExp: p.jobExp,
					skillPoints: p.skillPoints,
					skills: p.skills,
					hotbar: p.hotbar,
                    masteryVersion:p.masteryVersion,masteries:p.masteries,masteryExp:p.masteryExp,
				};
				drawBar();
                if(panel.open)draw();
			}
			bar.querySelectorAll<HTMLElement>("[data-slot]").forEach((el) => {
				const id = job?.hotbar[Number(el.dataset.slot)].skill,
					cd = id ? p.cd[id.startsWith('item:')?'potion':id] || 0 : 0;
				el.classList.toggle('low-sp',!!id&&!id.startsWith('item:')&&p.mp<(job?.hotbar[Number(el.dataset.slot)].mode==='autoSpell'?resolveAutomaticSkill(gameData,id,Math.max(1,masteryAutoRank(p,id,gameData.mastery))):resolveSkill(gameData,id,p.skills[id]||1)).sp);
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
