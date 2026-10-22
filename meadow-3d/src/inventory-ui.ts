import {
	loadGameData,
	rarityColors,
	ownedRarity, itemRollLines, rolledModifiers, requiredEquipmentLevel,
		inventorySlots,
	storageSlots,
	equipmentSlots,
	equipmentTarget,
	cardProblem,
	cardSlots,
	socketPrice,
	CARD_SLOT_NAMES,
	type Inventory,
	type OwnedItem,
	type Player,
} from "@the-beginning-online/shared";
import "./inventory.css";
import { itemIconCell } from "./item-icon";
import { cardEffects } from "./card-text";
import { mountRefine } from "./refine-ui";
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
	panel.innerHTML = `<button class="close" aria-label="ปิด">×</button><header class="g-head"><h2>กระเป๋า</h2><span class="g-sub inv-summary"></span></header><div class="inv-body"><aside class="inv-npc" hidden><div class="inv-npc-figure"></div><small class="inv-npc-place"></small><b class="inv-npc-name"></b><p class="inv-npc-say"></p></aside><div class="inv-left"><div class="inv-doll"></div><div class="inv-bonus"></div><div class="inv-weight-row"><span>น้ำหนัก</span><progress class="inv-weight" max="100"></progress><span class="inv-weight-text"></span></div></div><div class="inv-main"><nav class="inv-tabs"></nav><div class="inv-content"></div><div class="inv-foot"><label class="inv-auto g-switch"><input type="checkbox"><i></i>เก็บของอัตโนมัติ</label><span class="inv-count"></span></div><section class="inv-detail" aria-live="polite">คลิกไอเทมเพื่อดูปุ่มคำสั่ง · ชี้เมาส์เพื่อดูรายละเอียด</section></div><aside class="inv-cart" hidden></aside></div><p class="inv-status" role="status"></p>`;
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
	/** Quantity typed on a shop card before it goes into the cart. */
	const draftQty = new Map<string, number>();
	let shopSearch = "", sellCategory = "all";
	let buyQueue: [string, number][] = [];
	let lastDraw = "";
	let p: Player | undefined,
		inv: Inventory | undefined,
		filter = "ทั้งหมด",
		search = "",
		sortBy = "type",
		quick = "",
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
	panel.addEventListener("close", () => { hideTip(); markSeen(); });
	/** Item ids this character has already seen in the bag; anything else is "new" until the bag closes. */
	let seen: Set<string> | null = null, seenKey = "";
	function loadSeen() {
		const key = "tn-bag-seen:" + ((p as any)?.id || "");
		if (seen && seenKey === key) return;
		seenKey = key;
		try { const raw = localStorage.getItem(key); seen = raw ? new Set(JSON.parse(raw)) : null; } catch { seen = null; }
		if (!seen && inv) { seen = new Set(inv.items.map((i) => i.id)); saveSeen(); }
	}
	function saveSeen() { try { if (seen) localStorage.setItem(seenKey, JSON.stringify([...seen].slice(-400))); } catch { /* storage blocked */ } }
	function markSeen() { if (!inv || !seen) return; for (const i of inv.items) seen.add(i.id); saveSeen(); }
	const isNew = (i: OwnedItem) => !!seen && i.location === "bag" && !seen.has(i.id);
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
	let refineReq = "";
	const refine = mountRefine({
		data,
		itemIcon: (t) => itemIcon(t),
		request: (id) => { request("refine", { id }); refineReq = pending?.req ?? ""; if (!refineReq) refine.failed("กำลังบันทึก กรุณารอสักครู่"); },
		say: (text) => { const say = summary.querySelector(".shop-say"); if (say) say.textContent = text; },
	});
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
		if(cell.image){icon.style.backgroundImage=`url(${cell.image})`;icon.style.backgroundSize='contain';}
		return icon;
	}
	function cell(i: OwnedItem, mode = "bag") {
		const t = template(i),
			b = document.createElement("button");
		b.className = "inv-cell";
		b.style.setProperty("--rarity", rarityColors[ownedRarity(i,t.rarity)]);
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
        if(mode==='bag'&&isNew(i)){const dot=document.createElement('span');dot.className='inv-new';dot.title='ของใหม่';b.append(dot);}
        if(mode==='bag'&&i.location==='bag'&&t.slot){
            if(!wearable(t,i)){const no=document.createElement('span');no.className='inv-no';no.setAttribute('aria-hidden','true');b.append(no);b.setAttribute('aria-label',`${t.nameTh} · ใส่ไม่ได้ตอนนี้`);}
            else if(betterThanWorn(t,i)){const up=document.createElement('span');up.className='inv-up';up.textContent='▲';b.append(up);b.setAttribute('aria-label',`${t.nameTh} · ดีกว่าที่ใส่`);}
        }
        else if(incompatible){const note=document.createElement('small');note.textContent='อาชีพนี้ใช้ไม่ได้';b.append(note);}
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
	/** Choose the equipment a card goes into; inserting is permanent, so it asks first. */
	function pickCardTarget(card: OwnedItem, targets: OwnedItem[]) {
		const btns = detail.querySelector<HTMLElement>(".strip-actions");
		if (!btns) return;
		btns.replaceChildren();
		btns.classList.add("card-targets");
		for (const x of targets) {
			const t = template(x), b = document.createElement("button");
			b.type = "button";
			b.append(itemIcon(t), document.createTextNode(`${x.refine ? `+${x.refine} ` : ""}${t.nameTh}${x.location === "equip" ? " (สวมอยู่)" : ""} · ${x.cards.length}/${cardSlots(x, data)}`));
			b.onclick = () => {
				if (confirm(`ใส่ ${template(card).nameTh} ลงใน ${t.nameTh}?
ใส่แล้วถอดออกไม่ได้`)) request("card", { card: card.id, id: x.id });
			};
			btns.append(b);
		}
		const back = document.createElement("button");
		back.type = "button";
		back.className = "ghost";
		back.textContent = "ยกเลิก";
		back.onclick = () => showStrip(card);
		btns.append(back);
	}
	/** Bag selection: icon, one-line summary and short, explicit actions (e.g. "ใส่แหวน 2", "ใส่แทนแหวน 1"). */
	function showStrip(i: OwnedItem) {
		const t = template(i);
		detail.replaceChildren();
		detail.classList.add("inv-strip");
		detail.style.setProperty("--rarity", rarityColors[ownedRarity(i,t.rarity)]);
		const ico = document.createElement("span");
		ico.className = "strip-ico";
		ico.append(itemIcon(t));
		const text = document.createElement("div");
		text.className = "strip-text";
		const name = document.createElement("b");
		name.textContent = i.qty > 1 ? `${t.nameTh} ×${i.qty}` : t.nameTh;
		const sub = document.createElement("small");
		const btns = document.createElement("div");
		btns.className = "strip-actions";
		const add = (label: string, fn: () => void, cls = "") => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.className = cls; b.onclick = fn; btns.append(b); return b; };
		const kind = t.slot ? (t.slot === "accessory1" ? "แหวน" : slotNames[t.slot]) : describe(t);
		const stats = t.slot ? [...Object.entries(statsOf(t,i)).map(([k, v]) => `${metricNames[k] || k} +${v}`),...itemRollLines(i)].join(" · ") : "";
		let where = "";
		if (i.location === "equip") {
			where = `สวมอยู่ที่ ${slotNames[i.slot!]}`;
			add("ถอด", () => action(i), "gold");
		} else if (t.slot) {
			if (!wearable(t,i)) where = requiredEquipmentLevel(t.level,i) > playerLevel() ? `ต้องการระดับ ${requiredEquipmentLevel(t.level,i)}` : "อาชีพนี้ใช้ไม่ได้";
			else {
				const slots = equipmentSlots(t.slot), wornIn = (sl: string) => inv!.items.find((x) => x.location === "equip" && x.slot === sl);
				const target = equipmentTarget(inv!, t.slot);
				for (const sl of slots) {
					const worn = wornIn(sl);
					const label = slots.length > 1 ? (worn ? `ใส่แทน${slotNames[sl]}` : `ใส่${slotNames[sl]}`) : worn ? `ใส่แทน ${template(worn).nameTh}` : "ใส่";
					add(label, () => action(i, sl), sl === target ? "gold" : "");
				}
				const empty = slots.filter((sl) => !wornIn(sl));
				where = empty.length ? `ว่างอยู่ที่ ${empty.map((sl) => slotNames[sl]).join(", ")}` : slots.length > 1 ? "ช่องแหวนเต็ม" : "";
			}
		} else if (t.type === "consumable") add("ใช้", () => action(i), "gold");
		else if (t.type === "card") {
			const spec = data.cards.cards.find((c) => c.id === t.id);
			if (spec) {
				where = `ใส่ได้กับ${CARD_SLOT_NAMES[spec.slot]} · ${cardEffects(data, t.id)}`;
				const targets = inv!.items.filter((x) => x.id !== i.id && !cardProblem(i, x, data));
				const b = add(targets.length ? "ใส่การ์ด" : `ไม่มี${CARD_SLOT_NAMES[spec.slot]}ที่มีช่องว่าง`, () => pickCardTarget(i, targets), "gold");
				b.disabled = !targets.length;
			}
		}
		if (t.slot && i.location !== "storage") {
			const price = socketPrice(i, data);
			if (typeof price !== "string") {
				const mat = templates.find((x) => x.id === price.material)?.nameTh ?? price.material;
				add(`เจาะช่องการ์ด`, () => {
					if (confirm(`ให้ช่างตีเหล็กเจาะช่องการ์ด 1 ช่องใน ${t.nameTh}?
ค่าเจาะ ${price.gold.toLocaleString()} ทอง + ${mat} ×${price.qty}
(ต้องยืนคุยกับช่างตีเหล็กในเมือง)`)) request("socket", { id: i.id });
				}).title = `${price.gold.toLocaleString()} ทอง + ${mat} ×${price.qty} · ที่ช่างตีเหล็ก`;
			}
		}
		const slotCount = t.slot ? cardSlots(i, data) : 0;
		const cardInfo = slotCount ? `การ์ด ${i.cards.length}/${slotCount}${i.cards.length ? ": " + i.cards.map((c) => templates.find((x) => x.id === c)?.nameTh ?? c).join(", ") : ""}` : "";
		sub.textContent = [kind, stats, cardInfo, where].filter(Boolean).join(" · ");
		text.append(name, sub);
		if (i.location === "bag") {
			let qty: HTMLInputElement | null = null;
			if (i.qty > 1) {
				qty = document.createElement("input");
				qty.type = "number"; qty.min = "1"; qty.max = String(i.qty); qty.value = "1";
				qty.setAttribute("aria-label", "จำนวนทิ้ง");
				btns.append(qty);
			}
			add("ทิ้ง", () => {
				const n = Math.min(i.qty, Math.max(1, Math.trunc(Number(qty?.value) || 1)));
				if (confirm(`ยืนยันทิ้ง ${t.nameTh} ×${n}?`)) request("discard", { id: i.id, qty: n });
			}, "ghost");
		}
		detail.append(ico, text, btns);
	}
	function showDetail(i: OwnedItem, actions = true, requestedSlot?: string) {
		if (!shop && !storage) { showStrip(i); return; }
		detail.classList.remove("inv-strip");
		const t = template(i);
		detail.replaceChildren();
		const title = document.createElement("h3");
		title.textContent = t.nameTh;
		title.style.color = rarityColors[ownedRarity(i,t.rarity)];
		detail.append(title);
		const text = document.createElement("p");
		const targetSlot = t.slot && inv ? (i.location === 'equip' ? i.slot : equipmentTarget(inv, t.slot, requestedSlot)) : t.slot;
		const old = inv?.items.find(
			(i) => i.location === "equip" && i.slot === targetSlot,
		);
		const oldT = old && template(old);
		text.textContent = `${(t.slot === "accessory1" ? (i.location === "equip" ? slotNames[i.slot!] : "แหวน") : slotNames[t.slot || ""]) || ({ consumable: "ของใช้", material: "วัตถุดิบ", refine: "หินตีบวก", card: "การ์ด" } as any)[t.type]} · ต้องการระดับ ${requiredEquipmentLevel(t.level,i)}\nน้ำหนัก ${fmtWeight(t.weight)} · ${shop && shopTab === "ซื้อ" ? "ซื้อ " + fmtGold(data.economy.shops[shop][t.id]) : "ขาย " + fmtGold(Math.floor(t.npcPrice * data.economy.sellMultiplier))} ทอง · ช่องการ์ด ${t.slots}\n${i.bound ? "ผูกมัดแล้ว" : t.bind === "equip" ? "ผูกมัดเมื่อสวมใส่" : t.bind === "account" ? "ผูกบัญชี" : "แลกเปลี่ยนได้"}`;
		detail.append(text);
		for(const line of itemRollLines(i)){const row=document.createElement('p');row.className='item-roll-line';row.textContent=line;detail.append(row);}
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
  return (shopRange==='all'||levelBand(t.level)===band) && (shopCategory==='all'||groupOf(t)===shopCategory) && (!shopOwnClass||compatible(t)) && (!shopSearch||t.nameTh.toLowerCase().includes(shopSearch));
 }).sort((a,b)=>templates.find(t=>t.id===a)!.level-templates.find(t=>t.id===b)!.level || priceOf(a)-priceOf(b));
 const controls=document.createElement('div'); controls.className='shop-filters'; controls.hidden=true;
 tabs.after(controls);
 /** Shop categories group equipment slots the way players think of them. */
 const SHOP_GROUPS: [string, string, (t: (typeof templates)[number]) => boolean][] = [
  ['weapon','อาวุธ',t=>t.slot==='weapon'],
  ['armour','เกราะ · โล่ · ผ้าคลุม · รองเท้า',t=>['body','shield','garment','footgear'].includes(t.slot||'')],
  ['accessory','เครื่องประดับ',t=>t.slot==='accessory1'||t.slot==='accessory2'],
  ['consumable','ยา',t=>t.type==='consumable'],
  ['refine','หินตีบวก',t=>t.type==='refine'],
  ['other','อื่น ๆ',()=>true],
 ];
 const groupOf=(t:(typeof templates)[number])=>SHOP_GROUPS.find(([, ,f])=>f(t))![0];
 const SELL_GROUPS: [string, string, (t: (typeof templates)[number]) => boolean][] = [
  ['equip','อุปกรณ์',t=>!!t.slot],['material','วัตถุดิบ',t=>t.type==='material'],['consumable','ยา',t=>t.type==='consumable'],
  ['refine','หินตีบวก',t=>t.type==='refine'],['card','การ์ด',t=>t.type==='card'],['other','อื่น ๆ',()=>true],
 ];
 const sellGroupOf=(t:(typeof templates)[number])=>SELL_GROUPS.find(([, ,f])=>f(t))![0];
 const shopInRange=(t:(typeof templates)[number])=>{const band=shopRange==='current'?levelBand(playerLevel()):Number(shopRange);return shopRange==='all'||levelBand(t.level)===band;};
 const bandLabel=(b:number)=>b>=99?'Lv.99':`Lv.${b||1}–${b===90?98:b+9}`;
 function chip(label:string,count:string,on:boolean,fn:()=>void){const b=document.createElement('button');b.type='button';b.className='shop-chip';b.setAttribute('aria-pressed',String(on));b.innerHTML='<span></span><i></i>';b.querySelector('span')!.textContent=label;b.querySelector('i')!.textContent=count;b.onclick=fn;return b;}
 function drawShopTools(){
  controls.replaceChildren();
  const row=document.createElement('div');row.className='shop-row';
  const search=document.createElement('label');search.className='shop-search';search.innerHTML='<span aria-hidden="true">⌕</span><input type="search" placeholder="ค้นหาสินค้า" aria-label="ค้นหาสินค้า">';
  const input=search.querySelector('input')!;input.value=shopSearch;input.oninput=()=>{shopSearch=input.value.trim().toLowerCase();draw();const again=controls.querySelector<HTMLInputElement>('.shop-search input');if(again){again.focus();again.setSelectionRange(again.value.length,again.value.length);}};
  const row2=document.createElement('div');row2.className='shop-row sub';
  if(shopTab==='ซื้อ'){
   const pool=Object.keys(data.economy.shops[shop!]).map(id=>templates.find(t=>t.id===id)!).filter(t=>shopInRange(t)&&(!shopOwnClass||compatible(t)));
   row.append(chip('ทั้งหมด',String(pool.length),shopCategory==='all',()=>{shopCategory='all';draw();}));
   for(const [key,label] of SHOP_GROUPS){const n=pool.filter(t=>groupOf(t)===key).length;if(n)row.append(chip(label.split(' · ')[0],String(n),shopCategory===key,()=>{shopCategory=key;draw();}));}
   row.append(search);
   const lv=document.createElement('div');lv.className='shop-lv';const mine=levelBand(playerLevel());
   const bands:[string,string][]=[['current','ของฉัน · '+bandLabel(mine)],...(mine>0?[[String(mine-10),bandLabel(mine-10)] as [string,string]]:[]),...(mine<90?[[String(mine+10),bandLabel(mine+10)] as [string,string]]:[]),['all','ทั้งหมด']];
   for(const [v,label] of bands){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(shopRange===v));b.onclick=()=>{shopRange=v;draw();};lv.append(b);}
   const own=document.createElement('label');own.className='shop-own g-switch';own.innerHTML='<input type="checkbox"><i></i>เฉพาะที่อาชีพฉันใช้ได้';const box=own.querySelector('input')!;box.checked=shopOwnClass;box.onchange=()=>{shopOwnClass=box.checked;draw();};
   const cap=document.createElement('span');cap.className='shop-cap';cap.textContent='ช่วงเลเวล';
   row2.append(cap,lv,own);
  }else{
   const pool=inv!.items.filter(i=>i.location==='bag'&&!i.bound).map(template);
   row.append(chip('ทั้งหมด',String(pool.length),sellCategory==='all',()=>{sellCategory='all';draw();}));
   for(const [key,label] of SELL_GROUPS){const n=pool.filter(t=>sellGroupOf(t)===key).length;if(n)row.append(chip(label,String(n),sellCategory===key,()=>{sellCategory=key;draw();}));}
   row.append(search);
   const cap=document.createElement('span');cap.className='shop-cap';cap.textContent='เลือกเร็ว';
   const quick=document.createElement('div');quick.className='shop-lv';
   const pick=(label:string,f:(i:OwnedItem)=>boolean)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{for(const i of inv!.items)if(i.location==='bag'&&!i.bound&&f(i))multi.add(i.id);draw();};quick.append(b);};
   pick('ของขาวทั้งหมด',i=>template(i).rarity==='common'&&!template(i).slot);
   pick('วัตถุดิบทั้งหมด',i=>template(i).type==='material');
   const clear=document.createElement('button');clear.type='button';clear.textContent='ล้างที่เลือก';clear.onclick=()=>{multi.clear();draw();};quick.append(clear);
   const note=document.createElement('span');note.className='shop-note';note.textContent='ของที่สวมอยู่และของผูกมัดจะไม่แสดง';
   row2.append(cap,quick,note);
  }
  controls.append(row,row2);
 }
	const priceOf = (id: string) => data.economy.shops[shop!][id] as number;
	const sellPrice = (i: OwnedItem) => Math.floor(template(i).npcPrice * data.economy.sellMultiplier) * i.qty;
	const owned = (id: string) => inv?.items.filter((i) => i.location === "bag" && i.template === id).reduce((n, i) => n + i.qty, 0) || 0;
	function statsOf(t: (typeof templates)[number], i?:OwnedItem) {
		const out: Record<string, number> = {};
		if (t.atk) out.atk = t.atk;
		if (t.matk) out.matk = t.matk;
		for (const m of [...t.modifiers,...(i?rolledModifiers(i):[]),...(i?.cards.flatMap(id=>data.cards.cards.find(c=>c.id===id)?.modifiers??[])??[])]) if ("stat" in m && "value" in m && (m.kind === "flat" || m.kind === "stat")) out[m.stat] = (out[m.stat] || 0) + m.value;
		return out;
	}
	const wearable = (t: (typeof templates)[number],i?:OwnedItem) => !t.slot || (requiredEquipmentLevel(t.level,i) <= playerLevel() && compatible(t));
	const statSum = (t: (typeof templates)[number], i?:OwnedItem) => Object.values(statsOf(t,i)).reduce((a, b) => a + b, 0);
	/** Gear that would raise at least one stat over what sits in its slot now (and lose less than it gains). */
	function betterThanWorn(t: (typeof templates)[number], i?:OwnedItem) {
		if (!t.slot || !inv || !wearable(t,i)) return false;
		const worn = inv.items.find((x) => x.location === "equip" && x.slot === equipmentTarget(inv!, t.slot!));
		if (!worn) return statSum(t,i) > 0;
		const a = statsOf(t,i), b = statsOf(template(worn),worn);
		return Object.entries(a).some(([k, v]) => v > (b[k] || 0)) && statSum(t,i) >= statSum(template(worn),worn);
	}
	const RARITY_RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, fine: 3, common: 4 };
	const TYPE_RANK: Record<string, number> = { weapon: 0, armour: 1, shield: 2, garment: 3, footgear: 4, accessory: 5, consumable: 6, refine: 7, card: 8, material: 9 };
	const bagTools = document.createElement("div");
	bagTools.className = "inv-bagtools";
	bagTools.hidden = true;
	bagTools.innerHTML = `<label class="inv-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="ค้นหาไอเทม" aria-label="ค้นหาไอเทม"></label><label class="inv-sort"><span>เรียง</span><select aria-label="เรียงไอเทม"><option value="type">ประเภท</option><option value="rarity">ความหายาก</option><option value="level">เลเวล</option><option value="name">ชื่อ</option></select></label><div class="inv-quick" role="group" aria-label="ตัวกรองด่วน"><button type="button" data-q="wear">ใส่ได้ตอนนี้</button><button type="button" data-q="better">ดีกว่าที่ใส่</button><button type="button" data-q="new">ของใหม่</button><button type="button" data-q="sell">ขายได้</button></div>`;
	tabs.after(bagTools);
	const searchBox = bagTools.querySelector<HTMLInputElement>("input")!, sortBox = bagTools.querySelector<HTMLSelectElement>("select")!;
	searchBox.oninput = () => { search = searchBox.value.trim().toLowerCase(); draw(); };
	sortBox.onchange = () => { sortBy = sortBox.value; draw(); };
	bagTools.querySelectorAll<HTMLButtonElement>("[data-q]").forEach((b) => (b.onclick = () => { quick = quick === b.dataset.q ? "" : b.dataset.q!; draw(); }));
	const TYPE_NAMES: Record<string, string> = { consumable: "ของใช้", material: "วัตถุดิบ", refine: "หินตีบวก", card: "การ์ด" };
	const WEAPON_NAMES: Record<string, string> = { sword1h: "ดาบมือเดียว", dagger: "มีดสั้น", staff: "คทา", bow: "ธนู" };
	const RARITY_NAMES: Record<string, string> = { common: "ธรรมดา", fine: "ดี", rare: "หายาก", epic: "มหากาพย์", legendary: "ตำนาน" };
	type TipSource = { t: (typeof templates)[number]; i?: OwnedItem; mode?: string };
	/** One item card. With `against`, every stat shows its change from that equipped item (missing stats count as 0). */
	function tipCard(t: (typeof templates)[number], i: OwnedItem | undefined, opts: { worn?: boolean; against?: (typeof templates)[number] | null; againstItem?:OwnedItem; slot?: string } = {}) {
		const card = document.createElement("div");
		card.className = "tip-card" + (opts.worn ? " worn" : "");
		card.style.setProperty("--rarity", rarityColors[ownedRarity(i,t.rarity)]);
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
		name.querySelector("small")!.textContent = `${kind} · ${i?.roll?.quality??RARITY_NAMES[t.rarity]??t.rarity}`;
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
			const mine = statsOf(t,i), theirs = opts.against ? statsOf(opts.against,opts.againstItem) : null;
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
		if(i)for(const line of itemRollLines(i)){const row=document.createElement('p');row.className='item-roll-line';row.textContent=line;card.append(row);}
		if (t.type === "card") {
			const spec = data.cards.cards.find((c) => c.id === t.id);
			if (spec) { const e = document.createElement("p"); e.className = "tip-effect"; e.textContent = `ใส่ได้กับ${CARD_SLOT_NAMES[spec.slot]} · ${cardEffects(data, t.id)}`; card.append(e); }
		}
		if (i?.cards.length) {
			const e = document.createElement("p");
			e.className = "tip-cards";
			e.textContent = i.cards.map((c) => `${templates.find((x) => x.id === c)?.nameTh ?? c}: ${cardEffects(data, c)}`).join("\n");
			card.append(e);
		}
		const foot = document.createElement("div");
		foot.className = "tip-foot";
		const bind = i?.bound ? "ผูกมัดแล้ว" : t.bind === "equip" ? "ผูกมัดเมื่อสวม" : t.bind === "account" ? "ผูกบัญชี" : "แลกเปลี่ยนได้";
		foot.textContent = [`น้ำหนัก ${fmtWeight(t.weight)}`, `ขาย ${fmtGold(Math.floor(t.npcPrice * data.economy.sellMultiplier))} ทอง`, t.slot ? `ช่องการ์ด ${i?.cards.length ?? 0}/${i ? cardSlots(i, data) : t.slots}` : "", t.slot ? bind : ""].filter(Boolean).join(" · ");
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
		const main = tipCard(t, i, { worn: equipped, against: t.slot && !equipped ? oldT : undefined, againstItem:old, slot: equipped ? i!.slot : slot });
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
			for (const [k, v] of Object.entries(statsOf(template(i),i))) total[k] = (total[k] || 0) + v;
		bonusBox.innerHTML = Object.entries(total).map(([k, v]) => `<span>${metricNames[k] || k}<b>+${v}</b></span>`).join("") || `<span class="inv-bonus-none">ยังไม่มีโบนัสจากอุปกรณ์</span>`;
	}
	function shopCard(t: (typeof templates)[number], id: string) {
		const card = document.createElement("div"), price = priceOf(id), inCart = cart.get(id) || 0;
		const levelLock = t.level > playerLevel(), classLock = !compatible(t);
		const cur = t.slot && inv!.items.find((i) => i.location === "equip" && i.slot === equipmentTarget(inv!, t.slot!));
		const better = !!t.slot && !levelLock && !classLock && Object.entries(statsOf(t)).some(([k, v]) => v > ((cur && statsOf(template(cur))[k]) || 0));
		card.className = "shop-card" + (levelLock || classLock ? " lock" : "") + (inCart ? " incart" : "");
		card.dataset.item = id;
		card.style.setProperty("--rarity", rarityColors[t.rarity]);
		const box = document.createElement("span"); box.className = "shop-ico"; box.append(itemIcon(t));
		const name = document.createElement("div"); name.className = "shop-name";
		const nm = document.createElement("span"); nm.textContent = t.nameTh; name.append(nm);
		if (better) { const up = document.createElement("em"); up.className = "up"; up.textContent = "▲ ดีกว่าที่ใส่"; name.append(up); }
		if (inCart) { const tag = document.createElement("em"); tag.className = "tag"; tag.textContent = `ในตะกร้า ${inCart}`; name.append(tag); }
		const desc = document.createElement("div"); desc.className = "shop-desc";
		const why = levelLock ? `ต้องการระดับ ${t.level}` : classLock ? "อาชีพนี้ใช้ไม่ได้" : "";
		if (why) { const w = document.createElement("b"); w.textContent = why + " · "; desc.append(w); }
		desc.append(describe(t));
		const foot = document.createElement("div"); foot.className = "shop-foot";
		const cost = document.createElement("span"); cost.className = "shop-price" + (price > (p?.gold ?? 0) ? " cant" : ""); cost.textContent = fmtGold(price);
		const have = document.createElement("span"); have.className = "shop-have"; have.textContent = `มีอยู่ ${owned(id)}`;
		foot.append(cost, have);
		if (levelLock || classLock) { const no = document.createElement("button"); no.type = "button"; no.className = "shop-add"; no.disabled = true; no.textContent = "ซื้อไม่ได้"; foot.append(no); }
		else {
			const q = draftQty.get(id) || 1, step = document.createElement("span"); step.className = "shop-qty";
			const n = document.createElement("b"); n.textContent = String(q);
			const set = (v: number) => { draftQty.set(id, Math.max(1, Math.min(99, v))); n.textContent = String(draftQty.get(id)); };
			const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.setAttribute("aria-label", "ลดจำนวน"); minus.onclick = (e) => { e.stopPropagation(); set((draftQty.get(id) || 1) - 1); };
			const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", "เพิ่มจำนวน"); plus.onclick = (e) => { e.stopPropagation(); set((draftQty.get(id) || 1) + (e.shiftKey ? 10 : 1)); };
			step.append(minus, n, plus);
			const add = document.createElement("button"); add.type = "button"; add.className = "shop-add"; add.textContent = "ใส่ตะกร้า";
			add.onclick = () => { cart.set(id, Math.min(99, (cart.get(id) || 0) + (draftQty.get(id) || 1))); draftQty.delete(id); selected = id; draw(); };
			foot.append(step, add);
		}
		card.append(box, name, desc, foot);
		hoverTip(card, () => ({ t, mode: "buy" }));
		return card;
	}
	function sellCard(i: OwnedItem) {
		const t = template(i), on = multi.has(i.id), card = document.createElement("button");
		card.type = "button";
		card.className = "shop-card sell" + (on ? " picked" : "");
		card.style.setProperty("--rarity", rarityColors[t.rarity]);
		card.setAttribute("aria-pressed", String(on));
		const box = document.createElement("span"); box.className = "shop-ico"; box.append(itemIcon(t));
		const name = document.createElement("div"); name.className = "shop-name";
		const nm = document.createElement("span"); nm.textContent = t.nameTh;
		const check = document.createElement("i"); check.className = "shop-check"; check.textContent = on ? "✓" : "";
		name.append(nm, check);
		const desc = document.createElement("div"); desc.className = "shop-desc"; desc.textContent = (i.qty > 1 ? `×${i.qty} · ` : "") + describe(t);
		const foot = document.createElement("div"); foot.className = "shop-foot";
		const cost = document.createElement("span"); cost.className = "shop-price"; cost.textContent = fmtGold(sellPrice(i));
		foot.append(cost);
		if (i.qty > 1) { const per = document.createElement("span"); per.className = "shop-have"; per.textContent = `${fmtGold(Math.floor(t.npcPrice * data.economy.sellMultiplier))} / ชิ้น`; foot.append(per); }
		card.append(box, name, desc, foot);
		card.onclick = () => { on ? multi.delete(i.id) : multi.add(i.id); draw(); };
		hoverTip(card, () => ({ t, i, mode: "sell" }));
		return card;
	}
	function describe(t: (typeof templates)[number]) {
		const st = Object.entries(statsOf(t)).map(([k, v]) => `${metricNames[k] || k} ${v}`).join(" · ");
		return t.slot ? `Lv.${t.level} · ${t.slot==='accessory1'?'แหวน':slotNames[t.slot]}${st ? " · " + st : ""}` : t.effect==='party_hp'?`ฮีลสมาชิกปาร์ตี้ใกล้สุดใน 6 เมตร ${fmtGold(t.amount!)} HP · ใช้คูลดาวน์ร่วมกับยา`:t.effect==='party_cleanse'?'ล้างสถานะลบให้สมาชิกปาร์ตี้ใกล้สุดใน 6 เมตร · ใช้คูลดาวน์ร่วมกับยา':t.effect ? `ฟื้นฟู ${t.effect==='hp'?'HP':t.effect==='sp'?'SP':'ความเร็ว'} ${t.effect==='speed'?Math.round(t.amount!*100)+'%':fmtGold(t.amount!)}` : ({ consumable: "ของใช้", material: "วัตถุดิบ", refine: "หินตีบวก", card: "การ์ด" } as any)[t.type] || "";
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
			if (!count) lines.innerHTML = `<p class="inv-empty">ตะกร้ายังว่าง<br>เลือกจำนวนที่การ์ดสินค้าแล้วกด "ใส่ตะกร้า"</p>`;
			const after = gold - total;
			sum.innerHTML = `<dt>รวม</dt><dd class="total">${fmtGold(total)}</dd><dt>ทองคงเหลือ</dt><dd class="${after < 0 ? "bad" : ""}">${fmtGold(gold)} → ${fmtGold(after)}</dd><dt>น้ำหนัก</dt><dd>+${fmtWeight(weight)}</dd>`;
			go.textContent = !count ? "ซื้อ" : after < 0 ? "ทองไม่พอ" : `ซื้อ · ${fmtGold(total)} ทอง`;
			go.disabled = !count || after < 0 || !!pending || buyQueue.length > 0;
			go.onclick = () => {
				buyQueue = [...cart];
				cart.clear();
				nextBuy();
			};
			const clearCart = document.createElement("button");
			clearCart.className = "cart-white";
			clearCart.textContent = "ล้างตะกร้า";
			clearCart.disabled = !count;
			clearCart.onclick = () => { cart.clear(); draw(); };
			const n = document.createElement("small"); n.className = "cart-count"; n.textContent = `${count} รายการ`; head.append(n);
			cartBox.append(head, lines, sum, go, clearCart);
			return;
		}
		head.textContent = "ของที่จะขาย";
		for (const i of inv!.items.filter((i) => multi.has(i.id))) {
			const t = template(i);
			total += sellPrice(i); weight -= t.weight * i.qty; count++;
			const { line } = cartLine(t, `<b></b><small>×${i.qty}</small>`, "+" + fmtGold(sellPrice(i)));
			const x = document.createElement("button"); x.className = "cart-del"; x.textContent = "×"; x.setAttribute("aria-label", "เอาออก"); x.onclick = () => { multi.delete(i.id); draw(); };
			line.append(x);
			lines.append(line);
		}
		if (!count) lines.innerHTML = `<p class="inv-empty">เลือกของที่จะขาย<br>ของที่สวมอยู่จะไม่แสดงที่นี่</p>`;
		sum.innerHTML = `<dt>ได้รับ</dt><dd class="total">+${fmtGold(total)}</dd><dt>ทองคงเหลือ</dt><dd>${fmtGold(gold)} → ${fmtGold(gold + total)}</dd><dt>น้ำหนัก</dt><dd>${fmtWeight(weight)}</dd>`;
		go.textContent = count ? `ขาย · ${fmtGold(total)} ทอง` : "ขาย";
		go.disabled = !count;
		go.onclick = () => request("sell", { shop, ids: [...multi] });
		go.classList.add("sell");
		const n = document.createElement("small"); n.className = "cart-count"; n.textContent = `${count} รายการ`; head.append(n);
		cartBox.append(head, lines, sum, go);
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
		if (mode === "bag") {
			const cw = (p as any)?.carryWeight || 0, wl = (p as any)?.weightLimit || 1, pct = Math.min(100, (cw / wl) * 100);
			summary.innerHTML = `<span class="inv-pill gold">◈ <b>${fmtGold(p?.gold ?? 0)}</b> ทอง</span><span class="inv-pill">ช่อง <b>${inventorySlots(inv, data)} / ${data.economy.inventorySlots}</b></span><span class="inv-pill${pct >= 90 ? " heavy" : ""}">น้ำหนัก <i class="inv-wbar"><i style="width:${pct.toFixed(1)}%"></i></i><b>${Math.round(cw)} / ${Math.round(wl)}</b></span>`;
		} else if (mode === "shop") {
			const cw = (p as any)?.carryWeight || 0, wl = (p as any)?.weightLimit || 1, npc = NPCS[shop!];
			summary.innerHTML = `<span class="shop-say"></span><span class="inv-pill gold">◈ <b>${fmtGold(p?.gold ?? 0)}</b> ทอง</span><span class="inv-pill">ช่อง <b>${inventorySlots(inv, data)} / ${data.economy.inventorySlots}</b></span><span class="inv-pill">น้ำหนัก <b>${fmtGold(Math.round(cw))} / ${fmtGold(Math.round(wl))}</b></span>`;
			summary.querySelector(".shop-say")!.textContent = npc?.[2] ?? "";
			panel.querySelector(".g-head")!.setAttribute("data-npc", shop!);
			panel.querySelector(".g-head h2")!.setAttribute("data-place", npc?.[1] ?? "");
		} else summary.textContent = `◈ ${fmtGold(p?.gold ?? 0)} ทอง · ${inventorySlots(inv, data)} / ${data.economy.inventorySlots} ช่อง${storage ? ` · คลัง ${storageSlots(inv, data)} / ${data.economy.storageSlots}` : ""}`;
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
		for (const name of storage ? ["ฝากของ", "ในคลัง"] : shop === "forge" ? ["ซื้อ", "ขาย", "ตีบวก"] : shop ? ["ซื้อ", "ขาย"] : ["ทั้งหมด", "อุปกรณ์", "ของใช้", "วัตถุดิบ", "การ์ด"]) {
			const b = document.createElement("button");
			b.textContent = name;
			if (mode === "bag") {
				const bag = inv.items.filter((i) => i.location === "bag").map(template);
				const n = name === "อุปกรณ์" ? bag.filter((t) => t.slot).length : name === "ของใช้" ? bag.filter((t) => t.type === "consumable").length : name === "วัตถุดิบ" ? bag.filter((t) => ["material", "refine"].includes(t.type)).length : name === "การ์ด" ? bag.filter((t) => t.type === "card").length : bag.length;
				const c = document.createElement("i"); c.textContent = String(n); b.append(c);
			}
			b.classList.toggle("active", name === (storage ? storageTab : shop ? shopTab : filter));
			b.onclick = () => {
				if (storage) storageTab = name;
				else if (shop) shopTab = name;
				else filter = name;
				selected = null;
				multi.clear();
				detail.textContent = "คลิกไอเทมเพื่อดูปุ่มคำสั่ง · ชี้เมาส์เพื่อดูรายละเอียด";
				draw();
			};
			tabs.append(b);
		}
		const refining = shop === "forge" && shopTab === "ตีบวก";
		panel.dataset.tab = refining ? "refine" : "";
		controls.hidden=mode!=='shop'||refining;
		if (mode === "shop" && !refining) drawShopTools();
		bagTools.hidden = mode !== "bag";
		if (mode === "bag") { if (document.activeElement !== searchBox) searchBox.value = search; sortBox.value = sortBy; bagTools.querySelectorAll<HTMLButtonElement>("[data-q]").forEach((b) => b.setAttribute("aria-pressed", String(quick === b.dataset.q))); }
  if (mode === "bag") { loadSeen(); drawDoll(); }
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
		if (refining) {
			content.append(refine.root);
			refine.update(inv, p?.gold ?? 0);
			countBox.textContent = "หินตีบวก 1 ก้อน + ทอง ต่อครั้ง · +1 ถึง +4 ไม่มีทางล้มเหลว · ต้องยืนคุยกับช่างตีเหล็ก";
			return;
		}
		if (shop) {
			const list = document.createElement("div");
			list.className = "ware-list";
			content.append(list);
			list.classList.toggle("sell", shopTab !== "ซื้อ");
			let shown = 0;
			if (shopTab === "ซื้อ") {
				const ids = shopItems();
				for (const [key, label] of SHOP_GROUPS) {
					const group = ids.filter((id) => groupOf(templates.find((t) => t.id === id)!) === key);
					if (!group.length) continue;
					const head = document.createElement("div"); head.className = "shop-group"; head.textContent = label; list.append(head);
					for (const id of group) { list.append(shopCard(templates.find((t) => t.id === id)!, id)); shown++; }
				}
			} else {
				const items = inv.items.filter((i) => i.location === "bag" && !i.bound && (sellCategory === "all" || sellGroupOf(template(i)) === sellCategory) && (!shopSearch || template(i).nameTh.toLowerCase().includes(shopSearch)));
				for (const [key, label] of SELL_GROUPS) {
					const group = items.filter((i) => sellGroupOf(template(i)) === key);
					if (!group.length) continue;
					const head = document.createElement("div"); head.className = "shop-group"; head.textContent = label; list.append(head);
					for (const i of group) { list.append(sellCard(i)); shown++; }
				}
			}
			countBox.textContent = shopTab === "ซื้อ" ? `${shown} รายการ · ใส่จำนวนที่การ์ดแล้วกด "ใส่ตะกร้า" · Shift+กด + เพิ่มทีละ 10` : "คลิกการ์ดเพื่อเลือก/ยกเลิก · ขายคืนเฉพาะของที่ไม่ผูกมัด";
			if (!shown) list.innerHTML = shopTab === "ซื้อ" ? `<p class="inv-empty">ไม่มีสินค้าในตัวกรองนี้ · ลองเลือกช่วงเลเวลหรือประเภทอื่น</p>` : `<p class="inv-empty">ไม่มีของที่ขายได้ในตัวกรองนี้</p>`;
			drawCart();
			return;
		}
		const grid = document.createElement("div");
		grid.className = "inv-grid";
		content.append(grid);
		let shown = 0;
		const ordered = inv.items.filter((i) => i.location === "bag").sort((a, b) => {
			const ta = template(a), tb = template(b);
			if (sortBy === "rarity") return (RARITY_RANK[ta.rarity] ?? 9) - (RARITY_RANK[tb.rarity] ?? 9) || ta.nameTh.localeCompare(tb.nameTh, "th");
			if (sortBy === "level") return tb.level - ta.level || ta.nameTh.localeCompare(tb.nameTh, "th");
			if (sortBy === "name") return ta.nameTh.localeCompare(tb.nameTh, "th");
			return (TYPE_RANK[ta.type] ?? 9) - (TYPE_RANK[tb.type] ?? 9) || (RARITY_RANK[ta.rarity] ?? 9) - (RARITY_RANK[tb.rarity] ?? 9);
		});
		for (const i of ordered) {
			const t = template(i);
			if (filter === "อุปกรณ์" && !t.slot) continue;
			if (filter === "ของใช้" && t.type !== "consumable") continue;
			if (filter === "วัตถุดิบ" && !["material", "refine"].includes(t.type)) continue;
			if (filter === "การ์ด" && t.type !== "card") continue;
			if (quick === "new" && !isNew(i)) continue;
			if (search && !t.nameTh.toLowerCase().includes(search)) continue;
			if (quick === "wear" && !(t.slot && wearable(t,i))) continue;
			if (quick === "better" && !betterThanWorn(t,i)) continue;
			if (quick === "sell" && i.bound) continue;
			for (let left = i.qty; left > 0; left -= t.maxStack) {
				grid.append(cell({ ...i, qty: Math.min(left, t.maxStack) }, "bag"));
				shown++;
			}
		}
		if (!shown && (search || quick)) { const none = document.createElement("p"); none.className = "inv-empty inv-nomatch"; none.textContent = "ไม่มีไอเทมที่ตรงกับตัวกรอง"; grid.append(none); }
		for (let k = shown; k < Math.max(40, Math.ceil(shown / 10) * 10); k++) {
			const empty = document.createElement("span");
			empty.className = "inv-cell-empty";
			grid.append(empty);
		}
		countBox.innerHTML = `<span><em class="up">▲</em> ดีกว่าที่ใส่</span><span><em class="no">✕</em> ใส่ไม่ได้ตอนนี้</span><span><em class="new">●</em> ของใหม่</span><span>ดับเบิลคลิก ใส่/ใช้ · คลิกขวา เมนู</span>`;
	}
		function open(nextShop: string | null = null) {
		onOpen();
		storage = nextShop === "storage";
		if (storage) storageTab = "ฝากของ";
		shop = storage ? null : nextShop;
		shopRange = shop === "forge" ? "current" : "all"; shopCategory = "all"; shopOwnClass = true; shopSearch = ""; sellCategory = "all"; draftQty.clear(); shopTab = "ซื้อ"; refine.reset();
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
				if (refineReq && refineReq === m.req) { refineReq = ""; if (m.error) refine.failed(m.error); }
				multi.clear();
				if (m.error) buyQueue = [];
				else if (!pending && buyQueue.length) { nextBuy(); return; }
				if(!pending)status.textContent = m.error || "บันทึกแล้ว";
				draw();
				if (!shop && !storage && selected) {
					const current = inv?.items.find(i => i.id === selected);
					if (current) showDetail(current);
					else { selected = null; detail.textContent = 'คลิกไอเทมเพื่อดูปุ่มคำสั่ง · ชี้เมาส์เพื่อดูรายละเอียด'; }
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
