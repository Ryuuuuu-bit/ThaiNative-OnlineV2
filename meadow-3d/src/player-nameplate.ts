import * as T from 'three';
import { titleDefinition } from '@thainative/shared';
/** Draw only when identity/title changes; the render loop retains its pixel-size budget. */
export function updatePlayerNameplate(tag:T.Sprite,name:string,titleId?:string|null){
 const title=titleDefinition(titleId),key=name+'\0'+(title?.id??'');if(tag.userData.identity===key)return;
 tag.userData.identity=key;tag.userData.hasTitle=!!title;
 const c=document.createElement('canvas'),ctx=c.getContext('2d')!;ctx.font='600 22px "Noto Sans Thai",sans-serif';
 const width=ctx.measureText(name).width;ctx.font='600 18px "Noto Sans Thai",sans-serif';c.width=Math.ceil(Math.max(64,width,title?ctx.measureText(title.name).width:0)+24);c.height=title?96:64;
 ctx.textAlign='center';ctx.lineJoin='round';ctx.lineWidth=5;ctx.strokeStyle='#0b1514';
 const text=(s:string,y:number,color:string,size:number)=>{ctx.font=`600 ${size}px "Noto Sans Thai",sans-serif`;ctx.strokeText(s,c.width/2,y);ctx.fillStyle=color;ctx.fillText(s,c.width/2,y);};
 if(title)text(title.name,30,title.color,18);text(name,title?65:37,'#f4f5da',22);
 const material=tag.material as T.SpriteMaterial;material.map?.dispose();material.map=new T.CanvasTexture(c);material.map.colorSpace=T.SRGBColorSpace;material.needsUpdate=true;
 tag.scale.x=tag.scale.y*c.width/c.height;
}
