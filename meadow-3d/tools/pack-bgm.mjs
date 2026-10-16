import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/assets/audio');
const rate = 48000, channels = 2, overlap = rate * 1.5;
mkdirSync(out, { recursive: true });
function run(args, input) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostdin', ...args],
    { input, maxBuffer: 128 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw Error(result.stderr?.toString() || 'ffmpeg failed');
  return result.stdout;
}
const pcmInput = ['-f', 'f32le', '-ar', String(rate), '-ac', '2', '-i', 'pipe:0'];
function seam(pcm) {
  const a = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
  let jump = 0, maxStep = 0;
  for (let c = 0; c < channels; c++) jump = Math.max(jump, Math.abs(a[c] - a[a.length - channels + c]));
  for (let i = channels; i < a.length; i++) maxStep = Math.max(maxStep, Math.abs(a[i] - a[i - channels]));
  return { wrapJump: jump, maxAdjacentStep: maxStep, passed: jump < .02 && jump <= maxStep };
}
const manifest = { version: 1, sampleRate: rate, channels, tracks: {} };
for (const id of ['city', 'meadow', 'king']) {
  const source = `art/bgm-source/bgm_${id}.mp3`;
  const data = run(['-i', resolve(root, source), '-af', 'loudnorm=I=-20:TP=-2:LRA=11',
    '-f', 'f32le', '-ar', String(rate), '-ac', '2', 'pipe:1']);
  const samples = new Float32Array(data.buffer, data.byteOffset, data.length / 4);
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
  const pcm = Buffer.from(loop.buffer), duration = loop.length / channels / rate;
  const track = { source, sourceDuration: frames / rate, loopStart: 0, loopEnd: duration,
    tailStart: (frames - overlap) / rate, loopCrossfade: 1.5, boundaryFadeSeconds: .004, pcmSeam: seam(pcm) };
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
    track[key] = { url: '/assets/audio/' + name, bytes: encoded.length, sizeKB: encoded.length / 1024,
      decodedDuration: decoded.length / channels / 4 / rate, seam: decodedSeam };
  }
  if (!track.pcmSeam.passed) throw Error(`${id}: PCM seam verification failed`);
  manifest.tracks[id] = track;
}
writeFileSync(resolve(out, 'bgm.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest, null, 2));
