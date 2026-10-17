"""Pack painterly city art with a shared role scale and a fixed foot anchor."""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
out=root/'art/texture-sources/city';out.mkdir(exist_ok=True)
Image.open(root/'art/city/city-trim-generated.png').convert('RGBA').resize((1024,768),Image.Resampling.LANCZOS).save(out/'city-trim-v1.png')
im=Image.open(root/'art/city/city-npcs-personality-v4.png').convert('RGBA')
# Source row breaks sit in the transparent gutters, preserving tall staff/spear tips.
xs=[0,251,502,752,1003];ys=[0,314,630,937,1246,1568]
if im.size!=(xs[-1],ys[-1]):raise ValueError('Personality atlas size changed; inspect source slot bounds before packing')
sheet=Image.new('RGBA',(1024,1600));audit=[]
for row in range(5):
    group=[]
    for col in range(4):
        frame=im.crop((xs[col],ys[row],xs[col+1],ys[row+1]))
        bbox=frame.getchannel('A').point(lambda v:255 if v>32 else 0).getbbox()
        if bbox is None:raise ValueError(f'Empty NPC cell {row}:{col}')
        frame=frame.crop(bbox)
        # Median opaque pixels around the boots keeps arm gestures from shifting the body.
        alpha=frame.getchannel('A');low=[]
        for y in range(int(frame.height*.91),frame.height):
            low.extend(x for x in range(frame.width) if alpha.getpixel((x,y))>64)
        low.sort();anchor=low[len(low)//2]+.5 if low else frame.width/2
        group.append((frame,anchor))
    scale=min(120/max(a for _,a in group),120/max(f.width-a for f,a in group),300/max(f.height for f,_ in group))
    for col,(frame,anchor) in enumerate(group):
        w,h=round(frame.width*scale),round(frame.height*scale)
        frame=frame.resize((w,h),Image.Resampling.LANCZOS)
        x=128-round(anchor*scale);y=312-h
        if not (0<=x and x+w<=256 and 0<=y and y+h<=312):raise ValueError('NPC exceeds its cell')
        sheet.alpha_composite(frame,(col*256+x,row*320+y))
        audit.append({'row':row,'frame':col,'scale':round(scale,6),'footAnchor':[128,312],'paintBounds':[x,y,x+w,y+h]})
sheet.save(out/'city-npcs-v1.png')
(root/'art/city/npc-personality-layout.json').write_text(json.dumps({'source':im.size,'columns':xs,'rows':ys,'cells':audit},indent=2)+'\n')
for p in out.glob('*.png'):
    im=Image.open(p);im.save(out/(p.stem+'.webp'),'WEBP',quality=88,method=6,exact=True)
