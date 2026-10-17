// Original, procedurally designed hit layers (RO / Tree of Savior feel: short, dry, mid-range).
// Every hit = one weapon "thock" + one small material layer chosen by monster species.
// Writes 32-bit float WAVs to art/sfx-source/synth/; pack-audio.mjs normalises and packs them.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rate = 48000, out = resolve(dirname(fileURLToPath(import.meta.url)), '../art/sfx-source/synth');
mkdirSync(out, { recursive: true });
let seed = 0x5eed;
const noise = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;
/** One-pole lowpass state factory. */
const lp = hz => { const a = Math.exp(-2 * Math.PI * hz / rate); let y = 0; return x => (y = (1 - a) * x + a * y); };
/** Two cascaded poles: noise layers lose their hiss faster. */
const lp2 = hz => { const a = lp(hz), b = lp(hz); return x => b(a(x)); };
const swell = (t, d = .003) => t < d ? .5 - .5 * Math.cos(Math.PI * t / d) : 1;

function render(name, seconds, voice) {
  const n = Math.round(seconds * rate), x = new Float32Array(n);
  let phase = [0, 0, 0, 0];
  const osc = (i, hz) => Math.sin(phase[i] += 2 * Math.PI * hz / rate);
  for (let i = 0; i < n; i++) { const t = i / rate; x[i] = Math.tanh(1.2 * swell(t) * voice(t, osc)) / Math.tanh(1.2); }
  const tail = Math.round(.02 * rate);
  for (let i = 0; i < tail; i++) x[n - 1 - i] *= i / tail;
  const wav = Buffer.alloc(44 + n * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(3, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28);
  wav.writeUInt16LE(4, 32); wav.writeUInt16LE(32, 34); wav.write('data', 36); wav.writeUInt32LE(n * 4, 40);
  Buffer.from(x.buffer).copy(wav, 44);
  writeFileSync(resolve(out, name + '.wav'), wav);
}

{ // Weapon contact: a rounded wooden-ish "tok" - pitched body plus a brief, low-passed tick.
  const hi = lp2(2200), lo = lp(500);
  render('hit_thock', .13, (t, osc) => {
    const s = noise(), tick = (hi(s) - lo(s)) * Math.exp(-t / .01);
    return .85 * osc(0, 150 + 110 * Math.exp(-t / .014)) * Math.exp(-t / .042) + .9 * tick;
  });
}
{ // Jelly / slime: a gel "blop" - the pitch rises like a popping bubble and wobbles; no splashy hiss.
  const wet = lp2(1400);
  render('mat_jelly', .19, (t, osc) => {
    const hz = 230 + 300 * (1 - Math.exp(-t / .018)) - 60 * Math.max(0, t - .05) / .14;
    const wobble = 1 - .28 * Math.sin(2 * Math.PI * 19 * t);
    return .9 * osc(0, hz) * Math.exp(-t / .055) * wobble + .12 * osc(1, hz * 2.01) * Math.exp(-t / .03)
      + .35 * wet(noise()) * Math.exp(-t / .006);
  });
}
{ // Fur / beast: a muffled body thud.
  const fur = lp2(650);
  render('mat_fur', .11, (t, osc) => 2.4 * fur(noise()) * Math.exp(-t / .028) + .55 * osc(0, 115 - 30 * t / .11) * Math.exp(-t / .04));
}
{ // Wood / stump / warden: a hollow knock from three damped modes.
  const tick = lp(3000);
  render('mat_wood', .17, (t, osc) => .7 * osc(0, 380) * Math.exp(-t / .06) + .3 * osc(1, 985) * Math.exp(-t / .024)
    + .12 * osc(2, 1720) * Math.exp(-t / .011) + .25 * tick(noise()) * Math.exp(-t / .004));
}
{ // Mushroom: a soft spongy puff.
  const puff = lp2(900);
  render('mat_shroom', .15, (t, osc) => 2 * puff(noise()) * Math.exp(-t / .045) + .5 * osc(0, 260 - 80 * t / .15) * Math.exp(-t / .05));
}
{ // Wisp: a breathy, glassy shimmer kept low and warm.
  const air = lp2(1500);
  render('mat_wisp', .23, (t, osc) => .45 * osc(0, 660) * Math.exp(-t / .09) + .22 * osc(1, 990) * Math.exp(-t / .05)
    + .9 * air(noise()) * Math.exp(-t / .06));
}
console.log('wrote', out);
