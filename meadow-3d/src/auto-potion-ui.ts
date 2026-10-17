import { DEFAULT_AUTO_POTION, type AutoPotion } from '@thainative/shared';

/** Settings section for auto-potion (drink HP/MP potions below a threshold). The server decides and drinks. */
export function mountAutoPotion(send: (message: any) => void) {
  const panel = document.createElement('section');
  panel.id = 'auto-potion-settings';
  const row = (key: 'hp' | 'mp', label: string) => `<div class="ap-row ap-${key}"><label class="ap-toggle"><input type="checkbox" data-ap-on="${key}">${label}</label><label class="ap-range">ต่ำกว่า<input type="range" min="5" max="95" step="5" data-ap-at="${key}" aria-label="${label} เมื่อต่ำกว่า"><output data-ap-out="${key}"></output></label></div>`;
  panel.innerHTML = `<h3>เติมยาอัตโนมัติ</h3>${row('hp', 'ดื่มยาแดง (HP)')}${row('mp', 'ดื่มยาฟ้า (MP)')}<small>ใช้ยาในกระเป๋า · ยาทุกชนิดใช้คูลดาวน์ร่วมกัน · ทำงานทั้งตอนออโต้และเล่นเอง</small><p id="auto-potion-status" role="status"></p>`;
  document.querySelector('#audio-settings')!.prepend(panel);
  const status = panel.querySelector<HTMLElement>('#auto-potion-status')!;
  let settings: AutoPotion = structuredClone(DEFAULT_AUTO_POTION), dirty = false, received = false, timer: ReturnType<typeof setTimeout>;
  function draw() {
    for (const key of ['hp', 'mp'] as const) {
      panel.querySelector<HTMLInputElement>(`[data-ap-on="${key}"]`)!.checked = settings[key].on;
      const range = panel.querySelector<HTMLInputElement>(`[data-ap-at="${key}"]`)!;
      range.value = String(settings[key].at);
      range.disabled = !settings[key].on;
      panel.querySelector(`[data-ap-out="${key}"]`)!.textContent = settings[key].at + '%';
    }
    document.querySelector('[data-action="potion"]')?.classList.toggle('auto-on', settings.hp.on);
  }
  function save() { send({ t: 'autoPotion', settings: structuredClone(settings) }); }
  function changed() {
    dirty = true; draw(); status.textContent = 'กำลังบันทึก…';
    clearTimeout(timer); timer = setTimeout(save, 300);
  }
  for (const key of ['hp', 'mp'] as const) {
    panel.querySelector<HTMLInputElement>(`[data-ap-on="${key}"]`)!.onchange = e => { settings[key].on = (e.target as HTMLInputElement).checked; changed(); };
    panel.querySelector<HTMLInputElement>(`[data-ap-at="${key}"]`)!.oninput = e => { settings[key].at = Number((e.target as HTMLInputElement).value); changed(); };
  }
  draw();
  return {
    get settings() { return settings; },
    /** Same rule edited from the ตั้งค่า AUTO window. */
    set(next: AutoPotion) { settings = structuredClone(next); changed(); },
    receive(message: any) {
      if (message.t === 'welcome') { received = false; if (dirty) save(); }
      if (message.t === 'autoPotion' && JSON.stringify(message.settings) === JSON.stringify(settings)) { dirty = false; status.textContent = 'บันทึกแล้ว'; }
      if (message.t === 'autoPotionError') status.textContent = 'บันทึกไม่สำเร็จ · ลองอีกครั้ง';
      if (message.type === 'stats' && !received && message.autoPotion) {
        received = true;
        if (!dirty) { settings = structuredClone(message.autoPotion); draw(); }
      }
    },
  };
}
