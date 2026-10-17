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
	panel.innerHTML = `<button class="close" aria-label="ปิด">×</button><p class="caption">สัมภาระและอุปกรณ์</p><h2>กระเป๋า</h2><div class="inv-summary"></div><progress class="inv-weight" max="100"></progress><nav class="inv-tabs"></nav><label class="inv-auto"><input type="checkbox"> เก็บของอัตโนมัติ</label><div class="inv-content"></div><section class="inv-detail" aria-live="polite">เลือกไอเทมเพื่อดูข้อมูล</section><p class="inv-status" role="status"></p>`;
	document.body.append(panel);
	const summary = panel.querySelector<HTMLElement>(".inv-summary")!,
		tabs = panel.querySelector("nav")!,
		content = panel.querySelector<HTMLElement>(".inv-content")!,
		detail = panel.querySelector<HTMLElement>(".inv-detail")!,
		status = panel.querySelector<HTMLElement>(".inv-status")!;
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
	function cell(i: OwnedItem, mode = "bag") {
		const t = template(i),
			b = document.createElement("button");
		b.className = "inv-cell";
		b.style.setProperty("--rarity", rarityColors[t.rarity]);
		b.dataset.item = i.template;
		b.dataset.id = i.id;
		b.title = t.nameTh;
		b.setAttribute("aria-label", `${t.nameTh} ×${i.qty}`);
		const icon = document.createElement("span");
		icon.className = "item-icon";
		const n = templates.indexOf(t);
		// Atlas v1 holds items 0–24; the forest materials occupy the first row of v2.
		const page = n >= 25 ? 1 : 0, k = n - page * 25;
		if (page) icon.classList.add("item-icon-v2");
		icon.style.backgroundPosition = `${(k % 5) * 25}% ${Math.floor(k / 5) * 25}%`;
		b.append(icon);
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
			const metricNames:Record<string,string>={atk:'พลังโจมตี',flee:'หลบหลีก',hardDef:'เกราะกายภาพ',maxSp:'พลังสกิลสูงสุด'};
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
	function draw() {
		if (!panel.open) return;
		inv = p?.inventory || inv;
		if (!inv) return;
				summary.textContent = `◈ ${p?.gold ?? 0} ทอง · ${inventorySlots(inv, data)} / ${data.economy.inventorySlots} ช่อง${storage ? ` · คลัง ${storageSlots(inv, data)} / ${data.economy.storageSlots}` : ""} · น้ำหนัก ${Math.round((p as any)?.carryWeight || 0)} / ${Math.round((p as any)?.weightLimit || 0)}`;
		const weight = panel.querySelector<HTMLProgressElement>("progress")!;
		weight.value =
			(((p as any)?.carryWeight || 0) / ((p as any)?.weightLimit || 1)) * 100;
				auto.checked = inv.autoPickup;
		(auto.parentElement as HTMLElement).hidden = storage || !!shop;
		tabs.replaceChildren();
		content.replaceChildren();
				for (const name of storage
			? ["ฝากของ", "ในคลัง"]
			: shop
			? ["ซื้อ", "ขาย"]
			: ["ทั้งหมด", "อุปกรณ์", "ของใช้", "วัตถุดิบ", "สวมใส่"]) {
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
			const hint = document.createElement("p");
			hint.className = "inv-hint";
			hint.textContent = "ดับเบิลคลิกเพื่อฝาก/ถอนทั้งกอง · คลังแยกตามตัวละคร";
			content.append(hint);
			return;
		}
		if (!shop && filter === "สวมใส่") {
			const doll = document.createElement("div");
			doll.className = "inv-paperdoll";
			doll.style.backgroundImage = "var(--portrait)";
			for (const [slot, name] of Object.entries(slotNames)) {
				const row = document.createElement("div"),
					label = document.createElement("span");
				label.textContent = name;
				row.append(label);
				const i = inv.items.find(
					(i) => i.location === "equip" && i.slot === slot,
				);
				if (i) row.append(cell(i));
				else row.append(document.createElement("span"));
				row.ondragover = (e) => e.preventDefault();
				row.ondrop = (e) => {
					e.preventDefault();
					const id = e.dataTransfer?.getData("text/plain");
					if(id&&inv?.items.some(i=>i.id===id&&template(i).slot===slot))request("equip",{id});
				};
				doll.append(row);
			}
			content.append(doll);
			return;
		}
		const grid = document.createElement("div");
		grid.className = "inv-grid";
		content.append(grid);
		if (shop && shopTab === "ซื้อ") {
			for (const id of Object.keys(data.economy.shops[shop]).filter(id=>!["reed_dagger","wood_staff","bamboo_bow"].includes(id)))
				grid.append(
					cell(
						{
							id: "shop:" + id,
							template: id,
							qty: 1,
							location: "bag",
							slot: null,
							refine: 0,
							cards: [],
							bound: false,
							source: "npc",
						},
						"buy",
					),
				);
		} else {
			for (const i of inv.items.filter((i) => i.location === "bag")) {
				const t = template(i);
                if(shop&&["reed_dagger","wood_staff","bamboo_bow"].includes(t.id))continue;
				if (!shop && filter === "อุปกรณ์" && !t.slot) continue;
				if (!shop && filter === "ของใช้" && t.type !== "consumable") continue;
				if (
					!shop &&
					filter === "วัตถุดิบ" &&
					!["material", "refine", "card"].includes(t.type)
				)
					continue;
				for (let left = i.qty; left > 0; left -= t.maxStack)
					grid.append(
						cell(
							{ ...i, qty: Math.min(left, t.maxStack) },
							shop ? "sell" : "bag",
						),
					);
			}
		}
		if (shop && shopTab === "ขาย") {
			const actions = document.createElement("div");
			actions.className = "inv-actions";
			const total = inv.items
				.filter((i) => multi.has(i.id))
				.reduce(
					(n, i) => n + Math.floor(template(i).npcPrice * data.economy.sellMultiplier) * i.qty,
					0,
				);
			const sell = document.createElement("button");
			sell.textContent = `ขายที่เลือก · ${total} ทอง`;
			sell.disabled = !multi.size;
			sell.onclick = () => request("sell", { shop, ids: [...multi] });
			const white = document.createElement("button");
			white.textContent = "ขายของขาวทั้งหมด";
			white.onclick = () => {
				const ids = inv!.items
					.filter(
						(i) =>
							i.location === "bag" &&
							!i.bound &&
							template(i).rarity === "common",
					)
					.map((i) => i.id);
				if (ids.length && confirm("ยืนยันขายของขาวทั้งหมดในกระเป๋า?"))
					request("sell", { shop, ids });
			};
			actions.append(sell, white);
			content.append(actions);
		}
	}
		function open(nextShop: string | null = null) {
		onOpen();
		storage = nextShop === "storage";
		if (storage) storageTab = "ฝากของ";
		shop = storage ? null : nextShop;
		selected = null;
		multi.clear();
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
