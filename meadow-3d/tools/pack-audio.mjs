import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

if (process.argv.includes('--bgm')) {
  await import('./pack-bgm.mjs');
  process.exit(0);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'art/sfx-source'), out = resolve(root, 'public/assets/audio');
const picks = JSON.parse(readFileSync(resolve(source, 'picks.json')));
const metadata = JSON.parse(readFileSync(resolve(source, 'sfx-sources.json')));
const loops = readdirSync(resolve(source, 'raw')).filter(n => /^amb_meadow_loop.*\.mp3$/i.test(n)).sort();
if (loops.length) picks.amb_meadow = 'raw/' + (loops.find(n => n === 'amb_meadow_loop.mp3') || loops[0]);
mkdirSync(out, { recursive: true });
const rate = 48000, gap = Buffer.alloc(rate * 4 * .12);
function run(args, input) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args], { input, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (r.status !== 0) throw Error(r.stderr?.toString() || 'ffmpeg failed');
  return r;
}
const pcmArgs = ['-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0'];
function filter(input, af) { return run([...pcmArgs, '-af', af, '-f', 'f32le', '-ar', String(rate), '-ac', '1', 'pipe:1'], input).stdout; }
const manifest = { version: 1, sampleRate: rate, groups: {}, sounds: {} };
const groups = { 'sfx-core': [], 'sfx-skills': [], 'sfx-king': [], 'amb-meadow': [] };
const skills = new Set(['slash', 'whirlwind', 'dash', 'earth_break', 'provoke', 'endure', 'punch']);
// Soft combat hits: trim smeared pre-roll so the impact lands on time, cut the 2-6 kHz bite,
// round off the transient, add a short dark room tail and sit a few dB under the other SFX.
// Reference feel: RO / Tree of Savior - short, dry, mid-range "thock" hits and brief swings.
const TONE = {
  body: 'highpass=f=75,lowshelf=f=140:g=-2,equalizer=f=2800:t=o:w=1.5:g=-3,highshelf=f=6000:g=-4',
  warm: 'highpass=f=60,equalizer=f=800:t=o:w=1:g=2,equalizer=f=3000:t=o:w=1.5:g=-4,highshelf=f=5500:g=-6',
  clean: 'highpass=f=50',
  bright: 'highpass=f=120,equalizer=f=900:t=o:w=1:g=2,equalizer=f=3200:t=o:w=2:g=-9,highshelf=f=6000:g=-8',
};
const SOFT = {
  crit: { lead: .004, tone: 'bright', lufs: -19, lowpass: 5500, max: .3 },
  combo1: { lead: .04, tone: 'body', lufs: -21, lowpass: 8000 },
  combo2: { lead: .04, tone: 'body', lufs: -22, lowpass: 8000 },
  combo3: { lead: .04, tone: 'bright', lufs: -21, lowpass: 6000, max: .38 },
  slash: { lead: .01, tone: 'bright', lufs: -21, lowpass: 6000, max: .35 },
  whirlwind: { lead: .04, tone: 'warm', lufs: -19, lowpass: 8000 },
  earth_break: { lead: .02, tone: 'body', lufs: -18, lowpass: 8000 },
  // Synthesised layers (tools/synth-hit-sfx.mjs): weapon thock + per-species material, played together.
  hit_thock: { tone: 'clean', lufs: -21, lowpass: 7000 },
  mat_jelly: { tone: 'clean', lufs: -22, lowpass: 6000 },
  mat_fur: { tone: 'clean', lufs: -22, lowpass: 4000 },
  mat_wood: { tone: 'clean', lufs: -22, lowpass: 6000 },
  mat_shroom: { tone: 'clean', lufs: -22, lowpass: 4000 },
  mat_wisp: { tone: 'clean', lufs: -23, lowpass: 5000 },
};
/** Start `lead` seconds before the loudest 5 ms window. */
function trimToImpact(pcm, lead) {
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4), n = rate * .005;
  let best = 0, at = 0;
  for (let i = 0; i + n <= x.length; i += n) { let e = 0; for (let j = i; j < i + n; j++) e += x[j] * x[j]; if (e > best) { best = e; at = i; } }
  return pcm.subarray(Math.max(0, at - Math.round(lead * rate)) * 4);
}
/** Transient softener: where a fast envelope outruns a slow one, pull gain down (at most 9 dB). */
function softenTransients(pcm, amount = .6) {
  const x = new Float32Array(pcm.length / 4); x.set(new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4));
  const k = s => Math.exp(-1 / (s * rate)), fa = k(.0003), sa = k(.015), rel = k(.04), gs = k(.001), floor = Math.pow(10, -9 / 20);
  let fast = 0, slow = 0, g = 1;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    fast = a > fast ? fa * fast + (1 - fa) * a : rel * fast + (1 - rel) * a;
    slow = a > slow ? sa * slow + (1 - sa) * a : rel * slow + (1 - rel) * a;
    const target = fast > slow && fast > 1e-6 ? Math.max(floor, Math.pow(slow / fast, amount)) : 1;
    g = gs * g + (1 - gs) * target; x[i] *= g;
  }
  return Buffer.from(x.buffer);
}
for (const [id, path] of Object.entries(picks).sort(([a], [b]) => a.localeCompare(b))) {
  const ambience = id === 'amb_meadow', ui = id.startsWith('ui_');
  const group = ambience ? 'amb-meadow' : id.startsWith('king_') ? 'sfx-king' : skills.has(id) ? 'sfx-skills' : 'sfx-core';
  const soft = SOFT[id];
  const lufs = soft ? soft.lufs : ambience ? -24 : ui ? -20 : group === 'sfx-king' ? -14 : -16, peak = soft ? -3 : -1.5;
  let pcm = run(['-i', resolve(source, path), '-af', 'silenceremove=start_periods=1:start_duration=0.005:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_duration=0.005:start_threshold=-50dB,areverse', '-f', 'f32le', '-ar', String(rate), '-ac', '1', 'pipe:1']).stdout;
  if (!pcm.length) throw Error('Empty take: ' + id);
  if (soft) {
    pcm = softenTransients(filter(soft.lead === undefined ? pcm : trimToImpact(pcm, soft.lead), TONE[soft.tone]));
    pcm = filter(pcm, `apad=pad_dur=0.2,aecho=0.9:0.85:17|29|43|61:0.1|0.06|0.035|0.02,lowpass=f=${soft.lowpass},lowpass=f=${soft.lowpass},areverse,silenceremove=start_periods=1:start_duration=0.005:start_threshold=-60dB,areverse${soft.max ? `,atrim=end=${soft.max}` : ''}`);
  }
  // EBU R128 requires a 400ms window; repeat short transients for measurement only.
  const measured = Buffer.concat(Array(Math.max(1, Math.ceil(rate * 4 * 3 / pcm.length))).fill(pcm));
  const measure = run([...pcmArgs, '-af', `loudnorm=I=${lufs}:TP=${peak}:LRA=11:print_format=json`, '-f', 'null', '-'], measured).stderr.toString();
  const m = JSON.parse(measure.slice(measure.lastIndexOf('{')));
  const gainDB = Math.min(lufs - Number(m.input_i), peak - Number(m.input_tp));
  if (!Number.isFinite(gainDB)) throw Error('Cannot measure loudness: ' + id);
  pcm = filter(pcm, `volume=${gainDB}dB`);
  let crossfade = 0;
  if (ambience) {
    // Circular overlap: head/tail blend followed by the untouched middle. Both
    // joins continue adjacent source samples, including the playback wrap point.
    const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
    const n = Math.min(Math.round(1.5 * rate), Math.floor(samples.length / 2));
    const loop = new Float32Array(samples.length - n);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), w = .5 - .5 * Math.cos(Math.PI * t);
      loop[i] = samples[samples.length - n + i] * (1 - w) + samples[i] * w;
    }
    loop.set(samples.subarray(n, samples.length - n), n);
    pcm = Buffer.from(loop.buffer); crossfade = n / rate;
  } else {
    const duration = pcm.length / 4 / rate;
    pcm = filter(pcm, soft ? `afade=t=in:d=0.006:curve=qsin,afade=t=out:st=${Math.max(0, duration - .08)}:d=0.08:curve=qsin`
      : `afade=t=in:d=0.003,afade=t=out:st=${Math.max(0, duration - .035)}:d=0.035`);
  }
  const start = groups[group].reduce((s, b) => s + b.length, 0) / 4 / rate;
  manifest.sounds[id] = { group, start, duration: pcm.length / 4 / rate, source: 'art/sfx-source/' + path, targetDuration: metadata[id]?.target, lufs, crossfade, pitch: ui ? 0 : id === 'mat_jelly' ? .08 : soft ? .05 : .04, cooldown: id === 'jelly_hop' ? .8 : ui ? .06 : id === 'levelup' ? 0 : id === 'hit_thock' || id.startsWith('mat_') ? .05 : id === 'crit' ? .1 : .04, voices: id === 'hit_thock' || id.startsWith('mat_') ? 3 : id === 'jelly_hop' ? 2 : 4 };
  groups[group].push(pcm); if (!ambience) groups[group].push(gap);
}
for (const [group, parts] of Object.entries(groups)) {
  const pcm = Buffer.concat(parts), files = {};
  for (const [ext, codec] of [['ogg', 'libopus'], ['m4a', 'aac']]) {
    // Write containers to stdout with deterministic metadata; Ogg serial is fixed.
    const format = ext === 'ogg' ? ['-f', 'ogg', '-serial_offset', '0'] : ['-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov'];
    const data = run([...pcmArgs, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-c:a', codec, '-b:a', '64k', ...format, 'pipe:1'], pcm).stdout;
    if (group === 'sfx-core' && data.length > 400 * 1024) throw Error('sfx-core exceeds 400 KiB');
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 12), name = `${group}-${hash}.${ext}`;
    writeFileSync(resolve(out, name), data);
    files[ext === 'ogg' ? 'opus' : 'aac'] = { url: '/assets/audio/' + name, bytes: data.length };
  }
  manifest.groups[group] = { ...files, duration: pcm.length / 4 / rate };
}
writeFileSync(resolve(out, 'sprites.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ groups: manifest.groups, ambience: manifest.sounds.amb_meadow }, null, 2));
