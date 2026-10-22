from pathlib import Path
from PIL import Image,ImageDraw
import base64,io,json,hashlib,html
root=Path(__file__).resolve().parents[2];art=root/'meadow-3d/art/item-art-v2';out=root/'meadow-3d/public/assets/item-art-v2';out.mkdir(parents=True,exist_ok=True)
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
cards=json.loads((art/'card-inputs.json').read_text(encoding='utf-8'))
palette={'neutral':'#d8bd88','water':'#72cfec','earth':'#a5d28d','wind':'#91e3cb','fire':'#f7a16e','dark':'#ba97e0','ghost':'#b8b1f4','holy':'#fae5a0','poison':'#bad279'}
receipt=[];contact=Image.new('RGB',(12*140,10*140),'#142723');draw=ImageDraw.Draw(contact)
for n,c in enumerate(cards):
 candidates=[p for p in (root/'meadow-3d/art').glob('**/base.png') if p.parent.name==c['sourceId'] and 'quarantine'not in str(p)]
 if not candidates:
  reports=[p for p in (root/'meadow-3d/art').glob('**/base-report.json') if p.parent.name==c['sourceId'] and 'quarantine'not in str(p)]
  assert reports,c
  r=reports[0];original=Path(json.loads(r.read_text(encoding='utf-8'))['out']);assert original.exists(),original
  provenance=json.loads((r.parent.parent/'provenance.json').read_text(encoding='utf-8'))
  expected=next(s['baseSha256']for s in provenance['sources']if s['id']==c['sourceId'])
  assert digest(original)==expected,original
  restored=r.parent/'base.png';restored.write_bytes(original.read_bytes());candidates=[restored]
 source=candidates[0];report=source.parent/'base-report.json'
 assert report.exists(),source
 origin=json.loads(report.read_text(encoding='utf-8'));assert origin['provider']=='codex'and not origin.get('refs'),source
 im=Image.open(source).convert('RGBA');im=im.crop(im.getbbox());im.thumbnail((144,144),Image.Resampling.LANCZOS)
 # This is deterministic placement of our approved creature art inside newly authored vector borders.
 buf=io.BytesIO();im.save(buf,format='PNG');encoded=base64.b64encode(buf.getvalue()).decode();colour=palette.get(c['element'],palette['neutral']);edge='#e7c37c'if c['boss']else'#7c9d8e'
 w,h=im.width/2,im.height/2;x=(96-w)/2;y=8+(72-h)/2
 badge='<path d="m35 85 6 4 7-8 7 8 6-4-3 8H38Z" fill="#e7c37c"/>'if c['boss']else'<path d="m48 83 4 5-4 5-4-5Z" fill="'+colour+'"/>'
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="paper" x2="0" y2="1"><stop stop-color="#344b47"/><stop offset="1" stop-color="#142723"/></linearGradient><radialGradient id="halo"><stop stop-color="{colour}" stop-opacity=".28"/><stop offset="1" stop-color="{colour}" stop-opacity="0"/></radialGradient></defs><rect x="11" y="2" width="74" height="92" rx="7" fill="url(#paper)" stroke="{edge}" stroke-width="2"/><rect x="15" y="6" width="66" height="84" rx="4" fill="none" stroke="{colour}" stroke-opacity=".4"/><ellipse cx="48" cy="44" rx="34" ry="38" fill="url(#halo)"/><path d="M16 20V7h13M67 7h13v13M16 76v13h13m38 0h13V76" fill="none" stroke="{edge}" stroke-width="1.3"/><image x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" href="data:image/png;base64,{encoded}"/>{badge}<circle cx="76" cy="11" r="6" fill="#142723" stroke="{edge}"/><path d="m76 7 3 4-3 4-3-4Z" fill="{colour}"/></svg>\n'''
 target=out/(c['id']+'.svg');target.write_text(svg,encoding='utf-8')
 receipt.append({'id':c['id'],'kind':'card','file':target.name,'sha256':digest(target),'source':source.relative_to(root).as_posix(),'sourceSha256':digest(source),'sourceReceipt':report.relative_to(root).as_posix(),'monster':c['monster'],'element':c['element'],'boss':c['boss']})
 thumb=im.copy();thumb.thumbnail((112,112));cx=(n%12)*140;cy=(n//12)*140;contact.paste(thumb,(cx+(140-thumb.width)//2,cy+4),thumb);draw.text((cx+4,cy+119),c['id'][5:24],fill='#e4d9b3')
(art/'cards.provenance.json').write_text(json.dumps({'method':'Deterministic normalization of verified original monster bases in new code-authored SVG frames; no external artwork.','files':receipt},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
contact.save(art/'cards-source-contact.jpg',quality=85)
print(f'Wrote {len(receipt)} original creature cards')
