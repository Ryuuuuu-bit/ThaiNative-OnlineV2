import {CanvasAssets} from '../game-2d-assets';
import {monsterSpecies} from '../monster-animation';
let assets:Promise<{assets:CanvasAssets;basic:any;hunting:any}>|undefined;
function load(){return assets??=(async()=>{const manifest=await(await fetch('/texture-manifest.json')).json(),assets=new CanvasAssets(manifest),[basic,hunting]=await Promise.all([assets.json<any>('/assets/monsters-painted/manifest.json'),assets.json<any>('/assets/monsters-hunting/manifest.json')]);return{assets,basic,hunting};})().catch(e=>{assets=undefined;throw e;});}
export async function paintMonster(canvas:HTMLCanvasElement,id:string,boss=false){
 const {assets,basic,hunting}=await load(),fresh=hunting.species[id],def=fresh??basic.species[monsterSpecies(id,boss)],motion=def.motions.idle;
 const image=await assets.image((fresh?'/assets/monsters-hunting/':'/assets/monsters-painted/')+motion.file);
 const [x0,y0,x1,y1]=motion.directions[0][0].bounds,sw=x1-x0,sh=y1-y0,w=canvas.width,h=canvas.height,s=Math.min(w*.78/sw,h*.86/sh);
 const c=canvas.getContext('2d')!;c.clearRect(0,0,w,h);if(!fresh&&(id==='jelly_mint'||id==='jelly_sky'))c.filter=`hue-rotate(${id==='jelly_mint'?162:220}deg)`;
 c.drawImage(image,x0,y0,sw,sh,(w-sw*s)/2,h*.95-sh*s,sw*s,sh*s);c.filter='none';canvas.classList.add('ready');
}
