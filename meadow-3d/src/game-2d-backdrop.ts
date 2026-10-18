import type {MapId} from '@thainative/shared/maps';
import {CanvasAssets} from './game-2d-assets';
import {boundaryPlants,boundaryRoads} from './game-2d-boundaries';
import {unproject2D} from './game-2d-projection';

export async function loadMapBackdrop(id:MapId,assets:CanvasAssets){
 const base=id==='forest'?'/assets/env-forest/':'/assets/env-painted/';
 const [grass,road,manifest]=await Promise.all([assets.image(id==='canyon'?'/assets/env-forest/tile-path-v1.png':id==='ruins'?'/assets/env-forest/tile-moss-v1.png':id==='forest'?base+'tile-moss-v1.png':'/assets/city-painted-v1/ground-grass-v1.png'),assets.image(id==='forest'?base+'tile-path-v1.png':'/assets/city-painted-v1/ground-'+(id==='city_plaza'?'road':'garden')+'-v1.png'),assets.json<any>(base+'manifest.json')]);
 const names=id==='canyon'?['boulder-tall','rock-cluster','boulder-round','boulder-flat','grass-2','boulder-tall']:id==='ruins'?['tree-round','tree-tall','tree-leaning','boulder-round','fern-wide','tree-tall']:id==='forest'?['pine','oak','silver','rock','fern','hollow']:['tree-round','tree-tall','tree-flowering','boulder-round','bush-flowering','tree-tall'];
 const sprites=await Promise.all(names.map(async name=>{const a=manifest.assets.find((a:any)=>a.name===name);return {...a,image:await assets.image(base+a.atlas)};}));
 const props=boundaryPlants(id).map(p=>{const a=sprites[p.variant],h=p.variant===3?2.2:p.variant===4?1.6:p.h;return {...p,image:a.image as HTMLImageElement,rect:a.rect as number[],w:h*a.rect[2]/a.rect[3],h,anchor:a.anchor as number[]};});
 // Match texture resolution to the backing-store scale once, rather than
 // resampling a full source atlas for every repeated tile on a ground rebuild.
 const tiles=new Map<string,HTMLCanvasElement>();
 function tile(image:HTMLImageElement,metres:number,pixelsPerMetre:number){
  const size=Math.min(image.width,Math.max(32,Math.ceil(metres*pixelsPerMetre/32)*32)),key=`${image.src}|${size}`;
  let out=tiles.get(key);if(!out){out=document.createElement('canvas');out.width=size;out.height=Math.max(1,Math.round(size*image.height/image.width));const context=out.getContext('2d')!;context.imageSmoothingQuality='high';context.drawImage(image,0,0,out.width,out.height);tiles.set(key,out);}return out;
 }
 let grassPattern:CanvasPattern|null=null,roadPattern:CanvasPattern|null=null;
 let patternScale=0;
 return {props,draw(c:CanvasRenderingContext2D,o:{x:number;y:number},s:number,width:number,height:number){
  // Unproject all four viewport corners: the backdrop covers any aspect ratio or zoom,
  // while the collision boundary and gameplay coordinates remain unchanged.
  const points=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>unproject2D((x-o.x)/s,(y-o.y)/s));
  const minX=Math.min(...points.map(p=>p.x))-2,maxX=Math.max(...points.map(p=>p.x))+2,minZ=Math.min(...points.map(p=>p.z))-2,maxZ=Math.max(...points.map(p=>p.z))+2;
  const pixels=s*c.getTransform().a;
  if(patternScale!==pixels){grassPattern=roadPattern=null;tiles.clear();patternScale=pixels;}
  c.save();c.transform(.83205*s,.39223*s,-.5547*s,.58835*s,o.x,o.y);
  if(!grassPattern){const size=id==='city_plaza'?9:7,offset=id==='city_plaza'?-53:0,source=tile(grass,size,pixels);grassPattern=c.createPattern(source,'repeat')!;grassPattern.setTransform(new DOMMatrix().translate(offset,offset).scale(size/source.width));}
  c.fillStyle=grassPattern;c.fillRect(minX,minZ,maxX-minX,maxZ-minZ);
  if(['forest','ruins','canyon'].includes(id)){c.fillStyle=id==='canyon'?'#a5763c44':id==='ruins'?'#68706433':'#233c3d55';c.fillRect(minX,minZ,maxX-minX,maxZ-minZ);}
  if(!roadPattern){const size=id==='city_plaza'?8:5,offset=id==='city_plaza'?-53:0,source=tile(road,size,pixels);roadPattern=c.createPattern(source,'repeat')!;roadPattern.setTransform(new DOMMatrix().translate(offset,offset).scale(size/source.width));}
  c.strokeStyle=roadPattern;c.lineCap='round';
  for(const p of boundaryRoads(id)){c.lineWidth=p.width*2;c.beginPath();c.moveTo(p.x-p.dx,p.z-p.dz);c.lineTo(p.x+p.dx*1000,p.z+p.dz*1000);c.stroke();}
  c.restore();
 }};
}
