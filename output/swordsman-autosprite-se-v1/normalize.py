"""Deterministic atlas normalization. No pose edits or per-frame scaling."""
from pathlib import Path
from PIL import Image, ImageDraw
from statistics import median
import json, hashlib, math

root = Path(__file__).resolve().parent
raw = Image.open(root / 'autosprite-raw.png').convert('RGBA')
old = Image.open(root / 'original-idle-SE.png').convert('RGBA')
frames = []
for y in range(raw.height // 256):
    for x in range(raw.width // 256):
        f = raw.crop((x*256,y*256,(x+1)*256,(y+1)*256))
        if f.getbbox(): frames.append(f)
boxes = [f.getbbox() for f in frames]
old_box = old.getbbox()
target_height = old_box[3] - old_box[1]
source_height = median(b[3]-b[1] for b in boxes)
scale = target_height / source_height
# Shared transform: source canvas center and median foot baseline, identical for every frame.
source_anchor = (128, median(b[3] for b in boxes))
columns = 5
out = Image.new('RGBA',(384*columns,256*math.ceil(len(frames)/columns)))
contact_dir = root / 'contact'
contact_dir.mkdir(exist_ok=True)
normalized = []
for i, frame in enumerate(frames):
    size = (round(256*scale),round(256*scale))
    resized = frame.resize(size,Image.Resampling.LANCZOS)
    cell = Image.new('RGBA',(384,256))
    cell.alpha_composite(resized,(round(192-source_anchor[0]*scale),round(240-source_anchor[1]*scale)))
    normalized.append(cell)
    out.paste(cell,((i%columns)*384,(i//columns)*256))
    cell.save(contact_dir / f'frame-{i:03}.png')
out.save(root / 'walk-normalized.png')
contact_indices = [round(i*(len(frames)-1)/15) for i in range(16)]
contact = Image.new('RGB',(384*4,280*4),'#1e302a')
d=ImageDraw.Draw(contact)
for n,i in enumerate(contact_indices):
    contact.paste(normalized[i],((n%4)*384,(n//4)*280),normalized[i])
    d.text(((n%4)*384+15,(n//4)*280+258),f'FRAME {i+1:02} / {len(frames)}',fill='#e4d2a0')
contact.save(root / 'contact-sheet.png')
normalized[0].save(root/'walk.gif',save_all=True,append_images=normalized[1:],duration=round(2000/len(frames)),loop=0,disposal=2)
bounds=[f.getbbox() for f in normalized]
meta={
 'provider':'AutoSprite','characterId':'cmvfi8grt000bfsz61slaivr1','kind':'iso_walk_southeast',
 'frames':len(frames),'columns':columns,'cell':[384,256],'anchor':[192,240],
 'duration':2,'durationNote':'Playback retimed to a 2-second comparison loop, not a measured video duration.',
 'sourceFile':'autosprite-raw.png','sourceCell':[256,256],
 'sourceExport':'AutoSprite perfect-loop trimmed PNG: 23 populated cells in a 5x5 atlas (UI reports 25 before trim).',
 'sourceSha256':hashlib.sha256((root/'autosprite-raw.png').read_bytes()).hexdigest(),
 'reference':'original-idle-SE.png','referenceHeight':target_height,
 'sharedScale':scale,'sourceMedianHeight':source_height,'sourceAnchor':source_anchor,
 'normalizedHeights':[b[3]-b[1] for b in bounds],
 'contactFrames':contact_indices,'creditsUsed':5,'creditsRemainingAfterGeneration':20,
 'review':'ผลทดลองจาก AutoSprite: เห็นเท้าสองข้างสลับก้าว แต่ลำตัวและแนวดาบบิดเปลี่ยนมุมมากระหว่างรอบ จึงยังไม่ถือว่าผ่านสำหรับใช้จริง ปรับความสูงกึ่งกลางชุดให้เท่าต้นฉบับ 168 px ด้วยสเกลเดียว โดยไม่ยืดแขนขาหรือแก้ท่าแต่ละเฟรม',
 'quality':{'alternation':'Visually apparent alternating forward foot; not a verified skeletal contact test.',
 'facing':'Needs revision: torso/sword yaw changes noticeably within cycle.',
 'proportions':'Uniform scale preserves generated aspect ratio; original bone lengths are not guaranteed.',
 'shipReady':False},'gameFilesChanged':False,
}
(root/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'frames':len(frames),'sharedScale':scale,'referenceHeight':target_height,'normalizedHeightRange':[min(meta['normalizedHeights']),max(meta['normalizedHeights'])],'nonempty':all(bounds)},indent=2))
