"""Normalize generated city art for the existing content-hashed KTX2/WebP loader."""
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
out=root/'art/texture-sources/city';out.mkdir(exist_ok=True)
Image.open(root/'art/city/city-trim-generated.png').convert('RGBA').resize((1024,768),Image.Resampling.LANCZOS).save(out/'city-trim-v1.png')
im=Image.open(root/'art/city/city-npcs-generated.png').convert('RGBA')
# Generated rows/cells are not evenly padded. Normalize each to a fixed 256 x 320 cell.
xs=[112,350,586,822,1060];ys=[0,280,570,856,1120,1402]
frames=[]
for row in range(5):
    group=[]
    for col in range(4):
        frame=im.crop((xs[col],ys[row],xs[col+1],ys[row+1]));bbox=frame.getchannel('A').point(lambda v:255 if v>32 else 0).getbbox();group.append(frame.crop(bbox))
    scale=min(220/max(f.width for f in group),300/max(f.height for f in group))
    frames.append([f.resize((round(f.width*scale),round(f.height*scale)),Image.Resampling.LANCZOS) for f in group])
sheet=Image.new('RGBA',(1024,1600))
for row,group in enumerate(frames):
    for col,f in enumerate(group):sheet.alpha_composite(f,(col*256+(256-f.width)//2,row*320+312-f.height))
sheet.save(out/'city-npcs-v1.png')
for p in out.glob('*.png'):
    im=Image.open(p);im.save(out/(p.stem+'.webp'),'WEBP',quality=88,method=6,exact=True)
