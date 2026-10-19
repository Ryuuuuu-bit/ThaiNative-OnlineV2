"""Package approved ImageGen artwork; resample only, preserving logo alpha."""
from pathlib import Path
from PIL import Image
import argparse
import shutil

parser = argparse.ArgumentParser()
parser.add_argument('--logo', required=True)
parser.add_argument('--icon', required=True)
args = parser.parse_args()
destination = Path(__file__).resolve().parents[1] / 'meadow-3d/public/assets/brand'
shutil.copyfile(args.logo, destination / 'logo-v2-source.png')
shutil.copyfile(args.icon, destination / 'logo-mark-v2-source.png')
logo = Image.open(args.logo).convert('RGBA')
logo = logo.crop(logo.getchannel('A').getbbox())
logo.save(destination / 'logo-v2.png', optimize=True)
for width in (512, 1024):
    height = round(logo.height * width / logo.width)
    logo.resize((width, height), Image.Resampling.LANCZOS).save(
        destination / f'logo-v2-{width}.webp', quality=95, method=6)
icon = Image.open(args.icon).convert('RGB')
assert icon.width == icon.height, 'App icon must be square'
for size in (16, 32, 48, 180, 192, 512):
    icon.resize((size, size), Image.Resampling.LANCZOS).save(
        destination / f'icon-v2-{size}.png', optimize=True)
icon.resize((256, 256), Image.Resampling.LANCZOS).save(
    destination / 'favicon-v2.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
print(f'Logo: {logo.width}x{logo.height}; transparent PNG + 512/1024 WebP; favicon ICO + six PNG sizes')
