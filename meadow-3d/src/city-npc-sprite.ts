/** Keep the original atlas pixels: a 28 px/metre bake becomes blurry on HiDPI. */
export type NpcSprite={source:HTMLImageElement;rect:[number,number,number,number];width:number;height:number};
export function npcSprite(source:HTMLImageElement,rect:[number,number,number,number],height:number):NpcSprite{
 return {source,rect,width:height*rect[2]/rect[3],height};
}
export function drawNpcSprite(c:CanvasRenderingContext2D,sprite:NpcSprite,x:number,y:number,scale:number){
 const previous=c.imageSmoothingQuality;c.imageSmoothingQuality='high';
 c.drawImage(sprite.source,...sprite.rect,x-sprite.width*scale/2,y-sprite.height*scale,sprite.width*scale,sprite.height*scale);
 c.imageSmoothingQuality=previous;
}
