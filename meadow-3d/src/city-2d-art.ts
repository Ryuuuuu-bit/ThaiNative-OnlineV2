import {project} from './city-2d-sim';
export type Point = [number,number,number?];
const cacheScale=28,cacheW=26,cacheH=26;
export function polygon(c: CanvasRenderingContext2D, points: Point[], fill: string | CanvasPattern, stroke = '#3a3c2a', line = .035) {
  c.beginPath(); points.forEach(([x, z, h], i) => { const p = project(x, z, h); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.closePath(); c.fillStyle = fill; c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = line; c.stroke(); }
}
export function line(c: CanvasRenderingContext2D, a: Point, b: Point, color: string, thickness = .05) {
  const p = project(...a), q = project(...b); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.strokeStyle = color; c.lineWidth = thickness; c.stroke();
}
export function slab(c: CanvasRenderingContext2D, x: number, z: number, w: number, d: number, h: number, colors = ['#bbb298', '#8a856d', '#d0c5a9'], bottom = 0) {
  const a = x - w / 2, b = x + w / 2, f = z + d / 2, r = z - d / 2;
  polygon(c, [[a,f,bottom],[b,f,bottom],[b,f,h],[a,f,h]], colors[0]);
  polygon(c, [[b,f,bottom],[b,r,bottom],[b,r,h],[b,f,h]], colors[1]);
  polygon(c, [[a,r,h],[b,r,h],[b,f,h],[a,f,h]], colors[2]);
}
export function ellipse(c: CanvasRenderingContext2D, x: number, z: number, rx: number, ry: number, color: string, h = 0) {
  const p = project(x,z,h); c.beginPath(); c.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2); c.fillStyle=color; c.fill();
}
export type Sprite = HTMLCanvasElement & {left:number;top:number};
export function bake(draw: (c: CanvasRenderingContext2D) => void):Sprite {
  const out = document.createElement('canvas'); out.width = cacheW * cacheScale; out.height = cacheH * cacheScale;
  const c = out.getContext('2d')!; c.scale(cacheScale,cacheScale); c.translate(cacheW/2,cacheH*.72); draw(c);
  // Trim empty borders so hundreds of small city props do not each keep a large bitmap.
  const pixels=c.getImageData(0,0,out.width,out.height).data;let l=out.width,t=out.height,r=0,b=0;
  for(let y=0;y<out.height;y++)for(let x=0;x<out.width;x++)if(pixels[(y*out.width+x)*4+3]){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  const cropped=document.createElement('canvas') as Sprite;cropped.width=Math.max(1,r-l+3);cropped.height=Math.max(1,b-t+3);cropped.getContext('2d')!.drawImage(out,l-1,t-1,cropped.width,cropped.height,0,0,cropped.width,cropped.height);cropped.left=(l-1)/cacheScale-cacheW/2;cropped.top=(t-1)/cacheScale-cacheH*.72;return cropped;
}
export function roof(c: CanvasRenderingContext2D, w: number, d: number, h: number, palette: string[]) {
  const a=-w/2-.32,b=w/2+.32,f=d/2+.4,r=-d/2-.4,rise=Math.min(2,Math.min(w,d)*.4),peak=h+rise;
  polygon(c,[[a,r,h],[b,r,h],[b,0,peak],[a,0,peak]],palette[2]);
  polygon(c,[[a,0,peak],[b,0,peak],[b,f,h],[a,f,h]],palette[0]);
  polygon(c,[[b,r,h],[b,f,h],[b,0,peak]],palette[1]);
  for(let j=1;j<7;j++){const t=j/7;line(c,[a,f*t,peak-rise*t],[b,f*t,peak-rise*t],palette[1],.06);for(let i=a+.25;i<b;i+=.55)line(c,[i+(j%2)*.2,f*(t-1/7),peak-rise*(t-1/7)],[i+(j%2)*.2,f*t,peak-rise*t],palette[2],.025);}
  line(c,[a,0,peak],[b,0,peak],'#b6ac86',.14);line(c,[a,f,h],[b,f,h],'#484738',.12);
}
export function house(c: CanvasRenderingContext2D,w: number,d: number,index: number,kind='house') {
  const h=['storage','guild','inn'].includes(kind)?5.8:kind==='chapel'?6.5:3.8;
  slab(c,0,0,w+.35,d+.35,.35,['#8b8973','#666e5b','#c0b89a']);
  slab(c,0,0,w,d,h,['#cdc2a3','#a49c7e','#b6ae92']);
  // Masonry, timber framing, shutters and a recessed doorway.
  for(let y=.6;y<h;y+=.55){line(c,[-w/2,d/2,y],[w/2,d/2,y],'#aaa38a',.025);line(c,[w/2,-d/2,y],[w/2,d/2,y],'#88866e',.025);}
  for(const x of [-w/2,-w/4,0,w/4,w/2])line(c,[x,d/2,.3],[x,d/2,h],'#615d43',.12);
  line(c,[-w/2,d/2,h-.2],[w/2,d/2,h-.2],'#5c5b43',.18);
  polygon(c,[[-.6,d/2+.02,.35],[.6,d/2+.02,.35],[.6,d/2+.02,2.15],[-.6,d/2+.02,2.15]],'#3e4535');
  line(c,[0,d/2+.03,.4],[0,d/2+.03,2.05],'#9a8962',.04);
  for(const x of [-w*.31,w*.31]){polygon(c,[[x-.45,d/2+.03,1.5],[x+.45,d/2+.03,1.5],[x+.45,d/2+.03,2.5],[x-.45,d/2+.03,2.5]],'#354b40');line(c,[x,d/2+.06,1.5],[x,d/2+.06,2.5],'#d0bb88',.07);line(c,[x-.45,d/2+.05,2],[x+.45,d/2+.05,2],'#d0bb88',.06);slab(c,x,d/2+.13,1.2,.25,.95,['#696c43','#515b37','#9b9f62'],.7);}
  for(const z of [-d*.25,d*.25])polygon(c,[[w/2+.02,z-.4,1.55],[w/2+.02,z+.4,1.55],[w/2+.02,z+.4,2.6],[w/2+.02,z-.4,2.6]],'#374a3c');
  if(kind==='storage'){line(c,[-w/2,d/2,3.3],[w/2,d/2,3.3],'#5a5942',.2);for(const x of [-2.7,0,2.7])polygon(c,[[x-.5,d/2+.03,4],[x+.5,d/2+.03,4],[x+.5,d/2+.03,5],[x-.5,d/2+.03,5]],'#3f5041');}
  const palettes=[['#73846d','#405b4b','#9da58a'],['#ab7958','#6f4b3e','#d1a47b'],['#568c91','#315e66','#85b1af'],['#777398','#4d496b','#aba6bd']];
  roof(c,w,d,h,palettes[index%4]);
  slab(c,-w*.27,-d*.12,.7,.75,h+2.5,['#b2aa91','#7b7c66','#d2c6a6'],h+1.2);
  slab(c,-w*.27,-d*.12,.9,.95,h+2.65,['#8c8b73','#686f5a','#aea68b'],h+2.5);
  if(kind==='market')awning(c,w,2.4,h*.65,d/2+1.2);
  if(kind==='forge'){slab(c,w/2+.1,0,1.1,1.8,2.1,['#77735e','#535d4c','#99947b']);ellipse(c,w/2+.7,0,.3,.5,'#f7b75c',.8);}
  // Climbing ivy and small doorstep flowers soften the masonry silhouettes.
  for(let i=0;i<15;i++){const z=d/2+.04,x=-w/2+.1+Math.sin(i*1.8)*.17;ellipse(c,x,z,.12,.08,i%2?'#5e7952':'#87995e',.5+i*.2);}
  slab(c,0,d/2+.6,1.7,.7,.18,['#b3ad90','#878b70','#d6ccab']);
}
export function awning(c: CanvasRenderingContext2D,w: number,d: number,h: number,z=0) {
  for(const x of [-w/2,w/2])line(c,[x,z+d/2,0],[x,z+d/2,h],'#58553d',.12);
  for(let x=-w/2,i=0;x<w/2;x+=.5,i++)polygon(c,[[x,z-d/2,h+.6],[Math.min(x+.5,w/2),z-d/2,h+.6],[Math.min(x+.5,w/2),z+d/2,h],[x,z+d/2,h]],i%2?'#d4c59e':'#687f66','#4b5941',.02);
  slab(c,0,z,w,.8,.85,['#807759','#625e43','#b7a580']);
  for(let x=-w/2+.3;x<w/2;x+=.42)ellipse(c,x,z,.16,.11,x<0?'#b08245':'#8a9d5c',1.03);
}
export function tower(c: CanvasRenderingContext2D) {
  slab(c,0,0,5,5,.3);slab(c,0,0,4.4,4.4,.6);slab(c,0,0,3.8,3.8,9.6,['#c5bca0','#9a967b','#d8caac']);
  for(let y=1;y<9.5;y+=.6){line(c,[-1.9,1.9,y],[1.9,1.9,y],'#9d997f',.025);line(c,[1.9,-1.9,y],[1.9,1.9,y],'#7a816b',.025);}
  for(const y of [1,5.9,9.6])slab(c,0,0,4.3,4.3,y+.2,['#b3ac8d','#81896d','#d2c4a2'],y);
  polygon(c,[[-.55,1.92,.6],[.55,1.92,.6],[.55,1.92,2.7],[-.55,1.92,2.7]],'#3f4b3b');
  const p=project(0,1.93,7.8);c.save();c.translate(p.x,p.y);c.transform(.83,.392,0,1,0,0);c.beginPath();c.arc(0,0,1.04,0,Math.PI*2);c.fillStyle='#424e3b';c.fill();c.strokeStyle='#cfb676';c.lineWidth=.12;c.stroke();
  for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(Math.sin(a)*.78,Math.cos(a)*.78);c.lineTo(Math.sin(a)*.9,Math.cos(a)*.9);c.lineWidth=.045;c.stroke();}c.beginPath();c.moveTo(-.45,-.35);c.lineTo(0,0);c.lineTo(.25,-.65);c.lineWidth=.07;c.stroke();c.restore();
  roof(c,4.5,4.5,9.9,['#667b67','#405a48','#99a185']);line(c,[0,0,11.9],[0,0,13.3],'#bda56d',.12);ellipse(c,0,0,.17,.17,'#ddc88c',13.3);
}
export function fountain(c: CanvasRenderingContext2D) {
  ellipse(c,0,0,3,1.65,'#525f50');ellipse(c,0,0,2.8,1.5,'#c6bfa0',.25);ellipse(c,0,0,2.45,1.27,'#5c8e89',.3);ellipse(c,0,0,2.15,1.1,'#80b1a7',.31);
  for(let i=0;i<3;i++){c.beginPath();const p=project(0,0,.35);c.ellipse(p.x,p.y,1.1+i*.4,.55+i*.18,0,0,Math.PI*2);c.strokeStyle='#b4cfba';c.lineWidth=.035;c.stroke();}
  slab(c,0,0,.6,.6,1.7);ellipse(c,0,0,1.1,.55,'#c3bc98',1.7);ellipse(c,0,0,.85,.38,'#79a69a',1.8);line(c,[0,0,1.8],[0,0,2.8],'#c9e0cc',.09);
}
