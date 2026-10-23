"""Base hero motions v2 (AutoSprite, user-approved 2026-10-20): attack, dodge, hit, idle, death, spin.

Rows SE SW NE NW like the v1 sheets. To keep the AutoSprite cost low (user decision):
  - attack, dodge, hit: SE and NE renders; SW and NW are their mirrors (sword in the left hand).
  - idle: the SE breathing loop (SW mirrored); NE / NW keep the still v1 idle pose.
  - death, spin: SE render for the front; original painted NE back poses (SW / NW mirrored).
Every render gets the approved transform: game idle height 168 px / frame-1 height, frame-1 feet on
the anchor. The cell grows (never the scale) so no frame is clipped.

`--select <se dir> <ne dir>` reads <se dir>/<motion>/autosprite-raw.png and <ne dir>/<motion>.png and
keeps MOTION_FRAMES frames per row (SE picks; NE picks at the same fractions of its own active span).
Output: art/texture-sources/hero-motions-v2/hero-<motion>-v2.png + motions-v2.json. Without arguments
it packs those sources into public/ (webp + ktx2 + texture-manifest entries).
"""
from pathlib import Path
from PIL import Image, ImageOps
import numpy as np
import json, hashlib, os, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SRC = ROOT / 'art/texture-sources/hero-motions-v2'
PUBLIC = ROOT / 'public'
ROWS = ['SE', 'SW', 'NE', 'NW']
HEIGHT = 168
# 1-based SE render frames kept per motion; counts match frameCount() in src/sprite-animation.ts
# (idle becomes an 8-frame loop).
PICKS = {'attack': [9, 11, 13, 14, 16, 19], 'dodge': [7, 10, 14], 'hit': [11, 13, 17],
         'death': [7, 9, 11, 13, 16, 22], 'spin': [6, 8, 10, 12, 15, 18], 'idle': [1, 4, 7, 10, 13, 16, 19, 22]}
SE_DIR = {'death': 'death-v2'}
NE_RENDER = {'attack', 'dodge', 'hit'}

def frames_of(path):
    raw = Image.open(path).convert('RGBA'); c = raw.width // 5
    return [raw.crop(((i % 5) * c, (i // 5) * c, (i % 5 + 1) * c, (i // 5 + 1) * c)) for i in range(25)]

def active_span(frames):
    alpha = [np.asarray(f.resize((f.width // 4, f.height // 4)).getchannel('A'), dtype=float) / 255 for f in frames]
    diff = [np.abs(a - alpha[0]).mean() for a in alpha]
    moving = [i for i, d in enumerate(diff) if d > .2 * max(diff)]
    return moving[0], moving[-1]

def placed(frames, picks):
    """Frames scaled to the approved height, as (image, anchor x, anchor y) in game px."""
    b0 = frames[0].getbbox(); s = HEIGHT / (b0[3] - b0[1]); ax, ay = (b0[0] + b0[2]) / 2, b0[3]
    out = []
    for i in picks:
        f = frames[i].resize((round(frames[i].width * s),) * 2, Image.Resampling.LANCZOS)
        out.append((f, ax * s, ay * s))
    return out

def select(se_root, ne_root):
    SRC.mkdir(parents=True, exist_ok=True)
    idle_v1 = Image.open(ROOT / 'art/texture-sources/hero-painted/hero-idle-v1.png').convert('RGBA')
    meta = {}
    for motion, picks in PICKS.items():
        se = frames_of(se_root / SE_DIR.get(motion, motion) / 'autosprite-raw.png')
        rows = {'SE': placed(se, [p - 1 for p in picks])}
        if motion in NE_RENDER:
            ne = frames_of(ne_root / f'{motion}.png')
            (a, b), (c, d) = active_span(se), active_span(ne)
            ne_picks = [min(24, max(0, round(c + (p - 1 - a) / max(1, b - a) * (d - c)))) for p in picks]
            rows['NE'] = placed(ne, ne_picks)
            meta.setdefault(motion, {})['neFrames'] = [i + 1 for i in ne_picks]
        elif motion == 'idle':
            cell = idle_v1.crop((2 * 384, 0, 3 * 384, 256))  # still v1 NE pose, already 168 px / feet at (192, 240)
            rows['NE'] = [(cell, 192, 240)] * len(picks)
        else:
            # The original painted strip has real back poses; never reuse the front-facing render here.
            back = Image.open(ROOT / f'art/texture-sources/hero-painted/hero-{motion}-v1.png').convert('RGBA')
            bw, bh = back.width // len(picks), back.height // 4
            rows['NE'] = [(back.crop((i*bw, 2*bh, (i+1)*bw, 3*bh)), bw/2, 240) for i in range(len(picks))]
            meta.setdefault(motion, {})['backSource'] = f'hero-{motion}-v1 NE; NW mirrored'
        if motion == 'idle':
            nw = [(idle_v1.crop((3 * 384, 0, 4 * 384, 256)), 192, 240)] * len(picks)
        else:
            nw = None
        # Cell big enough for every kept frame around a centred anchor.
        half, up, down = 192, 240, 16
        for row in rows.values():
            for f, ax, ay in row:
                b = f.getbbox()
                if b:
                    half = max(half, int(max(ax - b[0], b[2] - ax)) + 8); up = max(up, int(ay - b[1]) + 8); down = max(down, int(b[3] - ay) + 8)
        w, h = 2 * half, up + down
        sheet = Image.new('RGBA', (w * len(picks), h * 4))
        def cell_of(f, ax, ay):
            c = Image.new('RGBA', (w, h)); c.alpha_composite(f, (round(half - ax), round(up - ay))); return c
        for col in range(len(picks)):
            se_cell, ne_cell = cell_of(*rows['SE'][col]), cell_of(*rows['NE'][col])
            for r, cell in enumerate([se_cell, ImageOps.mirror(se_cell), ne_cell,
                                      cell_of(*nw[col]) if nw else ImageOps.mirror(ne_cell)]):
                sheet.alpha_composite(cell, (col * w, r * h))
        sheet.save(SRC / f'hero-{motion}-v2.png')
        meta.setdefault(motion, {}).update({'cell': [w, h], 'anchor': [half, up], 'frames': len(picks), 'seFrames': picks})
        print(motion, [w, h], [half, up])
    (SRC / 'motions-v2.json').write_text(json.dumps(meta, indent=1) + '\n', encoding='utf-8')

def versioned(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:10]
    out = path.with_name(f'{path.stem}-{digest}{path.suffix}')
    out.write_bytes(path.read_bytes()); path.unlink()
    return '/' + out.relative_to(PUBLIC).as_posix()

def pack():
    toktx = os.environ.get('TOKTX') or str(REPO / '.codex-run/ktx-tools/extracted/bin/toktx.exe')
    manifest_path = PUBLIC / 'texture-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    dest = PUBLIC / 'assets/hero-painted'
    stage = REPO / '.codex-run/texture-inputs/hero-painted'; stage.mkdir(parents=True, exist_ok=True)
    for motion in PICKS:
        name = f'hero-{motion}-v2'
        atlas = Image.open(SRC / f'{name}.png').convert('RGBA')
        w, h = atlas.size; scale = min(1, 2048 / max(w, h))
        size = (max(4, round(w * scale / 4) * 4), max(4, round(h * scale / 4) * 4))
        shipped = atlas.resize(size, Image.Resampling.LANCZOS)
        shipped.save(stage / f'{name}.png')
        shipped.save(dest / f'{name}.webp', 'WEBP', quality=88, method=6, exact=True)
        subprocess.run([toktx, '--t2', '--encode', 'uastc', '--assign_oetf', 'srgb', '--lower_left_maps_to_s0t0', '--threads', '1',
                        '--uastc_quality', '3', '--uastc_rdo_l', '0.5', '--zcmp', '18', str(dest / f'{name}.ktx2'), str(stage / f'{name}.png')], check=True)
        key = f'/assets/hero-painted/{name}.png'
        for old in (manifest.get(key) or {}).values():
            if isinstance(old, str) and old.startswith('/assets/') and (PUBLIC / old[1:]).exists():
                (PUBLIC / old[1:]).unlink()
        manifest[key] = {'webp': versioned(dest / f'{name}.webp'), 'ktx2': versioned(dest / f'{name}.ktx2'),
                         'source': f'art/texture-sources/hero-motions-v2/{name}.png', 'size': list(size), 'originalSize': [w, h],
                         'mode': 'uastc', 'mips': False, 'hitMask': None, 'cpu': False}
        print(name, atlas.size, '->', size)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

if len(sys.argv) > 3 and sys.argv[1] == '--select':
    select(Path(sys.argv[2]), Path(sys.argv[3]))
else:
    pack()
