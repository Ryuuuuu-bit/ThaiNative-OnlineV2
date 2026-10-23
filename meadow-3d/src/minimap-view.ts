export interface MinimapView {k:number;ox:number;oy:number}
/** Each layer owns its clip, so UI markers cannot escape and clips cannot accumulate. */
export function paintMinimapLayer(ctx:CanvasRenderingContext2D,size:number,view:MinimapView,draw:()=>void,background?:string){
 ctx.save();
 try{
  ctx.setTransform(1,0,0,1,0,0);ctx.beginPath();ctx.arc(size/2,size/2,size/2,0,Math.PI*2);ctx.clip();
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,size,size);}
  ctx.setTransform(view.k,0,0,view.k,view.ox,view.oy);draw();
 }finally{ctx.restore();}
}
