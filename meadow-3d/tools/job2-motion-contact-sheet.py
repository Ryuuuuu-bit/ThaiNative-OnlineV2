from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT.parent/'.codex-run'
counts={'shield_bash':6,'bulwark':5,'quake_slam':9,'rally_roar':5,'frenzy_slash':8,'blood_rage':5,'blade_cyclone':8,'leap_strike':6}
w,h=160,130
sheet=Image.new('RGB',(13*w,32*h),(40,48,43));draw=ImageDraw.Draw(sheet)
for group,(id,count) in enumerate(counts.items()):
 atlas=Image.open(ROOT/f'art/hero-skills/hero-skill-{id}-v1.png').convert('RGBA')
 for row,direction in enumerate(['SE','SW','NE','NW']):
  y=(group*4+row)*h;draw.text((6,y+2),id+' / '+direction,fill='#f3e1bf')
  for col,old in enumerate(['idle','run','attack']):
   im=Image.open(ROOT/f'art/texture-sources/hero-painted/hero-{old}-v1.png').convert('RGBA')
   box=(row*384,0,(row+1)*384,256) if old=='idle' else (3*384,row*256,4*384,(row+1)*256)
   cell=im.crop(box).resize((160,107),Image.Resampling.LANCZOS);sheet.paste(cell,(col*w,y+20),cell)
  borrowed={'shield_bash':('slash',2),'bulwark':('endure',3),'quake_slam':('earth_break',6),'rally_roar':('provoke',2),'frenzy_slash':('slash',2),'blood_rage':('endure',3),'blade_cyclone':('whirlwind',2),'leap_strike':('dash_strike',1)}
  old,key=borrowed[id]
  im=Image.open(ROOT/f'art/hero-skills/hero-skill-{old}-v1.png').convert('RGBA')
  cell=im.crop((key*384,row*256,(key+1)*384,(row+1)*256)).resize((160,107),Image.Resampling.LANCZOS)
  sheet.paste(cell,(3*w,y+20),cell)
  for col in range(count):
   cell=atlas.crop((col*384,row*256,(col+1)*384,(row+1)*256)).resize((160,107),Image.Resampling.LANCZOS)
   sheet.paste(cell,((col+4)*w,y+20),cell)
sheet.save(OUT/'job2-motions-sheet.jpg',quality=94)
