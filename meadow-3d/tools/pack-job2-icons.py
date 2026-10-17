"""Assemble the single 24-cell atlas; preserve the first-job runtime pixels."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
art = ROOT / 'art/skills'
old = Image.open(art / 'skills-v1.png').convert('RGBA').resize((256, 192), Image.Resampling.LANCZOS)
source = Image.open(art / 'skills-job2-v1.png').convert('RGBA')
atlas = Image.new('RGBA', (256, 384))
atlas.paste(old, (0, 0))
# Generated source has a bottom margin; explicit source cell boundaries avoid drift.
xs = [0, 362, 724, 1086, 1448]
ys = [0, 350, 693, 1036]
for i in range(12):
    row, col = divmod(i, 4)
    cell = source.crop((xs[col], ys[row], xs[col+1], ys[row+1]))
    atlas.paste(cell.resize((64, 64), Image.Resampling.LANCZOS), (col*64, 192+row*64))
assert atlas.crop((0, 0, 256, 192)).tobytes() == old.tobytes()
atlas.save(art / 'skills-v2.png')
