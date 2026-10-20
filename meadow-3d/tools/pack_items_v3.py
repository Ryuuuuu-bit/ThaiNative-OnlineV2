"""Rebuild items-v2 preserving the fifteen approved cells exactly.

Run from any directory: python meadow-3d/tools/pack_items_v3.py
Generated panels and frozen approved RGBA cells live in art/painted-items-v3.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageChops
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from unparchment import clean_row

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/painted-items-v3'
OUT = ROOT / 'public/assets/items'
EVIDENCE = ROOT.parent / '.codex-run'
OLD = ['mist_spore', 'wolf_fur', 'wisp_tear', 'mist_wood', 'warden_heart']
NEW = ['stone_spore', 'relic_fang', 'rune_shard', 'ancient_vine', 'temple_seal',
       'ore_slime', 'crag_fur', 'amber_dust', 'crag_root', 'titan_core',
       'card_mist_warden', 'card_relic_warden', 'card_crag_titan']

# Interior only: all frame, shadow, placement and outer pixels come from v1.
TOP = 5
PANEL = [(17,TOP),(45,TOP),(48,TOP),(48,42),(44,47),(18,47),(14,42),(14,TOP)]

def card_template():
    # items-v1.webp is opaque (cards sit on parchment) while the bag shows items-v1-alpha.webp, so cut the card
    # silhouette out of the alpha atlas. The king card's crown covers its top border; take the top border
    # from the crownless jelly card instead.
    v1 = Image.open(OUT / 'items-v1.webp').convert('RGBA')
    alpha = Image.open(OUT / 'items-v1-alpha.webp').convert('RGBA').resize((320,320), Image.Resampling.LANCZOS)
    king = v1.crop((256,256,320,320))
    mask = alpha.crop((256,256,320,320)).getchannel('A')
    mask.paste(0, (0, 0, 64, 3))  # the king's crown above the frame
    king.putalpha(mask)
    # The crown also hid the top border: draw a 2 px gold rule in the frame's own side colours.
    gold = [king.getpixel((12, y)) for y in (24, 25)]
    for dy, colour in enumerate(gold):
        for x in range(12, 52):
            if mask.getpixel((x, 3 + dy)) > 0: king.putpixel((x, 3 + dy), colour[:3] + (mask.getpixel((x, 3 + dy)),))
    return king

def make_card(name):
    card = card_template()
    panel = Image.open(ART / f'{name}.png').convert('RGBA').resize((35,48), Image.Resampling.LANCZOS)
    insert = Image.new('RGBA', (64,64))
    insert.paste(panel, (14,0))
    mask = Image.new('L', (64,64))
    ImageDraw.Draw(mask).polygon(PANEL, fill=255)
    card.paste(insert, (0,0), mask)
    return card


def pack():
    EVIDENCE.mkdir(exist_ok=True)
    original = Image.open(ART / 'forest-original.png').convert('RGBA')
    assert original.size == (320, 64)
    # The forest five were painted on a parchment tile; cut it away so they sit on the bag like every other icon.
    original = clean_row(original)
    atlas = Image.new('RGBA', (320, 320))
    atlas.paste(original, (0, 0))
    approved = Image.open(ART / 'approved-slots-0-14.png').convert('RGBA')
    assert approved.size == (320,192)
    approved.paste(original, (0, 0))
    atlas.paste(approved, (0,0))
    frames, records = {}, []
    for slot, name in enumerate(OLD + NEW):
        x, y = slot % 5 * 64, slot // 5 * 64
        if slot >= 15:
            atlas.paste(make_card(name), (x,y))
        frames[name] = dict(index=25+slot, slot=slot, x=x, y=y, w=64, h=64)
    # Lossless + exact preserves RGBA bytes, including hidden RGB in original cells.
    atlas.save(OUT / 'items-v2.webp', lossless=True, exact=True, method=6)
    decoded = Image.open(OUT / 'items-v2.webp').convert('RGBA')
    assert decoded.crop((0, 0, 320, 64)).tobytes() == original.tobytes()
    assert decoded.crop((0,0,320,192)).tobytes() == approved.tobytes()
    outside = Image.new('L',(64,64),255)
    ImageDraw.Draw(outside).polygon(PANEL,fill=0)
    for slot in range(15,18):
        cell = decoded.crop(((slot%5)*64,192,(slot%5+1)*64,256))
        diff = ImageChops.difference(cell, card_template())
        assert all(ImageChops.multiply(c,outside).getbbox() is None for c in diff.split())
    for slot in range(18, 25):
        x, y = slot % 5 * 64, slot // 5 * 64
        assert decoded.crop((x,y,x+64,y+64)).getchannel('A').getextrema() == (0,0)
    manifest = dict(version=2, image='items-v2.webp', width=320, height=320,
                    cellSize=[64,64], columns=5, rows=5, reservedTransparentSlots=7, frames=frames)
    (OUT / 'items-v2.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    preview = Image.new('RGB', (720, 396), '#294a42')
    draw = ImageDraw.Draw(preview)
    for slot, name in enumerate(OLD + NEW):
        frame = frames[name]
        x,y = frame['x'],frame['y']
        cell = decoded.crop((x,y,x+64,y+64))
        cell_path = EVIDENCE / f'items-v3-{name}.png'
        cell.save(cell_path, optimize=True)
        bounds = cell.getchannel('A').getbbox()
        clipped = bool(bounds and (bounds[0]==0 or bounds[1]==0 or bounds[2]==64 or bounds[3]==64))
        records.append(dict(id=name, slot=slot, sourceBytes=(ART/f'{name}.png').stat().st_size if slot>=5 else None,
                            cellPngBytes=cell_path.stat().st_size, alphaBounds=bounds, clippingAtCellEdge=clipped))
        px,py = slot%6*120,slot//6*132
        preview.paste(cell, (px+28,py+14),cell)
        draw.text((px+60,py+93),name,fill='#e6d2a5',anchor='mm',font_size=10)
    preview.save(EVIDENCE/'items-v3-preview.jpg',quality=95)
    comparison = Image.new('RGB', (560,216), '#294a42')
    cd = ImageDraw.Draw(comparison)
    v1 = Image.open(OUT/'items-v1.webp').convert('RGBA')
    cards = [v1.crop((192,256,256,320)), card_template()] + [make_card(n) for n in NEW[-3:]]
    labels = ['jelly pink','king jelly','mist warden','relic warden','crag titan']
    for i, (card,label) in enumerate(zip(cards,labels)):
        cd.text((i*112+56,12),label,fill='#e6d2a5',anchor='mt',font_size=11)
        for size,y in [(40,42),(64,116)]:
            reduced=card.resize((size,size),Image.Resampling.LANCZOS)
            comparison.paste(reduced,(i*112+(112-size)//2,y),reduced)
    cd.text((8,90),'40 px',fill='#e6d2a5')
    cd.text((8,192),'64 px',fill='#e6d2a5')
    comparison.save(EVIDENCE/'items-v3-cards-40px.png')
    report = dict(atlasBytes=(OUT/'items-v2.webp').stat().st_size, icons=records,
                  preservedForestRGBA=hashlib.sha256(original.tobytes()).hexdigest(),
                  originalFivePixelIdentical=True, reservedTransparentSlots=7,
                  slots0Through14PixelIdentical=True,
                  approvedSlotsRGBA=hashlib.sha256(approved.tobytes()).hexdigest(),
                  cardTemplate='items-v1 card_king_jelly, unchanged pixels outside interior polygon',
                  cardInteriorPolygon=PANEL,
                  cardFramePixelsIdentical=True,
                  edgeContactNote='Boss cards inherit the king card parchment and top-edge contact exactly; original forest edge contacts also retained.',
                  reservedSlotsAlphaZero=True, generation='built-in image_gen',
                  clippingWarnings=[r['id'] for r in records if r['clippingAtCellEdge']])
    (EVIDENCE/'items-v3-report.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    pack()
