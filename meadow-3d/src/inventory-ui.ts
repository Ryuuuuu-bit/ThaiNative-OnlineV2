import {
	loadGameData,
	rarityColors,
		inventorySlots,
	storageSlots,
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
	accessory1: "แหวน",
	accessory2: "เครื่องราง",
};
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
	const metricNames: Record<string, string> = { atk: "พลังโจมตี", matk: "พลังเวท", flee: "หลบหลีก", hardDef: "เกราะกายภาพ", softDef: "ป้องกันกายภาพ", maxSp: "พลังสกิลสูงสุด", maxHp: "พลังชีวิตสูงสุด", hit: "ความแม่นยำ", crit: "คริติคอล" };
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
		selected: string | null = null,
		lastTouch = "",
		multi = new Set<string>(),
		pending: { req: string; message: any } | undefined;
	const auto = panel.querySelector<HTMLInputElement>("input")!;
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
	function action(i: OwnedItem) {
		const t = template(i);
		if (i.location === "equip") request("unequip", { id: i.id });
		else if (t.slot) request("equip", { id: i.id });
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
		b.title = t.nameTh;
		b.setAttribute("aria-label", `${t.nameTh} ×${i.qty}`);
		b.append(itemIcon(t));
		const count = document.createElement("b");
		count.textContent = i.qty > 1 ? String(i.qty) : i.bound ? "◆" : "";
		b.append(count);
        const incompatible=!!t.weaponType&&!data.classes.classes.find(c=>c.id===(p?.profile?.classId||p?.jobId))?.weapons.includes(t.weaponType);
        if(mode==='buy'||mode==='sell'){b.classList.add('shop-cell');const caption=document.createElement('span');caption.className='shop-caption';caption.textContent=t.nameTh;const price=document.createElement('small');price.textContent=`${mode==='buy'?data.economy.shops[shop!][t.id]:Math.floor(t.npcPrice*data.economy.sellMultiplier)} ทอง`;b.append(caption,price);}
        if(incompatible){const note=document.createElement('small');note.textContent='อาชีพนี้ใช้ไม่ได้';b.append(note);b.title+=' · อาชีพนี้ใช้ไม่ได้';}
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
	function showDetail(i: OwnedItem, actions = true) {
		const t = template(i);
		detail.replaceChildren();
		const title = document.createElement("h3");
		title.textContent = t.nameTh;
		title.style.color = rarityColors[t.rarity];
		detail.append(title);
		const text = document.createElement("p");
		const old = inv?.items.find(
			(i) => i.location === "equip" && i.slot === t.slot,
		);
		const oldT = old && template(old);
		text.textContent = `${slotNames[t.slot || ""] || ({ consumable: "ของใช้", material: "วัตถุดิบ", refine: "หินตีบวก", card: "การ์ด" } as any)[t.type]} · ต้องการระดับ ${t.level}\nน้ำหนัก ${t.weight} · ${shop && shopTab === "ซื้อ" ? "ซื้อ " + data.economy.shops[shop][t.id] : "ขาย " + Math.floor(t.npcPrice * data.economy.sellMultiplier)} ทอง · ช่องการ์ด ${t.slots}\n${i.bound ? "ผูกมัดแล้ว" : t.bind === "equip" ? "ผูกมัดเมื่อสวมใส่" : t.bind === "account" ? "ผูกบัญชี" : "แลกเปลี่ยนได้"}`;
		detail.append(text);
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
			span.textContent = ` (${diff >= 0 ? "+" : ""}${diff} เทียบที่สวม)`;
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
			add(`ซื้อ · ${data.economy.shops[shop][t.id]} ทอง/ชิ้น`, () =>
				request("buy", { shop, template: t.id, qty: Math.min(999,Math.max(1,Math.trunc(Number(quantity.value)||1))) }),
			);
		} else if (!shop) {
			if ((!t.slot || !incompatible) && (t.slot || t.type === "consumable"))
				add(i.location === "equip" ? "ถอด" : t.slot ? "ใส่" : "ใช้", () =>
					action(i),
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
	const shopItems = () => Object.keys(data.economy.shops[shop!]).filter(id=>!["reed_dagger","wood_staff","bamboo_bow"].includes(id));
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
				row.append(empty);
			}
			row.append(label);
			row.ondragover = (e) => e.preventDefault();
			row.ondrop = (e) => {
				e.preventDefault();
				const id = e.dataTransfer?.getData("text/plain");
				if(id&&inv?.items.some(i=>i.id===id&&template(i).slot===slot))request("equip",{id});
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
		const mark = document.createElement("span");
		mark.className = "ware-mark";
		mark.textContent = on ? "✓" : "+";
		row.append(ico, text, cost, mark);
		return row;
	}
	function describe(t: (typeof templates)[number]) {
		const st = Object.entries(statsOf(t)).map(([k, v]) => `${metricNames[k] || k} ${v}`).join(" · ");
		return t.slot ? `${slotNames[t.slot]}${st ? " · " + st : ""}` : ({ consumable: "ของใช้", material: "วัตถุดิบ", refine: "หินตีบวก", card: "การ์ด" } as any)[t.type] || "";
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
				const { line, mid } = cartLine(t, `<b></b><span class="cart-qty"><button data-d="-1" aria-label="ลด">−</button><span>${q}</span><button data-d="1" aria-label="เพิ่ม">+</button></span>`, String(priceOf(id) * q));
				mid.querySelectorAll<HTMLButtonElement>("[data-d]").forEach((b) => (b.onclick = () => {
					const n = (cart.get(id) || 0) + Number(b.dataset.d);
					n > 0 ? cart.set(id, Math.min(99, n)) : cart.delete(id);
					draw();
				}));
				lines.append(line);
			}
			if (!count) lines.innerHTML = `<p class="inv-empty">คลิกสินค้าเพื่อใส่ตะกร้า<br>Shift+คลิก ใส่ทีละ 10</p>`;
			const after = gold - total;
			sum.innerHTML = `<dt>รวม</dt><dd class="total">${total}</dd><dt>ทองคงเหลือ</dt><dd class="${after < 0 ? "bad" : ""}">${gold} → ${after}</dd><dt>น้ำหนัก</dt><dd>+${weight}</dd>`;
			go.textContent = !count ? "ซื้อ" : after < 0 ? "ทองไม่พอ" : `ซื้อ · ${total} ทอง`;
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
			lines.append(cartLine(t, `<b></b><small>×${i.qty}</small>`, "+" + sellPrice(i)).line);
		}
		if (!count) lines.innerHTML = `<p class="inv-empty">เลือกของที่จะขาย<br>ของที่สวมอยู่จะไม่แสดงที่นี่</p>`;
		sum.innerHTML = `<dt>ได้รับ</dt><dd class="total">+${total}</dd><dt>ทองคงเหลือ</dt><dd>${gold} → ${gold + total}</dd><dt>น้ำหนัก</dt><dd>${weight}</dd>`;
		go.textContent = count ? `ขาย · ${total} ทอง` : "ขาย";
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
		if (!panel.open) return;
		inv = p?.inventory || inv;
		if (!inv) return;
		const mode = storage ? "storage" : shop ? "shop" : "bag";
		panel.dataset.mode = mode;
		summary.textContent = `◈ ${p?.gold ?? 0} ทอง · ${inventorySlots(inv, data)} / ${data.economy.inventorySlots} ช่อง${storage ? ` · คลัง ${storageSlots(inv, data)} / ${data.economy.storageSlots}` : ""}`;
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
						cur = t.slot && inv.items.find((i) => i.location === "equip" && i.slot === t.slot),
						better = !!t.slot && Object.entries(statsOf(t)).some(([k, v]) => v > ((cur && statsOf(template(cur))[k]) || 0)),
						note = (t.level > ((p as any)?.level ?? 1) ? `ต้องการระดับ ${t.level} · ` : "") + (better ? "▲ ดีกว่าที่ใส่อยู่ · " : "") + describe(t),
						row = ware(t, String(price), note, cart.has(id), `มีอยู่ ${owned(id)}`);
					row.classList.toggle("cant", price > (p?.gold ?? 0));
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
					if (["reed_dagger","wood_staff","bamboo_bow"].includes(t.id)) continue;
					const row = ware(t, "+" + sellPrice(i), (i.qty > 1 ? `×${i.qty} · ` : "") + describe(t), multi.has(i.id), i.qty > 1 ? `${Math.floor(t.npcPrice * data.economy.sellMultiplier)} / ชิ้น` : "");
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
			countBox.textContent = "";
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
			}
		},
		toast(loot: { template: string; qty: number }[]) {
			const stack = document.querySelector("#notices")!;
			for (const drop of loot || []) {
				const t = templates.find((t) => t.id === drop.template)!;
				const toast = document.createElement("div");
				toast.className = "notice";
				toast.textContent = `+ ${t.nameTh} ×${drop.qty}`;
				stack.append(toast);
                while(stack.children.length>4)stack.firstElementChild?.remove();
				setTimeout(() => toast.remove(), 4000);
			}
		},
	};
}
