"""4-direction overview: contact sheet (every other frame, idle first) and a side-by-side GIF."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
root=Path(__file__).resolve().parent
dirs=['SE','SW','NE','NW']
frames={d:[Image.open(root/d/'contact'/f'frame-{i:03}.png').convert('RGBA') for i in range(25)] for d in dirs}
verdict={d:json.load(open(root/d/'metadata.json',encoding='utf-8'))['quality'] for d in dirs}
cols=list(range(0,25,2)); CW,CH=200,216; crop=(92,40,292,256)
sheet=Image.new('RGB',(90+CW*(len(cols)+1),CH*4+30),'#1e302a'); dr=ImageDraw.Draw(sheet)
dr.text((96,8),'IDLE (game)',fill='#9fd8c0')
for c,i in enumerate(cols): dr.text((90+CW*(c+1)+6,8),f'f{i+1}',fill='#e4d2a0')
for r,d in enumerate(dirs):
  y=30+r*CH; ok='OK' if verdict[d].get('shipReady') else ('pending' if 'Pending' in verdict[d].get('shipReadyNote','') else 'FAIL')
  dr.text((8,y+80),f'{d}\n{ok}',fill='#e4d2a0')
  idle=Image.open(root/d/f'original-idle-{d}.png').convert('RGBA').crop(crop); sheet.paste(idle,(90,y),idle)
  for c,i in enumerate(cols):
    im=frames[d][i].crop(crop); sheet.paste(im,(90+CW*(c+1),y),im)
sheet.save(root/'contact-4dir.png')
gif=[]
for i in range(25):
  g=Image.new('RGBA',(CW*4,CH+20),(30,48,42,255)); gd=ImageDraw.Draw(g)
  for c,d in enumerate(dirs):
    im=frames[d][i].crop(crop); g.alpha_composite(im,(c*CW,0)); gd.text((c*CW+8,CH+4),d,fill='#e4d2a0')
  gif.append(g.convert('RGB'))
gif[0].save(root/'walk-4dir.gif',save_all=True,append_images=gif[1:],duration=80,loop=0)
print('ok',sheet.size)
