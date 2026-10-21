import {CITY_NPC_CLIPS} from './city-npc-clips.ts';

/** Sample the atlas directly: a low-resolution world bake becomes blurry on HiDPI. */
export type NpcSprite={source:HTMLImageElement;rect:[number,number,number,number];width:number;height:number;anchor?:[number,number];animation?:{frames:[number,number,number,number][];duration:number;feet?:number[]}};
export function npcSprite(source:HTMLImageElement,rect:[number,number,number,number],height:number):NpcSprite{
 return {source,rect,width:height*rect[2]/rect[3],height};
}
const NPC_CLIPS=CITY_NPC_CLIPS;
export type CityNpcArt=keyof typeof NPC_CLIPS;
export const cityNpcWorldHeight=(art:CityNpcArt)=>NPC_CLIPS[art].worldHeight;
export function cityNpcSprite(source:HTMLImageElement,art:CityNpcArt):NpcSprite{
 const clip=NPC_CLIPS[art],[w,h]=clip.cell,[left,top,right,bottom]=clip.bodyBounds;
 // One native scale/pivot for the entire clip; changes in padding must not move the feet.
 const sprite=npcSprite(source,[0,0,w,h],clip.worldHeight*h/(bottom-top));
 sprite.anchor=[(left+right)/2/w,bottom/h];
 sprite.animation={duration:clip.duration,feet:[...clip.feet],frames:clip.rects.map(r=>[...r] as [number,number,number,number])};
 return sprite;
}
export async function loadCityNpcSprites(image:(path:string)=>Promise<HTMLImageElement>,arts:readonly CityNpcArt[]):Promise<Map<string,NpcSprite>>{
 const ids=[...new Set(arts)];
 return new Map(await Promise.all(ids.map(async id=>[id,cityNpcSprite(await image(NPC_CLIPS[id].file),id)] as const)));
}
export function drawNpcSprite(c:CanvasRenderingContext2D,sprite:NpcSprite,x:number,y:number,scale:number,elapsed=0){
 const previous=c.imageSmoothingQuality;c.imageSmoothingQuality='high';
 const animation=sprite.animation,index=animation?Math.floor(Math.max(0,elapsed)%animation.duration/animation.duration*animation.frames.length):0,rect=animation?animation.frames[index]:sprite.rect;
 const anchor=sprite.anchor??[.5,1],foot=animation?.feet?.[index];
 const anchorY=foot===undefined?anchor[1]:foot/rect[3];
 c.drawImage(sprite.source,...rect,x-sprite.width*scale*anchor[0],y-sprite.height*scale*anchorY,sprite.width*scale,sprite.height*scale);
 c.imageSmoothingQuality=previous;
}
