import {BIOME_IDS,LAYOUTS,type BiomeMapId,type MapId} from '@the-beginning-online/shared/maps';
import type {CanvasAssets} from './game-2d-assets';
import type {FieldProp} from './game-2d-fields';
import desert from './assets/biome-desert-v1.webp?url';
import frost from './assets/biome-frost-v1.webp?url';
import yokai from './assets/biome-yokai-v1.webp?url';
import dragon from './assets/biome-dragon-v1.webp?url';
import volcano from './assets/biome-volcano-v1.webp?url';
import fae from './assets/biome-fae-v1.webp?url';
import ocean from './assets/biome-ocean-v1.webp?url';
import astral from './assets/biome-astral-v1.webp?url';
import abyss from './assets/biome-abyss-v1.webp?url';
import confluence from './assets/biome-confluence-v1.webp?url';
import yokaiBamboo from './assets/biome-yokai-bamboo-detail-v1.webp?url';
import yokaiLantern from './assets/biome-yokai-lantern-detail-v1.webp?url';
import frostPine from './assets/biome-frost-pine-detail-v1.webp?url';
import fjordWreck from './assets/biome-fjord-wreck-detail-v1.webp?url';
import sand from './assets/biome-desert-surface-v1.webp?url';
import snow from './assets/biome-frost-surface-v1.webp?url';
import ash from './assets/biome-volcano-surface-v1.webp?url';
import limestone from './assets/biome-ocean-surface-v1.webp?url';
import stardust from './assets/biome-astral-surface-v1.webp?url';
import basalt from './assets/biome-abyss-surface-v1.webp?url';
import snowRock from './assets/biome-snow-rock-surface-v1.webp?url';
import coralRock from './assets/biome-coral-rock-surface-v1.webp?url';
import basaltRock from './assets/biome-basalt-rock-surface-v1.webp?url';
import sandstoneRock from './assets/biome-sandstone-rock-detail-v1.webp?url';
import oasisPalm from './assets/biome-oasis-palm-detail-v1.webp?url';
import jadeBamboo from './assets/biome-jade-bamboo-detail-v1.webp?url';
import starCrystal from './assets/biome-star-crystal-detail-v1.webp?url';

export const isBiomeMap=(id:MapId):id is BiomeMapId=>(BIOME_IDS as readonly string[]).includes(id);
export const BIOME_GROUND:Partial<Record<BiomeMapId,string>>={desert:sand,frost:snow,volcano:ash,ocean:limestone,astral:stardust,abyss:basalt,confluence:stardust};
export const BIOME_ROCK:Partial<Record<BiomeMapId,string>>={desert:sandstoneRock,frost:snowRock,dragon:jadeBamboo,yokai:yokaiBamboo,ocean:coralRock,volcano:basaltRock,abyss:basaltRock,astral:starCrystal,confluence:starCrystal};
export async function biomeRockProps(id:BiomeMapId,assets:CanvasAssets,points:{x:number;z:number;r:number}[]):Promise<FieldProp[]>{
 const image=await assets.image(BIOME_ROCK[id]!);
 return points.map(p=>{const h=(id==='dragon'||id==='yokai')?5+p.r:1.5+p.r*.65;return{x:p.x,z:p.z,image,rect:[0,0,image.width,image.height],w:h*image.width/image.height,h,anchor:[.5,.94],tree:id==='dragon'||id==='yokai',foliage:id==='dragon'||id==='yokai'};});
}
export async function desertPalms(assets:CanvasAssets):Promise<FieldProp[]>{const image=await assets.image(oasisPalm);return LAYOUTS.desert.obstacles.filter(o=>o.kind==='oasis-palm').map(o=>({x:o.x,z:o.z,image,rect:[0,0,image.width,image.height],w:7*image.width/image.height,h:7,anchor:[.5,.94],tree:true,foliage:true}));}
export async function frostDetails(assets:CanvasAssets):Promise<FieldProp[]>{const images=await Promise.all([assets.image(frostPine),assets.image(fjordWreck)]);return LAYOUTS.frost.obstacles.filter(o=>o.kind==='frost-pine'||o.kind==='fjord-wreck').map(o=>{const tree=o.kind==='frost-pine',image=images[tree?0:1],h=tree?7+o.r:4.6;return{x:o.x,z:o.z,image,rect:[0,0,image.width,image.height],w:h*image.width/image.height,h,anchor:[.5,.96],tree,foliage:tree};});}
export async function yokaiDetails(assets:CanvasAssets):Promise<FieldProp[]>{const image=await assets.image(yokaiLantern);return LAYOUTS.yokai.obstacles.filter(o=>o.kind==='yokai-lantern').map(o=>({x:o.x,z:o.z,image,rect:[0,0,image.width,image.height],w:3.2*image.width/image.height,h:3.2,anchor:[.5,.96]}));}
export const BIOME_SCENES:Record<BiomeMapId,{image:string;ground:string;water:string;accent:string;stone:boolean;h:number}>={
 desert:{image:desert,ground:'#c8a16cee',water:'#529d9cdd',accent:'#edcb8b',stone:true,h:13},
 frost:{image:frost,ground:'#bbd1daee',water:'#367b9cdd',accent:'#e8f7ff',stone:true,h:14},
 yokai:{image:yokai,ground:'#607d6cbb',water:'#77638dcc',accent:'#efb9d3',stone:false,h:13},
 dragon:{image:dragon,ground:'#658b78bb',water:'#68adaddd',accent:'#b5d6bc',stone:false,h:16},
 volcano:{image:volcano,ground:'#3e3537ee',water:'#e05e27ee',accent:'#e99c42',stone:true,h:15},
 fae:{image:fae,ground:'#526860cc',water:'#8b79abcc',accent:'#c6a1e4',stone:false,h:14},
 ocean:{image:ocean,ground:'#8da99fee',water:'#318fa6ee',accent:'#d9c0a6',stone:true,h:15},
 astral:{image:astral,ground:'#434663ee',water:'#6968b0ee',accent:'#c3b4ed',stone:true,h:16},
 abyss:{image:abyss,ground:'#414d50ee',water:'#36565dee',accent:'#849e98',stone:true,h:15},
 confluence:{image:confluence,ground:'#787d91dd',water:'#6c91b8dd',accent:'#d9cfa7',stone:true,h:17},
};
/** Baked world-space motifs; every impassable pool uses the server's exact ellipse. */
export function paintBiomeGround(c:CanvasRenderingContext2D,id:BiomeMapId){
 if(id==='frost'){
  const a=LAYOUTS.frost.arena!;c.save();
  for(const x of [-6,-3,0,3,6])for(const z of [-6,-3,0,3,6]){
   const px=a.x+x,pz=a.z+z,points=Array.from({length:8},(_,i)=>{const t=i*Math.PI/4,r=1.04+Math.sin(x*7+z*3+i*5)*.12;return{ x:px+Math.cos(t)*r,z:pz+Math.sin(t)*r*.9};});
   const outline=(offset:number)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.z+offset):c.moveTo(p.x,p.z+offset));c.closePath();};
   outline(.16);c.fillStyle='#647c89';c.fill();outline(0);const stone=c.createLinearGradient(px-.8,pz-.7,px+.8,pz+.7);stone.addColorStop(0,'#d2dfe0');stone.addColorStop(.5,'#aec4cc');stone.addColorStop(1,'#8ea9b5');c.fillStyle=stone;c.strokeStyle='#738f9c';c.lineWidth=.045;c.fill();c.stroke();
   c.strokeStyle='#728e9a88';c.beginPath();c.moveTo(px-.8,pz-.3);c.lineTo(px-.22,pz-.1);c.lineTo(px+.05,pz-.4);c.lineTo(px+.36,pz-.32);c.stroke();c.strokeStyle='#e9f1edcc';c.lineWidth=.09;c.beginPath();c.moveTo(points[4].x,points[4].z);c.lineTo(points[5].x,points[5].z);c.lineTo(points[6].x,points[6].z);c.stroke();
  }c.restore();
 }
 const arena=LAYOUTS[id].arena;
 if(arena&&['dragon','volcano','fae','ocean','astral','abyss','confluence'].includes(id)){
  const scene=BIOME_SCENES[id];c.save();c.translate(arena.x,arena.z);
  const floor=c.createRadialGradient(0,0,1,0,0,arena.r);floor.addColorStop(0,scene.ground);floor.addColorStop(1,scene.ground.slice(0,7)+'00');c.fillStyle=floor;c.beginPath();c.arc(0,0,arena.r,0,Math.PI*2);c.fill();
  for(let ring=0;ring<2;ring++){c.strokeStyle=scene.accent+(ring?'66':'99');c.lineWidth=ring?.09:.16;c.beginPath();c.arc(0,0,arena.r*(ring?.8:.95),0,Math.PI*2);c.stroke();}
  for(let i=0;i<12;i++){const t=i*Math.PI/6;c.save();c.rotate(t);c.fillStyle=scene.accent+'99';c.beginPath();c.moveTo(arena.r*.87,-.18);c.lineTo(arena.r*.94,0);c.lineTo(arena.r*.87,.18);c.lineTo(arena.r*.81,0);c.closePath();c.fill();c.restore();}
  c.restore();
 }
 if(BIOME_GROUND[id])return;
 const l=LAYOUTS[id],scene=BIOME_SCENES[id];c.save();
 for(let x=-l.halfX+3;x<l.halfX;x+=5)for(let z=-l.halfZ+3;z<l.halfZ;z+=5){
  const n=Math.sin(x*12.73+z*4.21),px=x+n*1.8,pz=z+Math.cos(x*3.1-z)*1.4;
  c.strokeStyle=scene.accent+'66';c.fillStyle=scene.accent+'55';c.lineWidth=.09;
  if(id==='desert'){c.beginPath();c.ellipse(px,pz,1.4,.28,-.2,0,Math.PI);c.stroke();c.beginPath();c.ellipse(px,pz+.45,1.7,.28,-.2,0,Math.PI);c.stroke();}
  else if(id==='volcano'||id==='abyss'){c.strokeStyle=id==='volcano'?'#c7753e66':'#222e3b99';c.beginPath();c.moveTo(px-1,pz-1);c.lineTo(px+.4,pz-.2);c.lineTo(px-.2,pz+1);c.lineTo(px+1.2,pz+1.5);c.stroke();}
  else if(id==='astral'||id==='confluence'){c.beginPath();c.arc(px,pz,.16,0,Math.PI*2);c.fill();if(n>.7){c.beginPath();c.moveTo(px-.5,pz);c.lineTo(px+.5,pz);c.moveTo(px,pz-.5);c.lineTo(px,pz+.5);c.stroke();}}
  else if(id==='frost'){c.beginPath();c.ellipse(px,pz,1.5,.7,n,0,Math.PI*2);c.fill();}
  else if(id==='ocean'){c.strokeStyle=n>0?'#eac8ad88':'#639c9799';for(let k=0;k<3;k++){c.beginPath();c.moveTo(px,pz);c.quadraticCurveTo(px+(k-1)*.8,pz-.7,px+(k-1)*.7,pz-1.1);c.stroke();}}
  else{c.beginPath();c.ellipse(px,pz,.18,.1,n,0,Math.PI*2);c.fill();if(id==='yokai'||id==='fae'){c.beginPath();c.ellipse(px+.3,pz-.2,.15,.1,1,0,Math.PI*2);c.fill();}}
 }
 c.restore();
}
export function paintBiomeWater(c:CanvasRenderingContext2D,id:BiomeMapId,road:CanvasPattern){
 const scene=BIOME_SCENES[id];c.save();
 for(const w of LAYOUTS[id].water){c.fillStyle=scene.water.slice(0,7)+(id==='volcano'?'ee':'33');c.beginPath();c.ellipse(w.x,w.z,w.rx,w.rz,0,0,Math.PI*2);c.fill();
  for(let i=0;i<9;i++){const z=w.z-w.rz*.7+i*w.rz*.16;if(w.bridgeZ!==undefined&&Math.abs(z-w.bridgeZ)<(w.bridgeHalf??1)+.5)continue;const span=w.rx*Math.sqrt(Math.max(0,1-((z-w.z)/w.rz)**2))*.8;c.strokeStyle=scene.accent+'55';c.lineWidth=.13;c.beginPath();c.moveTo(w.x-span,z);c.quadraticCurveTo(w.x,z+.3,w.x+span,z);c.stroke();}
  if(w.bridgeZ!==undefined){c.fillStyle=road;c.fillRect(w.x-w.rx-.7,w.bridgeZ-w.bridgeHalf!,(w.rx+.7)*2,w.bridgeHalf!*2);c.strokeStyle='#64695c88';c.lineWidth=.12;for(const side of [-1,1]){c.beginPath();c.moveTo(w.x-w.rx-.7,w.bridgeZ+side*w.bridgeHalf!);c.lineTo(w.x+w.rx+.7,w.bridgeZ+side*w.bridgeHalf!);c.stroke();}}
 }
 c.restore();
}
export async function biomeLandmark(id:BiomeMapId,assets:CanvasAssets):Promise<FieldProp>{
 const scene=BIOME_SCENES[id],image=await assets.image(scene.image),solid=LAYOUTS[id].obstacles.find(o=>o.kind==='biome-landmark')!;
 return{x:solid.x,z:solid.z,image,rect:[0,0,image.width,image.height],w:scene.h*image.width/image.height,h:scene.h,anchor:[.5,.94]};
}
