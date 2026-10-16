"""Deterministic crop/layout only: stage generated artwork for whole-strip edits."""
from pathlib import Path
from PIL import Image
import subprocess, sys

root = Path(__file__).resolve().parents[1]
art = root / 'art/painted-hero'
source = Image.open(art / 'turnaround-v1.png').convert('RGBA')
helper = Path('C:/Users/panup/.codex/plugins/cache/openai-curated-remote/game-studio/0.1.2/scripts/build_sprite_edit_canvas.py')
print('Source', source.size, 'alpha', source.getchannel('A').getextrema())
for i, direction in enumerate(['SE', 'SW', 'NE', 'NW']):
    col, row = i % 2, i // 2
    slot = source.crop((col*source.width//2,row*source.height//2,(col+1)*source.width//2,(row+1)*source.height//2))
    bbox = slot.getchannel('A').point(lambda a: 255 if a>12 else 0).getbbox()
    if not bbox: raise ValueError('Empty seed')
    content = slot.crop(bbox)
    content.thumbnail((204,220),Image.Resampling.LANCZOS)
    seed=Image.new('RGBA',(256,256))
    seed.alpha_composite(content,((256-content.width)//2,240-content.height))
    seed.save(art/f'seed-{direction}.png')
    subprocess.run([sys.executable,str(helper),'--seed',str(art/f'seed-{direction}.png'),'--out',str(art/f'scaffold-{direction}.png'),'--frames','6','--slot-size','256','--canvas-size','1536'],check=True)
    scaffold=Image.open(art/f'scaffold-{direction}.png').crop((0,640,1536,896))
    layout=Image.new('RGBA',(1536,512))
    layout.alpha_composite(scaffold,(0,0));layout.alpha_composite(scaffold,(0,256))
    layout.save(art/f'edit-canvas-{direction}.png')
