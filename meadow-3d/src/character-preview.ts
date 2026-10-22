import{assetImage,assetJSON}from'./asset-request';
import{heroPresentation,PREVIEW_FACING}from'./hero-presentation';
import type{Facing,Motion}from'./sprite-animation';
interface PreviewOptions{motion:Motion;direction:Facing;running?:boolean;anchors?:boolean;frame?:number;hd?:boolean}
const images=new Map<string,Promise<HTMLImageElement>>();
const manifest=assetJSON<Record<string,{webp:string}>>('/texture-manifest.json?v='+import.meta.env.VITE_BUILD_ID);
function imageFor(key:string){if(!images.has(key))images.set(key,manifest.then(m=>assetImage(m[key]?.webp??key)));return images.get(key)!;}
/** Preview the shipping sheets at a fixed body scale rather than fitting each pose. */
export function mountPreview(canvas:HTMLCanvasElement,options:PreviewOptions){
 let state={running:true,anchors:false,...options},image:HTMLImageElement|null=null,clock=0,previous=performance.now(),raf=0,disposed=false;
 const context=canvas.getContext('2d')!;
 const pose=()=>heroPresentation(state.motion,...PREVIEW_FACING[state.direction],clock,state.frame);
 function load(){const key=pose().key;image=null;const promise=imageFor(key);void promise.then(img=>{if(!disposed&&pose().key===key)image=img;}).catch(()=>{});return promise;}
 let ready=load();
 function draw(now:number){if(disposed)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;if(state.running)clock+=dt;
  if(canvas.getClientRects().length){const width=Math.round(canvas.height*1.5);if(canvas.width!==width)canvas.width=width;context.clearRect(0,0,canvas.width,canvas.height);
   const p=pose(),unit=canvas.height/300,scale=unit*p.scale,ground=canvas.height*.82;
   if(state.anchors){context.strokeStyle='#d4b98b66';context.beginPath();context.moveTo(0,ground);context.lineTo(canvas.width,ground);context.moveTo(canvas.width/2,0);context.lineTo(canvas.width/2,canvas.height);context.stroke();}
   if(image){const cell=p.cell;context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,cell.column*image.width/cell.columns,cell.row*image.height/cell.rows,image.width/cell.columns,image.height/cell.rows,canvas.width/2-p.w*scale/2,ground-p.feet*scale,p.w*scale,p.h*scale);}}
  raf=requestAnimationFrame(draw);
 }raf=requestAnimationFrame(draw);
 return{get ready(){return ready;},set(next:Partial<PreviewOptions>){const before=pose().key,changed=next.motion&&next.motion!==state.motion;state={...state,...next};if(changed)clock=0;if(before!==pose().key)ready=load();},dispose(){disposed=true;cancelAnimationFrame(raf);}};
}
