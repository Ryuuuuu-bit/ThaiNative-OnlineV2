import {DEFAULT_ATMOSPHERE,atmosphereSettings,sunPosition,breeze,pondOutline,leafPose,type AtmosphereSettings} from './atmosphere-model';
import {LAYOUTS,type MapId,type Ellipse} from '@the-beginning-online/shared/maps';
import {isBiomeMap,BIOME_SCENES} from './biome-scenes';
export type AtmosphereTree={x:number;z:number;h:number;w:number};
type Project=(x:number,z:number,h?:number)=>{x:number;y:number};
/** Decorative Canvas2D layers. No server state, collision footprints or extra textures downloaded. */
export class Atmosphere2D{
 settings={...DEFAULT_ATMOSPHERE};private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 private canopy=document.createElement('canvas');private contact=document.createElement('canvas');
 private lightCache:{key:string;warm:CanvasGradient;cool:CanvasGradient}|null=null;
 private stats={leaves:0,ponds:0,trees:0};private previewMotion:boolean|null=null;
 constructor(){
  this.canopy.width=256;this.canopy.height=160;const c=this.canopy.getContext('2d')!;
  // Shared soft, irregular canopy stamp: cached once, never a per-frame blur.
  for(let i=0;i<17;i++){const x=128+Math.sin(i*2.4)*78,y=80+Math.cos(i*1.7)*34,r=22+(i%4)*7,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#09241c25');g.addColorStop(.5,'#09241c1c');g.addColorStop(1,'#09241c00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
  this.contact.width=96;this.contact.height=48;const a=this.contact.getContext('2d')!;a.scale(1,.5);const g=a.createRadialGradient(48,48,3,48,48,45);g.addColorStop(0,'#10261e70');g.addColorStop(.4,'#10261e35');g.addColorStop(1,'#10261e00');a.fillStyle=g;a.fillRect(0,0,96,96);
 }
 configure(patch:Partial<AtmosphereSettings>){this.settings=atmosphereSettings(this.settings,patch);}
 /** Explicit review-page opt-in; normal gameplay follows the system motion preference. */
 setMotionPreview(enabled:boolean){this.previewMotion=enabled;}
 get reducedMotion(){return this.previewMotion===null?this.reduced.matches:!this.previewMotion;}
 sway(x:number,z:number,time:number){return this.settings.enabled&&!this.reducedMotion?breeze(x,z,time,this.settings.wind)*.023:0;}
 private visible(q:{x:number;y:number},width:number,height:number,r:number){return q.x>-r&&q.y>-r&&q.x<width+r&&q.y<height+r;}
 water(c:CanvasRenderingContext2D,map:MapId,project:Project,s:number,time:number,width:number,height:number,high:boolean){
  this.stats.ponds=0;if(!this.settings.enabled||!this.settings.water||map==='city_plaza')return;
  const t=this.reducedMotion?0:high?time:Math.floor(time*12)/12;
  for(const p of LAYOUTS[map].water){const q=project(p.x,p.z),reach=Math.max(p.rx,p.rz)*s*1.5;if(!this.visible(q,width,height,reach))continue;
   this.stats.ponds++;this.pond(c,p,q,s,t,high,map==='forest'||map==='himmapan',isBiomeMap(map)?BIOME_SCENES[map].water:undefined,map==='volcano');
  }
 }
 private pond(c:CanvasRenderingContext2D,p:Ellipse,q:{x:number;y:number},s:number,t:number,high:boolean,forest:boolean,colour?:string,lava=false){
  c.save();c.transform(.83205*s,.39223*s,-.5547*s,.58835*s,q.x,q.y);
  const outline=(factor=1)=>{c.beginPath();for(let i=0;i<=72;i++){const a=i/72*Math.PI*2,r=pondOutline(a)*factor,x=Math.cos(a)*p.rx*r,z=Math.sin(a)*p.rz*r;i?c.lineTo(x,z):c.moveTo(x,z);}c.closePath();};
  outline();c.clip();
  if(p.bridgeZ!==undefined){c.beginPath();c.rect(-p.rx*1.2,-p.rz*1.2,p.rx*2.4,p.rz*2.4);c.rect(-p.rx*1.2,p.bridgeZ-p.z-(p.bridgeHalf??1.3),p.rx*2.4,(p.bridgeHalf??1.3)*2);c.clip('evenodd');}
  const depth=c.createRadialGradient(-p.rx*.2,-p.rz*.2,.3,0,0,Math.max(p.rx,p.rz));depth.addColorStop(0,colour??(forest?'#24567570':'#176e9f7a'));depth.addColorStop(.65,colour??'#299bab45');depth.addColorStop(1,colour??'#9dddd037');c.fillStyle=depth;c.fillRect(-p.rx*1.2,-p.rz*1.2,p.rx*2.4,p.rz*2.4);
  const lines=high?18:8;
  c.lineCap='round';
  for(let i=0;i<lines;i++){
   const yy=-p.rz+(i+.5)/lines*p.rz*2,phase=i*2.399;
   c.beginPath();for(let j=0;j<=20;j++){const x=-p.rx*1.1+j/20*p.rx*2.2,z=yy+Math.sin(x*1.3+t*.55+phase)*.19+Math.sin(x*2.2-t*.28+i)*.08;j?c.lineTo(x,z):c.moveTo(x,z);}
   c.strokeStyle=`rgba(${lava?'255,196,94':'177,239,222'},${.10+.07*Math.sin(i*3.1+t*.4)**2})`;c.lineWidth=.035;c.stroke();
  }
  for(let i=0;i<(high?24:8);i++){
   const a=i*2.39996,r=Math.sqrt((i+.5)/24)*.85,x=Math.cos(a)*p.rx*r,z=Math.sin(a)*p.rz*r,glow=Math.max(0,Math.sin(t*.85+i*2.31))**9;
   if(glow<.08)continue;c.globalAlpha=glow*.65;c.strokeStyle=lava?'#ffd38c':'#e4ffec';c.lineWidth=.035;c.beginPath();c.moveTo(x-.035,z);c.lineTo(x+.05+glow*.09,z-.015);c.stroke();
  }
  c.globalAlpha=1;outline(.985);c.strokeStyle='#b7eadb4d';c.lineWidth=.09;c.stroke();
  for(let i=0;i<3;i++){const phase=(t*.09+i*.31)%1;c.beginPath();c.ellipse(Math.sin(i*4)*p.rx*.3,Math.cos(i*3)*p.rz*.25,p.rx*(.12+phase*.35),p.rz*(.1+phase*.25),0,0,Math.PI*2);c.strokeStyle=`rgba(203,245,232,${Math.sin(phase*Math.PI)*.16})`;c.lineWidth=.035;c.stroke();}
  c.restore();
 }
 shadows(c:CanvasRenderingContext2D,trees:AtmosphereTree[],project:Project,s:number,time:number){
  this.stats.trees=0;if(!this.settings.enabled||this.settings.sun===0)return;
  const sun=sunPosition(this.settings.hour);c.save();c.globalAlpha=this.settings.sun*.72;
  for(const tree of trees){const q=project(tree.x,tree.z),wind=this.sway(tree.x,tree.z,time),w=tree.h*.95*s,h=tree.h*.36*s;c.drawImage(this.canopy,q.x-w*.5+sun.dx*tree.h*sun.length*s+wind*tree.h*s,q.y-h*.5+tree.h*sun.length*s*.23,w,h);this.stats.trees++;}
  c.restore();
 }
 actorShadow(c:CanvasRenderingContext2D,q:{x:number;y:number},s:number,r=.65){
  if(!this.settings.enabled)return;const sun=sunPosition(this.settings.hour),w=r*2.7*s,h=r*.88*s;c.save();c.globalAlpha=.55+this.settings.sun*.3;c.drawImage(this.contact,q.x-w/2+sun.dx*r*.4*s,q.y-h/2+sun.length*r*.2*s,w,h);c.restore();
 }
 light(c:CanvasRenderingContext2D,width:number,height:number,map:MapId){
  if(!this.settings.enabled||!this.settings.sun)return;
  const key=`${width}:${height}:${this.settings.hour}:${map}`;
  if(this.lightCache?.key!==key){const morning=this.settings.hour<12,x=morning?0:width,warm=c.createRadialGradient(x,0,0,x,0,width*1.1);warm.addColorStop(0,'#fff2ba4d');warm.addColorStop(.5,'#f5e4a714');warm.addColorStop(1,'#f5e4a700');const cool=c.createLinearGradient(0,0,width,height);cool.addColorStop(0,'#102f3d00');cool.addColorStop(1,map==='forest'?'#173b4e29':'#14334414');this.lightCache={key,warm,cool};}
  c.save();c.globalAlpha=this.settings.sun;c.fillStyle=this.lightCache.warm;c.fillRect(0,0,width,height);c.fillStyle=this.lightCache.cool;c.fillRect(0,0,width,height);c.restore();
 }
 leaves(c:CanvasRenderingContext2D,trees:AtmosphereTree[],project:Project,s:number,time:number,width:number,height:number,high:boolean){
  this.stats.leaves=0;if(!this.settings.enabled||!this.settings.leaves||this.settings.wind===0||this.reducedMotion||!trees.length)return;
  const count=high?36:12;c.save();
  for(let i=0;i<count;i++){
   const tree=trees[(i*7)%trees.length],leaf=leafPose(i,time,this.settings.wind),x=tree.x+leaf.drift*.7+leaf.side,z=tree.z+leaf.drift*.45+Math.sin(i*3)*.5,h=tree.h*.63*(1-leaf.progress),q=project(x,z,h);
   if(!this.visible(q,width,height,20))continue;this.stats.leaves++;c.save();c.translate(q.x,q.y);c.rotate(leaf.spin);c.scale(leaf.flutter,1);const r=Math.min(4.5,Math.max(1.2,leaf.size*s));c.globalAlpha=leaf.alpha;c.fillStyle=i%5===0?'#e0cc88':i%3===0?'#9fb574':'#73945e';c.beginPath();c.moveTo(-r,0);c.quadraticCurveTo(0,-r*.7,r,0);c.quadraticCurveTo(0,r*.8,-r,0);c.fill();c.restore();
  }
  c.restore();
 }
 snapshot(){return{...this.stats,settings:{...this.settings},reducedMotion:this.reducedMotion};}
}
