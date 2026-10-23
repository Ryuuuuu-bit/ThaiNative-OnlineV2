import type {MapId} from '@the-beginning-online/shared/maps';

/** Entry roads and playable paths share the same surface across the map boundary. */
export function fieldRoadTexture(id:MapId){
 if(['desert','frost','ocean','astral','abyss','confluence','dragon'].includes(id))return '/assets/env-painted/tile-stone-v1.png';
 if(id==='city_plaza')return '/assets/city-painted-v1/ground-road-v1.png';
 if(id==='ruins'||id==='temple')return '/assets/env-painted/tile-stone-v1.png';
 if(id==='himmapan')return '/assets/env-forest/tile-path-v1.png';
 if((id==='forest'||id==='grove')||(id==='canyon'||id==='summit'))return '/assets/env-forest/tile-path-v1.png';
 return '/assets/env-painted/tile-dirt-v1.png';
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
  const colour=(id==='canyon'||id==='summit')?(f>.5?'139,100,56':'39,31,24'):id==='ruins'?'44,55,37':f>.5?'164,155,78':'31,67,37';
  const g=c.createRadialGradient(px,pz,0,px,pz,r);g.addColorStop(0,`rgba(${colour},.18)`);g.addColorStop(1,`rgba(${colour},0)`);
  c.fillStyle=g;c.fillRect(px-r,pz-r,r*2,r*2);
 }
 c.restore();
}
