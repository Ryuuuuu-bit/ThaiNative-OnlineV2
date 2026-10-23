import {LAYOUTS,MEADOW_PLACES} from '@the-beginning-online/shared/maps';
type Atlas={assets:{name:string;atlas:string;rect:number[]}[]};
/** Existing painted atlas details, baked into the ground once per map load. */
export function paintMeadowGround(c:CanvasRenderingContext2D,env:Atlas,sources:Map<string,HTMLImageElement>){
 const garden=MEADOW_PLACES.find(p=>p.kind==='garden');
 const patch=(x:number,z:number,rx:number,rz:number,colour:string)=>{c.save();c.translate(x,z);c.scale(rx,rz);const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,colour);g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();};
 if(garden)patch(garden.x,garden.z,11,7.5,'#a9804b75');
 for(const p of LAYOUTS.meadow.obstacles.filter(p=>p.kind==='orchard-tree'))patch(p.x,p.z,3.6,2.8,'#c8a75366');
 const flat=(name:string,x:number,z:number,w:number,h:number)=>{const a=env.assets.find(a=>a.name===name);if(!a)throw Error('Missing meadow art '+name);c.drawImage(sources.get(a.atlas)!,...a.rect as [number,number,number,number],x-w/2,z-h/2,w,h);};
 const arena=LAYOUTS.meadow.arena!;flat('stone-circle',arena.x,arena.z,arena.r*2,arena.r*2);
 for(const w of LAYOUTS.meadow.water)if(w.bridgeZ!==undefined)flat('bridge',w.x,w.bridgeZ,(w.rx+.7)*2,(w.bridgeHalf??1.3)*2+1.2);
}
export function decorateMeadow(prop:(name:string,x:number,z:number,h:number)=>void){
 const garden=MEADOW_PLACES.find(p=>p.kind==='garden');
 if(garden){
  for(let i=0;i<100;i++){const a=i*2.39996,r=Math.sqrt((i+.5)/100);prop(['flowers-pink','flowers-white','flowers-yellow'][i%3],garden.x+Math.cos(a)*r*9,garden.z+Math.sin(a)*r*5.8,.85+(i%4)*.07);}
  for(const [x,z]of [[-8,-4],[-6,4],[8,-1]])prop('bush-flowering',garden.x+x,garden.z+z,1.25);
 }
 for(const p of MEADOW_PLACES.filter(p=>p.kind==='sign'))prop('signpost',p.x,p.z,2.1);
 for(const w of LAYOUTS.meadow.water.filter(w=>w.bridgeZ!==undefined))for(const x of [w.x-w.rx-4,w.x+w.rx+5])for(let i=0;i<12;i++)prop(i%3?'flowers-white':'flowers-lavender',x+Math.sin(i*2)*1.5,w.z-7+i*1.35,.8);
 const a=LAYOUTS.meadow.arena!;
 for(let i=0;i<16;i++){const angle=i*Math.PI/8;prop(i%2?'flowers-yellow':'grass-2',a.x+Math.cos(angle)*(a.r+1),a.z+Math.sin(angle)*(a.r+1),.8);}
}
