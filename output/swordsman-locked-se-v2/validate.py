from pathlib import Path
from PIL import Image, ImageDraw
import json

root=Path(__file__).resolve().parent
atlas=Image.open(root/'swordsman-locked-SE-32.png').convert('RGBA')
source=Image.open(root/'original-idle-SE.png').convert('RGBA')
frames=[atlas.crop((i%8*384,i//8*256,i%8*384+384,i//8*256+256)) for i in range(32)]
protected=[]
for y in range(65,215):
 for x in range(110,240):
  if source.getpixel((x,y))[3]==255 and (y<155 or x<154):
   protected.append((x,y))
errors=[sum(f.getpixel(p)!=source.getpixel(p) for p in protected) for f in frames]
assert not any(errors),errors
bounds=[f.getbbox() for f in frames]
assert all(b and b[0]>0 and b[1]>0 and b[2]<384 and b[3]<256 for b in bounds)
assert frames[0].tobytes()!=frames[16].tobytes()
frames[0].save(root/'walk.gif',save_all=True,append_images=frames[1:],duration=31,loop=0,disposal=2)
report={'frames':32,'cell':[384,256],'protectedOpaqueHeadArmsTorsoAndBladePixels':len(protected),
 'protectedPixelMismatches':errors,'allFramesInsideCell':True,'oppositeStepsHaveDifferentImages':True,
 'bounds':bounds,'note':'Pixel comparison covers original opaque upper-body region and blade outside leg overlap. Joint length/contact/loop tests are in rig.test.mjs. These checks do not certify aesthetic quality or hidden anatomy.'}
(root/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='bounds'},indent=2))
