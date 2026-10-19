"""Build the 8-direction hero walk atlas from the AutoSprite walk renders and pack it.

Bounded like `prepare-textures.py --hero-skill`: only hero-walk-v1 is written, and only its
entries in public/texture-manifest.json change. Sources are the committed AutoSprite renders in
output/swordsman-autosprite-walk-4dir-v1/<SE|SW|NE|NW>/ and output/swordsman-autosprite-walk-8dir-v1/<S|E|N|W>/
(autosprite-raw.png, 25 cells of 512 px each). Diagonals start from the game idle; cardinals start from
user-approved AutoSprite standing poses.

Each render starts and ends on its standing pose, with a short stand at both ends. The
walking span is [first, last) in 1-based render frames: `first` is the last standing frame
before the feet move, and `last` is the first standing frame after (it matches `first`). Eight
evenly spaced frames from that span loop back onto `first`. The transform is each direction's
shared scale/anchor from metadata.json, so the median height equals the 168 px idle, and feet
sit on (192,240) in 384x256 cells (2x: 768x512 for the atelier preview).

Usage: python -X utf8 meadow-3d/tools/pack-hero-walk.py   (TOKTX = path to toktx 4.4.2)
"""
from pathlib import Path
from PIL import Image
import json, hashlib, os, subprocess

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
RENDERS = {**{d: REPO / 'output/swordsman-autosprite-walk-4dir-v1' / d for d in ['SE', 'SW', 'NE', 'NW']},
           **{d: REPO / 'output/swordsman-autosprite-walk-8dir-v1' / d for d in ['S', 'E', 'N', 'W']}}
SRC = ROOT / 'art/texture-sources/hero-painted'
PUBLIC = ROOT / 'public'
DIRECTIONS = ['SE', 'SW', 'NE', 'NW', 'S', 'E', 'N', 'W']  # atlas row order = WALK_DIRECTIONS in src/sprite-animation.ts
SPAN = {'SE': (3, 23), 'SW': (2, 20), 'NE': (2, 21), 'NW': (2, 23), 'S': (2, 23), 'E': (3, 23), 'N': (4, 21), 'W': (4, 22)}
FRAMES = 8

def frames_for(direction):
    first, last = SPAN[direction]
    return [round(first + k * (last - first) / FRAMES) for k in range(FRAMES)]

def build(factor):
    cw, ch = 384 * factor, 256 * factor
    sheet = Image.new('RGBA', (cw * FRAMES, ch * len(DIRECTIONS)))
    for row, direction in enumerate(DIRECTIONS):
        meta = json.loads((RENDERS[direction] / 'metadata.json').read_text(encoding='utf-8'))
        raw = Image.open(RENDERS[direction] / 'autosprite-raw.png').convert('RGBA')
        cell, scale, (ax, ay) = meta['sourceCell'][0], meta['sharedScale'] * factor, meta['sourceAnchor']
        cols = raw.width // cell
        for column, number in enumerate(frames_for(direction)):
            i = number - 1
            frame = raw.crop(((i % cols) * cell, (i // cols) * cell, (i % cols + 1) * cell, (i // cols + 1) * cell))
            size = round(cell * scale)
            frame = frame.resize((size, size), Image.Resampling.LANCZOS)
            sheet.alpha_composite(frame, (column * cw + round(cw / 2 - ax * scale), row * ch + round(240 * factor - ay * scale)))
    return sheet

def versioned(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:10]
    out = path.with_name(f'{path.stem}-{digest}{path.suffix}')
    out.write_bytes(path.read_bytes()); path.unlink()
    return '/' + out.relative_to(PUBLIC).as_posix()

atlas, preview = build(1), build(2)
atlas.save(SRC / 'hero-walk-v1.png'); preview.save(SRC / 'preview/hero-walk-v1.png')
# Same rules as prepare-textures.py pack(): longest side <= 2048, multiples of 4; previews stay full size.
w, h = atlas.size; scale = min(1, 2048 / max(w, h)); size = (max(4, round(w * scale / 4) * 4), max(4, round(h * scale / 4) * 4))
shipped = atlas.resize(size, Image.Resampling.LANCZOS)
dest = PUBLIC / 'assets/hero-painted'
stage = REPO / '.codex-run/texture-inputs/hero-painted'; stage.mkdir(parents=True, exist_ok=True)
shipped.save(stage / 'hero-walk-v1.png')
shipped.save(dest / 'hero-walk-v1.webp', 'WEBP', quality=88, method=6, exact=True)
preview.save(dest / 'preview/hero-walk-v1.webp', 'WEBP', quality=88, method=6, exact=True)
toktx = os.environ.get('TOKTX') or str(REPO / '.codex-run/ktx-tools/extracted/bin/toktx.exe')
subprocess.run([toktx, '--t2', '--encode', 'uastc', '--assign_oetf', 'srgb', '--lower_left_maps_to_s0t0', '--threads', '1',
                '--uastc_quality', '3', '--uastc_rdo_l', '0.5', '--zcmp', '18', str(dest / 'hero-walk-v1.ktx2'), str(stage / 'hero-walk-v1.png')], check=True)
manifest_path = PUBLIC / 'texture-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for key in ['/assets/hero-painted/hero-walk-v1.png', '/assets/hero-painted/preview/hero-walk-v1.png']:
    for old in (manifest.get(key) or {}).values():
        if isinstance(old, str) and old.startswith('/assets/') and (PUBLIC / old[1:]).exists():
            (PUBLIC / old[1:]).unlink()
manifest['/assets/hero-painted/hero-walk-v1.png'] = {
    'webp': versioned(dest / 'hero-walk-v1.webp'), 'ktx2': versioned(dest / 'hero-walk-v1.ktx2'),
    'source': 'art/texture-sources/hero-painted/hero-walk-v1.png', 'size': list(size), 'originalSize': [w, h],
    'mode': 'uastc', 'mips': False, 'hitMask': None, 'cpu': False}
manifest['/assets/hero-painted/preview/hero-walk-v1.png'] = {
    'webp': versioned(dest / 'preview/hero-walk-v1.webp'), 'ktx2': None,
    'source': 'art/texture-sources/hero-painted/preview/hero-walk-v1.png', 'size': list(preview.size), 'originalSize': list(preview.size),
    'mode': 'uastc', 'mips': False, 'hitMask': None, 'cpu': True}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(json.dumps({d: frames_for(d) for d in DIRECTIONS}), atlas.size, size, preview.size)
