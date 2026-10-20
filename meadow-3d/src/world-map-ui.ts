import { huntList, loadGameData } from "@thainative/shared";
import { FIELD_BOSS, GATE_LINKS, MAP_INFO, type MapId } from "@thainative/shared/maps";
import "./world-map.css";

const data = loadGameData();
/** Grid cells (column, row) laid out as the maps sit: meadow south of the city, the hunting road east. */
const NODES: Record<MapId, [number, number]> = { meadow: [0, 1], city_plaza: [0, 0], forest: [1, 0], ruins: [2, 0], canyon: [3, 0] };
const ORDER: MapId[] = ["city_plaza", "meadow", "forest", "ruins", "canyon"];
const levelRange = (m: MapId): [number, number] | null => {
	const r = MAP_INFO[m].levels.match(/(\d+)\D+(\d+)/);
	return r ? [Number(r[1]), Number(r[2])] : null;
};
const KIND_GROUPS: [string, (kind: string) => boolean][] = [
	["บริการ", (k) => !k.startsWith("gate:") && k !== "camp" && k !== "boss"],
	["ประตู", (k) => k.startsWith("gate:")],
	["แคมป์พักฟื้น", (k) => k === "camp"],
	["บอส", (k) => k === "boss"],
];

interface Point { x: number; z: number; kind: string; icon: string; name: string }
/** M: the world (maps, links, levels, bosses, monsters) and the current map's places; picking either walks there. */
export function mountWorldMap(o: {
	map: () => MapId;
	level: () => number;
	points: () => Point[];
	goTo: (p: Point) => void;
	travelTo: (map: MapId) => boolean;
	goal: () => MapId | null;
	notice: (text: string) => void;
	onOpen?: () => void;
	/** Show or hide the corner minimap (M used to do this). */
	toggleMinimap?: () => void;
}) {
	const panel = document.createElement("dialog");
	panel.id = "world-map";
	panel.innerHTML = `<header><h2>แผนที่โลก</h2><small>M เปิด/ปิด · เลือกแมพหรือสถานที่เพื่อเดินไปเอง</small><button type="button" class="wm-mini">ซ่อน/แสดงแผนที่ย่อ</button><button type="button" class="wm-close" aria-label="ปิด">×</button></header>
<div class="wm-body"><section class="wm-world" aria-label="แมพทั้งหมด"><svg class="wm-links" aria-hidden="true"></svg><div class="wm-nodes"></div></section>
<aside class="wm-detail"><h3 class="wm-here"></h3><p class="wm-hint"></p><div class="wm-places"></div></aside></div>`;
	document.body.append(panel);
	const $ = <T extends Element>(s: string) => panel.querySelector<T>(s)!;
	$<HTMLButtonElement>(".wm-close").onclick = () => panel.close();
	$<HTMLButtonElement>(".wm-mini").onclick = () => o.toggleMinimap?.();

	function node(m: MapId) {
		const info = MAP_INFO[m], here = o.map() === m, range = levelRange(m), lv = o.level();
		const b = document.createElement("button");
		b.type = "button";
		b.className = "wm-node";
		b.dataset.map = m;
		const [col, row] = NODES[m];
		b.style.gridColumn = String(col + 1);
		b.style.gridRow = String(row + 1);
		b.classList.toggle("here", here);
		b.classList.toggle("goal", o.goal() === m);
		b.classList.toggle("fit", !!range && lv >= range[0] && lv <= range[1]);
		b.classList.toggle("hard", !!range && lv < range[0] - 2);
		const boss = (FIELD_BOSS as Record<string, { dataId: string }>)[m];
		const bossName = boss && data.monsters.monsters.find((x) => x.id === boss.dataId)?.nameTh;
		const mobs = m === "city_plaza" ? [] : huntList(m, data).filter((x) => !x.boss).map((x) => x.name);
		b.innerHTML = `<b></b><small class="wm-lv"></small><span class="wm-tag"></span><small class="wm-mobs"></small><small class="wm-boss"></small>`;
		b.querySelector("b")!.textContent = info.name;
		b.querySelector(".wm-lv")!.textContent = range ? `ระดับ ${info.levels}` : info.levels;
		b.querySelector(".wm-tag")!.textContent = here ? "คุณอยู่ที่นี่" : o.goal() === m ? "กำลังเดินทาง" : b.classList.contains("fit") ? "เหมาะกับคุณ" : "";
		b.querySelector(".wm-mobs")!.textContent = mobs.join(" · ");
		b.querySelector(".wm-boss")!.textContent = bossName ? `บอส: ${bossName}` : "";
		b.title = here ? info.hint : `เดินทางไป${info.name}`;
		b.onclick = () => {
			if (here) return;
			if (o.travelTo(m)) { o.notice(`กำลังเดินทางไป${info.name}`); panel.close(); }
			else o.notice("ยังไม่มีทางไปแมพนี้");
		};
		return b;
	}
	function links() {
		const svg = $<SVGSVGElement>(".wm-links"), nodes = $<HTMLElement>(".wm-nodes"), box = svg.getBoundingClientRect();
		const centre = (m: MapId) => {
			const el = nodes.querySelector<HTMLElement>(`[data-map="${m}"]`)!.getBoundingClientRect();
			return { x: el.left - box.left + el.width / 2, y: el.top - box.top + el.height / 2 };
		};
		svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
		const seen = new Set<string>(), lines: string[] = [];
		for (const [from, gates] of Object.entries(GATE_LINKS) as [MapId, Record<string, MapId>][])
			for (const to of Object.values(gates)) {
				const key = [from, to].sort().join(">");
				if (seen.has(key)) continue;
				seen.add(key);
				const a = centre(from), b = centre(to);
				lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
			}
		svg.innerHTML = lines.join("");
	}
	function places() {
		const m = o.map(), list = $<HTMLElement>(".wm-places");
		$(".wm-here").textContent = `${MAP_INFO[m].name} · ${levelRange(m) ? "ระดับ " : ""}${MAP_INFO[m].levels}`;
		$(".wm-hint").textContent = MAP_INFO[m].hint;
		const all: Point[] = [...o.points()];
		const boss = (FIELD_BOSS as Record<string, { dataId: string; x: number; z: number }>)[m];
		if (boss) all.push({ x: boss.x, z: boss.z, kind: "boss", icon: "☠", name: `ลานบอส · ${data.monsters.monsters.find((x) => x.id === boss.dataId)?.nameTh ?? ""}` });
		list.replaceChildren();
		for (const [title, test] of KIND_GROUPS) {
			const items = all.filter((p) => test(p.kind));
			if (!items.length) continue;
			const h = document.createElement("h4");
			h.textContent = title;
			list.append(h);
			for (const p of items) {
				const b = document.createElement("button");
				b.type = "button";
				const to = p.kind.startsWith("gate:") ? GATE_LINKS[m][p.kind.slice(5)] : undefined;
				b.innerHTML = `<span class="wm-icon"></span><span></span>`;
				b.firstElementChild!.textContent = p.icon;
				b.lastElementChild!.textContent = to ? `ประตูไป${MAP_INFO[to].name}` : p.kind.startsWith("gate:") ? "ประตู (ยังปิดอยู่)" : p.name;
				b.disabled = p.kind.startsWith("gate:") && !to;
				b.onclick = () => { o.goTo(p); panel.close(); };
				list.append(b);
			}
		}
	}
	function render() {
		$(".wm-nodes").replaceChildren(...ORDER.map(node));
		places();
		requestAnimationFrame(links);
	}
	addEventListener("resize", () => { if (panel.open) links(); });
	return {
		toggle() {
			if (panel.open) { panel.close(); return; }
			o.onOpen?.();
			render();
			panel.showModal();
		},
		get open() { return panel.open; },
	};
}
