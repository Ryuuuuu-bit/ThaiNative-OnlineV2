"""Connected alpha extraction shared by monster canvas preparation and packing.
Based on the existing painted-hero flood fill, with configurable small-fragment retention.
"""
from PIL import Image, ImageFilter
import numpy as np
def components(image, min_pixels=64):
    w,h=image.size
    raw=bytearray(image.getchannel('A').point(lambda x:255 if x>12 else 0).tobytes())
    found=[]
    for origin in range(w*h):
        if not raw[origin]: continue
        raw[origin]=0; todo=[origin]; pixels=[];x0=w;y0=h;x1=y1=0
        while todo:
            i=todo.pop();pixels.append(i);y,x=divmod(i,w)
            x0=min(x0,x);x1=max(x1,x);y0=min(y0,y);y1=max(y1,y)
            for nxt in ((i-1 if x else -1),(i+1 if x<w-1 else -1),i-w,i+w):
                if 0<=nxt<w*h and raw[nxt]:raw[nxt]=0;todo.append(nxt)
        if len(pixels)<min_pixels:continue
        bbox=(x0,y0,x1+1,y1+1)
        # Mask isolates nearby crossing weapons without erasing antialiased edges.
        mask=Image.new('L',(w,h));buf=np.zeros(w*h,dtype=np.uint8);buf[pixels]=255
        mask=Image.fromarray(buf.reshape(h,w)).filter(ImageFilter.MaxFilter(5))
        crop=image.crop(bbox)
        alpha=np.minimum(np.asarray(crop.getchannel('A')),np.asarray(mask.crop(bbox)))
        crop.putalpha(Image.fromarray(alpha))
        found.append({'image':crop,'bbox':bbox,'center':((x0+x1)/2,(y0+y1)/2)})
    return found

def figures(sheet,columns=6,rows=2):
    groups=[[] for _ in range(columns*rows)];cw=sheet.width/columns;ch=sheet.height/rows
    for part in components(sheet):
        x,y=part['center'];col=min(columns-1,max(0,int(x/cw)));row=min(rows-1,max(0,int(y/ch)))
        groups[row*columns+col].append(part)
    result=[]
    for i,parts in enumerate(groups):
        if not parts:raise ValueError(f'Empty figure group {i+1}')
        x0=min(p['bbox'][0] for p in parts);y0=min(p['bbox'][1] for p in parts)
        x1=max(p['bbox'][2] for p in parts);y1=max(p['bbox'][3] for p in parts)
        crop=Image.new('RGBA',(x1-x0,y1-y0))
        for part in parts:crop.alpha_composite(part['image'],(part['bbox'][0]-x0,part['bbox'][1]-y0))
        a=np.asarray(crop.getchannel('A'))>32;h,w=a.shape
        low=np.nonzero(a & (np.indices(a.shape)[0]>=h*.85))[1]
        anchor=float(np.median(low))+.5 if len(low) else w/2
        result.append({'image':crop,'bbox':(x0,y0,x1,y1),'anchorX':anchor,'components':len(parts)})
    return result
