"""8-direction swordsman skill sheets (AutoSprite, approved 2026-10-20) and their packing.

Sources are the user-approved 25-frame renders, normalized with the approved SE transform
(game idle height 168 px / frame-1 height, frame-1 feet on the anchor) into one 25 x 8 atlas
per skill, rows SE SW NE NW S E N W. NW, W and SW endure are mirrors of NE, E and SE endure
(the renders AutoSprite made for those facings turned the wrong way).

`--select <dir>` reads <dir>/skill-<id>-8dir.png and keeps SKILL_FRAMES[id] frames per row,
placed by fraction of that row's own active span so the contact pose lands on CONTACT_FRAME
in every facing. Output: art/texture-sources/hero-skills-v2/hero-skill-<id>-v2.png + skills-v2.json.
Without arguments it packs those sources to public/ (webp + ktx2 + texture-manifest entries),
the same way pack-hero-walk.py does.

Usage: python -X utf8 meadow-3d/tools/pack-hero-skills-v2.py [--select <normalized dir>]
"""
from pathlib import Path
from PIL import Image
import numpy as np
import json, hashlib, os, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SRC = ROOT / 'art/texture-sources/hero-skills-v2'
PUBLIC = ROOT / 'public'
ROWS = ['SE', 'SW', 'NE', 'NW', 'S', 'E', 'N', 'W']  # = WALK_DIRECTIONS in src/sprite-animation.ts
# Cell size and feet anchor of each normalized atlas (game px, 1 px = HERO_PIXEL_METRES).
CELLS = {'slash': (384, 273, 240), 'whirlwind': (384, 266, 240), 'dash_strike': (384, 294, 240),
         'earth_break': (384, 346, 257), 'provoke': (384, 263, 240), 'endure': (384, 265, 243)}
# Kept frames as fractions of the active span, read off the approved SE row. Counts and the
# contact index match SKILL_FRAMES / CONTACT_FRAME in src/skill-motions.ts.
PICKS = {'slash': [.09, .27, .45, .64, .82, 1.0],
         'whirlwind': [.06, .12, .24, .35, .47, .59, .71, .88],
         'dash_strike': [0, .15, .38, .69, .92],
         'earth_break': [.10, .14, .19, .24, .33, .38, .48, .62, .86],
         'provoke': [.06, .18, .35, .59, .88],
         'endure': [.14, .24, .33, .48, .67]}

def active_span(frames):
    alpha = [np.asarray(f.resize((f.width // 4, f.height // 4)).getchannel('A'), dtype=float) / 255 for f in frames]
    diff = [np.abs(a - alpha[0]).mean() for a in alpha]
    moving = [i for i, d in enumerate(diff) if d > .2 * max(diff)]
    return moving[0], moving[-1]

def select(normalized):
    SRC.mkdir(parents=True, exist_ok=True)
    meta = {}
    for skill, fractions in PICKS.items():
        w, h, ay = CELLS[skill]
        atlas = Image.open(normalized / f'skill-{skill}-8dir.png').convert('RGBA')
        assert atlas.size == (w * 25, h * 8), (skill, atlas.size)
        out = Image.new('RGBA', (w * len(fractions), h * 8))
        meta[skill] = {'cell': [w, h], 'anchor': [w // 2, ay], 'frames': {}}
        for row, facing in enumerate(ROWS):
            frames = [atlas.crop((i * w, row * h, (i + 1) * w, (row + 1) * h)) for i in range(25)]
            a, b = active_span(frames)
            picked = [round(a + f * (b - a)) for f in fractions]
            meta[skill]['frames'][facing] = [i + 1 for i in picked]
            for col, i in enumerate(picked):
                out.alpha_composite(frames[i], (col * w, row * h))
        out.save(SRC / f'hero-skill-{skill}-v2.png')
    (SRC / 'skills-v2.json').write_text(json.dumps(meta, indent=1) + '\n', encoding='utf-8')
    print(json.dumps({k: v['frames']['SE'] for k, v in meta.items()}))

def versioned(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:10]
    out = path.with_name(f'{path.stem}-{digest}{path.suffix}')
    out.write_bytes(path.read_bytes()); path.unlink()
    return '/' + out.relative_to(PUBLIC).as_posix()

def pack():
    toktx = os.environ.get('TOKTX') or str(REPO / '.codex-run/ktx-tools/extracted/bin/toktx.exe')
    manifest_path = PUBLIC / 'texture-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    dest = PUBLIC / 'assets/hero-skills'
    stage = REPO / '.codex-run/texture-inputs/hero-skills'; stage.mkdir(parents=True, exist_ok=True)
    for skill in PICKS:
        name = f'hero-skill-{skill}-v2'
        atlas = Image.open(SRC / f'{name}.png').convert('RGBA')
        # Same rules as prepare-textures.py pack(): longest side <= 2048, multiples of 4.
        w, h = atlas.size; scale = min(1, 2048 / max(w, h))
        size = (max(4, round(w * scale / 4) * 4), max(4, round(h * scale / 4) * 4))
        shipped = atlas.resize(size, Image.Resampling.LANCZOS)
        shipped.save(stage / f'{name}.png')
        shipped.save(dest / f'{name}.webp', 'WEBP', quality=88, method=6, exact=True)
        subprocess.run([toktx, '--t2', '--encode', 'uastc', '--assign_oetf', 'srgb', '--lower_left_maps_to_s0t0', '--threads', '1',
                        '--uastc_quality', '3', '--uastc_rdo_l', '0.5', '--zcmp', '18', str(dest / f'{name}.ktx2'), str(stage / f'{name}.png')], check=True)
        key = f'/assets/hero-skills/{name}.png'
        for old in (manifest.get(key) or {}).values():
            if isinstance(old, str) and old.startswith('/assets/') and (PUBLIC / old[1:]).exists():
                (PUBLIC / old[1:]).unlink()
        manifest[key] = {'source': f'art/texture-sources/hero-skills-v2/{name}.png', 'size': list(size), 'originalSize': [w, h],
                         'mode': 'uastc', 'mips': False, 'cpu': False, 'hitMask': None,
                         'webp': versioned(dest / f'{name}.webp'), 'ktx2': versioned(dest / f'{name}.ktx2')}
        print(name, atlas.size, '->', size)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

if len(sys.argv) > 2 and sys.argv[1] == '--select':
    select(Path(sys.argv[2]))
else:
    pack()
