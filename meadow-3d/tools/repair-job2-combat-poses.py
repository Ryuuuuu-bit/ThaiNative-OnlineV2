"""Repair Job 2 poses using only approved same-character Job 2 cells, keeping hit timing.
Run before pack-hero-skills-v2.py. Anchors and scale stay fixed; only cell height grows.
"""
from pathlib import Path
from PIL import Image, ImageChops
import json
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'art/texture-sources/hero-skills-v2'
meta = json.loads((SRC / 'skills-v2.json').read_text(encoding='utf-8'))
images = {name: Image.open(SRC / ('hero-skill-' + name + '-v2.png')).convert('RGBA')
          for name in ['frenzy_slash', 'blade_cyclone', 'quake_slam', 'leap_strike']}

def cell(name, row, frame):
    w, h = meta[name]['cell']
    return images[name].crop((frame*w, row*h, (frame+1)*w, (row+1)*h))

for name in ['frenzy_slash', 'leap_strike']:
    frames = 8 if name == 'frenzy_slash' else 6
    out = Image.new('RGBA', (384*frames, 268*8))
    sources = {}
    for row, facing in enumerate(['SE','SW','NE','NW','S','E','N','W']):
        picks = [(name, i) for i in range(frames)]
        if name == 'frenzy_slash':
            picks = [('frenzy_slash',0),('frenzy_slash',1),('blade_cyclone',3),
                     ('blade_cyclone',4),('quake_slam',5),('quake_slam',6),
                     ('quake_slam',7),('frenzy_slash',7)]
        elif facing in ['NE','NW','N']:
            picks[4:6] = [('quake_slam',6),('quake_slam',7)]
        sources[facing] = [{'skill':s, 'frame':f} for s,f in picks]
        for col,(source,frame) in enumerate(picks):
            c = cell(source,row,frame)
            # All selected strips use the same (192,240) feet; never auto-fit a pose.
            assert meta[source]['anchor'] == [192,240]
            out.alpha_composite(c,(col*384,row*268))
        if name == 'frenzy_slash':
            contacts = [out.crop((f*384,row*268,(f+1)*384,(row+1)*268)) for f in [1,3,5]]
            assert all(ImageChops.difference(contacts[a],contacts[b]).getbbox() for a,b in [(0,1),(1,2),(0,2)]), facing
    for row in range(8):
        for frame in range(frames):
            box=out.crop((frame*384,row*268,(frame+1)*384,(row+1)*268)).getchannel('A').getbbox()
            assert box and box[0]>0 and box[1]>0 and box[2]<384 and box[3]<268,(name,row,frame,box)
    out.save(SRC / ('hero-skill-'+name+'-v2.png'))
    meta[name]['cell'] = [384,268]
    meta[name].pop('frameSources', None)
    meta[name]['poseRepair'] = ({'facings':'all', 'frames':sources['SE']} if name == 'frenzy_slash'
                                else {'facings':['NE','NW','N'], 'frames':{'4':sources['NE'][4], '5':sources['NE'][5]}})
    meta[name]['repair'] = 'Approved Job 2 poses, same feet/scale. poseRepair overrides original raw frames selection.'
(SRC / 'skills-v2.json').write_text(json.dumps(meta,indent=1)+'\n',encoding='utf-8')
print('Repaired 3 distinct Frenzy contacts in 8 facings and rear Leap landing/recovery, no rescaling.')
