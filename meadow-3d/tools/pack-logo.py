"""Package The Beginning Online artwork, preserving alpha and the existing app icon."""
from pathlib import Path
from PIL import Image, ImageOps
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'art/painted-brand/beginning-logo-source-v3.png'
OUT = ROOT / 'public/assets/brand'
logo = Image.open(SOURCE).convert('RGBA')
bounds = logo.getchannel('A').point(lambda a: 255 if a > 32 else 0).getbbox()
assert bounds, 'Logo must contain visible artwork'
logo = logo.crop(bounds)
for width in (512, 1024):
    logo.resize((width, round(logo.height * width / logo.width)), Image.Resampling.LANCZOS).save(
        OUT / f'logo-v3-{width}.webp', quality=95, method=6)

og = ImageOps.fit(Image.open(ROOT / 'public/assets/web/meadow-dawn-1600-v1.jpg').convert('RGBA'), (1200, 630))
og.alpha_composite(Image.new('RGBA', og.size, (10, 28, 25, 85)))
stamp = ImageOps.contain(logo, (960, 360), Image.Resampling.LANCZOS)
og.alpha_composite(stamp, ((1200-stamp.width)//2, (630-stamp.height)//2))
og.convert('RGB').save(OUT / 'og-image-v2.jpg', quality=85, optimize=True)

manifest_path = ROOT / 'public/site.webmanifest'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['name'] = 'The Beginning Online'
manifest['short_name'] = 'The Beginning'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Packaged logo v3 and social card v2; logo source {logo.width}x{logo.height}')
