import {
	loadGameData,
	rarityColors,
		inventorySlots,
	storageSlots,
	equipmentSlots,
	equipmentTarget,
	type Inventory,
	type OwnedItem,
	type Player,
} from "@thainative/shared";
import "./inventory.css";
import { itemIconCell } from "./item-icon";
const data = loadGameData(),
	templates = data.items.items;
const slotNames: Record<string, string> = {
	weapon: "อาวุธ",
	body: "ชุดเกราะ",
	shield: "โล่",
	garment: "ผ้าคลุม",
	footgear: "รองเท้า",
	accessory1: "แหวน 1",
	ring2: "แหวน 2",
	accessory2: "เครื่องราง",
};
/** Weights are decimals now (materials 0.1, potions 0.2): show at most one decimal, no float noise. */
const fmtGold = (n: number) => n.toLocaleString("en-US");
const fmtWeight = (w: number) => String(Math.round(w * 10) / 10);
export function mountInventory(send: (m: any) => void, onOpen: () => void) {
	const button = document.createElement("button");
	button.id = "inventory-button";
	button.textContent = "กระเป๋า I";
	document.querySelector("#ui")!.append(button);
	const panel = document.createElement("dialog");
	panel.id = "inventory-window";
	panel.innerHTML = `<button class="close" aria-label="ปิด">×</button><header class="g-head"><h2>กระเป๋า</h2><span class="g-sub inv-summary"></span></header><div class="inv-body"><aside class="inv-npc" hidden><div class="inv-npc-figure"></div><small class="inv-npc-place"></small><b class="inv-npc-name"></b><p class="inv-npc-say"></p></aside><div class="inv-left"><div class="inv-doll"></div><div class="inv-bonus"></div><div class="inv-weight-row"><span>น้ำหนัก</span><progress class="inv-weight" max="100"></progress><span class="inv-weight-text"></span></div></div><div class="inv-main"><nav class="inv-tabs"></nav><div class="inv-content"></div><div class="inv-foot"><label class="inv-auto g-switch"><input type="checkbox"><i></i>เก็บของอัตโนมัติ</label><span class="inv-count"></span></div><section class="inv-detail" aria-live="polite">เลือกไอเทมเพื่อดูข้อมูล</section></div><aside class="inv-cart" hidden></aside></div><p class="inv-status" role="status"></p>`;
	document.body.append(panel);
	const summary = panel.querySelector<HTMLElement>(".inv-summary")!,
		tabs = panel.querySelector("nav")!,
		content = panel.querySelector<HTMLElement>(".inv-content")!,
		detail = panel.querySelector<HTMLElement>(".inv-detail")!,
		status = panel.querySelector<HTMLElement>(".inv-status")!,
		npcBox = panel.querySelector<HTMLElement>(".inv-npc")!,
		left = panel.querySelector<HTMLElement>(".inv-left")!,
		dollBox = panel.querySelector<HTMLElement>(".inv-doll")!,
		bonusBox = panel.querySelector<HTMLElement>(".inv-bonus")!,
		cartBox = panel.querySelector<HTMLElement>(".inv-cart")!,
		countBox = panel.querySelector<HTMLElement>(".inv-count")!;
	const NPCS: Record<string, [string, string, string]> = {
		market: ["พ่อค้าเบ็ดเตล็ด", "ตลาด · นครที่ถูกลืมเลือน", "ยาสดใหม่เพิ่งต้มเมื่อเช้า ของจำเป็นก่อนออกประตูใต้มีครบ"],
		forge: ["ช่างตีเหล็ก", "โรงตีเหล็ก · นครที่ถูกลืมเลือน", "อาวุธดีต้องเหมาะกับมือ เลือกให้ดี แล้วค่อยกลับมาหาข้า"],
		storage: ["คนเฝ้าคลัง", "คลังเก็บของ · นครที่ถูกลืมเลือน", "ฝากไว้กับข้า ของในคลังปลอดภัยเสมอ"],
	};
	const metricNames: Record<string, string> = { atk: "พลังโจมตี", matk: "พลังเวท", flee: "หลบหลีก", hardDef: "เกราะกายภาพ", hardMdef: "เกราะเวท", softDef: "ป้องกันกายภาพ", maxSp: "พลังสกิลสูงสุด", maxHp: "พลังชีวิตสูงสุด", hit: "ความแม่นยำ", crit: "คริติคอล" };
	const cart = new Map<string, number>();
	let buyQueue: [string, number][] = [];
	let lastDraw = "";
	let p: Player | undefined,
		inv: Inventory | undefined,
		filter = "ทั้งหมด",
				shop: string | null = null,
		storage = false,
		storageTab = "ฝากของ",
		shopTab = "ซื้อ",
		shopRange = "current",
		shopCategory = "all",
		shopOwnClass = true,
		selected: string | null = null,
		lastTouch = "",
		multi = new Set<string>(),
		pending: { req: string; message: any } | undefined;
	const auto = panel.querySelector<HTMLInputElement>("input")!;
	const tip = document.createElement("div");
	tip.className = "inv-tip";
	tip.hidden = true;
	tip.setAttribute("role", "tooltip");
	// Top layer (popover) so it floats above the modal bag window without being clipped by it.
	tip.setAttribute("popover", "manual");
	document.body.append(tip);
	let tipTimer = 0, tipAnchor: HTMLElement | null = null;
	panel.addEventListener("close", () => hideTip());
	function request(op: string, args: any = {}) {
		if (pending) {
			status.textContent = "กำลังบันทึก กรุณารอสักครู่";
			return;
		}
		const message = { t: "inv", op, req: crypto.randomUUID(), ...args };
		pending = { req: message.req, message };
		status.textContent = "กำลังบันทึก…";
		send(message);
		window.setTimeout(() => {
			if (pending?.req === message.req) {
				status.textContent = "ยังไม่ได้รับคำตอบ · ";
				const retry = document.createElement("button");
				retry.textContent = "ลองคำขอเดิมอีกครั้ง";
				retry.onclick = () => send(message);
				status.append(retry);
			}
		}, 5000);
	}
	const template = (i: OwnedItem) =>
		templates.find((t) => t.id === i.template)!;
	function action(i: OwnedItem, slot?: string) {
		const t = template(i);
		if (i.location === "equip") request("unequip", { id: i.id });
		else if (t.slot) request("equip", { id: i.id, ...(slot ? {slot} : {}) });
		else if (t.type === "consumable") request("use", { id: i.id });
	}
	function itemIcon(t: (typeof templates)[number]) {
		const icon = document.createElement("span");
		icon.className = "item-icon";
		const cell = itemIconCell(t.id);
		if (cell.v2) icon.classList.add("item-icon-v2");
		icon.style.backgroundPosition = cell.position;
		return icon;
	}
	function cell(i: OwnedItem, mode = "bag") {
		const t = template(i),
			b = document.createElement("button");
		b.className = "inv-cell";
		b.style.setProperty("--rarity", rarityColors[t.rarity]);
		b.dataset.item = i.template;
		b.dataset.id = i.id;
		b.setAttribute("aria-label", `${t.nameTh} ×${i.qty}`);
		hoverTip(b, () => ({ t, i, mode }));
		b.append(itemIcon(t));
		const count = document.createElement("b");
		count.textContent = i.qty > 1 ? String(i.qty) : i.bound ? "◆" : "";
		b.append(count);
        const incompatible=!!t.weaponType&&!data.classes.classes.find(c=>c.id===(p?.profile?.classId||p?.jobId))?.weapons.includes(t.weaponType);
        if(mode==='buy'||mode==='sell'){b.classList.add('shop-cell');const caption=document.createElement('span');caption.className='shop-caption';caption.textContent=t.nameTh;const price=document.createElement('small');price.textContent=`${mode==='buy'?data.economy.shops[shop!][t.id]:Math.floor(t.npcPrice*data.economy.sellMultiplier)} ทอง`;b.append(caption,price);}
        if(incompatible){const note=document.createElement('small');note.textContent='อาชีพนี้ใช้ไม่ได้';b.append(note);}
		if (multi.has(i.id)) b.classList.add("inv-selected");
		b.draggable = mode === "bag";
		b.ondragstart = (e) => e.dataTransfer?.setData("text/plain", t.type==='consumable'?'item:'+t.id:i.id);
		b.onclick = () => {
			if (mode === "sell") {
				multi.has(i.id) ? multi.delete(i.id) : multi.add(i.id);
				draw();
			}
			selected = i.id;
			showDetail(i, !matchMedia("(pointer:coarse)").matches);
			if (matchMedia("(pointer:coarse)").matches) {
				if (lastTouch === i.id) showDetail(i, true);
				lastTouch = i.id;
			}
		};
				b.ondblclick = () => {
			if (mode === "store" || mode === "withdraw") { request(mode === "store" ? "store" : "retrieve", { id: i.id, qty: i.qty }); return; }
			if (mode === "buy")
				request("buy", { shop, template: i.template, qty: 1 });
			else if (mode !== "sell") action(i);
		};
		b.oncontextmenu = (e) => {
			e.preventDefault();
			selected = i.id;
			showDetail(i, true);
		};
		let hold: number;
		b.onpointerdown = () => {
			hold = window.setTimeout(() => showDetail(i, true), 550);
		};
		b.onpointerup = b.onpointerleave = () => clearTimeout(hold);
		return b;
	}
	function showDetail(i: OwnedItem, actions = true, requestedSlot?: string) {
		const t = template(i);
		detail.replaceChildren();
		const title = document.createElement("h3");
		title.textContent = t.nameTh;
		title.style.color = rarityColors[t.rarity];
		detail.append(title);
		const text = document.createElement("p");
		const targetSlot = t.slot && inv ? (i.location === 'equip' ? i.slot : equipmentTarget(inv, t.slot, requestedSlot)) : t.slot;
		const old = inv?.items.find(
			(i) => i.location === "equip" && i.slot === targetSlot,
		);
		const oldT = old && template(old);
		text.textContent = `${(t.slot === "accessory1" ? (i.location === "equip" ? slotNames[i.slot!] : "แหวน") : slotNames[t.slot || ""]) || ({ consumable: "ของใช้", material: "วัตถุดิบ", refine: "หินตีบวก", card: "การ์ด" } as any)[t.type]} · ต้องการระดับ ${t.level}\nน้ำหนัก ${fmtWeight(t.weight)} · ${shop && shopTab === "ซื้อ" ? "ซื้อ " + fmtGold(data.economy.shops[shop][t.id]) : "ขาย " + fmtGold(Math.floor(t.npcPrice * data.economy.sellMultiplier))} ทอง · ช่องการ์ด ${t.slots}\n${i.bound ? "ผูกมัดแล้ว" : t.bind === "equip" ? "ผูกมัดเมื่อสวมใส่" : t.bind === "account" ? "ผูกบัญชี" : "แลกเปลี่ยนได้"}`;
		detail.append(text);
		if (t.slot === 'accessory1' && i.location === 'bag' && !shop && !storage && actions) {
			const label = document.createElement('label'), select = document.createElement('select');
			label.textContent = 'ช่องแหวน '; select.setAttribute('aria-label', 'ช่องแหวนที่จะสวม');
			for (const slot of equipmentSlots(t.slot)) { const option = document.createElement('option'); option.value = slot; option.textContent = slotNames[slot]; select.append(option); }
			select.value = targetSlot!; select.onchange = () => showDetail(i, actions, select.value); label.append(select); detail.append(label);
		}
        const incompatible=!!t.weaponType&&!data.classes.classes.find(c=>c.id===(p?.profile?.classId||p?.jobId))?.weapons.includes(t.weaponType);
        if(incompatible){const note=document.createElement('p');note.textContent='อาชีพนี้ใช้ไม่ได้';detail.append(note);}
		const metrics = [
			["พลังโจมตี", t.atk || 0, oldT?.atk || 0],
			["พลังเวท", t.matk || 0, oldT?.matk || 0],
			...t.modifiers
				.filter(
					(m): m is Extract<typeof m, { value: number }> =>
						m.kind === "flat" || m.kind === "stat" || m.kind === "percent",
				)
				.map((m) => [
					"stat" in m ? m.stat : "",
					m.value,
					oldT?.modifiers.reduce(
						(n, o) =>
							n +
							("stat" in o && "stat" in m && o.stat === m.stat ? o.value : 0),
						0,
					) || 0,
				]),
		];
		for (const [name, value, oldValue] of metrics) {
			if (!value && !oldValue) continue;
			const row = document.createElement("div");
            row.textContent = `${metricNames[String(name)]||name} +${value}`;
			const diff = Number(value) - Number(oldValue),
				span = document.createElement("span");
			span.textContent = ` (${diff >= 0 ? "+" : ""}${diff} เทียบ${t.slot === 'accessory1' ? slotNames[targetSlot!] : 'ที่สวม'})`;
			span.style.color = diff >= 0 ? "#8ac68a" : "#e88d85";
			row.append(span);
			detail.append(row);
		}
				if (!actions) return;
		const buttons = document.createElement("div");
		buttons.className = "inv-actions";
		const add = (label: string, fn: () => void) => {
			const b = document.createElement("button");
			b.textContent = label;
			b.onclick = fn;
			buttons.append(b);
		};
		if (storage) {
			const into = i.location === "bag";
			const qty = document.createElement("input");
			qty.type = "number";
			qty.min = "1";
			qty.max = String(i.qty);
			qty.value = String(i.qty);
			qty.setAttribute("aria-label", into ? "จำนวนฝาก" : "จำนวนถอน");
			buttons.append(qty);
			add(into ? "ฝากเข้าคลัง" : "ถอนใส่กระเป๋า", () =>
				request(into ? "store" : "retrieve", { id: i.id, qty: Math.min(i.qty, Math.max(1, Math.trunc(Number(qty.value) || 1))) }),
			);
			detail.append(buttons);
			return;
		}
		if (shop && shopTab === "ซื้อ") {
			const quantity = document.createElement("input");
			quantity.type = "number";
			quantity.min = "1";
			quantity.max = "999";
			quantity.value = "1";
			quantity.setAttribute("aria-label", "จำนวนซื้อ");
			buttons.append(quantity);
			add(`ซื้อ · ${fmtGold(data.economy.shops[shop][t.id])} ทอง/ชิ้น`, () =>
				request("buy", { shop, template: t.id, qty: Math.min(999,Math.max(1,Math.trunc(Number(quantity.value)||1))) }),
			);
		} else if (!shop) {
			if ((!t.slot || !incompatible) && (t.slot || t.type === "consumable"))
				add(i.location === "equip" ? "ถอด" : t.slot === 'accessory1' ? 'ใส่'+slotNames[targetSlot!] : t.slot ? "ใส่" : "ใช้", () =>
					action(i, targetSlot ?? undefined),
				);
			if (i.location === "bag") {
				const qty = document.createElement("input");
				qty.type = "number";
				qty.min = "1";
				qty.max = String(i.qty);
				qty.value = "1";
				qty.setAttribute("aria-label", "จำนวนทิ้ง");
				buttons.append(qty);
				add("ทิ้ง ×n", () => {
					const n = Math.min(i.qty,Math.max(1,Math.trunc(Number(qty.value)||1)));
					if (confirm(`ยืนยันทิ้ง ${t.nameTh} ×${n}?`))
						request("discard", { id: i.id, qty: n });
				});
			}
		}
		detail.append(buttons);
	}
	const levelBand = (level: number) => level >= 99 ? 99 : Math.floor(level / 10) * 10;
 const playerLevel = () => p?.level ?? 1;
 const compatible = (t: (typeof templates)[number]) => !t.weaponType || !!data.classes.classes.find(c=>c.id===(p?.profile?.classId||p?.jobId))?.weapons.includes(t.weaponType);
 const shopItems = () => Object.keys(data.economy.shops[shop!]).filter(id=>{
  const t=templates.find(t=>t.id===id)!;
  const band=shopRange==='current'?levelBand(playerLevel()):Number(shopRange);
  return (shopRange==='all'||levelBand(t.level)===band) && (shopCategory==='all'||(t.slot??t.type)===shopCategory) && (!shopOwnClass||compatible(t));
 }).sort((a,b)=>templates.find(t=>t.id===a)!.level-templates.find(t=>t.id===b)!.level || priceOf(a)-priceOf(b));
 const controls=document.createElement('div'); controls.className='shop-filters'; controls.hidden=true;
 controls.innerHTML=`<label>ช่วงเลเวล<select aria-label="ช่วงเลเวลสินค้า"><option value="current">ช่วงเลเวลของฉัน</option><option value="all">ทั้งหมด · Lv.1–99</option>${[0,10,20,30,40,50,60,70,80,90,99].map(l=>`<option value="${l}">Lv.${l||1}${l===99?'':'–'+(l===90?98:l+9)}</option>`).join('')}</select></label><label>ประเภท<select aria-label="ประเภทสินค้า">${Object.entries({all:'ทุกประเภท',weapon:'อาวุธ',body:'เกราะ',shield:'โล่',garment:'ผ้าคลุม',footgear:'รองเท้า',accessory1:'แหวน',accessory2:'เครื่องราง',consumable:'ยา',refine:'หินตีบวก'}).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="shop-class"><input type="checkbox" checked>อาวุธตรงอาชีพ</label>`;
 tabs.after(controls);
 const rangeSelect=controls.querySelectorAll('select')[0],categorySelect=controls.querySelectorAll('select')[1],classCheck=controls.querySelector('input')!;
 rangeSelect.onchange=()=>{shopRange=rangeSelect.value;draw();};categorySelect.onchange=()=>{shopCategory=categorySelect.value;draw();};classCheck.onchange=()=>{shopOwnClass=classCheck.checked;draw();};
	const priceOf = (id: string) => data.economy.shops[shop!][id] as number;
	const sellPrice = (i: OwnedItem) => Math.floor(template(i).npcPrice * data.economy.sellMultiplier) * i.qty;
	const owned = (id: string) => inv?.items.filter((i) => i.location === "bag" && i.template === id).reduce((n, i) => n + i.qty, 0) || 0;
	function statsOf(t: (typeof templates)[number]) {
		const out: Record<string, number> = {};
		if (t.atk) out.atk = t.atk;
		if (t.matk) out.matk = t.matk;
		for (const m of t.modifiers) if ("stat" in m && "value" in m && (m.kind === "flat" || m.kind === "stat")) out[m.stat] = (out[m.stat] || 0) + m.value;
		return out;
	}
	const TYPE_NAMES: Record<string, string> = { consumable: "ของใช้", material: "วัตถุดิบ", refine: "หินตีบวก", card: "การ์ด" };
	const WEAPON_NAMES: Record<string, string> = { sword1h: "ดาบมือเดียว", dagger: "มีดสั้น", staff: "คทา", bow: "ธนู" };
	const RARITY_NAMES: Record<string, string> = { common: "ธรรมดา", fine: "ดี", rare: "หายาก", epic: "มหากาพย์", legendary: "ตำนาน" };
	type TipSource = { t: (typeof templates)[number]; i?: OwnedItem; mode?: string };
	/** One item card. With `against`, every stat shows its change from that equipped item (missing stats count as 0). */
	function tipCard(t: (typeof templates)[number], i: OwnedItem | undefined, opts: { worn?: boolean; against?: (typeof templates)[number] | null; slot?: string } = {}) {
		const card = document.createElement("div");
		card.className = "tip-card" + (opts.worn ? " worn" : "");
		card.style.setProperty("--rarity", rarityColors[t.rarity]);
		const head = document.createElement("div");
		head.className = "tip-head";
		const ico = document.createElement("span");
		ico.className = "tip-ico";
		ico.append(itemIcon(t));
		const name = document.createElement("div");
		const kind = t.slot
			? `${t.slot === "accessory1" ? (opts.slot ? slotNames[opts.slot] : "แหวน") : slotNames[t.slot]}${t.weaponType ? " · " + (WEAPON_NAMES[t.weaponType] || t.weaponType) : ""}`
			: TYPE_NAMES[t.type] || t.type;
		name.innerHTML = "<b></b><small></small>";
		name.querySelector("b")!.textContent = t.nameTh;
		name.querySelector("small")!.textContent = `${kind} · ${RARITY_NAMES[t.rarity] || t.rarity}`;
		head.append(ico, name);
		if (opts.worn) { const tag = document.createElement("em"); tag.textContent = "สวมอยู่"; head.append(tag); }
		card.append(head);
		const notes: [string, boolean][] = [];
		if (t.slot || t.level > 1) notes.push([`ต้องการระดับ ${t.level}`, (p?.level ?? 1) < t.level]);
		if (t.weaponType && !compatible(t)) notes.push(["อาชีพนี้ใช้ไม่ได้", true]);
		if (notes.length) {
			const req = document.createElement("div");
			req.className = "tip-req";
			for (const [text, bad] of notes) { const s = document.createElement("span"); s.textContent = text; s.classList.toggle("bad", bad); req.append(s); }
			card.append(req);
		}
		if (t.slot) {
			const mine = statsOf(t), theirs = opts.against ? statsOf(opts.against) : null;
			const keys = [...new Set([...Object.keys(mine), ...(theirs ? Object.keys(theirs) : [])])];
			const list = document.createElement("div");
			list.className = "tip-stats";
			for (const k of keys) {
				const row = document.createElement("div"), v = mine[k] || 0;
				row.innerHTML = "<span></span><b></b>";
				row.querySelector("span")!.textContent = metricNames[k] || k;
				row.querySelector("b")!.textContent = v ? `+${v}` : "—";
				if (theirs || opts.against === null) {
					const d = v - (theirs?.[k] || 0), diff = document.createElement("i");
					diff.textContent = d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : "=";
					diff.className = d > 0 ? "up" : d < 0 ? "down" : "same";
					row.append(diff);
				}
				list.append(row);
			}
			if (!keys.length) list.innerHTML = '<div class="tip-none">ไม่มีค่าพลังเพิ่ม</div>';
			card.append(list);
			if (opts.against === null) { const n = document.createElement("p"); n.className = "tip-note"; n.textContent = "ช่องนี้ยังว่าง"; card.append(n); }
		} else if (t.type === "consumable") {
			const e = document.createElement("p");
			e.className = "tip-effect";
			e.textContent = describe(t);
			card.append(e);
		}
		const foot = document.createElement("div");
		foot.className = "tip-foot";
		const bind = i?.bound ? "ผูกมัดแล้ว" : t.bind === "equip" ? "ผูกมัดเมื่อสวม" : t.bind === "account" ? "ผูกบัญชี" : "แลกเปลี่ยนได้";
		foot.textContent = [`น้ำหนัก ${fmtWeight(t.weight)}`, `ขาย ${fmtGold(Math.floor(t.npcPrice * data.economy.sellMultiplier))} ทอง`, t.slot ? `ช่องการ์ด ${t.slots}` : "", t.slot ? bind : ""].filter(Boolean).join(" · ");
		card.append(foot);
		return card;
	}
	function renderTip({ t, i, mode }: TipSource) {
		tip.replaceChildren();
		const wrap = document.createElement("div");
		wrap.className = "tip-wrap";
		const equipped = i?.location === "equip";
		let slot: string | undefined, old: OwnedItem | undefined;
		if (t.slot && inv && !equipped) {
			slot = equipmentTarget(inv, t.slot);
			old = inv.items.find((x) => x.location === "equip" && x.slot === slot);
		}
		const oldT = old ? template(old) : null;
		const main = tipCard(t, i, { worn: equipped, against: t.slot && !equipped ? oldT : undefined, slot: equipped ? i!.slot : slot });
		wrap.append(main);
		if (oldT && old) {
			const side = tipCard(oldT, old, { worn: true, slot });
			side.classList.add("side");
			wrap.append(side);
		}
		tip.append(wrap);
		const hint = mode === "buy" ? "ดับเบิลคลิก: ซื้อ 1 ชิ้น" : mode === "sell" ? "คลิก: เลือกขาย"
			: mode === "store" ? "ดับเบิลคลิก: ฝากทั้งหมด" : mode === "withdraw" ? "ดับเบิลคลิก: ถอนทั้งหมด"
			: equipped ? "ดับเบิลคลิก: ถอด" : t.slot ? (compatible(t) ? "ดับเบิลคลิก: สวม · ลากไปที่ช่องได้" : "")
			: t.type === "consumable" ? "ดับเบิลคลิก: ใช้ · ลากไปแถบลัดได้" : "";
		if (hint) { const h = document.createElement("p"); h.className = "tip-hint"; h.textContent = hint; tip.append(h); }
	}
	function placeTip(x: number, y: number) {
		const r = tip.getBoundingClientRect(), pad = 12;
		let left = x + 18, top = y + 18;
		if (left + r.width > innerWidth - pad) left = x - r.width - 14;
		if (top + r.height > innerHeight - pad) top = Math.max(pad, innerHeight - r.height - pad);
		tip.style.transform = `translate(${Math.max(pad, Math.round(left))}px,${Math.round(top)}px)`;
	}
	function hideTip() { clearTimeout(tipTimer); tip.hidden = true; tipAnchor = null; try { tip.hidePopover(); } catch { /* not open */ } }
	/** Mouse hover shows the full card right away; touch keeps tap-to-select and long-press. */
	function hoverTip(el: HTMLElement, source: () => TipSource) {
		let last = { x: 0, y: 0 };
		el.addEventListener("pointerenter", (e) => {
			if (e.pointerType !== "mouse") return;
			last = { x: e.clientX, y: e.clientY };
			clearTimeout(tipTimer);
			tipTimer = window.setTimeout(() => { renderTip(source()); tipAnchor = el; tip.hidden = false; try { tip.showPopover(); } catch { /* already open */ } placeTip(last.x, last.y); }, tip.hidden ? 120 : 0);
		});
		el.addEventListener("pointermove", (e) => { last = { x: e.clientX, y: e.clientY }; if (tipAnchor === el) placeTip(e.clientX, e.clientY); });
		el.addEventListener("pointerleave", () => { clearTimeout(tipTimer); if (tipAnchor === el) hideTip(); });
		el.addEventListener("dragstart", hideTip);
		el.addEventListener("pointerdown", (e) => { if (e.button === 2) hideTip(); });
	}
	/** Full-body figure between two slot columns: hand/back/feet on the left, body and accessories on the right. */
	function drawDoll() {
		const doll = document.createElement("div"),
			leftCol = document.createElement("div"),
			figure = document.createElement("div"),
			rightCol = document.createElement("div");
		doll.className = "inv-paperdoll";
		leftCol.className = rightCol.className = "inv-doll-col";
		figure.className = "inv-doll-figure";
		doll.append(leftCol, figure, rightCol);
		const leftSlots = ["weapon", "shield", "garment", "footgear"];
		for (const [slot, name] of Object.entries(slotNames)) {
			const row = document.createElement("div"),
				label = document.createElement("span");
			row.className = "inv-doll-slot";
			row.dataset.slot = slot;
			label.textContent = name;
			const i = inv!.items.find((i) => i.location === "equip" && i.slot === slot);
			if (i) row.append(cell(i));
			else {
				const empty = document.createElement("span");
				empty.className = "inv-doll-empty";
				empty.setAttribute('role', 'img'); empty.setAttribute('aria-label', `ช่อง${name}ว่าง`);
				row.append(empty);
			}
			row.append(label);
			row.ondragover = (e) => e.preventDefault();
			row.ondrop = (e) => {
				e.preventDefault();
				const id = e.dataTransfer?.getData("text/plain");
				if(id&&inv?.items.some(i=>i.id===id&&i.location==='bag'&&equipmentSlots(template(i).slot).includes(slot)))request("equip",{id,slot});
			};
			(leftSlots.includes(slot) ? leftCol : rightCol).append(row);
		}
		const who = document.createElement("div");
		who.className = "inv-doll-who";
		who.innerHTML = `<b></b><small></small>`;
		who.querySelector("b")!.textContent = (p as any)?.name || "";
		who.querySelector("small")!.textContent = `ระดับ ${(p as any)?.level ?? 1}`;
		doll.append(who);
		dollBox.replaceChildren(doll);
		const total: Record<string, number> = {};
		for (const i of inv!.items.filter((i) => i.location === "equip"))
			for (const [k, v] of Object.entries(statsOf(template(i)))) total[k] = (total[k] || 0) + v;
		bonusBox.innerHTML = Object.entries(total).map(([k, v]) => `<span>${metricNames[k] || k}<b>+${v}</b></span>`).join("") || `<span>ยังไม่มีโบนัสจากอุปกรณ์</span>`;
	}
	function ware(t: (typeof templates)[number], price: string, note: string, on: boolean, after: string) {
		const row = document.createElement("button");
		row.className = "ware" + (on ? " in" : "");
		row.style.setProperty("--rarity", rarityColors[t.rarity]);
		const ico = document.createElement("span");
		ico.className = "ware-ico";
		ico.append(itemIcon(t));
		const text = document.createElement("span");
		text.className = "ware-text";
		text.innerHTML = `<b></b><small></small>`;
		text.querySelector("b")!.textContent = t.nameTh;
		text.querySelector("small")!.textContent = note;
		const cost = document.createElement("span");
		cost.className = "ware-price";
		cost.innerHTML = `<b>${price}</b><small>${after}</small>`;
		hoverTip(row, () => ({ t, mode: shop && shopTab === "ซื้อ" ? "buy" : "sell" }));
		const mark = document.createElement("span");
		mark.className = "ware-mark";
		mark.textContent = on ? "✓" : "+";
		row.append(ico, text, cost, mark);
		return row;
	}
	function describe(t: (typeof templates)[number]) {
		const st = Object.entries(statsOf(t)).map(([k, v]) => `${metricNames[k] || k} ${v}`).join(" · ");
		return t.slot ? `Lv.${t.level} · ${t.slot==='accessory1'?'แหวน':slotNames[t.slot]}${st ? " · " + st : ""}` : t.effect ? `ฟื้นฟู ${t.effect==='hp'?'HP':t.effect==='sp'?'SP':'ความเร็ว'} ${t.effect==='speed'?Math.round(t.amount!*100)+'%':fmtGold(t.amount!)}` : ({ consumable: "ของใช้", material: "วัตถุดิบ", refine: "หินตีบวก", card: "การ์ด" } as any)[t.type] || "";
	}
	function cartLine(t: (typeof templates)[number], middle: string, sub: string) {
		const line = document.createElement("div");
		line.className = "cart-line";
		const ico = document.createElement("span");
		ico.className = "ware-ico";
		ico.append(itemIcon(t));
		const mid = document.createElement("div");
		mid.innerHTML = middle;
		mid.querySelector("b")!.textContent = t.nameTh;
		const price = document.createElement("span");
		price.className = "cart-sub";
		price.textContent = sub;
		line.append(ico, mid, price);
		return { line, mid };
	}
	function drawCart() {
		const gold = p?.gold ?? 0;
		cartBox.replaceChildren();
		const head = document.createElement("h3"),
			lines = document.createElement("div"),
			sum = document.createElement("dl"),
			go = document.createElement("button");
		lines.className = "cart-lines";
		go.className = "primary cart-go";
		let total = 0, weight = 0, count = 0;
		if (shopTab === "ซื้อ") {
			head.textContent = "ตะกร้า";
			for (const [id, q] of cart) {
				const t = templates.find((t) => t.id === id)!;
				total += priceOf(id) * q; weight += t.weight * q; count++;
				const { line, mid } = cartLine(t, `<b></b><span class="cart-qty"><button data-d="-1" aria-label="ลด">−</button><span>${q}</span><button data-d="1" aria-label="เพิ่ม">+</button></span>`, fmtGold(priceOf(id) * q));
				mid.querySelectorAll<HTMLButtonElement>("[data-d]").forEach((b) => (b.onclick = () => {
					const n = (cart.get(id) || 0) + Number(b.dataset.d);
					n > 0 ? cart.set(id, Math.min(99, n)) : cart.delete(id);
					draw();
				}));
				lines.append(line);
			}
			if (!count) lines.innerHTML = `<p class="inv-empty">คลิกสินค้าเพื่อใส่ตะกร้า<br>Shift+คลิก ใส่ทีละ 10</p>`;
			const after = gold - total;
			sum.innerHTML = `<dt>รวม</dt><dd class="total">${fmtGold(total)}</dd><dt>ทองคงเหลือ</dt><dd class="${after < 0 ? "bad" : ""}">${fmtGold(gold)} → ${fmtGold(after)}</dd><dt>น้ำหนัก</dt><dd>+${fmtWeight(weight)}</dd>`;
			go.textContent = !count ? "ซื้อ" : after < 0 ? "ทองไม่พอ" : `ซื้อ · ${fmtGold(total)} ทอง`;
			go.disabled = !count || after < 0 || !!pending || buyQueue.length > 0;
			go.onclick = () => {
				buyQueue = [...cart];
				cart.clear();
				nextBuy();
			};
			cartBox.append(head, lines, sum, go);
			return;
		}
		head.textContent = "ของที่จะขาย";
		for (const i of inv!.items.filter((i) => multi.has(i.id))) {
			const t = template(i);
			total += sellPrice(i); weight -= t.weight * i.qty; count++;
			lines.append(cartLine(t, `<b></b><small>×${i.qty}</small>`, "+" + fmtGold(sellPrice(i))).line);
		}
		if (!count) lines.innerHTML = `<p class="inv-empty">เลือกของที่จะขาย<br>ของที่สวมอยู่จะไม่แสดงที่นี่</p>`;
		sum.innerHTML = `<dt>ได้รับ</dt><dd class="total">+${fmtGold(total)}</dd><dt>ทองคงเหลือ</dt><dd>${fmtGold(gold)} → ${fmtGold(gold + total)}</dd><dt>น้ำหนัก</dt><dd>${fmtWeight(weight)}</dd>`;
		go.textContent = count ? `ขาย · ${fmtGold(total)} ทอง` : "ขาย";
		go.disabled = !count;
		go.onclick = () => request("sell", { shop, ids: [...multi] });
		const white = document.createElement("button");
		white.className = "cart-white";
		white.textContent = "ขายของขาวทั้งหมด";
		white.onclick = () => {
			const ids = inv!.items.filter((i) => i.location === "bag" && !i.bound && template(i).rarity === "common").map((i) => i.id);
			if (ids.length && confirm("ยืนยันขายของขาวทั้งหมดในกระเป๋า?")) request("sell", { shop, ids });
		};
		cartBox.append(head, lines, sum, go, white);
	}
	/** The server takes one inventory request at a time, so a cart is bought line by line. */
	function nextBuy() {
		const next = buyQueue.shift();
		if (next) request("buy", { shop, template: next[0], qty: next[1] });
		draw();
	}
	function draw() {
		if (!panel.open) { hideTip(); return; }
		queueMicrotask(() => { if (tipAnchor && !tipAnchor.isConnected) hideTip(); });
		inv = p?.inventory || inv;
		if (!inv) return;
		const mode = storage ? "storage" : shop ? "shop" : "bag";
		panel.dataset.mode = mode;
		summary.textContent = `◈ ${fmtGold(p?.gold ?? 0)} ทอง · ${inventorySlots(inv, data)} / ${data.economy.inventorySlots} ช่อง${storage ? ` · คลัง ${storageSlots(inv, data)} / ${data.economy.storageSlots}` : ""}`;
		const weight = panel.querySelector<HTMLProgressElement>("progress")!;
		weight.value = (((p as any)?.carryWeight || 0) / ((p as any)?.weightLimit || 1)) * 100;
		panel.querySelector(".inv-weight-text")!.textContent = `${Math.round((p as any)?.carryWeight || 0)} / ${Math.round((p as any)?.weightLimit || 0)}`;
		auto.checked = inv.autoPickup;
		(auto.parentElement as HTMLElement).hidden = mode !== "bag";
		const npcKind = storage ? "storage" : shop || "",
			npc = NPCS[npcKind];
		npcBox.hidden = !npc;
		if (npc) {
			npcBox.dataset.npc = npcKind;
			npcBox.querySelector(".inv-npc-name")!.textContent = npc[0];
			npcBox.querySelector(".inv-npc-place")!.textContent = npc[1];
			npcBox.querySelector(".inv-npc-say")!.textContent = npc[2];
		}
		left.hidden = mode !== "bag";
		cartBox.hidden = mode !== "shop";
		if (filter === "สวมใส่") filter = "ทั้งหมด";
		tabs.replaceChildren();
		content.replaceChildren();
		for (const name of storage ? ["ฝากของ", "ในคลัง"] : shop ? ["ซื้อ", "ขาย"] : ["ทั้งหมด", "อุปกรณ์", "ของใช้", "วัตถุดิบ"]) {
			const b = document.createElement("button");
			b.textContent = name;
			b.classList.toggle("active", name === (storage ? storageTab : shop ? shopTab : filter));
			b.onclick = () => {
				if (storage) storageTab = name;
				else if (shop) shopTab = name;
				else filter = name;
				selected = null;
				multi.clear();
				detail.textContent = "เลือกไอเทมเพื่อดูข้อมูล";
				draw();
			};
			tabs.append(b);
		}
		controls.hidden=mode!=='shop'||shopTab!=='ซื้อ';
  rangeSelect.value=shopRange;categorySelect.value=shopCategory;classCheck.checked=shopOwnClass;
  if (mode === "bag") drawDoll();
		if (storage) {
			const grid = document.createElement("div");
			grid.className = "inv-grid";
			const location = storageTab === "ฝากของ" ? "bag" : "storage";
			const items = inv.items.filter((i) => i.location === location);
			for (const i of items) {
				const t = template(i);
				for (let left = i.qty; left > 0; left -= t.maxStack)
					grid.append(cell({ ...i, qty: Math.min(left, t.maxStack) }, location === "bag" ? "store" : "withdraw"));
			}
			if (!items.length) {
				const empty = document.createElement("p");
				empty.className = "inv-empty";
				empty.textContent = location === "bag" ? "กระเป๋าว่าง (ของที่สวมอยู่ต้องถอดก่อนฝาก)" : "คลังยังว่าง · เลือกของจากแท็บ ฝากของ";
				content.append(empty);
			}
			content.append(grid);
			countBox.textContent = "ดับเบิลคลิกเพื่อฝาก/ถอนทั้งกอง · คลังแยกตามตัวละคร";
			return;
		}
		if (shop) {
			const list = document.createElement("div");
			list.className = "ware-list";
			content.append(list);
			if (shopTab === "ซื้อ") {
				for (const id of shopItems()) {
					const t = templates.find((t) => t.id === id)!,
						price = priceOf(id),
						cur = t.slot && inv.items.find((i) => i.location === "equip" && i.slot === equipmentTarget(inv!, t.slot)),
						better = !!t.slot && t.level <= playerLevel() && compatible(t) && Object.entries(statsOf(t)).some(([k, v]) => v > ((cur && statsOf(template(cur))[k]) || 0)),
						note = (t.level > ((p as any)?.level ?? 1) ? `ต้องการระดับ ${t.level} · ` : "") + (compatible(t)?"":"อาชีพนี้ใช้ไม่ได้ · ") + (better ? "▲ ค่าสถานะสูงขึ้น · " : "") + describe(t),
						row = ware(t, fmtGold(price), note, cart.has(id), `มีอยู่ ${owned(id)}`);
					row.dataset.item=id; row.classList.toggle("cant", price > (p?.gold ?? 0));
					row.onclick = (e) => {
						cart.set(id, Math.min(99, (cart.get(id) || 0) + (e.shiftKey ? 10 : 1)));
						selected = id;
						draw();
						showDetail({ id: "shop:" + id, template: id, qty: 1, location: "bag", slot: null, refine: 0, cards: [], bound: false, source: "npc" } as OwnedItem, false);
					};
					list.append(row);
				}
			} else {
				for (const i of inv.items.filter((i) => i.location === "bag")) {
					const t = template(i);
					if (i.bound) continue;
					const row = ware(t, "+" + fmtGold(sellPrice(i)), (i.qty > 1 ? `×${i.qty} · ` : "") + describe(t), multi.has(i.id), i.qty > 1 ? `${fmtGold(Math.floor(t.npcPrice * data.economy.sellMultiplier))} / ชิ้น` : "");
					row.classList.toggle("sell", multi.has(i.id));
					row.onclick = () => {
						multi.has(i.id) ? multi.delete(i.id) : multi.add(i.id);
						draw();
						showDetail(i, false);
					};
					list.append(row);
				}
				if (!list.children.length) list.innerHTML = `<p class="inv-empty">ไม่มีของที่ขายได้ในกระเป๋า</p>`;
			}
			countBox.textContent = shopTab === "ซื้อ" ? `${list.children.length} รายการ · ราคาต่อชิ้นเป็นทอง` : "ขายคืนเฉพาะของที่ไม่ผูกมัด";
			if (!list.children.length) list.innerHTML = `<p class="inv-empty">ไม่มีสินค้าในตัวกรองนี้ · ลองเลือกช่วงเลเวลหรือประเภทอื่น</p>`;
			drawCart();
			return;
		}
		const grid = document.createElement("div");
		grid.className = "inv-grid";
		content.append(grid);
		let shown = 0;
		for (const i of inv.items.filter((i) => i.location === "bag")) {
			const t = template(i);
			if (filter === "อุปกรณ์" && !t.slot) continue;
			if (filter === "ของใช้" && t.type !== "consumable") continue;
			if (filter === "วัตถุดิบ" && !["material", "refine", "card"].includes(t.type)) continue;
			for (let left = i.qty; left > 0; left -= t.maxStack) {
				grid.append(cell({ ...i, qty: Math.min(left, t.maxStack) }, "bag"));
				shown++;
			}
		}
		for (let k = shown; k < Math.max(32, Math.ceil(shown / 8) * 8); k++) {
			const empty = document.createElement("span");
			empty.className = "inv-cell-empty";
			grid.append(empty);
		}
		countBox.textContent = `ช่อง ${inventorySlots(inv, data)} / ${data.economy.inventorySlots}`;
	}
		function open(nextShop: string | null = null) {
		onOpen();
		storage = nextShop === "storage";
		if (storage) storageTab = "ฝากของ";
		shop = storage ? null : nextShop;
		shopRange = shop === "forge" ? "current" : "all"; shopCategory = "all"; shopOwnClass = true;
		selected = null;
		multi.clear();
		cart.clear();
		buyQueue = [];
		if(!pending)status.textContent = "";
		panel.querySelector("h2")!.textContent =
						storage
				? "คลังเก็บของ"
				: shop === "market"
				? "พ่อค้าเบ็ดเตล็ด"
				: shop === "forge"
					? "ช่างตีเหล็ก"
					: "กระเป๋า";
		if (!panel.open) panel.showModal();
		draw();
	}
	button.onclick = () => (panel.open ? panel.close() : open());
	panel.querySelector<HTMLButtonElement>(".close")!.onclick = () =>
		panel.close();
	auto.onchange = () => request("settings", { on: auto.checked });
	return {
		toggle() {
			panel.open ? panel.close() : open();
		},
		shop: (id: string) => open(id),
		get open() {
			return panel.open;
		},
		update(player: Player) {
			p = player;
			const signature = JSON.stringify([
				p.inventory,
				p.gold,
				(p as any).carryWeight,
				(p as any).weightLimit,
			]);
			if (signature !== lastDraw) {
				lastDraw = signature;
				draw();
			}
		},
		receive(m: any) {
 if(m.t==='welcome'){pending=undefined;status.textContent="";}
			if (m.t === "inv") {
                if(m.error&&!panel.open){const el=document.createElement('div');el.className='notice';el.textContent=m.error;const stack=document.querySelector('#notices')!;stack.append(el);while(stack.children.length>4)stack.firstElementChild?.remove();setTimeout(()=>el.remove(),4000);}
				if (m.inventory) {
					inv = m.inventory;
					if (p) {
						p.inventory = m.inventory;
						p.gold = m.gold;
					}
				}
				if (pending?.req === m.req) pending = undefined;
				multi.clear();
				if (m.error) buyQueue = [];
				else if (!pending && buyQueue.length) { nextBuy(); return; }
				if(!pending)status.textContent = m.error || "บันทึกแล้ว";
				draw();
				if (!shop && !storage && selected) {
					const current = inv?.items.find(i => i.id === selected);
					if (current) showDetail(current);
					else { selected = null; detail.textContent = 'เลือกไอเทมเพื่อดูข้อมูล'; }
				}
			}
		},
		/** Display names for a pickup, for the chat log. */
		names(loot: { template: string; qty: number }[]) {
			return (loot || []).flatMap((drop) => {
				const t = templates.find((t) => t.id === drop.template);
				return t ? [{ name: t.nameTh, qty: drop.qty }] : [];
			});
		},
	};
}
