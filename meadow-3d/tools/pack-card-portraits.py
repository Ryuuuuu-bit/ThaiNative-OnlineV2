"""Replace etched card symbols with normalized portraits from the game's idle sprites.

Run: python meadow-3d/tools/pack-card-portraits.py
Keeps the existing SVG frames and URLs; no generation service is called.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
import re

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'meadow-3d/public'
DEST = PUBLIC / 'assets/starter-loot'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def pack():
    items = read(ROOT / 'shared/data/items.json')['items']
    monsters = read(ROOT / 'shared/data/monsters.json')['monsters']
    textures = read(PUBLIC / 'texture-manifest.json')
    families = [(name, read(PUBLIC / f'assets/{name}/manifest.json')['species'])
                for name in ['monsters-expansion-v1', 'monsters-hunting', 'monsters-painted']]
    receipt = read(DEST / 'provenance.json')
    previous = {r['id'] for r in receipt.get('cardPortraitSources', [])}
    targets = [i for i in items if i['type'] == 'card'
               and (DEST / f'{i["icon"]}.svg').exists()
               and (i['id'] in previous or '<image' not in (DEST / f'{i["icon"]}.svg').read_text(encoding='utf-8'))]
    sources, previews = [], []
    for item in targets:
        owners = [m for m in monsters if any(d['item'] == item['id'] for d in m['drops'])]
        monster = next((m for m in owners if m['id'] == item['id'].removeprefix('card_')), owners[0])
        art = monster.get('artId', monster['id'])
        species = {'jelly_pink': 'slime', 'king_jelly': 'king', 'shade_wolf': 'wolf'}.get(art, art)
        family, definition = next((name, defs[art] if art in defs else defs[species])
                                  for name, defs in families if art in defs or species in defs)
        motion = definition['motions']['idle']
        key = f'/assets/{family}/{motion["file"]}'
        source = PUBLIC / textures.get(key, {}).get('webp', key).lstrip('/')
        bounds = motion['directions'][0][0]['bounds']
        with Image.open(source) as atlas:
            assert 0 <= bounds[0] < bounds[2] <= atlas.width, item['id']
            assert 0 <= bounds[1] < bounds[3] <= atlas.height, item['id']
            portrait = atlas.crop(bounds).convert('RGBA')
        assert portrait.getchannel('A').getbbox(), item['id']
        portrait.thumbnail((74, 74), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        portrait.save(buffer, format='PNG', optimize=True)
        encoded = base64.b64encode(buffer.getvalue()).decode('ascii')
        image = (f'<image x="{(96-portrait.width)/2:g}" y="{(96-portrait.height)/2:g}" '
                 f'width="{portrait.width}" height="{portrait.height}" href="data:image/png;base64,{encoded}"/>')
        path = DEST / f'{item["icon"]}.svg'
        svg, count = re.subn(r'<g\b[^>]*>.*?</g>|<image\b[^>]*/>', lambda _: image,
                             path.read_text(encoding='utf-8'), flags=re.DOTALL)
        assert count == 1, (item['id'], count)
        path.write_text(svg, encoding='utf-8', newline='\n')
        sources.append({'id': item['id'], 'file': path.name, 'monster': monster['id'],
                        'source': str(source.relative_to(ROOT)).replace('\\', '/'),
                        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                        'bounds': bounds, 'portraitSize': list(portrait.size),
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        previews.append((item['id'], portrait))
    receipt['cardPortraitMethod'] = 'Alpha crop of in-game idle sprites, normalized into existing original SVG frames; no new image generation.'
    receipt['cardPortraitSources'] = sources
    (DEST / 'provenance.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    out = ROOT / 'output/item-card-audit-20261023'
    out.mkdir(parents=True, exist_ok=True)
    sheet = Image.new('RGB', (896, ((len(previews)+7)//8)*150), '#243c3b')
    draw = ImageDraw.Draw(sheet)
    for n, (name, portrait) in enumerate(previews):
        x, y = n % 8*112, n//8*150
        draw.rounded_rectangle((x+6, y+5, x+94, y+93), radius=8, fill='#172c31', outline='#9dd9b8', width=2)
        sheet.paste(portrait, (x+(100-portrait.width)//2, y+49-portrait.height//2), portrait)
        draw.text((x+3, y+101), name.removeprefix('card_')[:17], fill='#eee0bd', font_size=9)
        small = portrait.copy()
        small.thumbnail((30, 30), Image.Resampling.LANCZOS)
        sheet.paste(small, (x+35, y+116), small)
    sheet.save(out / 'card-portraits.jpg', quality=92)
    print(f'Packed {len(sources)} card portraits; provenance: {DEST / "provenance.json"}')


if __name__ == '__main__':
    pack()
