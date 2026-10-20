"""Remove the cream parchment tile from the five forest icons by flood-filling it from the cell border."""
import sys
from collections import deque
from PIL import Image
PAPER=(246,226,178)
EDGE=(206,180,132)
def dist(c,k):
    return ((c[0]-k[0])**2+(c[1]-k[1])**2+(c[2]-k[2])**2)**.5
def close(c,t):
    return dist(c,PAPER)<=t or dist(c,EDGE)<=t*.8
def clean(cell,t=48,soft=80):
    w,h=cell.size;px=cell.load();bg=[[False]*w for _ in range(h)];q=deque()
    # Seed from the cell border and from a band just inside the tile's own edge (its rim can enclose the paper).
    box=cell.getchannel('A').point(lambda v:255 if v>200 else 0).getbbox() or (0,0,w,h)
    for x in range(w):
        for y in range(h):
            inside=box[0]<=x<box[2] and box[1]<=y<box[3]
            band=inside and min(x-box[0],box[2]-1-x,y-box[1],box[3]-1-y)<=3
            if x in(0,w-1) or y in(0,h-1) or band: q.append((x,y))
    while q:
        x,y=q.popleft()
        if not(0<=x<w and 0<=y<h) or bg[y][x]: continue
        r,g,b,a=px[x,y]
        if a<40 or close((r,g,b),t):
            bg[y][x]=True;q.extend(((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
    out=cell.copy();o=out.load()
    for y in range(h):
        for x in range(w):
            r,g,b,a=px[x,y]
            if bg[y][x]: o[x,y]=(r,g,b,0);continue
            # Edge pixels still tinted by the paper fade out in proportion to how paper-like they are.
            near=any(0<=x+dx<w and 0<=y+dy<h and bg[y+dy][x+dx] for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
            if near:
                d=((r-PAPER[0])**2+(g-PAPER[1])**2+(b-PAPER[2])**2)**.5
                if d<soft: o[x,y]=(r,g,b,int(a*max(0,(d-t))/(soft-t)))
    # Drop specks: visible islands of a few pixels left from the tile rim.
    o=out.load();seen=[[False]*w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if seen[y][x] or o[x,y][3]<40: continue
            comp=[];st=[(x,y)];seen[y][x]=True
            while st:
                cx,cy=st.pop();comp.append((cx,cy))
                for dx in(-1,0,1):
                    for dy in(-1,0,1):
                        nx,ny=cx+dx,cy+dy
                        if 0<=nx<w and 0<=ny<h and not seen[ny][nx] and o[nx,ny][3]>=40: seen[ny][nx]=True;st.append((nx,ny))
            xs=[c[0] for c in comp];ys=[c[1] for c in comp]
            sliver=len(comp)<=40 and (max(xs)-min(xs)<=2 or max(ys)-min(ys)<=2)
            if len(comp)<=8 or sliver:
                for cx,cy in comp: r,g,b,_=o[cx,cy];o[cx,cy]=(r,g,b,0)
    return out
def clean_row(row):
    """Clean every 64 px cell of a one-row strip."""
    out=Image.new('RGBA',row.size)
    for s in range(row.width//64): out.paste(clean(row.crop((s*64,0,s*64+64,64))),(s*64,0))
    return out
