import type { AudioEngine } from './audio';

export function mountAudioSettings(sound: AudioEngine, send: (message: any) => void) {
  const panel = document.createElement('section');
  panel.id = 'audio-settings'; panel.hidden = true;
  panel.innerHTML = `<h3>เสียง</h3>${[['sfx', 'เอฟเฟกต์'], ['music', 'เพลง'], ['ambience', 'บรรยากาศ']].map(([key, label]) => `<label>${label}<input type="range" min="0" max="1" step="0.01" data-volume="${key}" aria-label="${label}"><output data-output="${key}"></output></label>`).join('')}<label class="audio-mute"><input type="checkbox" id="audio-muted">ปิดเสียงทั้งหมด · M</label><small>ปรับระดับเพื่อฟังตัวอย่าง · เพลงจะเล่นเมื่อมีเพลงประกอบ</small><p id="audio-save-status" role="status"></p>`;
  document.querySelector('#key-settings')!.after(panel);
  const mute = panel.querySelector<HTMLInputElement>('#audio-muted')!;
  const status = panel.querySelector<HTMLElement>('#audio-save-status')!;
  let timer: ReturnType<typeof setTimeout>, dirty = false, received = false;
  function draw() {
    for (const input of panel.querySelectorAll<HTMLInputElement>('[data-volume]')) {
      const key = input.dataset.volume as 'sfx' | 'music' | 'ambience';
      input.value = String(sound.settings[key]);
      panel.querySelector(`[data-output="${key}"]`)!.textContent = Math.round(sound.settings[key] * 100) + '%';
    }
    mute.checked = sound.settings.muted;
    const button = document.querySelector<HTMLButtonElement>('#audio')!;
    button.textContent = sound.settings.muted ? '♩' : '♫';
    button.setAttribute('aria-pressed', String(sound.settings.muted));
    button.setAttribute('aria-label', sound.settings.muted ? 'เปิดเสียง (M)' : 'ปิดเสียงทั้งหมด (M)');
  }
  function save() { send({ t: 'audioSettings', settings: { ...sound.settings } }); }
  function changed() {
    dirty = true; status.textContent = 'บันทึกในเครื่องแล้ว · กำลังบันทึกกับเซิร์ฟเวอร์…';
    clearTimeout(timer); timer = setTimeout(save, 300);
  }
  sound.onChange = draw; draw();
  for (const input of panel.querySelectorAll<HTMLInputElement>('[data-volume]')) {
    input.oninput = () => {
      const bus = input.dataset.volume as 'sfx' | 'music' | 'ambience';
      sound.set({ [bus]: Number(input.value) }); sound.play('ui_click', undefined, bus === 'music' ? 'sfx' : bus); changed();
    };
  }
  mute.onchange = () => { sound.set({ muted: mute.checked }); changed(); sound.play('ui_click'); };
  return {
    toggleMute() { sound.toggle(); changed(); },
    receive(message: any) {
      if (message.t === 'welcome') { received = false; if (dirty) save(); }
      if (message.t === 'audioSettings' && JSON.stringify(message.settings) === JSON.stringify(sound.settings)) {
        dirty = false; status.textContent = 'บันทึกเสียงแล้ว';
      }
      if (message.t === 'audioSettingsError') status.textContent = 'บันทึกในเครื่องแล้ว · เซิร์ฟเวอร์ยังบันทึกไม่สำเร็จ';
      if (message.type === 'stats' && !received) {
        received = true;
        if (!dirty) sound.restore(message.audioSettings);
      }
    },
  };
}
