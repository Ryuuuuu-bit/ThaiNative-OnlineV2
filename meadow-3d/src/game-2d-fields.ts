import {LAYOUTS,MEADOW_LANDMARKS,FIELD_PLACES,type MapId} from '@the-beginning-online/shared/maps';
import {CanvasAssets} from './game-2d-assets';
import {canyonRockProps} from './canyon-rock-art';
import {ruinsProps} from './ruins-art';
import {fieldRoadTexture,paintFieldPath,groundWear} from './field-ground';
import {paintMeadowGround,decorateMeadow} from './meadow-art';
import {paintHimmapan,himmapanProps} from './himmapan-art';
import {isBiomeMap,BIOME_ROCK,biomeRockProps,paintBiomeGround,paintBiomeWater,biomeLandmark,desertPalms,frostDetails,yokaiDetails} from './biome-scenes';
import {paintRegionalGround,decorateRegion} from './regional-art';
export type FieldProp={x:number;z:number;image:HTMLImageElement;rect:number[];w:number;h:number;anchor:number[];tree?:boolean;foliage?:boolean};
export async function loadField2D(id:MapId,assets:CanvasAssets){
 const layout=LAYOUTS[id],forest=(id==='forest'||id==='grove');
 const env=await assets.json<any>('/assets/env-painted/manifest.json');
 const road=await assets.image(fieldRoadTexture(id)),waterArt=await assets.image(forest?'/assets/env-forest/tile-water-v1.png':'/assets/env-painted/tile-water-v2.png');
 const sources=new Map<string,HTMLImageElement>();
 await Promise.all([...new Set<string>(env.assets.map((a:any)=>a.atlas))].map(async file=>sources.set(file,await assets.image('/assets/env-painted/'+file))));
 const plane=document.createElement('canvas');plane.width=Math.max(2048,layout.halfX*32);plane.height=Math.round(plane.width*layout.halfZ/layout.halfX);
 const c=plane.getContext('2d')!,scale=plane.width/(layout.halfX*2);
 c.translate(plane.width/2,plane.height/2);c.scale(scale,scale);
 const pattern=(image:HTMLImageElement,size:number)=>{const p=c.createPattern(image,'repeat')!;p.setTransform(new DOMMatrix().scale(size/image.width));return p;};
 if(id==='ruins'){
  // Broken city paving forms readable blocks, rather than another forest floor.
  for(const {x:cx,z:cz}of FIELD_PLACES.ruins.filter(p=>['arch','plaza','runes','guardian'].includes(p.kind))){const w=24,h=22;
   c.fillStyle=pattern(road,7);
   for(let x=cx-w/2;x<cx+w/2-2;x+=2.5)for(let z=cz-h/2;z<cz+h/2-2;z+=2.2){
    const edge=Math.min(x-(cx-w/2),cx+w/2-x,z-(cz-h/2),cz+h/2-z);
    if(Math.sin(x*7+z*11)>(edge<3?-.2:.76))continue;
    c.globalAlpha=.25+Math.min(1,edge/4)*.4;c.fillRect(x,z,2.2,1.9);
   }c.globalAlpha=1;
  }
 }
 // Grass is one continuous world-space layer in MapBackdrop; this canvas holds
 // only roads and water so the playable rectangle cannot leave a texture seam.
 c.lineCap=c.lineJoin='round';c.strokeStyle=pattern(road,5);
 for(const p of layout.paths)paintFieldPath(c,p.points,p.width,pattern(road,5));
 for(const p of [...layout.camps,...(layout.arena?[layout.arena]:[])]){
  c.fillStyle=pattern(road,6);const r='r'in p?Number(p.r):3;
  for(const [extra,alpha]of [[.7,.12],[.35,.25],[0,.85]]){c.globalAlpha=alpha;c.beginPath();c.arc(p.x,p.z,r+extra,0,Math.PI*2);c.fill();}c.globalAlpha=1;
 }
 if(id==='temple'){
  // Marble courts, bronze borders and a maze mosaic are original canvas geometry.
  c.save();for(const place of FIELD_PLACES.temple){const w=place.kind==='boss'?23:24,h=place.kind==='boss'?23:20;
   for(let x=place.x-w/2;x<place.x+w/2;x+=2)for(let z=place.z-h/2;z<place.z+h/2;z+=2){c.fillStyle=(Math.floor(x+z)%3)?'#d8ceb2bb':'#b9ad91bb';c.fillRect(x,z,1.9,1.9);}
   c.strokeStyle='#a88d52';c.lineWidth=.2;c.strokeRect(place.x-w/2,place.z-h/2,w,h);
   if(place.kind==='boss'){c.strokeStyle='#6f6148';c.lineWidth=.35;for(let i=0;i<5;i++){const r=2+i*1.4;c.beginPath();c.arc(place.x,place.z,r,i*.8,i*.8+Math.PI*1.65);c.stroke();}}
  }c.restore();
 }
 groundWear(c,layout.halfX,layout.halfZ,id);
 if(isBiomeMap(id))paintBiomeGround(c,id);
 if(id==='grove'||id==='summit'){
  // Authored ground motifs: autumn leaf drifts and frosted crystal veins.
  c.save();
  for(const h of FIELD_PLACES[id]){
   if(h.kind==='sign')continue;
   for(let i=0;i<40;i++){
    const a=i*2.39996,r=2+Math.sqrt(i/40)*10,x=h.x+Math.cos(a)*r,z=h.z+Math.sin(a)*r*.7;
    c.fillStyle=id==='grove'?(i%2?'#d49b4b99':'#f1c76c88'):'#c7e0ff99';
    c.beginPath();c.ellipse(x,z,id==='grove'?.35:.8,.12,a,0,Math.PI*2);c.fill();
   }
  }c.restore();
 }
 for(const water of layout.water){
  const outline=(scale:number)=>{c.beginPath();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,r=scale+.015*Math.sin(a*7)+.012*Math.cos(a*11);const x=water.x+Math.cos(a)*water.rx*r,z=water.z+Math.sin(a)*water.rz*r;i?c.lineTo(x,z):c.moveTo(x,z);}c.closePath();};
  c.fillStyle=forest?'#374a4355':'#6e795555';outline(1.1);c.fill();c.fillStyle=pattern(waterArt,5);outline(1.035);c.fill();
  if(water.bridgeZ!==undefined){const left=water.x-water.rx-.7,w=(water.rx+.7)*2,half=water.bridgeHalf??1.3;c.fillStyle='#9b8058';c.fillRect(left,water.bridgeZ-half,w,half*2);c.strokeStyle='#534733';c.lineWidth=.08;for(let x=left;x<left+w;x+=.7){c.beginPath();c.moveTo(x,water.bridgeZ-half);c.lineTo(x,water.bridgeZ+half);c.stroke();}c.strokeRect(left,water.bridgeZ-half,w,half*2);}
 }
 if(id==='himmapan')paintHimmapan(c);
 if(isBiomeMap(id))paintBiomeWater(c,id);
 if(id==='meadow')paintMeadowGround(c,env,sources);
 const props:FieldProp[]=[];
 function prop(name:string,x:number,z:number,h:number){const a=env.assets.find((a:any)=>a.name===name);if(!a)throw Error('Missing environment art '+name);props.push({x,z,image:sources.get(a.atlas)!,rect:a.rect,w:h*a.rect[2]/a.rect[3],h,anchor:a.anchor,tree:name.startsWith('tree'),foliage:/tree|reeds|grass|fern/.test(name)});}
 if(id==='himmapan')props.push(...await himmapanProps(assets));
 if(isBiomeMap(id))props.push(await biomeLandmark(id,assets));
 if(id==='desert')props.push(...await desertPalms(assets));
 if(id==='frost')props.push(...await frostDetails(assets));
 if(id==='yokai')props.push(...await yokaiDetails(assets));
 if(isBiomeMap(id)&&BIOME_ROCK[id]){
  props.push(...await biomeRockProps(id,assets,layout.obstacles.filter(o=>!['biome-landmark','oasis-palm','frost-pine','fjord-wreck','yokai-lantern'].includes(o.kind))));
 }else if(id==='ruins'){
  props.push(...await ruinsProps(layout.obstacles,assets));
  for(const o of layout.obstacles.filter(o=>o.kind==='tree'))prop('tree-tall',o.x,o.z,7);
 }else if((id==='canyon'||id==='summit')){
  props.push(...await canyonRockProps(layout.obstacles,assets));
 }else if(forest){
  const fm=await assets.json<any>('/assets/env-forest/manifest.json');
  const atlas=await assets.image('/assets/env-forest/'+fm.atlases[0].file);
  for(const o of layout.obstacles){const a=fm.assets.find((a:any)=>a.name===(o.kind==='dead'?'silver':o.kind))??fm.assets.find((a:any)=>a.name==='pine'),h=6+o.r*1.5;props.push({x:o.x,z:o.z,image:atlas,rect:a.rect,w:h*a.rect[2]/a.rect[3],h,anchor:a.anchor,tree:/pine|oak|silver|hollow/.test(a.name),foliage:/pine|oak|silver|hollow|fern/.test(a.name)});}
  paintRegionalGround(c,id,{assets:fm.assets.map((a:any)=>({...a,atlas:fm.atlases[0].file}))},new Map([[fm.atlases[0].file,atlas]]));
  decorateRegion(id,(name,x,z,h)=>{const a=fm.assets.find((a:any)=>a.name===name);if(!a)throw Error('Missing forest detail '+name);props.push({x,z,image:atlas,rect:a.rect,w:h*a.rect[2]/a.rect[3],h,anchor:a.anchor,foliage:name==='fern'});});
 }else layout.obstacles.filter(o=>o.kind!=='spirit-trunk'&&o.kind!=='biome-landmark').forEach((o,i)=>prop(o.kind==='tree-flowering'||o.kind==='orchard-tree'?'tree-flowering':o.kind==='pillar'?(i%2?'pillar-fluted':'pillar-square'):o.kind==='rock-cluster'?'rock-cluster':o.kind==='boulder'?'boulder-round':i%3?'tree-round':'tree-tall',o.x,o.z,o.kind==='tree-flowering'||o.kind==='orchard-tree'?4.8:o.kind==='pillar'?4.2:o.kind==='rock-cluster'?o.r*3:o.kind==='boulder'?o.r*2.6:5.3+o.r*1.7));
 // Landmark footprints remain authoritative even where old meshes have been replaced by painted props.
 if(id==='meadow')for(const b of MEADOW_LANDMARKS.boxes)prop(b.kind==='fence-span'?'fence-span':b.kind==='rock-cluster'?'rock-cluster':'boulder-round',b.x,b.z,b.kind==='fence-span'?1.8:b.kind==='rock-cluster'?Math.max(b.w,b.d)*.9:Math.max(b.w,b.d)*1.25);
 if(id==='meadow')for(const p of MEADOW_LANDMARKS.circles)prop(p.kind==='giant-tree'?'tree-round':'boulder-tall',p.x,p.z,p.kind==='giant-tree'?10:2.4);
 if(id==='meadow')decorateMeadow(prop);
 if(id==='ruins'||(id==='canyon'||id==='summit')){paintRegionalGround(c,id,env,sources);decorateRegion(id,prop);}
 for(const p of layout.camps){prop('tent',p.x+3.5,p.z+1.5,3.1);prop('campfire',p.x,p.z,1.1);prop('signpost',p.x-2.8,p.z-1.5,1.9);}
 for(const water of layout.water)for(let i=0;i<22;i++){const a=i/22*Math.PI*2,x=water.x+Math.cos(a)*water.rx*1.05,z=water.z+Math.sin(a)*water.rz*1.05;if(water.bridgeZ!==undefined&&Math.abs(z-water.bridgeZ)<(water.bridgeHalf??1.3)+.5)continue;prop(i%3&&id!=='frost'?'reeds-1':'boulder-flat',x,z,i%3?.85:1.1);}
 return {plane,props,layout};
}
