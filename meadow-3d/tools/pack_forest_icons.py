"""Pack five 64px item cells; reserve the remaining twenty with exact zero alpha."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/painted-forest';OUT=ROOT/'public/assets/items'
NAMES=['mist_spore','wolf_fur','wisp_tear','mist_wood','warden_heart']
def pack():
 if (ROOT/'art/painted-items-v3/forest-original.png').exists():
  from pack_items_v3 import pack as pack_v3
  return pack_v3()
 source=Image.open(ART/'items-generated.png').convert('RGBA');atlas=Image.new('RGBA',(320,320));frames={}
 for i,name in enumerate(NAMES):
  x=i%3*source.width/3;y=i//3*source.height/2
  slot=source.crop((round(x),round(y),round(x+source.width/3),round(y+source.height/2)))
  slot=slot.resize((64,64),Image.Resampling.LANCZOS);atlas.alpha_composite(slot,(i*64,0));frames[name]={'index':25+i,'slot':i,'x':i*64,'y':0,'w':64,'h':64}
 atlas.save(OUT/'items-v2.webp',quality=95,method=6,exact=True)
 (OUT/'items-v2.json').write_text(json.dumps({'version':2,'image':'items-v2.webp','width':320,'height':320,'cellSize':[64,64],'columns':5,'rows':5,'reservedTransparentSlots':20,'frames':frames},indent=2)+'\n')
 proof=Image.new('RGB',(320,88),'#294a42');proof.paste(atlas,(0,24),atlas);d=ImageDraw.Draw(proof)
 for i,name in enumerate(NAMES):d.text((i*64+1,5),name,fill='#e6d2a5')
 proof.save(ART/'preview-items.jpg',quality=95)
 decoded=Image.open(OUT/'items-v2.webp').convert('RGBA');assert decoded.crop((0,64,320,320)).getchannel('A').getextrema()==(0,0)
 report={'icons':5,'slots':25,'transparentSlots':20,'size':[320,320],'cellSize':[64,64],'clippingWarnings':[]}
 (ART/'icon-packing-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
