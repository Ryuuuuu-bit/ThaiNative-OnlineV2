"""Measurements used in each direction's review: frame diffs, holds, head bob, foot profile, blade angle."""
import sys, math, numpy as np
from PIL import Image, ImageDraw
d=sys.argv[1]
R=Image.open(f'{d}/autosprite-raw.png').convert('RGBA'); r=np.array(R).astype(int)
f=lambda i:r[(i//5)*512:(i//5+1)*512,(i%5)*512:(i%5+1)*512]
bs=[Image.fromarray(f(i).astype('uint8')).getbbox() for i in range(25)]
def dd(a,b):
  A,B=f(a),f(b);m=(A[:,:,3]>40)|(B[:,:,3]>40);return round(float(np.abs(A[:,:,:3]*(A[:,:,3:]>40)-B[:,:,:3]*(B[:,:,3:]>40))[m].mean()),1)
print(d,'adjacent',[dd(i,(i+1)%25) for i in range(25)])
print(d,'vs f1',[dd(0,i) for i in range(25)])
print(d,'top',[b[1] for b in bs],'bottom',[b[3] for b in bs])
side=sys.argv[2]  # where the blade is: L or R
def ang(a):
  reg=a[220:512,0:180,3] if side=='L' else a[220:512,330:512,3]
  ys,xs=np.nonzero(reg>40)
  if len(xs)<50:return None
  c=np.cov(np.vstack([xs,ys]));w,v=np.linalg.eigh(c);vx,vy=v[:,1];return round(math.degrees(math.atan2(abs(vy),abs(vx))),1)
print(d,'blade',[ang(f(i)) for i in range(25)])
al=r[:,:,3]>40
for i in range(25):
  a=al[(i//5)*512:(i//5+1)*512,(i%5)*512:(i%5+1)*512];prof=[]
  for cx in range(140,440,8):
    ys=np.nonzero(a[330:,cx:cx+8].any(axis=1))[0];prof.append(330+ys.max() if len(ys) else 0)
  s=''.join(' ' if p==0 else chr(ord('a')+min(25,max(0,(p-400)//3))) for p in prof)
  print(f'{d} {i+1:2d} low_x={np.argmax(prof)*8+140:3d} bottom={max(prof)} |{s}|')
x0=min(b[0] for b in bs)-10;x1=max(b[2] for b in bs)+10;y0=min(b[1] for b in bs)-10;y1=max(b[3] for b in bs)+10
W,H=x1-x0,y1-y0;out=Image.new('RGB',(W*5,(H+20)*5),'#dcdccc');dr=ImageDraw.Draw(out)
for i in range(25):
  c=R.crop(((i%5)*512+x0,(i//5)*512+y0,(i%5)*512+x1,(i//5)*512+y1));out.paste(c,((i%5)*W,(i//5)*(H+20)),c);dr.text(((i%5)*W+6,(i//5)*(H+20)+H+4),str(i+1),fill='black')
out.save(f'{d}/raw-contact.png')
