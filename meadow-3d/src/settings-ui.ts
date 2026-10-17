/**
 * Settings window (เมนู → ตั้งค่า, or ตั้งค่าปุ่ม in the skill book). The sections themselves are mounted by
 * their own modules (skills-ui #key-settings, audio-settings-ui, auto-potion-ui, hud-qol #hud-settings);
 * this only moves those live nodes into tabs, so their listeners and server sync are unchanged.
 */
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
type Tab = "keys" | "sound" | "potion";
const TABS: [Tab, string][] = [
	["keys", "ปุ่มลัด"],
	["sound", "เสียงและการแสดงผล"],
	["potion", "ยาอัตโนมัติ"],
];

export function mountSettingsWindow(o: { onOpen: () => void; keysChanged: () => void }) {
	const panel = document.createElement("dialog");
	panel.id = "settings-window";
	panel.setAttribute("aria-labelledby", "settings-title");
	panel.innerHTML = `<button class="close" data-close aria-label="ปิด">×</button><header class="g-head"><h2 id="settings-title">ตั้งค่า</h2><span class="g-sub">บันทึกอัตโนมัติ</span></header>
		<nav class="settings-tabs" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}">${label}</button>`).join("")}</nav>
		<section class="settings-pane" data-pane="keys"><p class="caption">แถบสกิล</p><p class="settings-hint">แตะช่องแล้วกดปุ่มที่ต้องการ</p><div class="settings-keys-host"></div><div class="settings-actions"><p id="key-status" role="status"></p></div><p class="caption">ปุ่มอื่น ๆ และหน้าจอ</p><div class="settings-hud-host"></div></section>
		<section class="settings-pane" data-pane="sound"></section>
		<section class="settings-pane" data-pane="potion"></section>`;
	document.body.append(panel);

	const keys = $("#key-settings"),
		audio = $("#audio-settings"),
		potion = $("#auto-potion-settings"),
		hud = $("#hud-settings"),
		reset = $("#skills-reset-keys");
	panel.querySelector(".settings-keys-host")!.append(keys);
	panel.querySelector(".settings-actions")!.append(reset);
	panel.querySelector(".settings-hud-host")!.append(hud);
	panel.querySelector('[data-pane="sound"]')!.append(audio);
	panel.querySelector('[data-pane="potion"]')!.append(potion);
	// these used to be folded away inside the skill book; here the tab decides what shows
	for (const el of [keys, audio]) el.hidden = false;

	let tab: Tab = "keys";
	function show(next: Tab) {
		tab = next;
		panel.querySelectorAll<HTMLElement>("[data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
		panel.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab));
		if (tab === "keys") o.keysChanged();
	}
	panel.addEventListener("click", (e) => {
		const t = e.target as HTMLElement;
		if (t.closest("[data-close]")) panel.close();
		const b = t.closest<HTMLElement>("[data-tab]");
		if (b) show(b.dataset.tab as Tab);
	});
	function open(at: Tab = tab) {
		document.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((d) => d !== panel && d.close());
		o.onOpen();
		if (!panel.open) panel.showModal();
		show(at);
	}
	$("#skills-settings").onclick = () => open("keys");
	return {
		open,
		get isOpen() {
			return panel.open;
		},
	};
}
