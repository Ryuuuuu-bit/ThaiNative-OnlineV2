import { MUSIC_CROSSFADE, type MusicTrack } from './music-state.ts';

type Files = { opus: { url: string }; aac: { url: string } };
type Voice = { media: HTMLAudioElement; source: MediaElementAudioSourceNode; gain: GainNode; cleanup?: ReturnType<typeof setTimeout> };
/** Streaming media is created only after readiness AND a gesture-unlocked context. */
export class MusicPlayer {
  private manifest?: Promise<{ tracks: Record<MusicTrack, Files> } | undefined>;
  private voices = new Map<MusicTrack, Voice>();
  private failed = new Set<MusicTrack>();
  private warned = false;
  private busy = false;
  private gestureBlocked = false;
  private desired: MusicTrack | null = null;
  private current: MusicTrack | null = null;
  private hidden = false;
  private ctx: AudioContext;
  private bus: GainNode;
  constructor(ctx: AudioContext, bus: GainNode) { this.ctx = ctx; this.bus = bus; }
  private warn() {
    if (!this.warned) { this.warned = true; console.warn('Background music unavailable; continuing silently.'); }
  }
  select(track: MusicTrack | null) {
    this.desired = track;
    void this.sync();
  }
  gesture() {
    this.gestureBlocked = false;
    if (!this.hidden) this.resumeCurrent();
    void this.sync();
  }
  private resumeCurrent() {
    const voice = this.current && this.voices.get(this.current);
    if (voice?.media.paused) void voice.media.play().catch(() => {});
  }
  visibility(hidden: boolean) {
    if (this.hidden === hidden) return;
    this.hidden = hidden;
    if (hidden) for (const voice of this.voices.values()) voice.media.pause();
    else {
      this.resumeCurrent();
      void this.sync();
    }
  }
  private ramp(voice: Voice, value: number) {
    const now = this.ctx.currentTime;
    voice.gain.gain.cancelAndHoldAtTime(now);
    voice.gain.gain.linearRampToValueAtTime(value, now + MUSIC_CROSSFADE);
  }
  private retire(id: MusicTrack, voice: Voice) {
    this.ramp(voice, 0);
    clearTimeout(voice.cleanup);
    voice.cleanup = setTimeout(() => {
      if (this.current === id) return;
      voice.media.pause(); voice.media.removeAttribute('src'); voice.media.load();
      voice.source.disconnect(); voice.gain.disconnect(); this.voices.delete(id);
    }, MUSIC_CROSSFADE * 1000);
  }
  private async sync() {
    if (this.busy || this.hidden || this.gestureBlocked || this.current === this.desired ||
      (this.desired && this.failed.has(this.desired))) return;
    this.busy = true;
    const target = this.desired;
    try {
      let voice: Voice | undefined;
      if (target) {
        this.manifest ??= fetch('/assets/audio/bgm.json?v=' + import.meta.env?.VITE_BUILD_ID,
          { priority: 'low' }).then(r => { if (!r.ok) throw Error('BGM manifest'); return r.json(); })
          .catch(() => { this.warn(); return undefined; });
        const manifest = await this.manifest;
        if (target !== this.desired || this.hidden) return;
        const files = manifest?.tracks[target];
        if (!files) throw Error('Missing music track');
        voice = this.voices.get(target);
        if (!voice) {
          const media = new Audio();
          media.preload = 'none'; media.loop = true;
          media.src = (media.canPlayType('audio/ogg; codecs="opus"') ? files.opus : files.aac).url;
          const source = this.ctx.createMediaElementSource(media), gain = this.ctx.createGain();
          gain.gain.value = 0; source.connect(gain); gain.connect(this.bus);
          voice = { media, source, gain }; this.voices.set(target, voice);
          media.addEventListener('error', () => { this.failed.add(target); this.warn();
            if (this.desired === target) this.select(null); });
        }
        clearTimeout(voice.cleanup);
        await voice.media.play();
        if (target !== this.desired || this.hidden) {
          if (this.current !== target) this.retire(target, voice);
          if (this.hidden) voice.media.pause();
          return;
        }
      }
      this.current = target;
      for (const [id, other] of this.voices) if (id !== target) this.retire(id, other);
      if (voice) this.ramp(voice, 1);
    } catch (error) {
      if (target) {
        // A browser policy rejection may be retried by the next gesture.
        if (error instanceof DOMException && error.name === 'NotAllowedError') this.gestureBlocked = true;
        else if (!(error instanceof DOMException && error.name === 'AbortError')) {
          this.failed.add(target); this.warn();
          this.current = null;
          for (const [id, other] of this.voices) this.retire(id, other);
        }
        const voice = this.voices.get(target);
        if (voice && this.current !== target) this.retire(target, voice);
      }
    } finally {
      this.busy = false;
      if (target !== this.desired) void this.sync();
    }
  }
}
