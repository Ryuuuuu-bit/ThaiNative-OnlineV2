import { atlasCell, MOTIONS, frameCount, motionFrame } from './sprite-animation';
import type { Direction, Motion } from './sprite-animation';
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;
const portrait=$<HTMLCanvasElement>('#portrait');
const images={} as Record<Motion,HTMLImageElement>;
let motion:Motion='idle',direction:Direction='SE',running=true,clock=0,previous=performance.now(),showAnchor=false;
const strip:HTMLCanvasElement[]=[];
for(let i=0;i<6;i++){const figure=document.createElement('figure'),canvas=document.createElement('canvas'),caption=document.createElement('figcaption');canvas.width=384;canvas.height=256;caption.textContent=String(i+1).padStart(2,'0');figure.append(canvas,caption);$('#strip').append(figure);strip.push(canvas);}
function draw(canvas:HTMLCanvasElement,frame:number){canvas.width=(motion==='death'?512:384)*(canvas===portrait?2:1);const c=canvas.getContext('2d')!;c.clearRect(0,0,canvas.width,canvas.height);const img=images[motion];if(!img)return;const cell=atlasCell(motion,direction,frame),w=img.width/cell.columns,h=img.height/cell.rows;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';if(showAnchor){c.strokeStyle='#d4b98b66';c.lineWidth=1;c.beginPath();c.moveTo(0,canvas.height*240/256);c.lineTo(canvas.width,canvas.height*240/256);c.moveTo(canvas.width/2,0);c.lineTo(canvas.width/2,canvas.height);c.stroke();}c.drawImage(img,cell.column*w,cell.row*h,w,h,0,0,canvas.width,canvas.height);}
function refresh(){clock=0;$('#motion-label').textContent=`${{idle:'ยืน',run:'วิ่ง',attack:'โจมตี',spin:'ฟันพายุ',cast:'ดาวตก',hit:'บาดเจ็บ',dodge:'หลบ',death:'ล้ม'}[motion]} · ${direction}`;document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motion===motion)));document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===direction)));strip.forEach((c,i)=>{c.parentElement!.hidden=i>=frameCount(motion);draw(c,i);});}
document.querySelectorAll<HTMLButtonElement>('[data-motion]').forEach(b=>b.onclick=()=>{motion=b.dataset.motion as Motion;refresh();});
document.querySelectorAll<HTMLButtonElement>('[data-direction]').forEach(b=>b.onclick=()=>{direction=b.dataset.direction as Direction;refresh();});
$('#toggle').onclick=()=>{running=!running;$('#toggle').textContent=running?'หยุดภาพ':'เล่นต่อ';};
$<HTMLInputElement>('#anchors').onchange=e=>{showAnchor=(e.target as HTMLInputElement).checked;refresh();};
Promise.all(MOTIONS.map(name=>new Promise<void>((resolve,reject)=>{const img=new Image();img.onload=()=>{images[name]=img;resolve();};img.onerror=()=>reject(new Error(name));img.src=`/assets/hero-painted/preview/hero-${name}-v1.png`;}))).then(()=>{$('#status').textContent='พร้อมแล้ว · ลองเปลี่ยนท่าและทิศทาง';refresh();}).catch(()=>{$('#status').textContent='โหลดภาพไม่สำเร็จ กรุณารีเฟรชหน้า';});
function tick(now:number){const dt=Math.min(.05,(now-previous)/1000);previous=now;if(running)clock+=dt;const frame=motionFrame(motion,clock);draw(portrait,frame);requestAnimationFrame(tick);}requestAnimationFrame(tick);
