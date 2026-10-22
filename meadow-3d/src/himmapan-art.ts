import {LAYOUTS,type Ellipse} from '@the-beginning-online/shared/maps';
import type {CanvasAssets} from './game-2d-assets';
import type {FieldProp} from './game-2d-fields';
import spiritTree from './assets/himmapan-spirit-tree-v1.webp?url';

/** Original ground motifs follow the same water and bridge footprints as collision. */
export function paintHimmapan(c:CanvasRenderingContext2D){
 c.save();
 for(const p of LAYOUTS.himmapan.water){
  for(let i=0;i<38;i++){const a=i*2.39996,r=.22+Math.sqrt(i/38)*.67,x=p.x+Math.cos(a)*p.rx*r,z=p.z+Math.sin(a)*p.rz*r;
   if(p.bridgeZ!==undefined&&Math.abs(z-p.bridgeZ)<(p.bridgeHalf??0)+1)continue;
   c.fillStyle=i%3?'#438975dd':'#4f9d73ee';c.beginPath();c.ellipse(x,z,.55+(i%3)*.12,.38,a,0,Math.PI*1.82);c.lineTo(x,z);c.fill();
   if(i%3===0){for(let k=0;k<6;k++){const t=k*Math.PI/3;c.fillStyle=k%2?'#f4cbcf':'#fff0d7';c.beginPath();c.ellipse(x+Math.cos(t)*.2,z+Math.sin(t)*.2,.22,.1,t,0,Math.PI*2);c.fill();}c.fillStyle='#e7b957';c.beginPath();c.arc(x,z,.09,0,Math.PI*2);c.fill();}
  }
  if(p.bridgeZ!==undefined)rootBridge(c,p);
 }
 // A sanctuary floor reserves the boss footprint; no boss or rewards spawn in this preview.
 c.translate(58,28);const g=c.createRadialGradient(0,0,3,0,0,11);g.addColorStop(0,'#6a9a8177');g.addColorStop(1,'#749b6d00');c.fillStyle=g;c.fillRect(-11,-11,22,22);
 for(const r of [7.2,8.1,8.8]){c.strokeStyle=r===8.1?'#c4ac70aa':'#436c60';c.lineWidth=r===8.1?.25:.4;c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
 for(let i=0;i<12;i++){c.save();c.rotate(i*Math.PI/6);c.fillStyle='#acc49a99';c.beginPath();c.ellipse(0,-5.4,.65,1.9,0,0,Math.PI*2);c.fill();c.restore();}c.restore();
}
function rootBridge(c:CanvasRenderingContext2D,p:Ellipse){
 const z=p.bridgeZ!,half=p.bridgeHalf!,left=p.x-p.rx-1,right=p.x+p.rx+1;
 c.save();c.lineCap='round';
 for(let i=0;i<12;i++){const y=z-half+.3+i*(2*half-.6)/11;c.beginPath();c.moveTo(left,y);c.bezierCurveTo(left+12,y+Math.sin(i)*.3,right-12,y-Math.cos(i)*.3,right,y);c.strokeStyle=i%2?'#624e34':'#796345';c.lineWidth=.62;c.stroke();c.strokeStyle='#b5a16b';c.lineWidth=.1;c.stroke();}
 for(let x=left+1;x<right;x+=2.2){c.strokeStyle='#c4b07c66';c.lineWidth=.12;c.beginPath();c.moveTo(x,z-half+.4);c.lineTo(x+.4,z+half-.4);c.stroke();}
 // Curving roots form low rails outside the navigable centre band.
 for(const side of [-1,1]){c.strokeStyle='#3e5140';c.lineWidth=.75;c.beginPath();c.moveTo(left,z+side*half);c.bezierCurveTo(p.x-8,z+side*(half+.4),p.x+8,z+side*(half+.4),right,z+side*half);c.stroke();c.strokeStyle='#8ba473';c.lineWidth=.16;c.stroke();}c.restore();
}
export async function himmapanProps(assets:CanvasAssets):Promise<FieldProp[]>{
 const tree=await assets.image(spiritTree);
 // Native transparent source; world scale and solid footprint are authored independently in Tiled.
 const props:FieldProp[]=[{x:-22,z:-27,image:tree,rect:[0,0,tree.width,tree.height],w:12,h:18,anchor:[.5,.96],tree:true,foliage:true}];
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=512;const c=canvas.getContext('2d')!;
 const rock=c.createLinearGradient(30,0,340,360);rock.addColorStop(0,'#566c69');rock.addColorStop(.45,'#344f4c');rock.addColorStop(1,'#183d38');c.fillStyle=rock;
 c.beginPath();c.moveTo(38,425);c.lineTo(25,158);c.lineTo(80,62);c.lineTo(292,38);c.lineTo(355,200);c.lineTo(365,456);c.closePath();c.fill();
 for(let i=0;i<30;i++){c.strokeStyle=i%3?'#77958788':'#182e2a';c.lineWidth=3+i%5;c.beginPath();c.moveTo(40+i*10,90+(i%4)*11);c.lineTo(25+i*11,420+(i%3)*9);c.stroke();}
 const flow=c.createLinearGradient(0,100,0,465);flow.addColorStop(0,'#b9e3d2dd');flow.addColorStop(.4,'#62b6b7ee');flow.addColorStop(1,'#d5f5e2aa');c.fillStyle=flow;c.beginPath();c.moveTo(135,88);c.bezierCurveTo(182,160,110,300,120,441);c.quadraticCurveTo(190,493,273,438);c.bezierCurveTo(250,290,270,170,240,80);c.closePath();c.fill();
 for(let i=0;i<18;i++){c.strokeStyle=i%2?'#e9fff1aa':'#93d1c9';c.lineWidth=2+(i%3);c.beginPath();c.moveTo(140+i*5,91);c.bezierCurveTo(175+i*4,194,111+i*7,319,131+i*7,439);c.stroke();}
 for(let i=0;i<50;i++){c.fillStyle=i%2?'#b6dec9':'#e8fff1';c.beginPath();c.ellipse(115+(i*31%170),431+(i*19%42),6+i%9,2+i%4,0,0,Math.PI*2);c.fill();}
 for(let i=0;i<32;i++){c.fillStyle=i%2?'#8cba7b':'#406e4f';c.beginPath();c.ellipse(50+i*9,64+Math.sin(i*2)*22,16,8,i,0,Math.PI*2);c.fill();}
 const waterfall=new Image();waterfall.src=canvas.toDataURL();await waterfall.decode();props.push({x:62,z:-43,image:waterfall,rect:[0,0,384,512],w:11,h:14,anchor:[.5,.92]});
 return props;
}
