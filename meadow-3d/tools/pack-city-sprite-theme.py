"""Pack the approved four-view city sheets without changing their artwork."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'meadow-3d/art/city-sprite-v2'
OUTPUT = ROOT / 'meadow-3d/public/assets/city-sprite-v2'
LABELS = {
    'cottage': 'บ้านชาวเมือง', 'townhouse': 'บ้านพ่อค้า', 'inn': 'โรงเตี๊ยม',
    'market': 'ร้านเสบียง', 'forge': 'โรงตีเหล็ก', 'guild': 'สมาคมนักผจญภัย',
    'clocktower': 'หอนาฬิกา', 'fountain': 'น้ำพุธาราจันทร์', 'chapel': 'วิหาร',
    'gazebo': 'ศาลาสวน', 'wall': 'กำแพงเมือง', 'watchtower': 'หอคอยกำแพง',
    'gate': 'ประตูเมือง', 'booth': 'ป้อมยาม', 'lamp': 'เสาไฟ', 'banner': 'ธงประดับ',
    'dummy': 'หุ่นฝึก', 'flowerbed': 'แปลงดอกไม้', 'table': 'โต๊ะพักนักผจญภัย',
    'stall': 'แผงขายของ', 'notice': 'กระดานประกาศ', 'wagon': 'เกวียนคาราวาน',
    'anvil': 'ทั่งตีเหล็ก', 'barrels': 'ถังไม้', 'bench': 'ม้านั่ง', 'hay': 'กองฟาง',
    'crates': 'ลังเสบียง', 'well': 'บ่อน้ำ', 'portal': 'วงแหวนวาร์ป', 'marker': 'เสาหินนำทาง',
    'warp-core': 'แกนวาร์ปทางออกเมือง',
    'tree-flowering': 'ต้นไม้ดอก', 'tree-tall': 'ต้นไม้สูง', 'tree-round': 'ต้นไม้ทรงกลม',
    'bush-flowering': 'พุ่มไม้ดอก', 'flowers-lavender': 'กอลาเวนเดอร์',
    'flowers-white': 'ดอกไม้สีขาว', 'grass-2': 'กอหญ้า',
    'npc-clerk': 'คนเฝ้าคลัง', 'npc-blacksmith': 'ช่างตีเหล็ก', 'npc-merchant': 'พ่อค้า',
    'npc-healer': 'ผู้รักษา', 'npc-guard': 'ทหารยาม', 'npc-angel': 'ทูตสวรรค์',
}
# These complete drawings cross the sheet's nominal midlines; retain their actual extents.
VIEW_REGIONS = {
    'inn': [(58, 52, 516, 480), (543, 47, 986, 482), (65, 528, 497, 950), (548, 538, 978, 960)],
    'watchtower': [(110, 28, 461, 498), (586, 39, 945, 516), (98, 525, 449, 985), (615, 525, 968, 988)],
    'notice': [(106, 39, 463, 516), (562, 38, 922, 515), (101, 526, 460, 987), (565, 526, 925, 986)],
}
VIEW_ORDERS = {family: (0, 1, 2, 3) for family in (
    'clocktower', 'chapel', 'gazebo', 'watchtower', 'wall', 'gate', 'notice',
    'bench', 'wagon', 'stall', 'banner', 'anvil', 'lamp', 'portal',
)}


def views_of(image, regions=None):
    assert image.width == image.height and image.width % 2 == 0, 'Expected square 2x2 sheet'
    half = image.width // 2
    custom_regions = regions is not None
    if regions is None:
        regions = [(x, y, x + half, y + half) for y in (0, half) for x in (0, half)]
    assert len(regions) == 4, 'Expected four facing regions'
    coverage = Image.new('1', image.size)
    coverage_draw = ImageDraw.Draw(coverage)
    views = []
    for x, y, end_x, end_y in regions:
        assert 0 <= x < end_x <= image.width and 0 <= y < end_y <= image.height, 'Facing region exceeds the sheet'
        alpha = image.crop((x, y, end_x, end_y)).getchannel('A')
        bounds = alpha.point(lambda value: 255 if value >= 16 else 0).getbbox()
        assert bounds, 'Missing facing image'
        left, top, right, bottom = bounds
        if not custom_regions:
            assert left >= 1 and top >= 1 and right <= half - 1 and bottom <= half - 1, 'Facing touches a cell border'
        assert (right - left) * (bottom - top) > half * half * .015, 'Facing is too small'
        left, top, right, bottom = x + left, y + top, x + right, y + bottom
        assert left > 0 and top > 0 and right < image.width and bottom < image.height, 'Facing is clipped by the sheet'
        left, top = max(0, left - 2), max(0, top - 2)
        right, bottom = min(image.width, right + 2), min(image.height, bottom + 2)
        for previous in views:
            px, py, pw, ph = previous['rect']
            assert right <= px or left >= px + pw or bottom <= py or top >= py + ph, 'Facing crops overlap'
        coverage_draw.rectangle((left, top, right - 1, bottom - 1), fill=1)
        views.append({'rect': [left, top, right - left, bottom - top], 'anchor': [.5, 1]})
    alpha_mask = image.getchannel('A').point(lambda value: 255 if value >= 16 else 0)
    assert not ImageChops.subtract(alpha_mask, coverage.convert('L')).getbbox(), 'Facing crops omit artwork'
    return views


def self_check():
    image = Image.new('RGBA', (128, 128))
    draw = ImageDraw.Draw(image)
    for y in (0, 64):
        for x in (0, 64):
            draw.rectangle((x + 12, y + 10, x + 48, y + 53), fill='white')
    views = views_of(image)
    assert views[0]['rect'] == [10, 8, 41, 48]
    assert views[3]['rect'] == [74, 72, 41, 48]
    overflow = Image.new('RGBA', (128, 128))
    draw = ImageDraw.Draw(overflow)
    for box in [(12, 10, 67, 53), (78, 10, 114, 53), (12, 74, 48, 117), (78, 74, 114, 117)]:
        draw.rectangle(box, fill='white')
    regions = [(12, 10, 68, 54), (78, 10, 115, 54), (12, 74, 49, 118), (78, 74, 115, 118)]
    try:
        views_of(overflow)
    except AssertionError:
        pass
    else:
        raise AssertionError('Quadrant slicing must reject an object crossing its midline')
    assert views_of(overflow, regions)[0]['rect'] == [10, 8, 60, 48]
    draw.rectangle((70, 15, 72, 17), fill='white')
    try:
        views_of(overflow, regions)
    except AssertionError:
        pass
    else:
        raise AssertionError('Artwork outside the supplied regions must be rejected')
    try:
        views_of(Image.new('RGBA', (128, 128)))
    except AssertionError:
        pass
    else:
        raise AssertionError('Empty sheets must be rejected')


def main():
    self_check()
    jobs = json.loads((SOURCE / 'generation-prompts.json').read_text(encoding='utf-8'))['jobs']
    names = ['cottage'] + [job['family'] for job in jobs] + ['warp-core']
    missing = [name for name in names if not (SOURCE / f'{name}.png').is_file()]
    assert not missing, 'Missing approved sheets: ' + ', '.join(missing)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {'version': 1, 'name': 'นครหินเถ้า · ชุด Sprite ดำ', 'assets': {}, 'ground': {}}
    previews = []
    for name in names:
        source = Image.open(SOURCE / f'{name}.png').convert('RGBA')
        size = 512 if name.startswith('ground-') else 1024
        image = source.resize((size, size), Image.Resampling.LANCZOS)
        if name.startswith('ground-'):
            assert image.getchannel('A').getextrema() == (255, 255), 'Ground must be opaque'
            image.convert('RGB').save(OUTPUT / f'{name}.webp', quality=92, method=6)
            manifest['ground'][name.removeprefix('ground-')] = f'/assets/city-sprite-v2/{name}.webp'
            continue
        assert image.getchannel('A').getextrema()[0] == 0, 'Sprite sheet needs transparency'
        # Camera-corner sheets put the opposite ground axis in the bottom-left cell.
        raw_views = views_of(image, VIEW_REGIONS.get(name))
        views = [raw_views[index] for index in VIEW_ORDERS.get(name, (0, 1, 3, 2))]
        image.save(OUTPUT / f'{name}.webp', lossless=True, method=6)
        manifest['assets'][name] = {'label': LABELS[name], 'image': f'/assets/city-sprite-v2/{name}.webp', 'views': views}
        previews.append((name, image))
    assert len(manifest['assets']) == 44 and len(manifest['ground']) == 3
    # The contact sheets expose clipping, mismatched perspective and style drift for review.
    for page in range((len(previews) + 9) // 10):
        sheet = Image.new('RGB', (1000, 440), '#25312c')
        draw = ImageDraw.Draw(sheet)
        for index, (name, image) in enumerate(previews[page * 10:(page + 1) * 10]):
            x, y = index % 5 * 200, index // 5 * 220
            thumb = image.copy(); thumb.thumbnail((190, 190), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x + 5, y + 22), thumb)
            draw.text((x + 7, y + 5), name, fill='#e5ddc4')
        sheet.save(SOURCE / f'contact-{page + 1}.jpg', quality=93)
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Packed 44 sprite families / 176 views and 3 ground textures')


if __name__ == '__main__':
    main()
