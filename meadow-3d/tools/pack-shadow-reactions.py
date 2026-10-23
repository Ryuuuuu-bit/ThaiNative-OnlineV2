"""Normalize authored whole-body reactions; source rows may have uneven gutters."""
import hashlib
import json
from pathlib import Path
from statistics import median
import numpy as np
import cv2
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'output/shadow-reactions-20261023'
OUTPUT=ROOT/'meadow-3d/public/assets/hero-shadow-8dir-v1'
DIRECTIONS={'SE':'southeast','SW':'southwest','NE':'northeast','NW':'northwest','S':'down','E':'right','N':'up','W':'left'}
MOTIONS={'hit':(0,4,.3),'dodge':(4,8,.22),'death':(8,16,1.1)}

def separators(mask):
    counts=mask.sum(axis=1);length=len(counts);cuts=[0]
    for k in range(1,4):
        lo,hi=int((k-.44)*length/4),int((k+.44)*length/4)
        candidates=np.flatnonzero(counts[lo:hi]==0)+lo
        if not len(candidates):return None
        gaps=np.split(candidates,np.flatnonzero(np.diff(candidates)>1)+1)
        centers=np.array([int((g[0]+g[-1])/2) for g in gaps])
        cuts.append(int(centers[np.argmin(abs(centers-k*length/4))]))
    return cuts+[length]

def normalize(path):
    source=Image.open(path).convert('RGBA');a=np.array(source.getchannel('A'))
    assert source.width==source.height and source.width>=1000,path
    frames=[];heights=[];origins=[];bounds=[]
    ys=separators(a>128)
    if ys is None:
        # Neighboring poses can overlap vertically without touching; keep each whole silhouette.
        _,row_labels,row_stats,row_centers=cv2.connectedComponentsWithStats((a>16).astype('uint8'))
        bodies=[i for i in range(1,len(row_stats)) if row_stats[i,4]>500]
        rows=[[] for _ in range(4)]
        for i in range(1,len(row_stats)):
            owner=i if i in bodies else min(bodies,key=lambda j:sum(max(row_stats[j,k]-row_centers[i,k],0,row_centers[i,k]-row_stats[j,k]-row_stats[j,k+2])**2 for k in [0,1]))
            rows[min(3,int(row_centers[owner,1]*4/source.height))].append(i)
    for row in range(4):
        if ys is not None:strip=source.crop((0,ys[row],source.width,ys[row+1]))
        else:
            pixels=np.array(source);pixels[~np.isin(row_labels,rows[row])]=0
            strip=Image.fromarray(pixels);box=strip.getbbox();assert box,(path,row,'empty row')
            strip=strip.crop((0,max(0,box[1]-2),source.width,min(source.height,box[3]+2)))
        # Separate connected silhouettes when a blade crosses a nominal column boundary.
        pixels=np.array(strip);_,labels,stats,centroids=cv2.connectedComponentsWithStats((pixels[:,:,3]>16).astype('uint8'))
        large=[i for i in range(1,len(stats)) if stats[i,4]>500]
        assert len(large)>=4,(path,row,'missing silhouettes')
        groups=[[] for _ in range(4)]
        for i in range(1,len(stats)):
            owner=i if i in large else min(large,key=lambda j:sum(max(stats[j,k]-centroids[i,k],0,centroids[i,k]-stats[j,k]-stats[j,k+2])**2 for k in [0,1]))
            groups[min(3,int(centroids[owner,0]*4/source.width))].append(i)
        cells=[];centers=[]
        for col,group in enumerate(groups):
            p=pixels.copy();p[~np.isin(labels,group)]=0
            f=Image.fromarray(p);box=f.getbbox();assert box,(path,row,col,'empty pose')
            left=max(0,box[0]-2);right=min(source.width,box[2]+2)
            cells.append(f.crop((left,0,right,strip.height)))
            centers.append(source.width*(col+.5)/4-left)
        boxes=[f.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox() for f in cells]
        assert all(boxes),(path,row,'empty pose')
        if row<3:
            alpha=np.array(cells[0].getchannel('A'))>128
            center=centers[0]
            dense=alpha[:,max(0,int(center-source.width*.035)):int(center+source.width*.035)].sum(axis=1)
            body=np.flatnonzero(dense>=4)
            assert len(body)>50,(path,row,'missing standing calibration')
            floor=int(body[-1]);heights.append(int(body[-1]-body[0]))
        else:
            # The lower row continues the fall, with a floor shared by all four prone poses.
            floor=round(median(b[3] for b in boxes))
        for col,(f,b) in enumerate(zip(cells,boxes)):
            assert b[0]>0 and b[1]>0 and b[2]<f.width and b[3]<f.height,(path,row,col,'clipped source')
            origin=(centers[col],floor)
            frames.append(f);origins.append(origin)
            bounds.append((b[0]-origin[0],b[1]-floor,b[2]-origin[0],b[3]-floor))
    height=median(heights)
    scale=min(145/height,116/max(max(abs(b[0]),abs(b[2])) for b in bounds),194/max(-b[1] for b in bounds),30/max(1,max(b[3] for b in bounds)))
    normalized=[]
    for f,(x,y) in zip(frames,origins):
        out=Image.new('RGBA',(256,256));f=f.resize((round(f.width*scale),round(f.height*scale)),Image.Resampling.LANCZOS)
        out.paste(f,(round(128-x*scale),round(210-y*scale)))
        box=out.getchannel('A').point(lambda v:255 if v>128 else 0).getbbox()
        assert box and min(box[0],box[1],256-box[2],256-box[3])>=8,(path,'runtime gutter',box)
        normalized.append(out)
    return normalized,{motion:{'x':128,'y':210,'height':round(heights[i]*scale,4)} for i,motion in enumerate(MOTIONS)}

def append_reactions(manifest,validation):
    validation[:]=[r for r in validation if r['motion'] not in MOTIONS]
    for look in manifest['looks']:
        clips={m:Image.new('RGBA',((end-start)*256,8*256)) for m,(start,end,_) in MOTIONS.items()}
        anchors={m:{} for m in MOTIONS};overview=Image.new('RGB',(16*128,8*148),'#526258');draw=ImageDraw.Draw(overview)
        for row,(direction,provider) in enumerate(DIRECTIONS.items()):
            path=SOURCE/f'{look}-{provider}-authored.png'
            frames,calibration=normalize(path)
            for i,f in enumerate(frames):
                small=f.resize((128,128));overview.paste(small,(i*128,row*148+20),small)
                draw.text((i*128+3,row*148+3),f'{direction} {i}',fill='white')
            for motion,(start,end,_) in MOTIONS.items():
                anchor=calibration[motion];anchors[motion][direction]=anchor
                for col,f in enumerate(frames[start:end]):clips[motion].paste(f,(col*256,row*256))
                validation.append({'look':look,'motion':motion,'direction':direction,'sourceHash':hashlib.sha256(path.read_bytes()).hexdigest(),'edgeFrames':[],'gutter':8,'anchor':anchor})
        overview.save(SOURCE/f'{look}-normalized.jpg',quality=92)
        for motion,atlas in clips.items():
            start,end,seconds=MOTIONS[motion];name=f'{look}-{motion}-{hashlib.sha256(atlas.tobytes()).hexdigest()[:10]}.webp'
            atlas.save(OUTPUT/name,'WEBP',quality=93,method=4)
            manifest['looks'][look][motion]={'url':'/assets/hero-shadow-8dir-v1/'+name,'size':256,'frames':end-start,'seconds':seconds,'anchors':anchors[motion]}

if __name__=='__main__':
    manifest=json.loads((OUTPUT/'manifest.json').read_text());validation=json.loads((OUTPUT/'validation.json').read_text())
    append_reactions(manifest,validation)
    (OUTPUT/'validation.json').write_text(json.dumps(validation,indent=2))
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps({'clips':len(validation),'newFrames':4*8*16}))
