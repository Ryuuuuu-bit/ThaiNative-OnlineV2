import {RUINS_STRUCTURES} from '@thainative/shared/maps';
import type {CanvasAssets} from './game-2d-assets';
type Point={x:number;z:number;r?:number;kind?:string};
const root='/assets/ruins-painted-v1/';
const widths:Record<string,number>={'wall-x':10,'wall-z':9,house:10,arch:10,temple:12,foundation:9,column:3,pier:3.2,statue:4.8,fallen:4.5,boulder:4.3,rubble:3.3};
/** Native-resolution painted masonry, positioned from authoritative footprints. */
export async function ruinsProps(points:Point[],assets:CanvasAssets,structures=true){
 const m=await assets.json<{atlases:{file:string}[];assets:{name:string;atlas:string;rect:number[];anchor:number[]}[]}>(root+'manifest.json');
 const images=new Map(await Promise.all(m.atlases.map(async a=>[a.file,await assets.image(root+a.file)] as const)));
 const source=structures?[...RUINS_STRUCTURES,...points.filter(p=>p.kind?.startsWith('ruins-')&&p.kind!=='ruins-foot')]:points;
 return source.map((p,i)=>{const name=p.kind?.replace('ruins-','')??['wall-x','wall-z','boulder','rubble','house','fallen'][i%6],a=m.assets.find(a=>a.name===name)!;
  const w=widths[name];return{x:p.x,z:p.z,image:images.get(a.atlas)!,rect:a.rect,w,h:w*a.rect[3]/a.rect[2],anchor:a.anchor};
 });
}
