import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/assets/audio');
const rate = 48000, channels = 2;
const approved = JSON.parse(readFileSync(resolve(root, 'art/bgm-source/map-v2/sources.json'), 'utf8')).tracks;
mkdirSync(out, { recursive: true });
function run(args, input) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args],
    { input, maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw Error(result.stderr?.toString() || 'ffmpeg failed');
  return result.stdout;
}
const pcmInput = ['-f', 'f32le', '-ar', String(rate), '-ac', '2', '-i', 'pipe:0'];
function loudness(pcm) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...pcmInput,
    '-af', 'loudnorm=I=-22:TP=-3:LRA=20:print_format=json', '-f', 'null', '-'],
    { input: pcm, maxBuffer: 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw Error(result.stderr?.toString() || 'Loudness check failed');
  const log = result.stderr.toString();
  return JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
}
function seam(pcm) {
  const a = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
  let jump = 0, maxStep = 0;
  for (let c = 0; c < channels; c++) jump = Math.max(jump, Math.abs(a[c] - a[a.length - channels + c]));
  for (let i = channels; i < a.length; i++) maxStep = Math.max(maxStep, Math.abs(a[i] - a[i - channels]));
  return { wrapJump: jump, maxAdjacentStep: maxStep, passed: jump < .02 && jump <= maxStep };
}
const manifest = { version: 1, sampleRate: rate, channels, tracks: {} };
for (const id of [...Object.keys(approved), 'king']) {
  const config = approved[id];
  const overlap = config?.overlapFrames ?? rate * 1.5;
  const source = config?.source ?? `art/bgm-source/bgm_${id}.mp3`;
  const sourceSha256 = createHash('sha256').update(readFileSync(resolve(root, source))).digest('hex');
  if (config && sourceSha256 !== config.sha256) throw Error(`${id}: approved source hash mismatch`);
  const data = run(['-i', resolve(root, source), ...(config ? [] : ['-af', 'loudnorm=I=-22:TP=-3:LRA=9']),
    '-f', 'f32le', '-ar', String(rate), '-ac', '2', 'pipe:1']);
  const full = new Float32Array(data.buffer, data.byteOffset, data.length / 4);
  // Trim a fade-in / fade-out so the loop never dips: keep the span whose 100 ms RMS stays within 9 dB of the body.
  const win = rate / 10, blocks = Math.floor(full.length / channels / win), level = [];
  for (let b = 0; b < blocks; b++) { let e = 0; for (let i = b * win * channels; i < (b + 1) * win * channels; i++) e += full[i] * full[i]; level.push(10 * Math.log10(e / (win * channels) + 1e-12)); }
  const body = [...level].sort((a, b) => a - b)[Math.floor(blocks / 2)];
  let first = 0, last = blocks - 1;
  while (first < blocks / 4 && level[first] < body - 9) first++;
  while (last > blocks * 3 / 4 && level[last] < body - 9) last--;
  const start = config?.startFrame ?? first * win, end = config?.endFrame ?? (last + 1) * win;
  if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(overlap) ||
    start < 0 || end > full.length / channels || end - start <= overlap * 2) throw Error(`${id}: invalid loop bounds`);
  const samples = full.subarray(start * channels, end * channels);
  const frames = samples.length / channels, loop = new Float32Array((frames - overlap) * channels);
  // Circular overlap: tail -> head, then untouched middle. The playback wrap
  // continues from the middle into the tail with adjacent original samples.
  for (let i = 0; i < overlap; i++) {
    const w = .5 - .5 * Math.cos(Math.PI * i / (overlap - 1));
    for (let c = 0; c < channels; c++) loop[i * channels + c] =
      samples[(frames - overlap + i) * channels + c] * (1 - w) + samples[i * channels + c] * w;
  }
  loop.set(samples.subarray(overlap * channels, (frames - overlap) * channels), overlap * channels);
  // Four milliseconds at the wrap suppress codec boundary transients and AAC
  // padding clicks without an audible gap in the circular musical overlap.
  const edge = rate * .004;
  for (let i = 0; i < edge; i++) {
    const w = .5 - .5 * Math.cos(Math.PI * i / (edge - 1));
    for (let c = 0; c < channels; c++) {
      loop[i * channels + c] *= w;
      loop[loop.length - (i + 1) * channels + c] *= w;
    }
  }
  let pcm = Buffer.from(loop.buffer);
  if (config) {
    const measured = loudness(pcm);
    pcm = run([...pcmInput, '-af', `loudnorm=I=-22:TP=-3:LRA=20:linear=true:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}`,
      '-f', 'f32le', '-ar', String(rate), '-ac', '2', 'pipe:1'], pcm);
  }
  const duration = pcm.length / 4 / channels / rate;
  const track = { source, sourceSha256, ...(config ? { map: config.map, requestedBpm: config.requestedBpm, loopBars: config.loopBars } : {}),
    sourceDuration: full.length / channels / rate, trimmedStart: start / rate, trimmedEnd: (full.length / channels - end) / rate,
    loopStart: 0, loopEnd: duration, targetLufs: -22, truePeakCeilingDbtp: -3,
    tailStart: (frames - overlap) / rate, loopCrossfade: overlap / rate, boundaryFadeSeconds: .004, pcmSeam: seam(pcm) };
  for (const [key, ext, codec] of [['opus', 'ogg', 'libopus'], ['aac', 'm4a', 'aac']]) {
    // A seekable MP4 output preserves AAC encoder-delay/edit-list metadata.
    const temp = resolve(out, `.bgm-${id}-${process.pid}.${ext}`);
    let encoded;
    try {
      run([...pcmInput, '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', '-c:a', codec, '-b:a', '96k',
        ...(ext === 'ogg' ? ['-vbr', 'constrained'] : []),
        ...(ext === 'm4a' ? ['-movflags', '+faststart'] : ['-serial_offset', '0']), '-y', temp], pcm);
      encoded = readFileSync(temp);
    } finally { try { unlinkSync(temp); } catch {} }
    const hash = createHash('sha256').update(encoded).digest('hex').slice(0, 12);
    const name = `bgm-${id}-${hash}.${ext}`;
    writeFileSync(resolve(out, name), encoded);
    const decoded = run(['-i', resolve(out, name), '-f', 'f32le', '-ar', String(rate), '-ac', '2', 'pipe:1']);
    const decodedSeam = seam(decoded);
    if (!decodedSeam.passed) throw Error(`${name}: seam verification failed: ${JSON.stringify(decodedSeam)}`);
    const measured = loudness(decoded);
    if (Math.abs(Number(measured.input_i) + 22) > 1 || Number(measured.input_tp) > -2.8) throw Error(`${name}: loudness verification failed`);
    track[key] = { url: '/assets/audio/' + name, bytes: encoded.length, sizeKB: encoded.length / 1024,
      decodedDuration: decoded.length / channels / 4 / rate, seam: decodedSeam,
      lufs: Number(measured.input_i), truePeakDbtp: Number(measured.input_tp) };
  }
  if (!track.pcmSeam.passed) throw Error(`${id}: PCM seam verification failed`);
  manifest.tracks[id] = track;
}
writeFileSync(resolve(out, 'bgm.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
