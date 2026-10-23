import type {MapId} from '@the-beginning-online/shared/maps';
import {fieldPalette} from './field-palette.ts';
import type {CanvasAssets} from './game-2d-assets';

export const FIELD_GRASS_SIZE=14,FIELD_ROAD_SIZE=8;
/** Reuse the approved leafy city trees without loading the rest of the city theme. */
export async function meadowTrees(assets:CanvasAssets){
 const manifest=await assets.json<{assets:Record<string,{image:string;views:{rect:number[];anchor:number[]}[]}>}>('/assets/city-sprite-v2/manifest.json');
 return new Map(await Promise.all(['tree-round','tree-tall','tree-flowering'].map(async name=>{const a=manifest.assets[name];return [name,{image:await assets.image(a.image),...a.views[0]}] as const;})));
}

/** Entry roads and playable paths share the same surface across the map boundary. */
export function fieldRoadTexture(id:MapId){
 if(['desert','frost','ocean','astral','abyss','confluence','dragon','ruins','temple','summit','canyon'].includes(id))return '/assets/field-painted-v2/stone.webp';
 if(id==='city_plaza')return '/assets/city-sprite-v2/ground-road.webp';
 return '/assets/field-painted-v2/dirt.webp';
}
export function paintFieldPath(c:CanvasRenderingContext2D,points:readonly (readonly number[])[],width:number,pattern:CanvasPattern){
 c.save();c.strokeStyle=pattern;c.lineCap=c.lineJoin='round';
 for(const [extra,alpha]of [[1.4,.08],[.9,.16],[.45,.3],[0,.9]]){
  c.globalAlpha=alpha;c.lineWidth=width*2+extra;c.beginPath();
  points.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.stroke();
 }
 c.restore();
}
/** Low-frequency colour variation breaks texture repetition; baked once with the ground. */
export function groundWear(c:CanvasRenderingContext2D,halfX:number,halfZ:number,id:MapId){
 if(id==='city_plaza')return;
 c.save();
 for(let x=-halfX;x<=halfX;x+=9)for(let z=-halfZ;z<=halfZ;z+=9){
  const n=Math.sin(x*12.7+z*3.1)*43758.54,f=n-Math.floor(n),px=x+(f-.5)*6,pz=z+Math.sin(n)*3,r=2.5+f*3.5;
  const colour=fieldPalette(id).wear;
  const g=c.createRadialGradient(px,pz,0,px,pz,r);g.addColorStop(0,`rgba(${colour},.1)`);g.addColorStop(1,`rgba(${colour},0)`);
  c.fillStyle=g;c.fillRect(px-r,pz-r,r*2,r*2);
 }
 c.restore();
}
