import {LAYOUTS,MEADOW_LANDMARKS,type MapId} from '@thainative/shared/maps';
import {CanvasAssets} from './game-2d-assets';
export type FieldProp={x:number;z:number;image:HTMLImageElement;rect:number[];w:number;h:number;anchor:number[]};
export async function loadField2D(id:MapId,assets:CanvasAssets){
 const layout=LAYOUTS[id],forest=id==='forest';
 const env=await assets.json<any>('/assets/env-painted/manifest.json');
 const road=await assets.image(forest?'/assets/env-forest/tile-path-v1.png':'/assets/city-painted-v1/ground-garden-v1.png'),waterArt=await assets.image(forest?'/assets/env-forest/tile-water-v1.png':'/assets/env-painted/tile-water-v2.png');
 const sources=new Map<string,HTMLImageElement>();
 await Promise.all([...new Set<string>(env.assets.map((a:any)=>a.atlas))].map(async file=>sources.set(file,await assets.image('/assets/env-painted/'+file))));
 const plane=document.createElement('canvas');plane.width=2048;plane.height=Math.round(2048*layout.halfZ/layout.halfX);
 const c=plane.getContext('2d')!,scale=plane.width/(layout.halfX*2);
 c.translate(plane.width/2,plane.height/2);c.scale(scale,scale);
 const pattern=(image:HTMLImageElement,size:number)=>{const p=c.createPattern(image,'repeat')!;p.setTransform(new DOMMatrix().scale(size/image.width));return p;};
 // Grass is one continuous world-space layer in MapBackdrop; this canvas holds
 // only roads and water so the playable rectangle cannot leave a texture seam.
 c.lineCap=c.lineJoin='round';c.strokeStyle=pattern(road,5);
 for(const p of layout.paths){c.lineWidth=p.width*2;c.beginPath();p.points.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.stroke();}
 for(const p of [...layout.camps,...(layout.arena?[layout.arena]:[])]){c.fillStyle=pattern(road,6);c.beginPath();c.arc(p.x,p.z,'r'in p?Number(p.r):3,0,Math.PI*2);c.fill();}
 for(const water of layout.water){
  const outline=(scale:number)=>{c.beginPath();for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,r=scale+.015*Math.sin(a*7)+.012*Math.cos(a*11);const x=water.x+Math.cos(a)*water.rx*r,z=water.z+Math.sin(a)*water.rz*r;i?c.lineTo(x,z):c.moveTo(x,z);}c.closePath();};
  c.fillStyle=forest?'#374a4355':'#6e795555';outline(1.1);c.fill();c.fillStyle=pattern(waterArt,5);outline(1.035);c.fill();
  if(water.bridgeZ!==undefined){c.fillStyle='#9b8058';c.fillRect(water.x-water.rx-.7,water.bridgeZ-(water.bridgeHalf??1.3),(water.rx+.7)*2,(water.bridgeHalf??1.3)*2);}
 }
 const props:FieldProp[]=[];
 function prop(name:string,x:number,z:number,h:number){const a=env.assets.find((a:any)=>a.name===name);if(!a)throw Error('Missing environment art '+name);props.push({x,z,image:sources.get(a.atlas)!,rect:a.rect,w:h*a.rect[2]/a.rect[3],h,anchor:a.anchor});}
 if(forest){
  const fm=await assets.json<any>('/assets/env-forest/manifest.json');
  const atlas=await assets.image('/assets/env-forest/'+fm.atlases[0].file);
  for(const o of layout.obstacles){const a=fm.assets.find((a:any)=>a.name===(o.kind==='dead'?'silver':o.kind))??fm.assets.find((a:any)=>a.name==='pine'),h=6+o.r*1.5;props.push({x:o.x,z:o.z,image:atlas,rect:a.rect,w:h*a.rect[2]/a.rect[3],h,anchor:a.anchor});}
 }else layout.obstacles.forEach((o,i)=>prop(o.kind==='pillar'?(i%2?'pillar-fluted':'pillar-square'):o.kind==='rock-cluster'?'rock-cluster':o.kind==='boulder'?(id==='canyon'?'boulder-tall':'boulder-round'):i%3?'tree-round':'tree-tall',o.x,o.z,o.kind==='pillar'?4.2:o.kind==='rock-cluster'?o.r*3:o.kind==='boulder'?o.r*(id==='canyon'?4:2.6):5.3+o.r*1.7));
 // Landmark footprints remain authoritative even where old meshes have been replaced by painted props.
 if(id==='meadow')for(const b of MEADOW_LANDMARKS.boxes)prop('boulder-round',b.x,b.z,Math.max(b.w,b.d)*1.25);
 if(id==='meadow')for(const p of MEADOW_LANDMARKS.circles)prop(p.kind==='giant-tree'?'tree-round':'boulder-tall',p.x,p.z,p.kind==='giant-tree'?10:2.4);
 for(const p of layout.camps){prop('tent',p.x+3.5,p.z+1.5,3.1);prop('campfire',p.x,p.z,1.1);prop('signpost',p.x-2.8,p.z-1.5,1.9);}
 for(const water of layout.water)for(let i=0;i<22;i++){const a=i/22*Math.PI*2,x=water.x+Math.cos(a)*water.rx*1.05,z=water.z+Math.sin(a)*water.rz*1.05;if(water.bridgeZ!==undefined&&Math.abs(z-water.bridgeZ)<(water.bridgeHalf??1.3)+.5)continue;prop(i%3?'reeds-1':'boulder-flat',x,z,i%3?.85:1.1);}
 return {plane,props,layout};
}
