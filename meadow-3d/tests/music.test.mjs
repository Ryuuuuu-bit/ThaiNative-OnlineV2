import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MAP_IDS } from '@the-beginning-online/shared/maps';
import { MusicSelection, MAP_MUSIC, musicDuckGain, MUSIC_CROSSFADE, MUSIC_RELEASE } from '../src/music-state.ts';
import { MusicPlayer } from '../src/music.ts';

const field = { mapId: 'meadow', dead: false, bossAlive: true, bossTargeted: false, bossBarActive: false, bossAggro: false };
test('map themes, unknown map silence, and city precedence over boss state', () => {
  const selection = new MusicSelection();
  assert.equal(selection.select(field, 0), 'meadow');
  assert.equal(new MusicSelection().select({ ...field, mapId: 'forest', bossAlive: false }, 0), 'forest');
  assert.equal(new MusicSelection().select({ ...field, mapId: 'forest', bossTargeted: true }, 0), 'king');
  assert.equal(selection.select({ ...field, mapId: 'city_plaza', bossAggro: true }, 1), 'city');
  assert.equal(selection.select({ ...field, mapId: 'unknown' }, 2), null);
});
test('target, boss bar, and aggro independently engage King; dead bosses cannot engage', () => {
  for (const key of ['bossTargeted', 'bossBarActive', 'bossAggro']) {
    const selection = new MusicSelection();
    assert.equal(selection.select({ ...field, [key]: true }, 0), 'king');
    assert.equal(new MusicSelection().select({ ...field, bossAlive: false, [key]: true }, 0), 'meadow');
  }
});
test('fight end, King death/removal, and player death release exactly four seconds later', () => {
  for (const end of [field, { ...field, bossAlive: false, bossBarActive: true }, { ...field, dead: true, bossAggro: true }]) {
    const selection = new MusicSelection();
    assert.equal(selection.select({ ...field, bossAggro: true }, 10), 'king');
    assert.equal(selection.select(end, 12), 'king');
    assert.equal(selection.select(end, 15.999), 'king');
    assert.equal(selection.select(end, 16), 'meadow');
    assert.equal(selection.select(end, 30), 'meadow');
  }
  assert.equal(MUSIC_RELEASE, 4); assert.equal(MUSIC_CROSSFADE, 3);
});
test('reengagement cancels release; map exit clears stale combat memory', () => {
  const selection = new MusicSelection();
  selection.select({ ...field, bossAggro: true }, 0); selection.select(field, 1);
  assert.equal(selection.select({ ...field, bossTargeted: true }, 4), 'king');
  assert.equal(selection.select(field, 8), 'king');
  assert.equal(selection.select({ ...field, mapId: 'city_plaza' }, 9), 'city');
  assert.equal(selection.select(field, 10), 'meadow');
});
test('every map has its own theme, and all map-to-map transitions clear the previous boss release', () => {
  assert.deepEqual(Object.keys(MAP_MUSIC), [...MAP_IDS]);
  assert.equal(new Set(Object.values(MAP_MUSIC)).size, MAP_IDS.length);
  for (const from of MAP_IDS) for (const to of MAP_IDS) {
    const selection = new MusicSelection();
    assert.equal(selection.select({ ...field, mapId: from }, 0), MAP_MUSIC[from]);
    selection.select({ ...field, mapId: from, bossAggro: true }, 1);
    selection.select({ ...field, mapId: from }, 2);
    if (from !== to) assert.equal(selection.select({ ...field, mapId: to }, 2.1), MAP_MUSIC[to], `${from} -> ${to}`);
    assert.equal(selection.select({ ...field, mapId: to }, 7), MAP_MUSIC[to]);
    if (to !== 'city_plaza') {
      assert.equal(selection.select({ ...field, mapId: to, bossAggro: true }, 8), 'king');
      assert.equal(selection.select({ ...field, mapId: to }, 9), 'king');
      assert.equal(selection.select({ ...field, mapId: to }, 13), MAP_MUSIC[to]);
    }
  }
  assert.equal(new MusicSelection().select({ ...field, mapId: 'toString' }, 0), null);
});

const flush = () => new Promise(resolve => setImmediate(resolve));
test('death ducks to 30%; impact attenuation is capped at -3 dB and composes with death', () => {
  assert.equal(musicDuckGain(false, false), 1);
  assert.equal(musicDuckGain(true, false), .3);
  assert.ok(Math.abs(20 * Math.log10(musicDuckGain(false, true)) + 1.5) < 1e-9);
  assert.equal(musicDuckGain(true, true), .3 * Math.pow(10, -1.5 / 20));
});
test('streaming is deferred, crossfades last 3 seconds, hidden pauses and focus resumes', async t => {
  const media = [], ramps = [], requests = [];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url);
    return { ok: true, json: async () => ({ tracks: Object.fromEntries(['city', 'meadow', 'king'].map(id =>
      [id, { opus: { url: id + '.ogg' }, aac: { url: id + '.m4a' } }])) }) };
  });
  const originalAudio = globalThis.Audio;
  globalThis.Audio = class {
    paused = true; plays = 0; listeners = {};
    constructor() { media.push(this); }
    canPlayType() { return 'probably'; }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener(id, cb) { this.listeners[id] = cb; }
    removeAttribute() {} load() {}
  };
  t.after(() => { globalThis.Audio = originalAudio; });
  const ctx = { currentTime: 10, createGain: () => ({ connect() {}, disconnect() {}, gain: {
    value: 0, cancelAndHoldAtTime() {}, linearRampToValueAtTime: (value, end) => ramps.push({ value, end }) } }),
    createMediaElementSource: () => ({ connect() {}, disconnect() {} }) };
  const music = new MusicPlayer(ctx, {});
  assert.equal(requests.length, 0); assert.equal(media.length, 0);
  music.select('city'); await flush();
  assert.equal(requests.length, 1); assert.equal(media[0].loop, true); assert.equal(media[0].preload, 'none');
  assert.deepEqual(ramps.at(-1), { value: 1, end: 13 });
  for (let i = 0; i < 10; i++) { music.visibility(false); music.select('city'); }
  assert.equal(media[0].plays, 1);
  music.select('king'); await flush();
  assert.equal(media.length, 2); assert.equal(media[0].paused, false);
  assert.deepEqual(ramps.slice(-2), [{ value: 0, end: 13 }, { value: 1, end: 13 }]);
  music.visibility(true); assert.ok(media.every(m => m.paused));
  // If the browser revokes autoplay while hidden, the next gesture retries
  // the current track even though the selected track has not changed.
  const play = media[1].play;
  media[1].play = () => Promise.reject(new DOMException('gesture required', 'NotAllowedError'));
  music.visibility(false); await flush(); assert.equal(media[1].paused, true);
  media[1].play = play; music.gesture(); await flush(); assert.equal(media[1].paused, false);
  t.mock.timers.tick(3000); assert.equal(media[0].paused, true);
  music.select(null); await flush(); t.mock.timers.tick(3000);
  assert.ok(media.every(m => m.paused));
});
test('manifest failure stays silent and logs once across repeated selections', async t => {
  let warnings = 0, requests = 0;
  t.mock.method(console, 'warn', () => warnings++);
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw Error('offline'); });
  const music = new MusicPlayer({}, {});
  music.select('city'); await flush(); music.select('city'); await flush();
  music.select('king'); await flush();
  assert.equal(warnings, 1); assert.equal(requests, 1);
});
test('rapid travel keeps the last requested map and retires stale streams in both codecs', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/audio/bgm.json', import.meta.url)));
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => manifest }));
  const originalAudio = globalThis.Audio;
  t.after(() => { globalThis.Audio = originalAudio; });
  for (const codec of ['opus', 'aac']) {
    const media = []; let release;
    globalThis.Audio = class {
      paused = true;
      constructor() { media.push(this); }
      canPlayType() { return codec === 'opus' ? 'probably' : ''; }
      play() {
        this.paused = false;
        return this.src.includes('bgm-forest-') ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
      }
      pause() { this.paused = true; }
      addEventListener() {} removeAttribute() {} load() {}
    };
    const ctx = { currentTime: 10, createGain: () => ({ connect() {}, disconnect() {}, gain: {
      value: 0, cancelAndHoldAtTime() {}, linearRampToValueAtTime() {} } }),
      createMediaElementSource: () => ({ connect() {}, disconnect() {} }) };
    const player = new MusicPlayer(ctx, {});
    player.select('city'); await flush();
    player.select('forest'); await flush();
    player.select('desert'); player.select('ruins');
    release(); await flush(); await flush();
    t.mock.timers.tick(3000);
    assert.deepEqual(media.filter(m => !m.paused).map(m => m.src), [manifest.tracks.ruins[codec].url]);
    for (const track of Object.values(MAP_MUSIC)) {
      player.select(track); await flush();
      if (track === 'forest') { release(); await flush(); }
      t.mock.timers.tick(3000);
      assert.deepEqual(media.filter(m => !m.paused).map(m => m.src), [manifest.tracks[track][codec].url]);
    }
    player.select(null); await flush(); t.mock.timers.tick(3000);
    assert.ok(media.every(m => m.paused));
  }
});
test('packed tracks have both hashed codecs, stereo loops, and verified decoded seams', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/assets/audio/bgm.json', import.meta.url)));
  assert.equal(manifest.channels, 2);
  const approved = JSON.parse(readFileSync(new URL('../art/bgm-source/map-v2/sources.json', import.meta.url))).tracks;
  assert.deepEqual(Object.keys(manifest.tracks), [...Object.keys(approved), 'king']);
  assert.deepEqual(new Set(Object.keys(approved)), new Set(Object.values(MAP_MUSIC)));
  for (const [id, track] of Object.entries(manifest.tracks)) {
    assert.equal(track.loopStart, 0);
    assert.ok(Math.abs(track.loopEnd - (track.sourceDuration - track.loopCrossfade - track.trimmedStart - track.trimmedEnd)) < .01);
    if (approved[id]) {
      const source = approved[id];
      assert.equal(createHash('sha256').update(readFileSync(new URL('../'+source.source,import.meta.url))).digest('hex'), source.sha256);
      assert.equal(track.sourceSha256, source.sha256);
      assert.equal(track.loopBars, 20);
      assert.ok(Math.abs(track.loopEnd - 20 * 4 * 60 / source.requestedBpm) < .001);
      assert.ok(Math.abs(track.loopCrossfade - 4 * 60 / source.requestedBpm) < .001);
    } else assert.equal(track.loopCrossfade, 1.5);
    assert.ok(track.pcmSeam.passed);
    for (const codec of ['opus', 'aac']) {
      const file = track[codec];
      assert.match(file.url, new RegExp(`bgm-${id}-[a-f0-9]{12}\\.(ogg|m4a)$`));
      assert.equal(statSync(new URL('../public' + file.url, import.meta.url)).size, file.bytes);
      assert.ok(file.seam.passed); assert.ok(file.seam.wrapJump < .02);
      assert.ok(Math.abs(file.lufs + 22) < 1); assert.ok(file.truePeakDbtp <= -2.8);
      const hash = createHash('sha256').update(readFileSync(new URL('../public'+file.url,import.meta.url))).digest('hex').slice(0,12);
      assert.ok(file.url.includes(hash));
    }
  }
});
