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
for (const [id, path] of Object.entries(picks).sort(([a], [b]) => a.localeCompare(b))) {
  const ambience = id === 'amb_meadow', ui = id.startsWith('ui_');
  const group = ambience ? 'amb-meadow' : id.startsWith('king_') ? 'sfx-king' : skills.has(id) ? 'sfx-skills' : 'sfx-core';
  const lufs = ambience ? -24 : ui ? -20 : group === 'sfx-king' ? -14 : -16;
  let pcm = run(['-i', resolve(source, path), '-af', 'silenceremove=start_periods=1:start_duration=0.005:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_duration=0.005:start_threshold=-50dB,areverse', '-f', 'f32le', '-ar', String(rate), '-ac', '1', 'pipe:1']).stdout;
  if (!pcm.length) throw Error('Empty take: ' + id);
  // EBU R128 requires a 400ms window; repeat short transients for measurement only.
  const measured = Buffer.concat(Array(Math.max(1, Math.ceil(rate * 4 * 3 / pcm.length))).fill(pcm));
  const measure = run([...pcmArgs, '-af', `loudnorm=I=${lufs}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], measured).stderr.toString();
  const m = JSON.parse(measure.slice(measure.lastIndexOf('{')));
  const gainDB = Math.min(lufs - Number(m.input_i), -1.5 - Number(m.input_tp));
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
    pcm = filter(pcm, `afade=t=in:d=0.003,afade=t=out:st=${Math.max(0, duration - .035)}:d=0.035`);
  }
  const start = groups[group].reduce((s, b) => s + b.length, 0) / 4 / rate;
  manifest.sounds[id] = { group, start, duration: pcm.length / 4 / rate, source: 'art/sfx-source/' + path, targetDuration: metadata[id]?.target, lufs, crossfade, pitch: ui ? 0 : .04, cooldown: id === 'jelly_hop' ? .8 : ui ? .06 : id === 'levelup' ? 0 : .04, voices: id === 'jelly_hit' ? 3 : id === 'jelly_hop' ? 2 : 4 };
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
