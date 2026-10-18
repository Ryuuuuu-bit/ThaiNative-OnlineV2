import {bake,type Sprite} from './city-2d-art';
import {project} from './city-2d-sim';
import {gateTransform} from './city-2d-gates';

type ArtAsset={id:string;rect:[number,number,number,number];clip?:[number,number][]};
type ArtGroup={image:string;assets:ArtAsset[]};
type ArtManifest=Record<string,ArtGroup>;
export async function loadPaintedCityScene(){
  const response=await fetch('/assets/city-painted-v1/theme-manifest.json');
  if(!response.ok)throw new Error('โหลดชุดภาพสิ่งแวดล้อมไม่สำเร็จ');
  const manifest=await response.json() as ArtManifest;
  const sources=new Map<string,{asset:ArtAsset;image:HTMLImageElement}>();
  await Promise.all(Object.values(manifest).map(async group=>{
    const image=new Image();image.src=group.image;await image.decode();
    for(const asset of group.assets)sources.set(asset.id,{asset,image});
  }));
  const cache=new Map<string,Sprite>();
  function sprite(id:string,w:number,bottom=0,h?:number){
    const key=[id,w,bottom,h].join(':');if(cache.has(key))return cache.get(key)!;
    const source=sources.get(id);if(!source)throw new Error('ไม่มีภาพ '+id);
    const {asset,image}=source;const height=h??w*asset.rect[3]/asset.rect[2];
    const result=bake(c=>{
      if(asset.clip){c.beginPath();asset.clip.forEach(([x,y],i)=>{const xx=-w/2+(x-asset.rect[0])/asset.rect[2]*w,yy=bottom-height+(y-asset.rect[1])/asset.rect[3]*height;i?c.lineTo(xx,yy):c.moveTo(xx,yy);});c.closePath();c.clip();}
      c.drawImage(image,...asset.rect,-w/2,bottom-height,w,height);
    });
    cache.set(key,result);return result;
  }
  function footprint(id:string,w:number,d:number,overhang=1.08){
    return sprite(id,(.83205*w+.5547*d)*overhang,(.39223*w+.58835*d)/2);
  }
  function upright(id:string,height:number){
    const source=sources.get(id);if(!source)throw new Error('ไม่มีภาพ '+id);
    return sprite(id,height*source.asset.rect[2]/source.asset.rect[3],.1,height);
  }
  // Match the painted panel's two ground endpoints to the map projection.
  // Vertical scaling is separate, keeping wall height consistent on both axes.
  function wall(axis:'x'|'z',length:number){
    const id='wall-'+axis,key=id+length;if(cache.has(key))return cache.get(key)!;
    const {asset,image}=sources.get(id)!;
    const [a,b]=axis==='x'?[[68,247],[453,431]]:[[648,443],[965,245]];
    const from=axis==='x'?project(-length/2,0):project(0,length/2);
    const to=axis==='x'?project(length/2,0):project(0,-length/2);
    const sx=(to.x-from.x)/(b[0]-a[0]),sy=.0205;
    const skew=(to.y-from.y-sy*(b[1]-a[1]))/(b[0]-a[0]);
    const tx=from.x-sx*a[0],ty=from.y-skew*a[0]-sy*a[1];
    const result=bake(c=>{c.transform(sx,skew,0,sy,tx,ty);c.drawImage(image,...asset.rect,...asset.rect);});
    cache.set(key,result);return result;
  }
  function gate(axis:'x'|'z'){
    const id='gate-'+axis,key=id+':aligned';if(cache.has(key))return cache.get(key)!;
    const {asset,image}=sources.get(id)!,t=gateTransform(axis);
    const result=bake(c=>{c.transform(t.sx,t.skew,0,t.sy,t.tx,t.ty);c.drawImage(image,...asset.rect,...asset.rect);});
    cache.set(key,result);return result;
  }
  return {sprite,footprint,upright,wall,gate,assetCount:sources.size};
}
