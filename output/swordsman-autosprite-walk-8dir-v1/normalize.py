"""Deterministic atlas normalization for one direction. No pose edits or per-frame scaling.

Usage: python normalize.py <DIR>   (DIR = S | E | N | W, a subfolder next to this script)

Adapted from ../swordsman-autosprite-se-v3/normalize.py (v2 -> v1 lineage): the source cell size is read
from source.json (exported at 512 px) and the human review /
quality verdict comes from review.json so the visual check is recorded separately.
"""
from pathlib import Path
from PIL import Image, ImageDraw
from statistics import median
import json, hashlib, math

import sys
root = Path(__file__).resolve().parent / sys.argv[1]
direction = sys.argv[1]
source = json.loads((root / 'source.json').read_text(encoding='utf-8'))
review = json.loads((root / 'review.json').read_text(encoding='utf-8'))
src = source['sourceCell']
raw = Image.open(root / 'autosprite-raw.png').convert('RGBA')
# Cardinal facings have no game idle yet; every game idle is 168 px tall (bbox rows 72..240).
idle_file = root / f'original-idle-{direction}.png'
old = Image.open(idle_file).convert('RGBA') if idle_file.exists() else None
frames = []
for y in range(raw.height // src):
    for x in range(raw.width // src):
        f = raw.crop((x*src,y*src,(x+1)*src,(y+1)*src))
        if f.getbbox(): frames.append(f)
boxes = [f.getbbox() for f in frames]
target_height = (lambda b: b[3] - b[1])(old.getbbox()) if old else 168
source_height = median(b[3]-b[1] for b in boxes)
scale = target_height / source_height
# Shared transform: source canvas center and median foot baseline, identical for every frame.
source_anchor = (src/2, median(b[3] for b in boxes))
columns = 5
out = Image.new('RGBA',(384*columns,256*math.ceil(len(frames)/columns)))
contact_dir = root / 'contact'
contact_dir.mkdir(exist_ok=True)
normalized = []
for i, frame in enumerate(frames):
    size = (round(src*scale),round(src*scale))
    resized = frame.resize(size,Image.Resampling.LANCZOS)
    cell = Image.new('RGBA',(384,256))
    cell.alpha_composite(resized,(round(192-source_anchor[0]*scale),round(240-source_anchor[1]*scale)))
    normalized.append(cell)
    out.paste(cell,((i%columns)*384,(i//columns)*256))
    cell.save(contact_dir / f'frame-{i:03}.png')
out.save(root / 'walk-normalized.png')
# Every frame on the contact sheet (v2 has few enough frames), plus the idle reference first.
contact_indices = list(range(len(frames)))
cols = 6
rows = math.ceil((len(frames)+1)/cols)
contact = Image.new('RGB',(384*cols,280*rows),'#1e302a')
d=ImageDraw.Draw(contact)
if old: contact.paste(old,(0,0),old)
d.text((15,258),f'IDLE {direction} (reference)' if old else f'{direction}: no game idle (168 px target)',fill='#9fd8c0')
for n,i in enumerate(contact_indices, start=1):
    x,y=(n%cols)*384,(n//cols)*280
    d.line([(x,y+240),(x+383,y+240)],fill='#3d5a50')
    d.line([(x,y+240-target_height),(x+383,y+240-target_height)],fill='#3d5a50')
    contact.paste(normalized[i],(x,y),normalized[i])
    d.text((x+15,y+258),f'FRAME {i+1:02} / {len(frames)}',fill='#e4d2a0')
contact.save(root / 'contact-sheet.png')
normalized[0].save(root/'walk.gif',save_all=True,append_images=normalized[1:],duration=round(source['duration']*1000/len(frames)),loop=0,disposal=2)
bounds=[f.getbbox() for f in normalized]
meta={
 'provider':'AutoSprite','characterId':source['characterId'],'kind':source['kind'],
 'animationName':source['animationName'],'videoId':source['videoId'],'spritesheetId':source['spritesheetId'],
 'videoTier':source['videoTier'],'turboMode':source['turboMode'],'prompt':source['prompt'],
 'frames':len(frames),'columns':columns,'cell':[384,256],'anchor':[192,240],
 'duration':source['duration'],'durationNote':source['durationNote'],
 'sourceFile':'autosprite-raw.png','sourceCell':[src,src],
 'sourceExport':source['sourceExport'],
 'sourceSha256':hashlib.sha256((root/'autosprite-raw.png').read_bytes()).hexdigest(),
 'direction':direction,'reference':None,'referencePose':f'../poses/idle-{direction}-pose.png','referenceSource':'AutoSprite generate_pose from the uploaded 2x game idle (user-approved standing pose)','firstLastFramePoseId':source.get('firstLastFramePoseId'),'referenceHeight':target_height,
 'sharedScale':scale,'sourceMedianHeight':source_height,'sourceAnchor':source_anchor,
 'normalizedHeights':[b[3]-b[1] for b in bounds],
 'contactFrames':contact_indices,
 'creditsUsed':source['creditsUsed'],'creditsRemainingAfterGeneration':source['creditsRemaining'],
 'review':review['review'],'quality':review['quality'],'gameFilesChanged':False,
}
(root/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'frames':len(frames),'sharedScale':scale,'referenceHeight':target_height,'normalizedHeightRange':[min(meta['normalizedHeights']),max(meta['normalizedHeights'])],'nonempty':all(bounds)},indent=2))
