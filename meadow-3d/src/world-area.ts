import {project2D} from './game-2d-projection.ts';
import {placeWorldLabel,type Rect} from './world-labels.ts';

type AreaKind='travel'|'camp';
const axisX=project2D(1,0),axisZ=project2D(0,1);

/** Ground engraving uses the same projection and radius as the existing area marker. */
export function drawAreaRing(c:CanvasRenderingContext2D,q:{x:number;y:number},radius:number,scale:number,color:string,active:boolean){
 c.save();const transform=c.getTransform();
 c.globalAlpha=active?1:.9;
 const arc=(r:number,start=0,end=Math.PI*2)=>{
  c.beginPath();c.transform(axisX.x*scale,axisX.y*scale,axisZ.x*scale,axisZ.y*scale,q.x,q.y);
  c.arc(0,0,r,start,end);c.setTransform(transform);
 };
 arc(radius);c.fillStyle=color+'0c';c.fill();c.strokeStyle='#24372d90';c.lineWidth=4;c.stroke();c.strokeStyle=color+'b0';c.lineWidth=1;c.stroke();
 arc(radius*.76);c.strokeStyle=color+'b0';c.setLineDash([2,5]);c.stroke();c.setLineDash([]);
 c.strokeStyle=color;c.lineWidth=active?2:1.5;
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2;arc(radius*.96,a+.16,a+Math.PI/2-.16);c.stroke();
  const p=project2D(Math.cos(a)*radius,Math.sin(a)*radius),x=q.x+p.x*scale,y=q.y+p.y*scale;
  c.beginPath();c.moveTo(x,y-4);c.lineTo(x+5,y);c.lineTo(x,y+4);c.lineTo(x-5,y);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#24372d';c.lineWidth=1;c.stroke();c.strokeStyle=color;c.lineWidth=active?2:1.5;
 }
 c.restore();
}

function areaIcon(c:CanvasRenderingContext2D,x:number,y:number,kind:AreaKind){
 c.beginPath();
 if(kind==='camp'){
  c.moveTo(x-7,y+5);c.lineTo(x,y-6);c.lineTo(x+7,y+5);c.closePath();c.moveTo(x,y-6);c.lineTo(x+2,y+5);c.moveTo(x-9,y+7);c.lineTo(x+9,y+7);
 }else{
  c.moveTo(x-6,y+6);c.lineTo(x-6,y-1);c.quadraticCurveTo(x-6,y-7,x,y-7);c.quadraticCurveTo(x+6,y-7,x+6,y-1);c.lineTo(x+6,y+6);
  c.moveTo(x-9,y+7);c.lineTo(x+9,y+7);c.moveTo(x,y+3);c.lineTo(x,y-2);c.moveTo(x-3,y+1);c.lineTo(x,y-2);c.lineTo(x+3,y+1);
 }
 c.stroke();
}

/** Two-line area plaque, placed in the same collision lanes as actor nameplates. */
export function drawAreaTag(c:CanvasRenderingContext2D,q:{x:number;y:number},title:string,detail:string,kind:AreaKind,color:string,occupied:readonly Rect[]):Rect|null{
 c.save();c.font='600 12px Inter,"Noto Sans Thai",sans-serif';const titleWidth=c.measureText(title).width;
 c.font='500 10px Inter,"Noto Sans Thai",sans-serif';const width=Math.max(150,Math.max(titleWidth,c.measureText(detail).width)+60);
 const r=placeWorldLabel(q.x,q.y,width,occupied,44);
 if(!r){c.restore();return null;}
 c.beginPath();c.roundRect(r.left,r.top,width,44,7);c.fillStyle='#122923ee';c.fill();c.strokeStyle=color+'88';c.lineWidth=1;c.stroke();
 c.beginPath();c.moveTo(r.left+44,r.top+10);c.lineTo(r.left+44,r.bottom-10);c.strokeStyle=color+'45';c.stroke();
 c.strokeStyle=color;c.lineWidth=1.4;areaIcon(c,r.left+23,r.top+21,kind);
 c.textAlign='left';c.textBaseline='alphabetic';c.font='600 12px Inter,"Noto Sans Thai",sans-serif';c.fillStyle='#f4ecd8';c.fillText(title,r.left+54,r.top+18);
 c.font='500 10px Inter,"Noto Sans Thai",sans-serif';c.fillStyle=color;c.fillText(detail,r.left+54,r.top+34);
 c.beginPath();c.moveTo(q.x-3,r.bottom);c.lineTo(q.x,r.bottom+4);c.lineTo(q.x+3,r.bottom);c.fillStyle=color;c.fill();
 c.restore();return r;
}
