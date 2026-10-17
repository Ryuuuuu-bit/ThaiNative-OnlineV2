"""Build a self-contained A/B page for the combat hit SFX: python meadow-3d/tools/sfx-review.py [old-rev]

Cuts each hit sprite out of the packed Opus files at <old-rev> (default: main) and in the
working tree, measures peak / LUFS / spectral balance, and embeds both as data URIs in
meadow-3d/art/sfx-review.html, which opens straight from disk (file://).
"""
import base64, html, json, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
FF = subprocess.run(['node', '-p', "require('ffmpeg-static')"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
AUDIO = 'meadow-3d/public/assets/audio'
# Monster hits are layered (weapon thock + species material); older builds played jelly_hit for every monster.
HITS = {'hit_slime': 'mat_jelly', 'hit_wolf': 'mat_fur', 'hit_stump': 'mat_wood', 'hit_shroom': 'mat_shroom', 'hit_wisp': 'mat_wisp'}
IDS = [*HITS, 'crit', 'combo1', 'combo2', 'combo3', 'slash', 'whirlwind', 'earth_break']
R = 48000


def read(rev, rel):
    if rev is None: return (ROOT / rel).read_bytes()
    return subprocess.run(['git', 'show', f'{rev}:{rel}'], cwd=ROOT, capture_output=True, check=True).stdout


def clips(rev):
    man = json.loads(read(rev, AUDIO + '/sprites.json')); cache = {}; out = {}
    def cut(i):
        s = man['sounds'][i]; g = s['group']
        if g not in cache:
            data = read(rev, AUDIO + '/' + man['groups'][g]['opus']['url'].split('/')[-1])
            cache[g] = np.frombuffer(subprocess.run([FF, '-v', 'error', '-i', 'pipe:0', '-f', 'f32le', '-ac', '1', '-ar', str(R), '-'], input=data, capture_output=True, check=True).stdout, np.float32)
        return cache[g][int(s['start'] * R):int((s['start'] + s['duration']) * R)]
    for i in IDS:
        layers = ([i] if i in man['sounds'] else ['hit_thock', HITS[i]] if 'hit_thock' in man['sounds'] else ['jelly_hit'])
        parts = [cut(l) for l in layers]; mix = np.zeros(max(len(p) for p in parts), np.float32)
        for p in parts: mix[:len(p)] += p
        out[i] = mix
    return out


def metrics(x):
    x64 = x.astype(np.float64)
    rep = np.tile(x, max(1, int(np.ceil(R * 3 / len(x)))))
    err = subprocess.run([FF, '-hide_banner', '-f', 'f32le', '-ar', str(R), '-ac', '1', '-i', '-', '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], input=rep.tobytes(), capture_output=True).stderr.decode()
    X = np.abs(np.fft.rfft(x64 * np.hanning(len(x64)))) ** 2; f = np.fft.rfftfreq(len(x64), 1 / R); t = X.sum()
    band = lambda lo, hi: round(10 * np.log10(X[(f >= lo) & (f < hi)].sum() / t + 1e-12), 1)
    return {'peak dBFS': round(20 * np.log10(np.abs(x64).max() + 1e-12), 1), 'LUFS': float(json.loads(err[err.rfind('{'):])['input_i']),
            'centroid Hz': int((f * X).sum() / t), '2-6 kHz share dB': band(2000, 6000), '>6 kHz share dB': band(6000, 24000), 'length s': round(len(x) / R, 3)}


def encode(x):
    data = subprocess.run([FF, '-v', 'error', '-f', 'f32le', '-ar', str(R), '-ac', '1', '-i', '-', '-c:a', 'libopus', '-b:a', '96k', '-f', 'ogg', '-'], input=x.tobytes(), capture_output=True, check=True).stdout
    return 'data:audio/ogg;base64,' + base64.b64encode(data).decode()


rev = sys.argv[1] if len(sys.argv) > 1 else 'main'
old, new = clips(rev), clips(None)
rows, sounds = [], {}
for i in IDS:
    a, b = metrics(old[i]), metrics(new[i])
    sounds[i] = {'old': encode(old[i]), 'new': encode(new[i])}
    cells = ''.join(f'<td>{a[k]}</td><td class=n>{b[k]}</td>' for k in a)
    rows.append(f'<tr><th>{i}</th><td><button data-id={i} data-v=old>เดิม</button> <button data-id={i} data-v=new class=n>ใหม่</button></td>{cells}</tr>')
heads = ''.join(f'<th colspan=2>{html.escape(k)}<br><small>เดิม / ใหม่</small></th>' for k in metrics(new[IDS[0]]))
page = f'''<!doctype html><meta charset=utf-8><title>Hit SFX A/B</title>
<style>body{{font:14px system-ui;margin:16px;background:#14161a;color:#e8e8e8}}table{{border-collapse:collapse}}td,th{{padding:4px 8px;border-bottom:1px solid #333;text-align:right}}
th:first-child{{text-align:left}}.n{{color:#9fe0a8}}button{{font:inherit;padding:4px 10px;border-radius:6px;border:1px solid #555;background:#23262c;color:inherit;cursor:pointer}}
button.n{{border-color:#4c8a57}}section{{margin:18px 0}}</style>
<h1>เสียงตีมอนสเตอร์: เดิม vs ใหม่</h1>
<p>hit_* = เสียงตีแต่ละชนิดมอนสเตอร์ (ใหม่: ทุกครั้งที่ตีมีเสียงอาวุธกระทบสั้นๆ แห้งๆ สไตล์ RO / ToS + เสียงเนื้อวัสดุของมอน เช่น วุ้นเป็นเสียง &quot;บล็อป&quot; เด้งๆ ไม่ใช่เสียงน้ำ — เดิมใช้ jelly_hit เสียงเดียวกับทุกมอน)</p>
<p>เทียบ <code>{html.escape(rev)}</code> กับไฟล์ปัจจุบัน ผ่านสาย SFX bus เดียวกับในเกม (shelf −5 dB @4.5 kHz, lowpass 9.5 kHz, glue compressor)</p>
<section><b>ตีรัว (จำลอง Whirlwind / ตีหลายตัว):</b>
<button id=rapidOld>เดิม: 8 hits ทุก 60 ms</button> <button id=rapidNew class=n>ใหม่: 8 hits ทุก 60 ms</button>
<button id=comboOld>เดิม: combo 1-2-3 + hit</button> <button id=comboNew class=n>ใหม่: combo 1-2-3 + hit</button></section>
<table><tr><th>เสียง</th><th>ฟัง</th>{heads}</tr>{''.join(rows)}</table>
<script>
const S={json.dumps(sounds)};
let ctx,bus,buf={{}};
async function init(){{if(ctx)return;ctx=new AudioContext();const glue=ctx.createDynamicsCompressor();glue.threshold.value=-20;glue.knee.value=14;glue.ratio.value=3;glue.attack.value=.012;glue.release.value=.3;
const sh=ctx.createBiquadFilter();sh.type='highshelf';sh.frequency.value=4500;sh.gain.value=-5;const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=9500;lp.Q.value=.5;
bus=ctx.createGain();bus.gain.value=.72;bus.connect(sh);sh.connect(lp);lp.connect(glue);glue.connect(ctx.destination);
for(const[id,v]of Object.entries(S))for(const k of['old','new'])buf[id+k]=await ctx.decodeAudioData(await (await fetch(v[k])).arrayBuffer());}}
const recent={{}},last={{}},ends={{}};
function play(id,v,at){{const now=at??ctx.currentTime,s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buf[id+v];
if(v==='old'){{if(now-(last[id+v]??-1)<.04)return;s.playbackRate.value=1+(Math.random()*2-1)*.04;g.gain.value=Math.pow(10,(Math.random()*2-1)/20);}}
else{{const cd=id.startsWith('hit_')?.05:id==='crit'?.1:.04;if(now-(last[id+v]??-1)<cd)return;const r=(recent[id]=(recent[id]??[]).filter(t=>now-t<.25));r.push(now);
s.playbackRate.value=1+(Math.random()*2-1)*.05;const lv=Math.pow(10,(Math.random()*2-1)/20)/(1+.35*(r.length-1));g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(lv,now+.005);}}
const e=(ends[id+v]=(ends[id+v]??[]).filter(t=>t>now));if(id.startsWith('hit_')&&e.length>=3)return;e.push(now+s.buffer.duration/s.playbackRate.value);
last[id+v]=now;s.connect(g);g.connect(bus);s.start(now);}}
document.querySelectorAll('button[data-id]').forEach(b=>b.onclick=async()=>{{await init();play(b.dataset.id,b.dataset.v);}});
const rapid=v=>async()=>{{await init();const t=ctx.currentTime+.05;for(let i=0;i<8;i++)play('hit_slime',v,t+i*.06);}};
const combo=v=>async()=>{{await init();const t=ctx.currentTime+.05;['combo1','combo2','combo3'].forEach((c,i)=>{{play(c,v,t+i*.45);play('hit_slime',v,t+i*.45+.12);}});play('crit',v,t+.9+.12);}};
rapidOld.onclick=rapid('old');rapidNew.onclick=rapid('new');comboOld.onclick=combo('old');comboNew.onclick=combo('new');
</script>'''
out = ROOT / 'meadow-3d/art/sfx-review.html'
out.write_text(page, encoding='utf-8')
print(out, f'{out.stat().st_size // 1024} KiB')
