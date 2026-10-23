"""Repack complete generated views and record their measured ground endpoints."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops

root = Path(__file__).resolve().parents[1] / 'art/city-sprite-v2'
calibration = {}
for family in ['wall', 'gate']:
    source = Image.open(root / f'{family}-fortification-generated.png').convert('RGBA')
    assert source.size == (1254, 1254)
    if family == 'wall':
        polygons = [[(0,0),(627,0),(627,610),(0,610)], [(627,0),(1254,0),(1254,627),(627,627)],
                    [(0,610),(627,610),(627,1254),(0,1254)], [(627,627),(1254,627),(1254,1254),(627,1254)]]
        endpoints = [((64,327),(574,568)), ((698,575),(1194,344)), ((64,890),(574,1146)), ((698,1168),(1194,927))]
        rises = [245,245,245,245]
    else:
        polygons = [[(0,0),(627,0),(627,675),(0,550)], [], [(0,550),(627,675),(627,1254),(0,1254)], []]
        # Wall contact points stay inside each tower's stone footing.
        endpoints = [((148,460),(491,578)), ((703,853),(1024,512)), ((148,1050),(490,1172)), ((703,857),(1024,516))]
        rises = [430,500,430,500]
        side = {1: Image.open(root / 'gate-side-front-v2.png').convert('RGBA'),
                3: Image.open(root / 'gate-side-rear-v2.png').convert('RGBA')}
    sheet = Image.new('RGBA',(1024,1024))
    records = []
    for i in range(4):
        im = side[i] if family == 'gate' and i % 2 else source
        mask = Image.new('L',im.size)
        if family == 'gate' and i % 2:
            mask.paste(255,(0,0,im.width,im.height))
        else:
            ImageDraw.Draw(mask).polygon(polygons[i],fill=255)
        cut = im.copy(); cut.putalpha(ImageChops.multiply(im.getchannel('A'),mask))
        box = cut.getchannel('A').point(lambda a: 255 if a >= 8 else 0).getbbox() if family == 'gate' and i % 2 else cut.getbbox()
        assert box
        if family == 'gate' and i % 2:
            box = (max(0,box[0]-3),max(0,box[1]-3),min(im.width,box[2]+3),min(im.height,box[3]+3))
        assert all(box[0] <= p[0] < box[2] and box[1] <= p[1] < box[3] for p in endpoints[i]), 'Ground endpoint outside artwork'
        cut = cut.crop(box)
        factor = min(468/cut.width,468/cut.height)
        size = (round(cut.width*factor),round(cut.height*factor))
        cut = cut.resize(size,Image.Resampling.LANCZOS)
        assert max(size) <= 468, 'View must leave transparent gutters'
        x,y = i%2*512+(512-size[0])//2, i//2*512+(512-size[1])//2
        sheet.paste(cut,(x,y))
        points = [[round(x+(p[0]-box[0])*size[0]/(box[2]-box[0]),3),round(y+(p[1]-box[1])*size[1]/(box[3]-box[1]),3)] for p in endpoints[i]]
        records.append({'a':points[0],'b':points[1],'rise':round(rises[i]*size[1]/(box[3]-box[1]),3)})
    sheet.save(root / f'{family}.png')
    assert len(records) == 4 and all(r['a'][0] < r['b'][0] and r['rise'] > 0 for r in records)
    calibration[family] = records
(root / 'fortification-calibration.json').write_text(json.dumps(calibration,indent=2)+'\n',encoding='utf-8')
print('Normalized 8 complete wall/gate views; saved ground endpoint calibration')
