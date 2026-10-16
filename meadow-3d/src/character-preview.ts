import{assetImage,assetJSON}from'./asset-request';
import{atlasCell,motionFrame}from'./sprite-animation';import type{Direction,Motion}from'./sprite-animation';
interface PreviewOptions{motion:Motion;direction:Direction;running?:boolean;anchors?:boolean;frame?:number;hd?:boolean}
const images=new Map<string,Promise<HTMLImageElement>>();const manifest=assetJSON<Record<string,{webp:string}>>('/texture-manifest.json?v='+import.meta.env.VITE_BUILD_ID);
function imageFor(motion:Motion,hd:boolean){const path=`/assets/hero-painted/${hd?'preview/':''}hero-${motion}-v1.png`;if(!images.has(path))images.set(path,manifest.then(m=>assetImage(m[path].webp)));return images.get(path)!;}
/** Shared idle/animation preview for the public atelier and character creation. */
export function mountPreview(canvas:HTMLCanvasElement,options:PreviewOptions){
 let state={running:true,anchors:false,hd:false,...options},image:HTMLImageElement|null=null,clock=0,previous=performance.now(),raf=0,disposed=false;
 const context=canvas.getContext('2d')!;
 function load(){const motion=state.motion;const promise=imageFor(motion,state.hd);void promise.then(img=>{if(!disposed&&state.motion===motion)image=img;}).catch(()=>{});return promise;}
 let ready=load();
 function draw(now:number){if(disposed)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;if(state.running)clock+=dt;
  if(canvas.getClientRects().length){const width=canvas.height*(state.motion==='death'?2:1.5);if(canvas.width!==width)canvas.width=width;context.clearRect(0,0,canvas.width,canvas.height);
   if(image){const cell=atlasCell(state.motion,state.direction,state.frame??motionFrame(state.motion,clock)),w=image.width/cell.columns,h=image.height/cell.rows;context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';if(state.anchors){context.strokeStyle='#d4b98b66';context.beginPath();context.moveTo(0,canvas.height*240/256);context.lineTo(canvas.width,canvas.height*240/256);context.moveTo(canvas.width/2,0);context.lineTo(canvas.width/2,canvas.height);context.stroke();}context.drawImage(image,cell.column*w,cell.row*h,w,h,0,0,canvas.width,canvas.height);}}
  raf=requestAnimationFrame(draw);
 }raf=requestAnimationFrame(draw);
 return{get ready(){return ready;},set(next:Partial<PreviewOptions>){const changed=next.motion&&next.motion!==state.motion;state={...state,...next};if(changed){clock=0;image=null;ready=load();}},dispose(){disposed=true;cancelAnimationFrame(raf);}};
}
