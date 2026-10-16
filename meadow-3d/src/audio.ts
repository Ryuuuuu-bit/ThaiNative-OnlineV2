import { AudioSettingsSchema, DEFAULT_AUDIO, type AudioSettings } from '@thainative/shared';
import { assetFetch, reportDeferred } from './asset-request';
type Position = { x: number; z: number };
type Sprite = { group: string; start: number; duration: number; pitch: number; cooldown: number; voices: number };
type Manifest = { sounds: Record<string, Sprite>; groups: Record<string, { opus: { url: string }; aac: { url: string } }> };
type Bus = 'sfx' | 'music' | 'ambience';
/** One gesture-unlocked context; downloads never participate in boot progress. */
export class AudioEngine {
  settings: AudioSettings = { ...DEFAULT_AUDIO };
  onChange = (_settings: AudioSettings) => {};
  private ctx: AudioContext | null = null;
  private master?: GainNode;
  private buses = {} as Record<Bus, GainNode>;
  private manifest?: Manifest;
  private manifestTask?: Promise<void>;
  private loads = new Map<string, Promise<void>>();
  private encoded = new Map<string, ArrayBuffer>();
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<AudioBufferSourceNode, string>();
  private last = new Map<string, number>();
  private playable = false;
  private city = false;
  setMap(mapId: string) { this.city = mapId === "city_plaza"; this.apply(); }
  private ambient?: AudioBufferSourceNode;
  private listener: Position = { x: 0, z: 0 };
  private storageKey: string;
  constructor(characterId: string) {
    this.storageKey = 'tn-audio:' + characterId;
    try { this.restore(JSON.parse(localStorage.getItem(this.storageKey) || 'null')); } catch {}
    const unlock = () => this.start();
    for (const event of ['pointerdown', 'click', 'keydown', 'touchstart'])
      window.addEventListener(event, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => this.apply());
  }
  restore(value: unknown) {
    const parsed = AudioSettingsSchema.safeParse(value);
    if (parsed.success) { this.settings = parsed.data; this.apply(); this.persist(); this.onChange(this.settings); }
  }
  private persist() { try { localStorage.setItem(this.storageKey, JSON.stringify(this.settings)); } catch {} }
  set(value: Partial<AudioSettings>) { this.restore({ ...this.settings, ...value }); }
  toggle() { this.set({ muted: !this.settings.muted }); return !this.settings.muted; }
  start() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        for (const name of ['sfx', 'music', 'ambience'] as const) {
          this.buses[name] = this.ctx.createGain(); this.buses[name].connect(this.master);
        }
        this.apply();
        for (const group of this.encoded.keys()) void this.decode(group);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      this.ambience();
    } catch { /* Unsupported audio remains silent. */ }
  }
  private apply() {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.settings.muted || document.hidden ? 0 : 1, this.ctx.currentTime, .08);
    for (const bus of ['sfx', 'music', 'ambience'] as const)
      this.buses[bus].gain.setTargetAtTime(this.settings[bus] * (bus === "ambience" && this.city ? .45 : 1), this.ctx.currentTime, .08);
  }
  setListener(position: Position) { this.listener = { x: position.x, z: position.z }; }
  private getManifest() {
    return this.manifestTask ??= (async () => {
      try { this.manifest = await (await assetFetch('/assets/audio/sprites.json?v=' + import.meta.env.VITE_BUILD_ID, 'low')).json(); }
      catch { reportDeferred(); }
    })();
  }
  load(group: string) {
    if (!this.loads.has(group)) this.loads.set(group, (async () => {
      await this.getManifest();
      const files = this.manifest?.groups[group]; if (!files) return;
      const opus = !!document.createElement('audio').canPlayType('audio/ogg; codecs="opus"');
      try {
        this.encoded.set(group, await (await assetFetch((opus ? files.opus : files.aac).url, 'low')).arrayBuffer());
        await this.decode(group);
      } catch { reportDeferred(); }
    })());
    return this.loads.get(group)!;
  }
  private async decode(group: string) {
    const bytes = this.encoded.get(group); if (!this.ctx || !bytes) return;
    this.encoded.delete(group);
    try { this.buffers.set(group, await this.ctx.decodeAudioData(bytes)); this.ambience(); }
    catch { reportDeferred(); }
  }
  afterPlayable() {
    if (this.playable) return;
    this.playable = true;
    void this.load('sfx-core').then(() => this.load('sfx-skills')).then(() => this.load('amb-meadow'));
  }
  private ambience() {
    const sprite = this.manifest?.sounds.amb_meadow, buffer = this.buffers.get('amb-meadow');
    if (!this.playable || !this.ctx || !sprite || !buffer || this.ambient) return;
    const source = this.ctx.createBufferSource(), fade = this.ctx.createGain();
    source.buffer = buffer; source.loop = true; source.loopStart = sprite.start; source.loopEnd = Math.min(buffer.duration, sprite.start + sprite.duration);
    fade.gain.setValueAtTime(0, this.ctx.currentTime); fade.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 2);
    source.connect(fade); fade.connect(this.buses.ambience); source.start(0, sprite.start); this.ambient = source;
  }
  play(id: string, position?: Position, bus: Bus = 'sfx') {
    const ctx = this.ctx, sprite = this.manifest?.sounds[id], buffer = sprite && this.buffers.get(sprite.group);
    if (!ctx || ctx.state !== 'running' || !sprite || !buffer || document.hidden || this.settings.muted) return;
    const now = ctx.currentTime;
    if (now - (this.last.get(id) ?? -Infinity) < sprite.cooldown || this.voices.size >= 16 || [...this.voices.values()].filter(v => v === id).length >= sprite.voices) return;
    const dx = position ? position.x - this.listener.x : 0, dz = position ? position.z - this.listener.z : 0;
    const distance = Math.hypot(dx, dz); if (distance >= 24) return;
    const source = ctx.createBufferSource(), gain = ctx.createGain(), pan = ctx.createStereoPanner();
    source.buffer = buffer; source.playbackRate.value = 1 + (Math.random() * 2 - 1) * sprite.pitch;
    gain.gain.value = Math.pow(10, (Math.random() * 3 - 1.5) / 20) * Math.pow(1 - distance / 24, 2);
    pan.pan.value = Math.max(-1, Math.min(1, (dx * .822 - dz * .569) / 10));
    source.connect(gain); gain.connect(pan); pan.connect(this.buses[bus]);
    source.onended = () => { this.voices.delete(source); source.disconnect(); gain.disconnect(); pan.disconnect(); };
    source.start(now, sprite.start, sprite.duration); this.last.set(id, now); this.voices.set(source, id);
    if (import.meta.env.DEV) {
      const log = ((window as any).__sfxLog ??= []); log.push({ id, time: now, position, bus }); if (log.length > 256) log.shift();
    }
  }
}
