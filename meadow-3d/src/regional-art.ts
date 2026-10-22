import {FIELD_PLACES,LAYOUTS,type FieldMapId} from '@the-beginning-online/shared/maps';
type Prop=(name:string,x:number,z:number,h:number)=>void;
type Atlas={assets:{name:string;atlas:string;rect:number[]}[]};
/** Ground details use authored destinations; decorations add no collision or loot. */
export function paintRegionalGround(c:CanvasRenderingContext2D,id:FieldMapId,env:Atlas,sources:Map<string,HTMLImageElement>){
 const places=FIELD_PLACES[id],arena=LAYOUTS[id].arena!;
 const patch=(x:number,z:number,rx:number,rz:number,colour:string)=>{c.save();c.translate(x,z);c.scale(rx,rz);const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,colour);g.addColorStop(1,'#00000000');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();};
 const flat=(name:string,x:number,z:number,w:number,h:number)=>{const a=env.assets.find(a=>a.name===name);if(!a)throw Error('Missing regional ground art '+name);c.drawImage(sources.get(a.atlas)!,...a.rect as [number,number,number,number],x-w/2,z-h/2,w,h);};
 if((id==='forest'||id==='grove')){
  for(const p of places)if(p.kind==='mushrooms')patch(p.x,p.z,12,9,'#b5ad7350');else if(p.kind==='den')patch(p.x,p.z,12,9,'#2e292c88');else if(p.kind==='wisp-pond')patch(p.x,p.z,11,8,'#65baba55');
  flat('stone-ring',arena.x,arena.z,arena.r*2.6,arena.r*2.3);
  for(const w of LAYOUTS[id].water)for(let i=0;i<5;i++){const a=i*2.39996;flat('lilies',w.x+Math.cos(a)*w.rx*.6,w.z+Math.sin(a)*w.rz*.6,1.5,1.1);}
 }else{
  flat('stone-circle',arena.x,arena.z,arena.r*2,arena.r*2);
  if(id==='ruins')for(const p of places){
   if(p.kind==='plaza')flat('stone-circle',p.x,p.z,9,9);
   if(p.kind==='runes'||p.kind==='guardian'){
    patch(p.x,p.z,10,8,p.kind==='runes'?'#9994bf55':'#829a6155');
    c.save();c.translate(p.x,p.z);c.strokeStyle=p.kind==='runes'?'#c9bdccaa':'#a6b38888';c.lineWidth=.1;
    for(const r of [3.4,4]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;c.save();c.rotate(a);c.beginPath();c.moveTo(3.4,-.2);c.lineTo(3.7,.25);c.lineTo(4,-.2);c.stroke();c.restore();}c.restore();
   }
  }
  if((id==='canyon'||id==='summit'))for(const p of places){
   if(p.kind==='ore'||p.kind==='amber'){
    patch(p.x,p.z,13,10,p.kind==='ore'?'#d2b77766':'#d6914488');
    c.save();c.translate(p.x,p.z);c.lineCap='round';
    for(let i=0;i<18;i++){const a=i*2.39996,r=3+Math.sqrt(i/18)*8,x=Math.cos(a)*r,z=Math.sin(a)*r*.7;c.strokeStyle=i%3?'#e1bc7855':'#f8dfa988';c.lineWidth=.07+(i%3)*.04;c.beginPath();c.moveTo(x,z);c.lineTo(x+.8,z-.4);c.lineTo(x+1.3,z-.25);c.stroke();}c.restore();
   }
   if(p.kind==='stone-ring')flat('stone-circle',p.x,p.z,7,7);
  }
 }
}
export function decorateRegion(id:FieldMapId,prop:Prop){
 const places=FIELD_PLACES[id];
 for(const p of places){
  if(p.kind==='sign')prop('signpost',p.x,p.z,2.1);
  if((id==='forest'||id==='grove')){
   if(p.kind==='mushrooms')for(let i=0;i<36;i++){const a=i*2.39996,r=3+Math.sqrt(i/36)*7;prop(i%4?'mushrooms':'spores',p.x+Math.cos(a)*r,p.z+Math.sin(a)*r*.65,.6+(i%3)*.16);}
   if(p.kind==='den'){prop('fallen-log',p.x-5,p.z-4,1.2);prop('log-seat',p.x+5,p.z+3,.9);for(let i=0;i<14;i++)prop('fern',p.x+Math.sin(i*2.4)*8,p.z+Math.cos(i*2.4)*6,.75);}
   if(p.kind==='wisp-pond')for(let i=0;i<7;i++){const a=i*Math.PI*2/7;prop('lantern',p.x+Math.cos(a)*7,p.z+Math.sin(a)*4.5,1.7);}
   if(p.kind==='hollow'){prop('fallen-log',p.x-5,p.z+4,1.3);prop('spores',p.x+3,p.z+2,1.1);}
  }else if(id==='ruins'){
   if(p.kind==='garden')for(let i=0;i<14;i++){const a=i*2.39996;prop(i%2?'flowers-white':'flowers-yellow',p.x+Math.cos(a)*6,p.z+Math.sin(a)*6,.7);}
   if(p.kind==='plaza')for(let i=0;i<18;i++){const a=i*2.39996;prop(i%3?'grass-2':'flowers-white',p.x+Math.cos(a)*5.2,p.z+Math.sin(a)*5.2,.6);}
   if(p.kind==='guardian')for(let i=0;i<16;i++){const a=i*Math.PI/8;prop('fern-wide',p.x+Math.cos(a)*5,p.z+Math.sin(a)*5,.75);}
  }else if((id==='canyon'||id==='summit')&&(p.kind==='ore'||p.kind==='amber')){
   for(let i=0;i<9;i++){const a=i*2.39996;prop(i%3?'boulder-flat':'boulder-round',p.x+Math.cos(a)*7,p.z+Math.sin(a)*5,.65+(i%3)*.13);}
  }
 }
}
