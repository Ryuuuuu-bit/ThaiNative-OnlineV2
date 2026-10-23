import type {FieldProp} from './game-2d-fields';
import {CITY,type MapId} from '@the-beginning-online/shared/maps';
import {CanvasAssets} from './game-2d-assets';
import {boundaryPlants,boundaryRoads} from './game-2d-boundaries';
import {unproject2D} from './game-2d-projection';
import {canyonRockProps} from './canyon-rock-art';
import {ruinsProps} from './ruins-art';
import {fieldRoadTexture,paintFieldPath} from './field-ground';
import {isBiomeMap,BIOME_SCENES,BIOME_GROUND,BIOME_ROCK,biomeRockProps} from './biome-scenes';
import {loadCitySpriteTheme} from './city-sprite-theme';

export async function loadMapBackdrop(id:MapId,assets:CanvasAssets){
 const base=(id==='forest'||id==='grove')?'/assets/env-forest/':'/assets/env-painted/';
 const emptyCity=id==='city_plaza'&&CITY.empty;
 const [grass,road,manifest,cityTheme]=await Promise.all([assets.image(id==='city_plaza'?'/assets/city-sprite-v2/ground-grass.webp':isBiomeMap(id)&&BIOME_GROUND[id]?BIOME_GROUND[id]!:(id==='canyon'||id==='summit')?'/assets/env-forest/tile-litter-v1.png':(id==='ruins'||id==='temple'||id==='himmapan')?'/assets/env-forest/tile-moss-v1.png':(id==='forest'||id==='grove')?base+'tile-moss-v1.png':'/assets/city-painted-v1/ground-grass-v1.png'),assets.image(fieldRoadTexture(id)),id==='city_plaza'?null:assets.json<any>(base+'manifest.json'),id==='city_plaza'&&!emptyCity?loadCitySpriteTheme():null]);
 const names=id==='city_plaza'?['tree-round','tree-tall','tree-flowering','bush-flowering','flowers-lavender','tree-tall']:(id==='canyon'||id==='summit'||isBiomeMap(id)&&BIOME_SCENES[id].stone)?['boulder-tall','rock-cluster','boulder-round','boulder-flat','grass-2','boulder-tall']:(id==='ruins'||id==='temple')?['tree-round','tree-tall','tree-leaning','boulder-round','fern-wide','tree-tall']:(id==='forest'||id==='grove')?['pine','oak','silver','rock','fern','hollow']:['tree-round','tree-tall','tree-flowering','boulder-round','bush-flowering','tree-tall'];
 const sprites=emptyCity||(id==='canyon'||id==='summit')||(id==='ruins'||id==='temple')?[]:cityTheme?names.map(name=>{const view=cityTheme.view(name);return {image:view.source,rect:view.rect,anchor:view.anchor};}):await Promise.all(names.map(async name=>{const a=manifest.assets.find((a:any)=>a.name===name);return {...a,image:await assets.image(base+a.atlas)};}));
 const plants=emptyCity?[]:boundaryPlants(id);
 const props:FieldProp[]=isBiomeMap(id)&&BIOME_ROCK[id]?await biomeRockProps(id,assets,plants.filter((_,i)=>i%3===0).map(p=>({...p,r:2.2+(p.h-5)*.25}))):(id==='ruins'||id==='temple')?await ruinsProps(plants.filter((p,i)=>i%6===0),assets,false):(id==='canyon'||id==='summit')?await canyonRockProps(plants.filter((p,i)=>i%4===0).map(p=>({...p,r:2.2+(p.h-5)*.25})),assets):plants.map(p=>{const a=sprites[p.variant],h=p.variant===3?2.2:p.variant===4?1.6:p.h;return {...p,image:a.image as HTMLImageElement,rect:a.rect as number[],w:h*a.rect[2]/a.rect[3],h,anchor:a.anchor as number[],tree:/tree|pine|oak|silver|hollow/.test(names[p.variant])};});
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
  if(isBiomeMap(id)){c.fillStyle=BIOME_GROUND[id]?BIOME_SCENES[id].ground.slice(0,7)+'22':BIOME_SCENES[id].ground;c.fillRect(minX,minZ,maxX-minX,maxZ-minZ);}
  if(emptyCity){c.restore();return;}
  if(['forest','ruins','canyon','grove','summit','temple','himmapan'].includes(id)){c.fillStyle=id==='himmapan'?'#28706a33':id==='temple'?'#b8aa8266':id==='summit'?'#8caddc99':id==='grove'?'#c78c3866':id==='canyon'?'#a5763c44':id==='ruins'?'#68706433':'#233c3d55';c.fillRect(minX,minZ,maxX-minX,maxZ-minZ);}
  if(!roadPattern){const size=id==='city_plaza'?8:5,offset=id==='city_plaza'?-53:0,source=tile(road,size,pixels);roadPattern=c.createPattern(source,'repeat')!;roadPattern.setTransform(new DOMMatrix().translate(offset,offset).scale(size/source.width));}
  c.strokeStyle=roadPattern;c.lineCap='round';
  for(const p of boundaryRoads(id)){
   const points=[[p.x-p.dx,p.z-p.dz],[p.x+p.dx*1000,p.z+p.dz*1000]];
   if(id!=='city_plaza')paintFieldPath(c,points,p.width,roadPattern);
   else{c.lineWidth=p.width*2;c.beginPath();c.moveTo(...points[0] as [number,number]);c.lineTo(...points[1] as [number,number]);c.stroke();}
  }
  c.restore();
 }};
}
