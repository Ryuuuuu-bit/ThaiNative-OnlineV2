/**
 * Sword-line skill VFX for the Canvas2D world (approved "skill colours" designs).
 * Visual only: never changes damage, movement or authoritative events.
 * Effects paint into two layers: an fx layer (cel bands, rocks, dust) and a low-resolution glow
 * layer that is blurred and added on top. `pre` paints what sits behind entities, `post` what sits in front.
 */
export type Project=(x:number,z:number,h?:number)=>{x:number;y:number};
export interface VfxFrame{ctx:CanvasRenderingContext2D;width:number;height:number;dpr:number;scale:number;screen:Project;locate:(id:string)=>{x:number;z:number}|undefined;highQuality:boolean}
interface Pal{edge:string;hi:string;mid:string;low:string;deep:string|null;fleck:string;spark:string}
type Pt={x:number;y:number};type W={x:number;z:number;h?:number};
interface Fx{kind:string;t0:number;life:number;x:number;z:number;dx:number;dz:number;playerId?:string;follow:boolean;seed:number;crit?:boolean;index?:number;toX?:number;toZ?:number;dur?:number;other:boolean}
interface V{fx:CanvasRenderingContext2D;glow:CanvasRenderingContext2D;P:Project;S:number;time:number;heroY:number}

export const PALS:Record<string,Pal>={
 steel:{edge:'#ffffff',hi:'#f6f2e6',mid:'#dcd5c2',low:'#a49c86',deep:null,fleck:'#fff6dc',spark:'#fff1c4'},
 cream:{edge:'#fffdf5',hi:'#fff0c4',mid:'#f2cf7a',low:'#c99a3e',deep:'#5e4520',fleck:'#ffd66b',spark:'#ffd98a'},
 jade:{edge:'#f3fffa',hi:'#c6f5e2',mid:'#5fd0b0',low:'#1e8f78',deep:'#0c4640',fleck:'#e9fff6',spark:'#bff7e4'},
 sand:{edge:'#fffaea',hi:'#fbe8b4',mid:'#efcf86',low:'#d2a85e',deep:'#8a6534',fleck:'#fff3d0',spark:'#ffe6a6'},
 gold:{edge:'#fffbe8',hi:'#ffe7a3',mid:'#f3bf4f',low:'#b98222',deep:'#4f3410',fleck:'#fff3c2',spark:'#ffd36b'},
 emerald:{edge:'#fbfff2',hi:'#d4f6c0',mid:'#57d27f',low:'#1d9152',deep:'#0b4228',fleck:'#f0c75e',spark:'#f3d77a'},
 amber:{edge:'#fff6dc',hi:'#ffd68a',mid:'#f09a35',low:'#b55a18',deep:'#4e240a',fleck:'#ffe2a0',spark:'#ffc061'},
 storm:{edge:'#ffffff',hi:'#d2e8ff',mid:'#6fb2ff',low:'#2c62d8',deep:'#11245e',fleck:'#ffffff',spark:'#bfe0ff'},
 crimson:{edge:'#fff3ee',hi:'#ffb09e',mid:'#ff4536',low:'#bf1220',deep:'#43050d',fleck:'#ffb347',spark:'#ffb347'},
};
const STEEL_BLADE:Pal={...PALS.crimson,edge:'#ffffff',hi:'#f3eeee',mid:'#d9d0d0',low:'#9b8f8f',deep:null};

// ---------- math ----------
const TAU=Math.PI*2;
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const fract=(v:number)=>v-Math.floor(v);
const hash=(n:number)=>fract(Math.sin(n*127.1+311.7)*43758.5453);
const smooth=(a:number,b:number,v:number)=>{v=clamp((v-a)/(b-a));return v*v*(3-2*v);};
const easeOut=(v:number)=>1-(1-clamp(v))**3;
const lerp=(p:Pt,q:Pt,t:number)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
const life=(t:number,a:number,b:number)=>t>=a&&t<=b;
function teeth(s:number,seed:number,k=9){const f=fract(s*k+hash(seed)),id=Math.floor(s*k+hash(seed));return (1-f)**2.4*(.45+.55*hash(id*3.7+seed));}

// ---------- ribbons ----------
interface Ribbon{o:Pt[];i:Pt[];n:number}
function buildRibbon(n:number,fn:(u:number)=>{o:Pt;i:Pt}):Ribbon{const o:Pt[]=[],i:Pt[]=[];for(let k=0;k<=n;k++){const r=fn(k/n);o.push(r.o);i.push(r.i);}return{o,i,n};}
function bandPath(c:CanvasRenderingContext2D,rb:Ribbon,a:number,b:number){
 c.beginPath();
 for(let k=0;k<=rb.n;k++){const p=lerp(rb.o[k],rb.i[k],a);k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}
 for(let k=rb.n;k>=0;k--){const p=lerp(rb.o[k],rb.i[k],b);c.lineTo(p.x,p.y);}
 c.closePath();
}
function sample(rb:Ribbon,u:number,v:number){const f=clamp(u)*rb.n,k=Math.min(rb.n-1,Math.floor(f)),t=f-k;return lerp(lerp(rb.o[k],rb.o[k+1],t),lerp(rb.i[k],rb.i[k+1],t),v);}
function star4(c:CanvasRenderingContext2D,x:number,y:number,r:number,rot=0,thin=.2){c.beginPath();for(let k=0;k<8;k++){const a=rot+k*Math.PI/4,rr=k%2?r*thin:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();}
function diamond(c:CanvasRenderingContext2D,x:number,y:number,r:number,rot:number){c.beginPath();for(let k=0;k<4;k++){const a=rot+k*Math.PI/2,rr=k%2?r*.4:r;c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();}
/** Cel-banded blade: edge → hi → mid → low → deep, with gold shards in the dark side. */
function paintBlade(v:V,rb:Ribbon,P:Pal,{alpha=1,seed=1,flecks=16,glow=1}={}){
 const fx=v.fx,gl=v.glow;if(alpha<=0)return;
 if(P.deep){fx.globalAlpha=alpha*.95;fx.fillStyle=P.deep;bandPath(fx,rb,0,1);fx.fill();}
 fx.globalAlpha=alpha;
 fx.fillStyle=P.low;bandPath(fx,rb,0,P.deep?.78:1);fx.fill();
 fx.fillStyle=P.mid;bandPath(fx,rb,0,.55);fx.fill();
 fx.fillStyle=P.hi;bandPath(fx,rb,0,.3);fx.fill();
 fx.fillStyle=P.edge;bandPath(fx,rb,0,.1);fx.fill();
 if(flecks){
  fx.save();bandPath(fx,rb,.35,1);fx.clip();
  for(let s=0;s<flecks;s++){const p=sample(rb,hash(seed+s*3.17),.4+.6*hash(seed+s*7.71));fx.globalAlpha=alpha*(.5+.5*Math.sin(v.time*16+s*2.3));fx.fillStyle=P.fleck;diamond(fx,p.x,p.y,1.6+hash(seed+s)*2.6,hash(s+seed*2)*3);fx.fill();}
  fx.restore();
 }
 fx.globalAlpha=1;
 gl.globalAlpha=alpha*.8*glow;gl.fillStyle=P.mid;bandPath(gl,rb,0,.7);gl.fill();
 gl.globalAlpha=alpha*glow;gl.fillStyle=P.hi;bandPath(gl,rb,0,.32);gl.fill();
 gl.globalAlpha=1;
}
function polyline(c:CanvasRenderingContext2D,pts:Pt[],width:number,color:string,alpha=1,close=false){if(pts.length<2||alpha<=0)return;c.globalAlpha=Math.min(1,alpha);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));if(close)c.closePath();c.stroke();c.globalAlpha=1;}
function glint(v:V,p:Pt,r:number,alpha:number,rot:number,P:Pal){
 if(alpha<=0||r<=0)return;const g=v.glow;g.globalAlpha=Math.min(1,alpha);const rg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r*1.4);rg.addColorStop(0,'#fff');rg.addColorStop(.3,P.hi);rg.addColorStop(1,P.mid+'00');g.fillStyle=rg;g.beginPath();g.arc(p.x,p.y,r*1.4,0,TAU);g.fill();g.globalAlpha=1;
 const f=v.fx;f.globalAlpha=Math.min(1,alpha);f.fillStyle='#fff';star4(f,p.x,p.y,r,rot,.14);f.fill();f.globalAlpha=1;
}
function streak(v:V,p0:W,vel:{x:number;z:number;h?:number},age:number,lifeS:number,color:string,len=.06){
 if(age<0||age>lifeS)return;
 const pos=(a:number)=>{const d=(1-Math.exp(-4*a))/4;return v.P(p0.x+vel.x*d,p0.z+vel.z*d,(p0.h??0)+(vel.h??0)*d-1.2*a*a);};
 const t=age/lifeS,a=pos(age),b=pos(Math.max(0,age-len*(1-t*.5)));
 polyline(v.glow,[b,a],3,color,(1-t)*.9);polyline(v.fx,[b,a],1.2,'#fff',1-t);
}
function sparkBurst(v:V,w:W,age:number,P:Pal,n=10,seed=1,speed=3,lifeS=.35){for(let k=0;k<n;k++){const a=k/n*TAU+hash(k*1.9+seed),sp=speed*(.6+hash(k*4.2+seed)*.8);streak(v,w,{x:Math.cos(a)*sp,z:Math.sin(a)*sp,h:.5+hash(k*6.6+seed)*2.5},age,lifeS*(.8+hash(k+seed)*.4),k%3?P.spark:P.hi);}}
function burst(v:V,w:W,age:number,lifeS:number,size:number,P:Pal){
 if(age<0||age>lifeS)return;
 const t=age/lifeS,p=v.P(w.x,w.z,w.h??0),r=v.S*size*easeOut(t/.35),a=(1-t)**1.5;
 glint(v,p,r,a,t*.8,P);
 const g=v.glow;g.globalAlpha=a*.8;g.strokeStyle=P.hi;g.lineWidth=2;g.beginPath();g.ellipse(p.x,p.y,r*1.3,r*.65,0,0,TAU);g.stroke();g.globalAlpha=1;
}
function circlePts(v:V,c:W,r:number,h=.05,n=56,jit?:(k:number)=>number){const pts:Pt[]=[];for(let k=0;k<n;k++){const a=k/n*TAU,j=jit?jit(k):0;pts.push(v.P(c.x+Math.cos(a)*(r+j),c.z+Math.sin(a)*(r+j),h+(jit?j*.25:0)));}return pts;}
function shockRing(v:V,c:W,r:number,P:Pal,alpha:number,width=3,h=.05){if(alpha<=0||r<=0)return;const pts=circlePts(v,c,r,h);polyline(v.glow,pts,width*3.5,P.mid,alpha*.8,true);polyline(v.fx,pts,width,P.hi,alpha,true);}
function groundGlow(v:V,c:W,r:number,P:Pal,alpha:number){if(alpha<=0)return;const p=v.P(c.x,c.z,0),gl=v.glow,rr=r*v.S,gr=gl.createRadialGradient(p.x,p.y,0,p.x,p.y,rr);gr.addColorStop(0,P.mid+'88');gr.addColorStop(.6,P.low+'44');gr.addColorStop(1,P.low+'00');gl.save();gl.translate(p.x,p.y);gl.scale(1,.5);gl.translate(-p.x,-p.y);gl.globalAlpha=Math.min(1,alpha);gl.fillStyle=gr;gl.beginPath();gl.arc(p.x,p.y,rr,0,TAU);gl.fill();gl.restore();gl.globalAlpha=1;}
function cracks(v:V,c:W,R:number,n:number,seed:number,prog:number,P:Pal,alpha:number){
 if(alpha<=0||prog<=0)return;
 for(let i=0;i<n;i++){
  const a0=i/n*TAU+hash(i*2.3+seed)*.5,len=R*(.6+.4*hash(i*5.1+seed))*prog,pts=[v.P(c.x,c.z,.02)];let a=a0;
  for(let k=1;k<=6;k++){a+=(hash(i*13+k+seed)-.5)*.5;const r=len*k/6;pts.push(v.P(c.x+Math.cos(a)*r,c.z+Math.sin(a)*r,.02));}
  polyline(v.glow,pts,5,P.mid,alpha*.9);polyline(v.fx,pts,1.6,P.edge,alpha);
  if(prog>.5){const b=pts[3],ba=a0+(hash(i+seed)-.5)*1.4,r2=len*.35,q=v.P(c.x+Math.cos(a0)*len*.5+Math.cos(ba)*r2,c.z+Math.sin(a0)*len*.5+Math.sin(ba)*r2,.02);polyline(v.glow,[b,q],3,P.mid,alpha*.7);polyline(v.fx,[b,q],1,P.hi,alpha);}
 }
}
function dust(v:V,c:W,r:number,t:number,alpha:number,n:number,seed:number,color='#eadfc6'){
 if(alpha<=0)return;const fx=v.fx;
 for(let i=0;i<n;i++){const a=i/n*TAU+hash(i+seed),rr=r*(.75+.5*hash(i*3+seed)),p=v.P(c.x+Math.cos(a)*rr,c.z+Math.sin(a)*rr,.25+t*.4),s=v.S*(.3+.35*hash(i*7+seed))*(.6+t),g=fx.createRadialGradient(p.x,p.y,0,p.x,p.y,s);g.addColorStop(0,color+'cc');g.addColorStop(1,color+'00');fx.globalAlpha=Math.min(1,alpha*(1-t));fx.fillStyle=g;fx.beginPath();fx.arc(p.x,p.y,s,0,TAU);fx.fill();}
 fx.globalAlpha=1;
}
function rocks(v:V,c:W,age:number,n:number,seed:number,spread=1,colors=['#4a3624','#8a6a45']){
 const fx=v.fx;
 for(let i=0;i<n;i++){
  const a=i/n*TAU+hash(i*2.2+seed),up=2+hash(i*4.4+seed)*2.4,out=1+hash(i*8.8+seed)*1.6,s=v.S*(.1+hash(i*1.7+seed)*.12),h=up*age-5*age*age;
  if(age<0||h<0)continue;const r=.4*spread+out*age,p=v.P(c.x+Math.cos(a)*r,c.z+Math.sin(a)*r,h);
  fx.save();fx.translate(p.x,p.y);fx.rotate((hash(i+seed)-.5)*14*age);fx.fillStyle=colors[0];fx.beginPath();for(let k=0;k<6;k++){const an=k/6*TAU,rr=s*(.75+.35*hash(i*9+k+seed));fx.lineTo(Math.cos(an)*rr,Math.sin(an)*rr);}fx.closePath();fx.fill();fx.fillStyle=colors[1];fx.beginPath();fx.moveTo(-s*.5,-s*.2);fx.lineTo(s*.2,-s*.6);fx.lineTo(s*.4,0);fx.closePath();fx.fill();fx.restore();
 }
}
/** Straight-ish slash in screen space; the sharp edge sits on the convex side. */
function screenSlash(v:V,p:Pt,rot:number,L:number,th:number,grow:number,fade:number,P:Pal,seed:number,bend=.25,flecks=6){
 if(grow<=0||fade<=0)return;const ux=Math.cos(rot),uy=Math.sin(rot),nx=-uy,ny=ux;
 const rb=buildRibbon(24,u=>{const s=(u*2-1)*grow,b=(1-s*s)*L*bend,w=th*Math.sin(Math.PI*u)**.9*fade*(1+.5*teeth(u,seed,5)*(1-fade)),q={x:p.x+ux*L*s+nx*b,y:p.y+uy*L*s+ny*b};return{o:q,i:{x:q.x-nx*w,y:q.y-ny*w}};});
 paintBlade(v,rb,P,{alpha:fade,seed,flecks});
}
interface Swing{flip:number;R:number;T:number;sweep:number;life:number;seed:number;flecks?:number;tilt?:number;glint?:number}
function swing(v:V,sw:Swing,lt:number,hero:W,dir:{x:number;z:number},P:Pal){
 const tl=lt/sw.life;if(tl<0||tl>1)return;
 const head=easeOut(tl/.4),tail=clamp((tl-.12)/.88)**2,fade=1-smooth(.55,1,tl);
 const base=Math.atan2(dir.z,dir.x),cx=hero.x+dir.x*.2,cz=hero.z+dir.z*.2,from=-sw.sweep+2*sw.sweep*tail,to=-sw.sweep+2*sw.sweep*head;
 const at=(ang:number,r:number,dh=0)=>{const a=ang*sw.flip,w=base+a;return{x:cx+Math.cos(w)*r,z:cz+Math.sin(w)*r,h:1.05+Math.sin(ang)*(sw.tilt??1.05)+dh};};
 const rb=buildRibbon(40,u=>{
  const ang=from+(to-from)*u,thick=sw.T*Math.sin(Math.PI*u)**.75*(.35+.65*u)*(.35+.65*fade),stable=(ang+sw.sweep)/(2*sw.sweep);
  const ri=sw.R-thick*(1+.55*teeth(stable,sw.seed,8)*(1.6-fade*.6)),o=at(ang,sw.R),i=at(ang,ri,-.05);
  return{o:v.P(o.x,o.z,o.h),i:v.P(i.x,i.z,i.h)};
 });
 paintBlade(v,rb,P,{alpha:Math.min(1,tl*12)*(.3+.7*fade),seed:sw.seed,flecks:sw.flecks??14});
 const pts:Pt[]=[];for(let k=0;k<=16;k++){const u=.55+.45*k/16,ang=from+(to-from)*u,p=at(ang,sw.R*1.1,.06);pts.push(v.P(p.x,p.z,p.h));}
 polyline(v.glow,pts,2.6,P.hi,fade*.7);polyline(v.fx,pts,1.2,'#fff',fade*.9);
 if(head<.995){const tip=at(to,sw.R*1.02);glint(v,v.P(tip.x,tip.z,tip.h),v.S*(sw.glint??.3),.9,v.time*3,P);}
}
/** Ground ring segment from `from` to `to` radians (whirlwinds). */
function arcRibbon(v:V,c:W,{R,T,from,to,h=.06,tilt=0,tiltPhase=0,seed=1,fade=1,jag=.6,n=64,spiral=0}:{R:number;T:number;from:number;to:number;h?:number;tilt?:number;tiltPhase?:number;seed?:number;fade?:number;jag?:number;n?:number;spiral?:number}){
 return buildRibbon(n,u=>{const a=from+(to-from)*u,thick=T*Math.sin(Math.PI*u)**.6*(.3+.7*u)*(.35+.65*fade),r=R*(1+spiral*u),ri=r-thick*(1+jag*teeth(a/TAU,seed,14)*(1.5-fade*.5)),hh=h+Math.sin(a+tiltPhase)*tilt;
  return{o:v.P(c.x+Math.cos(a)*r,c.z+Math.sin(a)*r,hh),i:v.P(c.x+Math.cos(a)*ri,c.z+Math.sin(a)*ri,hh-.02)};});
}
interface Stroke{a0:number;a1:number;r:number;h:number;T:number;tilt:number;ph:number;seed:number}
function windStroke(v:V,c:W,s:Stroke,from:number,to:number,fade:number){
 const n=Math.max(4,Math.ceil((to-from)/.08));
 return buildRibbon(n,u=>{const a=from+(to-from)*u,t=(a-s.a0)/(s.a1-s.a0),thick=s.T*Math.sin(Math.PI*clamp(t))**.7*(.35+.65*t)*(.4+.6*fade),ri=s.r-thick*(1+.35*teeth(t,s.seed,6)),h=s.h+Math.sin(a+s.ph)*s.tilt;
  return{o:v.P(c.x+Math.cos(a)*s.r,c.z+Math.sin(a)*s.r,h),i:v.P(c.x+Math.cos(a)*ri,c.z+Math.sin(a)*ri,h-.03)};});
}
function flash(v:V,p:Pt,r:number,P:Pal,a:number){if(a<=0)return;const g=v.glow,gr=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r);gr.addColorStop(0,'#ffffff');gr.addColorStop(.22,P.hi);gr.addColorStop(.6,P.mid+'66');gr.addColorStop(1,P.mid+'00');g.globalAlpha=Math.min(1,a);g.fillStyle=gr;g.fillRect(p.x-r,p.y-r,r*2,r*2);g.globalAlpha=1;}
function beam(v:V,w:W,height:number,width:number,P:Pal,a:number){
 if(a<=0)return;const b=v.P(w.x,w.z,0),t=v.P(w.x,w.z,height),ww=width*v.S;
 for(const [L,k,al] of [[v.glow,1,1],[v.fx,.25,.9]] as [CanvasRenderingContext2D,number,number][]){const gr=L.createLinearGradient(0,b.y,0,t.y);gr.addColorStop(0,k<1?'#ffffff':P.hi);gr.addColorStop(.55,(k<1?P.hi:P.mid)+'aa');gr.addColorStop(1,P.mid+'00');L.globalAlpha=Math.min(1,a*al);L.fillStyle=gr;L.beginPath();L.moveTo(b.x-ww*k,b.y);L.lineTo(t.x-ww*k*.25,t.y);L.lineTo(t.x+ww*k*.25,t.y);L.lineTo(b.x+ww*k,b.y);L.closePath();L.fill();}
 v.glow.globalAlpha=v.fx.globalAlpha=1;
}
function runeCircle(v:V,c:W,r:number,P:Pal,a:number,rot:number,style='holy'){
 if(a<=0||r<=0)return;
 const ring=(rr:number,w:number,col:string,al:number,L:CanvasRenderingContext2D)=>polyline(L,circlePts(v,c,rr,.03,72),w,col,al,true);
 ring(r,7,P.mid,a*.75,v.glow);ring(r,1.8,P.edge,a,v.fx);ring(r*.84,4,P.mid,a*.55,v.glow);ring(r*.84,1.1,P.hi,a,v.fx);
 for(let k=0;k<48;k++){const an=k/48*TAU+rot,q1=v.P(c.x+Math.cos(an)*r*.86,c.z+Math.sin(an)*r*.86,.03),f=k%4?.92:.98,q2=v.P(c.x+Math.cos(an)*r*f,c.z+Math.sin(an)*r*f,.03);polyline(v.fx,[q1,q2],k%4?1:1.8,P.hi,a*.9);}
 const n=style==='holy'?6:7,step=style==='holy'?2:3,rr=r*.8,pts:W[]=[];
 for(let k=0;k<n;k++){const an=k/n*TAU-rot*.7;pts.push({x:c.x+Math.cos(an)*rr,z:c.z+Math.sin(an)*rr});}
 for(let k=0;k<n;k++){const p=pts[k],q=pts[(k+step)%n];let seg=[v.P(p.x,p.z,.03),v.P(q.x,q.z,.03)];
  if(style!=='holy'){const m={x:(p.x+q.x)/2*.55+c.x*.45,z:(p.z+q.z)/2*.55+c.z*.45};seg=[seg[0],v.P(m.x,m.z,.03),seg[1]];}
  polyline(v.glow,seg,5,P.mid,a*.7);polyline(v.fx,seg,1.3,P.edge,a);}
 for(const p of pts){const q=v.P(p.x,p.z,.03);v.fx.globalAlpha=Math.min(1,a);v.fx.fillStyle=P.edge;diamond(v.fx,q.x,q.y,v.S*.12,Math.PI/2);v.fx.fill();}
 v.fx.globalAlpha=1;
}
function bolt(v:V,from:Pt,to:Pt,seed:number,P:Pal,a:number,w=2){
 if(a<=0)return;const pts:Pt[]=[],n=12,dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
 for(let k=0;k<=n;k++){const t=k/n,j=k===0||k===n?0:(hash(seed*31+k*7.3)-.5)*v.S*.9*(1-Math.abs(t-.5));pts.push({x:from.x+dx*t+nx*j,y:from.y+dy*t+ny*j});}
 polyline(v.glow,pts,w*6,P.mid,a);polyline(v.glow,pts,w*2.5,P.hi,a);polyline(v.fx,pts,w,'#ffffff',a);
 const b=pts[5],bt={x:b.x+(hash(seed*3)-.5)*v.S*1.6,y:b.y+v.S*.9};polyline(v.glow,[b,bt],w*3,P.mid,a*.7);polyline(v.fx,[b,bt],w*.6,'#fff',a*.8);
}
function shieldCrest(v:V,p:Pt,s:number,P:Pal,alpha:number){
 if(alpha<=0||s<=0)return;const f=v.fx;f.save();f.translate(p.x,p.y);f.globalAlpha=Math.min(1,alpha);
 const path=()=>{f.beginPath();f.moveTo(-s*.5,-s*.55);f.quadraticCurveTo(0,-s*.68,s*.5,-s*.55);f.lineTo(s*.48,0);f.quadraticCurveTo(s*.4,s*.45,0,s*.7);f.quadraticCurveTo(-s*.4,s*.45,-s*.48,0);f.closePath();};
 const g=f.createLinearGradient(0,-s*.6,0,s*.7);g.addColorStop(0,P.mid);g.addColorStop(1,P.deep??P.low);path();f.fillStyle=g;f.fill();
 f.lineWidth=s*.08;f.strokeStyle='#f0c75e';path();f.stroke();
 f.fillStyle='#f6d56f';f.beginPath();f.moveTo(0,-s*.38);f.lineTo(s*.12,-s*.05);f.lineTo(0,s*.36);f.lineTo(-s*.12,-s*.05);f.closePath();f.fill();
 for(const sg of [-1,1]){f.beginPath();f.moveTo(0,-s*.02);f.quadraticCurveTo(sg*s*.3,-s*.2,sg*s*.22,s*.12);f.quadraticCurveTo(sg*s*.12,0,0,s*.1);f.closePath();f.fill();}
 f.restore();
}
function starBurst(v:V,p:Pt,R:number,P:Pal,a:number,seed:number){
 if(a<=0||R<=1)return;
 const layer=(L:CanvasRenderingContext2D,scale:number,col:string,al:number,w:number)=>{L.globalAlpha=Math.min(1,al);L.fillStyle=col;for(let i=0;i<18;i++){const an=i/18*TAU+(hash(seed+i)-.5)*.3,len=R*scale*(.45+.55*hash(seed+i*3.3)),bw=R*w,ca=Math.cos(an),sa=Math.sin(an)*.62,px=-sa,py=ca;L.beginPath();L.moveTo(p.x+px*bw,p.y+py*bw);L.lineTo(p.x+ca*len,p.y+sa*len-len*.12);L.lineTo(p.x-px*bw,p.y-py*bw);L.closePath();L.fill();}L.globalAlpha=1;};
 layer(v.fx,1.25,'#3a2410',a*.55,.16);layer(v.glow,1.05,P.mid,a,.17);layer(v.fx,1,P.mid,a,.15);layer(v.fx,.7,P.hi,a,.12);
 flash(v,p,R*.75,P,a);v.fx.globalAlpha=Math.min(1,a);v.fx.fillStyle='#fffbea';v.fx.beginPath();v.fx.ellipse(p.x,p.y,R*.18,R*.12,0,0,TAU);v.fx.fill();v.fx.globalAlpha=1;
}
function rockShard(v:V,base:W,out:{x:number;z:number},h:number,w:number,P:Pal,a:number,seed:number){
 if(a<=0||h<=.02)return;const fx=v.fx,t=v.P(base.x+out.x*h*.75,base.z+out.z*h*.75,h),perp={x:-out.z,z:out.x};
 const l=v.P(base.x+perp.x*w/2,base.z+perp.z*w/2,0),r=v.P(base.x-perp.x*w/2,base.z-perp.z*w/2,0),m=v.P(base.x+out.x*w*.35,base.z+out.z*w*.35,h*.15),sh=v.P(base.x+out.x*h*.4+perp.x*w*.18,base.z+out.z*h*.4+perp.z*w*.18,h*.8);
 fx.globalAlpha=Math.min(1,a);fx.fillStyle='#3e2a16';fx.beginPath();fx.moveTo(l.x,l.y);fx.lineTo(sh.x,sh.y);fx.lineTo(t.x,t.y);fx.lineTo(r.x,r.y);fx.closePath();fx.fill();
 fx.fillStyle=hash(seed)>.5?'#7d5a30':'#6c4e2a';fx.beginPath();fx.moveTo(l.x,l.y);fx.lineTo(sh.x,sh.y);fx.lineTo(t.x,t.y);fx.lineTo(m.x,m.y);fx.closePath();fx.fill();
 fx.fillStyle='#c2914a';fx.beginPath();fx.moveTo(sh.x,sh.y);fx.lineTo(t.x,t.y);fx.lineTo(m.x,m.y);fx.closePath();fx.fill();
 polyline(v.glow,[l,r],v.S*.12,P.mid,a*.9);fx.globalAlpha=1;
}
/** Runs `draw` clipped to the far (above `cut`) or near half of the screen; used for rings around the hero. */
function half(v:V,front:boolean,draw:()=>void){
 for(const c of [v.fx,v.glow]){c.save();c.beginPath();front?c.rect(-1e4,v.heroY,2e4,2e4):c.rect(-1e4,-1e4,2e4,1e4+v.heroY);c.clip();}
 draw();v.fx.restore();v.glow.restore();
}

// ---------- event → effect ----------
const FOLLOW=new Set(['basic','slash','whirlwind','provoke','endure','bulwark','rally','frenzy','bloodRage','cyclone','quakeCharge','shieldFly']);
const LIFE:Record<string,number>={basic:.5,basicHit:.36,slash:.55,slashHit:.5,whirlwind:.85,dash:.75,dashHit:.45,earth:1,provoke:1.25,endure:1.7,shieldFly:.2,shieldHit:1.5,bulwark:2.55,quakeCharge:.85,quake:2,rally:1.7,frenzy:.75,frenzyHit:1.2,bloodRage:2.45,cyclone:1.15,cycloneHit:.32,leapTrail:.75,leap:1.6,hitSpark:.35};
const SKILL_KIND:Record<string,string>={slash:'slash',whirlwind:'whirlwind',provoke:'provoke',endure:'endure',shield_bash:'shieldFly',bulwark:'bulwark',quake_slam:'quakeCharge',rally_roar:'rally',frenzy_slash:'frenzy',blood_rage:'bloodRage',blade_cyclone:'cyclone'};
const HIT_KIND:Record<string,string>={basic:'basicHit',slash:'slashHit',dash_strike:'dashHit',shield_bash:'shieldHit',frenzy_slash:'frenzyHit',blade_cyclone:'cycloneHit',whirlwind:'hitSpark',earth_break:'hitSpark',quake_slam:'hitSpark',leap_strike:'hitSpark',provoke:'hitSpark'};
/** Which effect an event spawns (null = not a sword-line skill; the renderer keeps its old handling). */
export function vfxKind(e:any):string|null{
 if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.z))return null;
 if(e.type==='slash')return 'basic';
 if(e.type==='skill')return SKILL_KIND[e.skillId]??(e.skillId==='dash_strike'||e.skillId==='earth_break'||e.skillId==='leap_strike'?'none':null);
 if(e.type==='dashTrail')return e.skillId==='leap_strike'?'leapTrail':'dash';
 if(e.type==='skillImpact')return e.skillId==='earth_break'?'earth':e.skillId==='quake_slam'?'quake':e.skillId==='leap_strike'?'leap':null;
 if(e.type==='hit'&&!e.reflect)return HIT_KIND[e.skillId??'basic']??null;
 return null;
}
export const PALETTE_OF:Record<string,string>={basic:'steel',basicHit:'steel',slash:'cream',slashHit:'cream',whirlwind:'jade',dash:'jade',dashHit:'jade',earth:'gold',provoke:'sand',endure:'gold',shieldFly:'emerald',shieldHit:'emerald',bulwark:'emerald',quakeCharge:'amber',quake:'amber',rally:'storm',frenzy:'crimson',frenzyHit:'crimson',bloodRage:'crimson',cyclone:'crimson',cycloneHit:'crimson',leapTrail:'crimson',leap:'crimson',hitSpark:'cream'};

export class SkillVfx2D {
 effects:Fx[]=[];time=0;readonly max=96;
 private facing=new Map<string,{dx:number;dz:number}>();
 /** Visual-only travel for dashes and leaps: the server moves the hero in one tick, the sprite follows the trail instead. */
 private travel=new Map<string,{fromX:number;fromZ:number;toX:number;toZ:number;t0:number;dur:number;leap:boolean}>();
 private fxC=document.createElement('canvas');private glC=document.createElement('canvas');private blurC=document.createElement('canvas');
 private fxX=this.fxC.getContext('2d')!;private glX=this.glC.getContext('2d')!;private blurX=this.blurC.getContext('2d')!;
 private glowScale=.35;
 /** Returns true when the event is a sword-line skill event (handled here, even if it spawns nothing). */
 event(e:any,you?:string){
  const kind=vfxKind(e);if(!kind)return false;
  if(e.type==='skill'&&e.playerId&&Number.isFinite(e.dx))this.facing.set(e.playerId,{dx:e.dx,dz:e.dz});
  if(kind==='none')return true;
  const face=this.facing.get(e.playerId)??{dx:1,dz:0},dx=Number.isFinite(e.dx)?e.dx:face.dx,dz=Number.isFinite(e.dz)?e.dz:face.dz,d=Math.hypot(dx,dz)||1;
  const fx:Fx={kind,t0:this.time,life:LIFE[kind],x:e.x,z:e.z,dx:dx/d,dz:dz/d,playerId:e.playerId,follow:FOLLOW.has(kind),seed:(e.id??0)*7+(e.combo??0)+Math.floor(this.time*13),crit:!!e.crit,index:e.hitIndex??0,other:!!you&&!!e.playerId&&e.playerId!==you};
  if(e.type==='slash')fx.index=e.combo??0;
  if(e.type==='dashTrail'&&e.playerId)this.travel.set(e.playerId,{fromX:e.fromX,fromZ:e.fromZ,toX:e.toX,toZ:e.toZ,t0:this.time,dur:kind==='leapTrail'?e.duration??.4:DASH_TIME,leap:kind==='leapTrail'});
  if(e.type==='dashTrail'){fx.x=e.fromX;fx.z=e.fromZ;fx.toX=e.toX;fx.toZ=e.toZ;fx.dur=e.duration??.4;if(kind==='leapTrail')fx.life=fx.dur+.35;const L=Math.hypot(e.toX-e.fromX,e.toZ-e.fromZ)||1;fx.dx=(e.toX-e.fromX)/L;fx.dz=(e.toZ-e.fromZ)/L;}
  if(kind==='frenzyHit'){const sameTarget=this.effects.filter(f=>f.kind==='frenzyHit'&&this.time-f.t0<.6&&Math.hypot(f.x-e.x,f.z-e.z)<1.5).length;fx.index=e.hitIndex??sameTarget;}
  this.effects.push(fx);if(this.effects.length>this.max)this.effects.splice(0,this.effects.length-this.max);
  return true;
 }
 clear(){this.effects.length=0;this.facing.clear();this.travel.clear();}
 /** Where to draw a hero mid-dash or mid-leap (null when not travelling, or when it has since moved elsewhere). */
 heroPose(id:string,x:number,z:number){
  const t=this.travel.get(id);if(!t)return null;const age=this.time-t.t0;
  if(age>=t.dur+GHOST_TAIL||Math.hypot(x-t.toX,z-t.toZ)>1.5){this.travel.delete(id);return null;}
  const at=(a:number)=>{const k=t.leap?clamp(a/t.dur):easeOut(a/t.dur);return{x:t.fromX+(t.toX-t.fromX)*k,z:t.fromZ+(t.toZ-t.fromZ)*k,lift:t.leap?leapLift(a,t.dur):0};};
  // Tinted afterimages trail the sprite and fold back into it once it arrives.
  const fade=1-smooth(t.dur,t.dur+GHOST_TAIL,age),ghosts=[1,2,3,4].map(k=>({...at(Math.max(0,age-k*.045)),alpha:(.42-k*.08)*fade})).filter(g=>g.alpha>.01);
  return{...at(age),ghosts,tint:t.leap?'#ff2030':'#5fd0b0'};
 }
 /** Advances the clock, prunes finished effects and paints the layer behind entities. */
 pre(f:VfxFrame,dt:number){this.time+=Math.max(0,Math.min(dt,.1));this.effects=this.effects.filter(e=>this.time-e.t0<e.life);this.paint(f,'pre');}
 post(f:VfxFrame){this.paint(f,'post');}
 snapshot(){return{effects:this.effects.length,kinds:[...new Set(this.effects.map(e=>e.kind))]};}
 private paint(f:VfxFrame,phase:'pre'|'post'){
  if(!this.effects.length)return;
  const W=Math.round(f.width*f.dpr),H=Math.round(f.height*f.dpr),g=f.highQuality?this.glowScale:.25,gw=Math.max(1,Math.round(W*g)),gh=Math.max(1,Math.round(H*g));
  if(this.fxC.width!==W||this.fxC.height!==H){this.fxC.width=W;this.fxC.height=H;}
  if(this.glC.width!==gw||this.glC.height!==gh){this.glC.width=gw;this.glC.height=gh;this.blurC.width=gw;this.blurC.height=gh;}
  const fx=this.fxX,gl=this.glX;
  fx.setTransform(1,0,0,1,0,0);fx.clearRect(0,0,W,H);fx.setTransform(f.dpr,0,0,f.dpr,0,0);
  gl.setTransform(1,0,0,1,0,0);gl.clearRect(0,0,gw,gh);gl.setTransform(f.dpr*g,0,0,f.dpr*g,0,0);
  for(const e of this.effects){
   const at=e.follow&&e.playerId?f.locate(e.playerId)??e:e,v:V={fx,glow:gl,P:f.screen,S:f.scale,time:this.time,heroY:f.screen(at.x,at.z,0).y};
   fx.globalAlpha=gl.globalAlpha=1;fx.globalCompositeOperation=gl.globalCompositeOperation='source-over';
   try{DRAW[e.kind]?.(v,e,{x:at.x,z:at.z},this.time-e.t0,PALS[PALETTE_OF[e.kind]],phase);}catch(err){console.warn('skill vfx',e.kind,err);}
  }
  const c=f.ctx;c.save();c.setTransform(1,0,0,1,0,0);
  const bx=this.blurX;bx.setTransform(1,0,0,1,0,0);bx.clearRect(0,0,gw,gh);bx.filter=`blur(${Math.max(1.5,f.scale*f.dpr*g*.5)}px)`;bx.drawImage(this.glC,0,0);bx.filter='none';
  c.globalCompositeOperation='lighter';c.globalAlpha=.75;c.drawImage(this.blurC,0,0,W,H);c.globalAlpha=.7;c.drawImage(this.glC,0,0,W,H);
  c.globalCompositeOperation='source-over';c.globalAlpha=1;c.drawImage(this.fxC,0,0);
  c.restore();
 }
}

/** How long afterimages linger after a dash or leap lands. */
export const GHOST_TAIL=.25;
/** Dash slide time; the jade lance head runs on the same curve. */
export const DASH_TIME=.22;
/** Leap arc height in world units at `age` of a `dur`-second jump. */
export const leapLift=(age:number,dur:number)=>age>0&&age<dur?Math.sin(clamp(age/dur)*Math.PI)*2.1:0;

// ---------- per-skill painters ----------
type Draw=(v:V,e:Fx,o:W,age:number,P:Pal,phase:'pre'|'post')=>void;
const dirOf=(e:Fx)=>({x:e.dx,z:e.dz});
const DRAW:Record<string,Draw>={
 basic(v,e,o,age,P,ph){if(ph==='post')swing(v,{flip:e.index%2?-1:1,R:e.index%3===2?1.8:1.6,T:e.index%3===2?.8:.62,sweep:e.index%3===2?1.3:1.1,life:.45,seed:e.seed%97,flecks:0},age,o,dirOf(e),P);},
 basicHit(v,e,o,age,P,ph){if(ph!=='post')return;const w={x:o.x,z:o.z,h:1};burst(v,w,age,.22,e.crit?.7:.45,P);sparkBurst(v,w,age,P,e.crit?12:7,e.seed,2.6,.25);},
 slash(v,e,o,age,P,ph){if(ph==='post')swing(v,{flip:1,R:1.95,T:1.25,sweep:1.5,life:.5,seed:5,flecks:22,glint:.42},age,o,dirOf(e),P);},
 slashHit(v,e,o,age,P,ph){if(ph!=='post')return;const hit={x:o.x,z:o.z,h:1.05};burst(v,hit,age,.3,.8,P);sparkBurst(v,hit,age,P,12,e.seed,3.5);for(let k=0;k<10;k++)streak(v,{x:hit.x,z:hit.z,h:1.1},{x:e.dx*3+(hash(k)-.5)*3,z:e.dz*3+(hash(k*3)-.5)*3,h:1+hash(k*5)*2},age-.02*k,.4,P.fleck,.04);},
 whirlwind(v,e,o,age,P,ph){
  const L=.78,tl=age/L,full=TAU*1.15,fade=1-smooth(.55,1,tl);if(tl>1)return;
  half(v,ph==='post',()=>{
   for(const [R,T,lag,off,tilt,seed,al] of [[2.45,.38,.06,.9,-.16,13,.75],[1.9,.66,0,0,.22,7,1]]){const l2=Math.max(0,age-lag)/L,head=easeOut(l2/.5)*full,tail=clamp((l2-.14)/.86)**1.5*full,f2=1-smooth(.55,1,l2);
    paintBlade(v,arcRibbon(v,o,{R,T,from:tail+off,to:head+off,tilt,tiltPhase:.6,seed,fade:f2,spiral:.05}),P,{alpha:al*Math.min(1,l2*12)*(.3+.7*f2),seed,flecks:24});}
   for(let k=0;k<5;k++){const a0=hash(k*3)*TAU+v.time*9,pts:Pt[]=[];for(let j=0;j<=14;j++){const a=a0+j*.09,r=2.9+k*.08;pts.push(v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,.3+k*.12));}polyline(v.glow,pts,2.5,P.hi,fade*.6);polyline(v.fx,pts,1,'#fff',fade*.7);}
  });
  if(ph==='pre')groundGlow(v,o,2.6,P,fade*Math.min(1,tl*8)*.8);
 },
 dash(v,e,o,age,P,ph){
  if(ph!=='post')return;const D=DASH_TIME,from={x:e.x,z:e.z},to={x:e.toX,z:e.toZ},span=Math.hypot(to.x-from.x,to.z-from.z),k=(t:number)=>easeOut(t/D),pos=(t:number)=>({x:from.x+(to.x-from.x)*k(t),z:from.z+(to.z-from.z)*k(t)});
  const fade=1-smooth(.3,.75,age),tp=pos(Math.max(0,age-.2)),me=pos(age),hp={x:me.x+e.dx*1.1,z:me.z+e.dz*1.1},len=Math.hypot(hp.x-tp.x,hp.z-tp.z);
  if(len>.05&&span>.05)for(const sg of [1,-1])paintBlade(v,buildRibbon(32,u=>{const x=tp.x+(hp.x-tp.x)*u,z=tp.z+(hp.z-tp.z)*u,th=.36*u**.7*(1-.9*smooth(.88,1,u))*(.4+.6*fade)*(1+.7*teeth(u*len*.3,31+sg,4)*(1.5-fade*.5));return{o:v.P(x,z,.95),i:v.P(x,z,.95+sg*th)};}),P,{alpha:fade,seed:31+sg,flecks:10});
  for(let j=0;j<4;j++){const s=clamp((age-j*.05)/.4);if(s<=0||s>=1)continue;const q=pos(j*.05+.04),c0=v.P(q.x,q.z,.5+j%2*.6),pts:Pt[]=[];for(let i=0;i<=16;i++){const a=i/16*TAU*1.2,r=v.S*(.12+.25*i/16)*(1+s);pts.push({x:c0.x+Math.cos(a)*r,y:c0.y+Math.sin(a)*r*.6});}polyline(v.glow,pts,2.2,P.mid,(1-s)*.7);polyline(v.fx,pts,1,P.edge,(1-s)*.8);}
 },
 dashHit(v,e,o,age,P,ph){if(ph!=='post')return;const hit={x:o.x,z:o.z,h:1},p=v.P(hit.x,hit.z,hit.h),f=1-smooth(.15,.4,age),rot=Math.atan2(v.P(e.dx,e.dz).y-v.P(0,0).y,v.P(e.dx,e.dz).x-v.P(0,0).x);screenSlash(v,p,rot,v.S*1.6,v.S*.18,easeOut(age/.08),f,P,41,.06,4);burst(v,hit,age,.3,.7,P);sparkBurst(v,hit,age,P,10,e.seed,3.2);},
 earth(v,e,o,imp,P,ph){
  const fade=1-smooth(.45,1,imp);
  if(ph==='pre'){groundGlow(v,o,2.4,P,fade*.55);cracks(v,o,2.3,11,3,easeOut(imp/.12),P,fade);shockRing(v,o,.5+2.4*easeOut(imp/.35),P,1-smooth(.1,.45,imp),3);dust(v,o,2,clamp(imp/.8),.7,14,5,'#e7d6b4');}
  else{rocks(v,o,imp,10,7,1);burst(v,{x:o.x+e.dx*.6,z:o.z+e.dz*.6,h:.2},imp,.25,.7,P);sparkBurst(v,{x:o.x,z:o.z,h:.3},imp,P,14,8,4);}
 },
 provoke(v,e,o,lt,P,ph){
  const fade=1-smooth(.7,1.25,lt),grow=easeOut(lt/.14);
  const footFlare=(front:boolean)=>{const fp=v.P(o.x,o.z,0),a=(1-smooth(.15,.7,lt))*clamp(lt/.04);for(let i=0;i<16;i++){const x=fp.x+(hash(i*2.1)-.5)*v.S*2.2,isFront=hash(i*6.6)>.5;if(isFront!==front)continue;const h=v.S*(.8+1.6*hash(i*4.3))*grow,b={x,y:fp.y+(hash(i*9)-.3)*v.S*.4},t={x:x+(x-fp.x)*.25,y:b.y-h};polyline(v.glow,[b,t],v.S*.18,P.hi,a*(front?.45:.8));polyline(v.fx,[b,t],1.4,'#fff',a*(front?.5:.8));}};
  const blast=(front:boolean)=>{const fx=v.fx;
   for(let i=0;i<34;i++){const an=hash(i*1.37)*TAU;if((Math.sin(an)>0)!==front)continue;const sp=2.5+hash(i*2.9)*4.5,up=2.5+hash(i*4.7)*4,age=lt-hash(i*8.1)*.06;if(age<0)continue;const r=.5+sp*(1-Math.exp(-2.2*age))/2.2,h=up*age-5.5*age*age;if(h<0)continue;const q=v.P(o.x+Math.cos(an)*r,o.z+Math.sin(an)*r,h),sz=v.S*(.07+.2*hash(i*6.2)**2);
    fx.save();fx.translate(q.x,q.y);fx.rotate(age*(hash(i)-.5)*16);fx.globalAlpha=Math.min(1,fade*1.3);fx.fillStyle='#4d463e';fx.beginPath();for(let k=0;k<6;k++){const a2=k/6*TAU,rr=sz*(.7+.4*hash(i*9+k));fx.lineTo(Math.cos(a2)*rr,Math.sin(a2)*rr);}fx.closePath();fx.fill();fx.fillStyle='#8d8273';fx.beginPath();fx.moveTo(-sz*.5,-sz*.2);fx.lineTo(sz*.2,-sz*.6);fx.lineTo(sz*.45,0);fx.closePath();fx.fill();fx.restore();}
   for(let i=0;i<50;i++){const an=hash(i*3.9)*TAU;if((Math.sin(an)>0)!==front)continue;const sp=3+hash(i*2.2)*5,r=.4+sp*(1-Math.exp(-3*lt))/3,h=(2+hash(i*5.5)*4)*lt-5*lt*lt;if(h<0)continue;const q=v.P(o.x+Math.cos(an)*r,o.z+Math.sin(an)*r,h);fx.globalAlpha=fade;fx.fillStyle=i%3?'#5a5248':P.hi;fx.beginPath();fx.arc(q.x,q.y,.8+hash(i*7.7)*1.6,0,TAU);fx.fill();}
   fx.globalAlpha=1;};
  if(ph==='pre'){
   const fx=v.fx,R=2.7*grow,disc=(rr:number,col:string,al:number,j:boolean)=>{const pts=circlePts(v,o,rr,0,60,j?(k=>(teeth(k/60,7,9)-.3)*.35):undefined);fx.globalAlpha=Math.min(1,al);fx.fillStyle=col;fx.beginPath();pts.forEach((p,k)=>k?fx.lineTo(p.x,p.y):fx.moveTo(p.x,p.y));fx.closePath();fx.fill();fx.globalAlpha=1;};
   disc(R*1.05,P.low,.5*fade,false);disc(R*.86,P.mid,.45*fade,true);disc(R*.45,P.hi,.3*fade,false);const rim=circlePts(v,o,R*1.05,0,72);polyline(v.glow,rim,5,P.mid,.6*fade,true);polyline(v.fx,rim,1.6,P.edge,.9*fade,true);
   for(let i=0;i<6;i++){const r=3.1+i*.35+1.4*easeOut(lt/.55),a1=hash(i*3.3)*TAU+lt*(i%2?.8:-.8)+1.2,len=1.2+hash(i*6.1)*1.1,s:Stroke={a0:a1-len,a1,r,h:.02,T:.34-i*.03,tilt:0,ph:0,seed:90+i};paintBlade(v,windStroke(v,o,s,s.a0,s.a1,fade),P,{alpha:fade*clamp(lt/.1),seed:90+i,flecks:0,glow:.5});}
   cracks(v,o,1.6,9,41,easeOut(lt/.1),P,fade*.8);dust(v,o,1.2,clamp(lt/1.1),.85*fade,16,5,'#4a4239');
   const c0=v.P(o.x,o.z,1.75),k=.85+.15*easeOut(lt/.3),rx=v.S*2.5*k,ry=v.S*2.8*k,a=fade*clamp(lt/.06),gl=v.glow;
   gl.globalAlpha=Math.min(1,a);gl.strokeStyle=P.mid;gl.lineWidth=v.S*.55;gl.beginPath();gl.ellipse(c0.x,c0.y,rx,ry,0,Math.PI*.92,Math.PI*2.08);gl.stroke();
   gl.strokeStyle=P.hi;gl.lineWidth=v.S*.18;gl.beginPath();gl.ellipse(c0.x,c0.y,rx,ry,0,Math.PI*.95,Math.PI*2.05);gl.stroke();
   fx.globalAlpha=Math.min(1,a*.9);fx.strokeStyle=P.edge;fx.lineWidth=1.6;fx.beginPath();fx.ellipse(c0.x,c0.y,rx*.98,ry*.98,0,Math.PI*1.02,Math.PI*1.98);fx.stroke();
   for(let i=0;i<46;i++){const an=Math.PI*(.9+1.2*hash(i*3.7)),r0=.85+.15*hash(i*1.1),r1=r0+.3+.8*hash(i*5.3)*grow,w=1+2.5*hash(i*7.9),fl=.6+.4*Math.sin(v.time*25+i),p0={x:c0.x+Math.cos(an)*rx*r0,y:c0.y+Math.sin(an)*ry*r0},p1={x:c0.x+Math.cos(an)*rx*r1,y:c0.y+Math.sin(an)*ry*r1};polyline(gl,[p0,p1],w*2.5,P.hi,a*fl*.8);if(i%3===0)polyline(fx,[p0,p1],w*.5,'#fff',a*fl*.7);}
   gl.globalAlpha=fx.globalAlpha=1;footFlare(false);blast(false);
  }else{footFlare(true);blast(true);flash(v,v.P(o.x,o.z,.2),v.S*2.6,P,(1-lt/.16)*.45);}
 },
 endure(v,e,o,lt,P,ph){
  const k=Math.min(1,lt*5)*(1-smooth(1.3,1.7,lt));if(k<=0)return;
  if(ph==='pre'){groundGlow(v,o,1.6,P,k*.8);return;}
  const c0=v.P(o.x,o.z,1.25),rx=v.S*1.05,ry=v.S*1.75,gl=v.glow,fx=v.fx;
  gl.globalAlpha=k*.9;gl.strokeStyle=P.mid;gl.lineWidth=6;gl.beginPath();gl.ellipse(c0.x,c0.y,rx,ry,0,0,TAU);gl.stroke();
  fx.globalAlpha=k*.9;fx.strokeStyle=P.edge;fx.lineWidth=1.6;fx.beginPath();fx.ellipse(c0.x,c0.y,rx,ry,0,0,TAU);fx.stroke();
  for(const [tilt,sp,phs] of [[.5,2.2,0],[-.6,-1.7,1.5]]){const pts:Pt[]=[];for(let j=0;j<=40;j++){const a=j/40*TAU*.7+v.time*sp+phs;pts.push({x:c0.x+Math.cos(a)*rx*1.25,y:c0.y+Math.sin(a)*ry*.3+Math.cos(a)*rx*tilt*.5});}polyline(gl,pts,4,P.hi,k*.8);polyline(fx,pts,1.2,'#fff',k);}
  for(let j=0;j<14;j++){const pf=fract(v.time*.8+hash(j)),x=c0.x+(hash(j*3)-.5)*rx*2,y=c0.y+ry-pf*ry*2.4;fx.globalAlpha=k*(1-pf)*(.5+.5*Math.sin(v.time*14+j));fx.fillStyle=P.fleck;star4(fx,x,y,2+hash(j*5)*2.5,0,.25);fx.fill();}
  fx.globalAlpha=gl.globalAlpha=1;
 },
 shieldFly(v,e,o,age,P,ph){if(ph!=='post')return;const fly=clamp(age/.15),q=v.P(o.x+e.dx*(.6+1.2*easeOut(fly)),o.z+e.dz*(.6+1.2*easeOut(fly)),1.05);glint(v,q,v.S*1.2,.6*(1-smooth(.15,.2,age)),0,P);shieldCrest(v,q,v.S*(1.2+.9*fly),P,(.55+.3*fly)*(1-smooth(.15,.2,age)));},
 shieldHit(v,e,o,a,P,ph){
  const G=PALS.gold,hit={x:o.x,z:o.z,h:1.05},p=v.P(hit.x,hit.z,hit.h),f=1-smooth(.35,.7,a);
  if(ph==='pre'){runeCircle(v,o,1.7*easeOut(a/.15),G,1-smooth(.6,1.2,a),v.time*.8,'holy');cracks(v,o,1.4,8,5,easeOut(a/.1),P,1-smooth(.4,1,a));return;}
  const pop=a<.08?easeOut(a/.08)*1.25:1.25-.25*easeOut((a-.08)/.12);
  beam(v,hit,6.5,.55,P,1-smooth(.05,.6,a));flash(v,p,v.S*4.5,P,(1-a/.25)*.9);
  glint(v,p,v.S*1.6*pop,f*.9,0,P);shieldCrest(v,{x:p.x,y:p.y-v.S*.3},v.S*2.3*pop,P,f);
  for(let k=0;k<4;k++){const l=clamp((a-k*.05)/.32);if(l<=0||l>=1)continue;const r=v.S*(.8+l*2.2);v.glow.globalAlpha=1-l;v.glow.strokeStyle=P.mid;v.glow.lineWidth=9;v.glow.beginPath();v.glow.ellipse(p.x,p.y,r*.5,r,0,-1.25,1.25);v.glow.stroke();v.fx.globalAlpha=1-l;v.fx.strokeStyle=P.edge;v.fx.lineWidth=2;v.fx.beginPath();v.fx.ellipse(p.x,p.y,r*.5,r,0,-1.25,1.25);v.fx.stroke();}
  v.glow.globalAlpha=v.fx.globalAlpha=1;
  const base=Math.atan2(e.dz,e.dx);for(let k=0;k<22;k++){const ang=base+(hash(k*2)-.5)*2.2,sp=2.5+hash(k*3)*4.5;streak(v,hit,{x:Math.cos(ang)*sp,z:Math.sin(ang)*sp,h:hash(k*7)*3.5},a,.5,k%3?P.mid:P.fleck,.06);}
  if(a>.25){const s=1-smooth(1.1,1.5,a),top=v.P(hit.x,hit.z,2.6);for(let k=0;k<4;k++){const an=v.time*5+k/4*TAU,x=top.x+Math.cos(an)*v.S*.55,y=top.y+Math.sin(an)*v.S*.18;v.fx.globalAlpha=s;v.fx.fillStyle='#ffe27a';star4(v.fx,x,y,v.S*.16,an,.42);v.fx.fill();}v.fx.globalAlpha=1;}
 },
 bulwark(v,e,o,lt,P,ph){
  const G=PALS.gold,k=Math.min(1,easeOut(lt/.3))*(1-smooth(2.2,2.55,lt));if(k<=0)return;
  if(ph==='pre'){runeCircle(v,o,2.2,G,k,v.time*.5,'holy');beam(v,o,8,.8,P,1-smooth(.05,.6,lt));shockRing(v,o,.4+2.6*easeOut(lt/.35),G,1-smooth(.1,.45,lt),3);groundGlow(v,o,2.4,P,k*.7);return;}
  const r=1.85*(.85+.15*k),pts=circlePts(v,o,r,.02,48),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,rx=(Math.max(...xs)-Math.min(...xs))/2,ry=(Math.max(...ys)-Math.min(...ys))/2,H=r*v.S*1.25*k,pulse=1+.02*Math.sin(v.time*6),fx=v.fx,gl=v.glow;
  const dome=(c:CanvasRenderingContext2D)=>{c.beginPath();c.ellipse(cx,cy,rx*pulse,ry,0,0,Math.PI);c.ellipse(cx,cy,rx*pulse,H,0,Math.PI,TAU);c.closePath();};
  const g=fx.createLinearGradient(0,cy-H,0,cy+ry);g.addColorStop(0,P.hi+'55');g.addColorStop(.6,P.mid+'22');g.addColorStop(1,P.mid+'55');fx.globalAlpha=k;fx.fillStyle=g;dome(fx);fx.fill();
  gl.globalAlpha=k*.8;gl.strokeStyle=P.mid;gl.lineWidth=9;gl.beginPath();gl.ellipse(cx,cy,rx*pulse,H,0,Math.PI,TAU);gl.stroke();
  fx.globalAlpha=k*.95;fx.strokeStyle=P.edge;fx.lineWidth=1.8;fx.beginPath();fx.ellipse(cx,cy,rx*pulse,H,0,Math.PI,TAU);fx.stroke();
  fx.lineWidth=1;for(let j=1;j<=4;j++){fx.globalAlpha=k*.4;fx.beginPath();fx.ellipse(cx,cy,rx*pulse*j/5,H,0,Math.PI,TAU);fx.stroke();const hh=H*j/5,w=rx*Math.sqrt(1-(j/5)**2);fx.beginPath();fx.ellipse(cx,cy-hh,w,ry*Math.sqrt(1-(j/5)**2),0,0,TAU);fx.stroke();}
  polyline(gl,pts,9,'#f0c75e',k*.8,true);polyline(fx,pts,2,'#ffe7a0',k,true);
  for(let j=0;j<4;j++){const an=v.time*1.6+j/4*TAU,x=cx+Math.cos(an)*rx*1.18,y=cy-H*.45+Math.sin(an)*ry*1.1,front=Math.sin(an)>0;glint(v,{x,y},v.S*.35,k*.5,0,G);shieldCrest(v,{x,y},v.S*(front?.75:.6),P,k*(front?1:.6));}
  for(let j=0;j<12;j++){const pf=fract(v.time*.5+hash(j)),x=cx+(hash(j*3)-.5)*rx*1.6,y=cy-pf*H*.95;fx.globalAlpha=k*(1-pf);fx.fillStyle=j%3?P.hi:'#f0c75e';diamond(fx,x,y,3+hash(j)*3.5,Math.PI/2);fx.fill();}
  fx.globalAlpha=gl.globalAlpha=1;
 },
 quakeCharge(v,e,o,el,P,ph){
  const cast=.5,c=clamp(el/cast),hit={x:o.x+e.dx*.4,z:o.z+e.dz*.4};
  if(el<cast){
   if(ph==='pre'){runeCircle(v,o,3.2*easeOut(c),P,c,v.time*1.5,'holy');groundGlow(v,o,1.6,P,c*.7);for(let j=0;j<16;j++){const an=j/16*TAU+hash(j*3),r=1.2+hash(j*5)*2,p=v.P(o.x+Math.cos(an)*r,o.z+Math.sin(an)*r,c*(.3+hash(j)*1.2));v.fx.fillStyle='#5a4128';v.fx.beginPath();v.fx.arc(p.x,p.y,v.S*(.06+hash(j*2)*.07),0,TAU);v.fx.fill();}}
   else{const h0=v.P(o.x,o.z,1.3);for(let j=0;j<14;j++){const pf=fract(c*1.6+hash(j)),an=hash(j*7)*TAU,r=v.S*(2.6-2.2*pf),p={x:h0.x+Math.cos(an)*r,y:h0.y+Math.sin(an)*r*.7},q={x:h0.x+Math.cos(an)*(r-v.S*.5),y:h0.y+Math.sin(an)*(r-v.S*.5)*.7};polyline(v.glow,[p,q],3,P.hi,c*(1-pf)*.9);polyline(v.fx,[p,q],1,'#fff',c*(1-pf));}flash(v,h0,v.S*1.6,P,c*.35);}
  }
  const la=el-.3;if(ph==='post'&&life(la,0,.5)){const head=clamp(la/.2)**2,tail=clamp((la-.1)/.4)**1.5,fade=1-smooth(.25,.5,la),th0=2.1,th1=-.55,R=1.7,c0={x:o.x+e.dx*.1,z:o.z+e.dz*.1};
   const at=(th:number,r:number)=>({x:c0.x+e.dx*Math.cos(th)*r,z:c0.z+e.dz*Math.cos(th)*r,h:1+Math.sin(th)*r});
   paintBlade(v,buildRibbon(28,u=>{const th=th0+(th1-th0)*(tail+(head-tail)*u),thick=1.2*Math.sin(Math.PI*u)**.7*(.35+.65*u)*(.4+.6*fade),a=at(th,R),i=at(th,R-thick*(1+.4*teeth(u,77,7)));return{o:v.P(a.x,a.z,a.h),i:v.P(i.x,i.z,i.h)};}),P,{alpha:Math.min(1,la*14)*fade,seed:77,flecks:20});void hit;}
 },
 quake(v,e,o,imp,P,ph){
  const fade=1-smooth(1.1,2,imp),heroY=v.heroY,front={x:o.x+e.dx*1.5,z:o.z+e.dz*1.5};
  const shards:{base:W;out:{x:number;z:number};h:number;w:number;seed:number;y:number}[]=[];
  for(let i=0;i<34;i++){const ring=i<20?0:1,k=ring?i-20:i,n=ring?14:20,an=k/n*TAU+(hash(i*3.1)-.5)*.25,r=ring?2.5+hash(i*5.2)*.6:1.3+hash(i*5.2)*.7,out={x:Math.cos(an),z:Math.sin(an)},base={x:o.x+out.x*r,z:o.z+out.z*r},rise=easeOut((imp-ring*.08-hash(i*7)*.05)/.1)*(1-smooth(1.4,1.9,imp)),y=v.P(base.x,base.z,0).y;
   shards.push({base,out,h:(ring?.5+.5*hash(i*2.7):.8+.8*hash(i*2.7))*rise*(y>heroY&&r<2?.6:1),w:ring?.5+.3*hash(i*9.3):.7+.4*hash(i*9.3),seed:i,y});}
  for(let f=0;f<6;f++){const an=f/6*TAU+.4,out={x:Math.cos(an),z:Math.sin(an)};for(let j=0;j<6;j++){const d=3.4+j*.5,base={x:o.x+out.x*d+(hash(f*9+j)-.5)*.3,z:o.z+out.z*d+(hash(f*7+j)-.5)*.3},rise=easeOut((imp-.1-j*.06)/.08)*(1-smooth(1.2+j*.04,1.7,imp));shards.push({base,out,h:(.75-j*.08)*(.7+.5*hash(f*13+j))*rise,w:.5-j*.03,seed:100+f*10+j,y:v.P(base.x,base.z,0).y});}}
  const draw=(back:boolean)=>{for(const s of shards.filter(s=>(s.y<heroY)===back).sort((a,b)=>a.y-b.y))rockShard(v,s.base,s.out,s.h,s.w,P,Math.min(1,fade*1.4),s.seed);};
  if(ph==='pre'){
   const g=v.P(o.x,o.z,0);
   runeCircle(v,o,3.2,P,1-smooth(.15,.8,imp),v.time*.4,'holy');
   dust(v,o,3.2+2.4*easeOut(imp/.9),clamp(imp/1.6),.75*fade,28,7,'#7d7468');groundGlow(v,o,3.6,P,fade);
   shockRing(v,o,1+4.6*easeOut(imp/.5),P,1-smooth(.1,.6,imp),4.5);shockRing(v,o,.8+3.4*easeOut((imp-.14)/.5),P,imp>.14?1-smooth(.3,.8,imp):0,3);
   const ring=circlePts(v,o,1.2+.3*easeOut(imp/.2),.02,56);polyline(v.glow,ring,v.S*.4,P.mid,fade,true);polyline(v.glow,ring,v.S*.14,P.hi,fade,true);polyline(v.fx,ring,2,P.edge,fade*.8,true);
   const core=v.fx.createRadialGradient(g.x,g.y,0,g.x,g.y,v.S*1.3);core.addColorStop(0,'#fff6d8');core.addColorStop(.35,P.hi);core.addColorStop(.7,P.mid+'aa');core.addColorStop(1,P.low+'00');v.fx.save();v.fx.translate(g.x,g.y);v.fx.scale(1,.5);v.fx.translate(-g.x,-g.y);v.fx.globalAlpha=fade;v.fx.fillStyle=core;v.fx.beginPath();v.fx.arc(g.x,g.y,v.S*1.3,0,TAU);v.fx.fill();v.fx.restore();v.fx.globalAlpha=1;
   cracks(v,o,4.6,16,11,easeOut(imp/.18),P,fade);cracks(v,o,2.4,9,23,easeOut(imp/.1),P,fade);
   draw(true);
  }else{
   draw(false);const p=v.P(front.x,front.z,.25);
   flash(v,p,v.S*8,P,(1-imp/.3)*.75);beam(v,front,11,1,P,(1-smooth(.05,.75,imp))*.85);
   starBurst(v,p,v.S*4.2*easeOut(imp/.07),P,1-smooth(.14,.42,imp),5);starBurst(v,v.P(front.x,front.z,.4),v.S*2.8*easeOut((imp-.1)/.07),P,imp>.1?1-smooth(.22,.5,imp):0,19);
   rocks(v,front,imp,24,13,1.8);rocks(v,front,imp*.8,8,29,1,['#3e2a16','#a37838']);sparkBurst(v,{...front,h:.4},imp,P,32,9,7,.6);
   for(let j=0;j<20;j++){const pf=fract(imp*.7+hash(j*2)),q=v.P(o.x+(hash(j*5)-.5)*5,o.z+(hash(j*9)-.5)*4,pf*4);v.fx.globalAlpha=fade*(1-pf);v.fx.fillStyle=j%2?P.hi:P.fleck;v.fx.beginPath();v.fx.arc(q.x,q.y,1+hash(j)*1.8,0,TAU);v.fx.fill();}v.fx.globalAlpha=1;
  }
 },
 rally(v,e,o,lt,P,ph){
  const fade=1-smooth(1,1.7,lt),g=easeOut(lt/.15),fr=Math.floor(v.time*24);
  if(ph==='pre')runeCircle(v,o,2.8*g,P,fade,-v.time*.9,'holy');
  half(v,ph==='post',()=>{for(const [r,seed,w] of [[2.2,1,2.4],[2.35,7,1.4]]){const pts=circlePts(v,o,r*g,.1,56,k=>(hash(k*1.3+fr*7.1+seed)-.5)*.45);polyline(v.glow,pts,w*4,P.mid,fade,true);polyline(v.fx,pts,w,'#fff',fade,true);}
   const w=lt-.15;if(w>0){shockRing(v,o,2.3+5.8*easeOut(w/.7),P,1-smooth(.3,.85,w),3);shockRing(v,o,2.3+4.5*easeOut((w-.15)/.7),P,w>.15?1-smooth(.45,1,w):0,2);}});
  if(ph==='pre'){groundGlow(v,o,3.2,P,fade);return;}
  flash(v,v.P(o.x,o.z,1),v.S*6,P,(1-lt/.25)*.85);
  for(let j=0;j<6;j++){const an=j/6*TAU+.3,w={x:o.x+Math.cos(an)*2.2,z:o.z+Math.sin(an)*2.2},bl=lt-j*.07;
   if(life(bl,0,.16)){const to=v.P(w.x,w.z,0);bolt(v,{x:to.x+(hash(j)-.5)*v.S*2,y:to.y-v.S*9},to,fr+j*13,P,1-bl/.16,2.2);burst(v,{...w,h:.2},bl,.25,.7,P);}
   beam(v,w,3.4*(1-smooth(.3,1.1,lt))*clamp(lt/.12),.3,P,fade);}
  for(let k=0;k<14;k++){const a=k/14*TAU+hash(fr+k),p0={x:o.x+Math.cos(a)*2.2,z:o.z+Math.sin(a)*2.2,h:.2};streak(v,p0,{x:Math.cos(a)*2,z:Math.sin(a)*2,h:4},fract(lt*3+hash(k))*.3,.3,P.hi,.06);}
 },
 frenzy(v,e,o,age,P,ph){if(ph!=='post')return;[0,.125,.25].forEach((c,i)=>swing(v,{flip:i%2?-1:1,R:1.75,T:.95,sweep:1,life:.32,seed:20+i,flecks:10,tilt:1.25,glint:.4},age-c+.05,o,dirOf(e),P));},
 frenzyHit(v,e,o,a,P,ph){
  const i=Math.min(2,e.index??0),p=v.P(o.x,o.z,1.05);
  if(ph==='pre'){if(i===2)runeCircle(v,o,1.5*easeOut(a/.12),P,1-smooth(.6,1.2,a),-v.time*.6,'blood');return;}
  if(life(a,0,.45)){const fd=1-smooth(.18,.45,a),rot=(i===1?.75:-.85)+(i===2?.2:0);for(let j=-1;j<=1;j++){const q={x:p.x+Math.cos(rot+Math.PI/2)*j*v.S*.42,y:p.y+Math.sin(rot+Math.PI/2)*j*v.S*.42};screenSlash(v,q,rot,v.S*(1.6-Math.abs(j)*.2),v.S*.24,easeOut((a-Math.abs(j)*.02)/.07),fd,P,30+i*3+j,.18,4);}
   sparkBurst(v,{x:o.x,z:o.z,h:1.05},a,P,i===2?20:10,i*5,3.6);flash(v,p,v.S*(i===2?4.5:2.5),P,(1-a/.18)*(i===2?.9:.5));}
  if(i===2&&life(a,0,1.2)){const f=1-smooth(.25,.6,a);screenSlash(v,p,-.8,v.S*2.5,v.S*.42,easeOut(a/.08),f,P,81,.1,10);screenSlash(v,p,.8,v.S*2.5,v.S*.42,easeOut((a-.04)/.08),f,P,83,.1,10);dust(v,o,.9,clamp(a/.9),.6,10,9,'#a8121c');}
 },
 bloodRage(v,e,o,lt,P,ph){
  const k=Math.min(1,lt/.2)*(1-smooth(2.1,2.45,lt));if(k<=0)return;
  const flames=(front:boolean)=>{const c=v.fx,b=v.P(o.x,o.z,0);for(let j=0;j<18;j++){const a=j/18*TAU+hash(j);if((Math.sin(a)>0)!==front)continue;const r=(.8+.35*hash(j*3))*v.S,x=b.x+Math.cos(a)*r,y=b.y+Math.sin(a)*r*.45,hgt=v.S*(front?1.2:2.4+1.8*(.5+.5*Math.sin(v.time*7+j*1.9)))*k,sway=Math.sin(v.time*6+j)*v.S*.25,w=v.S*(.24+.14*hash(j*5));
   const g=c.createLinearGradient(0,y,0,y-hgt);g.addColorStop(0,P.mid);g.addColorStop(.45,P.hi+'cc');g.addColorStop(1,P.hi+'00');c.globalAlpha=k*(front?.35:.75);c.fillStyle=g;c.globalCompositeOperation='lighter';c.beginPath();c.moveTo(x-w,y);c.quadraticCurveTo(x-w*.4+sway*.5,y-hgt*.5,x+sway,y-hgt);c.quadraticCurveTo(x+w*.4+sway*.5,y-hgt*.5,x+w,y);c.closePath();c.fill();c.globalCompositeOperation='source-over';c.globalAlpha=1;}};
  if(ph==='pre'){runeCircle(v,o,2*easeOut(lt/.2),P,k,-v.time*.7,'blood');groundGlow(v,o,2.2,P,k*.8);beam(v,{x:o.x-.05,z:o.z-.05},7,.75,P,k*(.45+.15*Math.sin(v.time*8)));shockRing(v,o,.4+3.2*easeOut(lt/.4),P,1-smooth(.15,.5,lt),3.5);flames(false);return;}
  flash(v,v.P(o.x,o.z,1),v.S*4.5,P,(1-lt/.22)*.85);sparkBurst(v,{x:o.x,z:o.z,h:.4},lt,P,20,3,4,.55);flames(true);
  const fx=v.fx,b=v.P(o.x,o.z,0);glint(v,v.P(o.x,o.z,1.1),v.S*.9,k*(.25+.1*Math.sin(v.time*10)),0,P);
  for(let j=0;j<24;j++){const pf=fract(v.time*.9+hash(j*2)),x=b.x+(hash(j*7)-.5)*v.S*2.2+Math.sin(v.time*3+j)*6,y=b.y-pf*v.S*4;fx.globalAlpha=k*(1-pf);fx.fillStyle=j%2?P.fleck:P.hi;fx.beginPath();fx.arc(x,y,1+hash(j)*2,0,TAU);fx.fill();}
  fx.globalAlpha=1;
 },
 cyclone(v,e,o,lt,P,ph){
  const L=1.15,tl=lt/L,fade=1-smooth(.7,1,tl);if(tl>1)return;
  const strokes:(Stroke&{c:W;alpha:number})[]=[];
  for(let i=0;i<34;i++){const hn=clamp(i/33+(hash(i*3.1)-.5)*.05),age=lt-hn*.22;if(age<0)continue;
   const grow=easeOut(age/.18),len=(1.9-hn*.9)*(.55+.45*hash(i*5.3))*grow,spin=(10-hn*4.5)*(1+.2*hash(i*7)),a1=hash(i*2.7)*TAU+v.time*spin,lean=hn*hn*.9;
   strokes.push({a0:a1-len,a1,r:2.75*(1-hn*.6)+.12*Math.sin(hn*9+i),h:.12+hn*4.6,T:(.44-hn*.26)*(.55+.6*hash(i*9.1)),tilt:.18+.12*hash(i),ph:hash(i*4)*TAU,seed:i*3+1,c:{x:o.x+lean*.55,z:o.z-lean*.35},alpha:Math.min(1,age*8)*fade*(hn>.85?.75:1)});}
  const far=ph==='pre';
  if(far){runeCircle(v,o,3.1,P,Math.min(1,tl*6)*fade*.55,v.time*1.2,'blood');groundGlow(v,o,3.3,P,fade*.8);}
  for(const s of strokes){const cuts=[s.a0];for(let k=Math.ceil(s.a0/Math.PI);k*Math.PI<s.a1;k++)cuts.push(k*Math.PI);cuts.push(s.a1);
   for(let j=0;j<cuts.length-1;j++){const fr=cuts[j],to=cuts[j+1];if(to-fr<.02||(Math.sin((fr+to)/2)<0)!==far)continue;
    paintBlade(v,windStroke(v,s.c,s,fr,to,fade),P,{alpha:s.alpha*(far?.75:1),seed:s.seed,flecks:0,glow:far?.7:1});
    const pts:Pt[]=[];for(let k=0;k<=10;k++){const a=fr+(to-fr)*k/10,r=s.r*1.06;pts.push(v.P(s.c.x+Math.cos(a)*r,s.c.z+Math.sin(a)*r,s.h+.08+Math.sin(a+s.ph)*s.tilt));}polyline(v.glow,pts,2.4,P.hi,s.alpha*.6);polyline(v.fx,pts,.9,'#fff',s.alpha*.8);}}
  for(let j=0;j<6;j++){const a=j/6*TAU+v.time*11;if((Math.sin(a)<0)!==far)continue;const c0=v.P(o.x+Math.cos(a)*2.5,o.z+Math.sin(a)*2.5,.7),rot=a+Math.PI/2+.5;screenSlash(v,c0,Math.atan2(Math.sin(rot)*.5,Math.cos(rot)),v.S*.5,v.S*.13,1,fade*Math.min(1,tl*6),STEEL_BLADE,50+j,.35,0);}
 },
 cycloneHit(v,e,o,a,P,ph){if(ph!=='post')return;const w={x:o.x,z:o.z,h:.8};burst(v,w,a,.25,.7,P);sparkBurst(v,w,a,P,8,e.seed,3);},
 leapTrail(v,e,o,age,P,ph){
  if(ph!=='post')return;const dur=e.dur??.4,from={x:e.x,z:e.z},to={x:e.toX,z:e.toZ},pos=(t:number)=>{const k=clamp(t/dur);return{x:from.x+(to.x-from.x)*k,z:from.z+(to.z-from.z)*k,h:1+leapLift(t,dur)};};
  const fade=1-smooth(dur,dur+.35,age),pts:Pt[]=[];for(let j=0;j<=24;j++){const t=Math.max(0,Math.min(dur,age)-.25+j/24*.25),q=pos(t);pts.push(v.P(q.x,q.z,q.h));}
  paintBlade(v,buildRibbon(24,u=>{const p=sample({o:pts,i:pts,n:24},u,0),th=v.S*.75*u**.8*fade;return{o:p,i:{x:p.x,y:p.y+th}};}),P,{alpha:fade,seed:61,flecks:12});
 },
 leap(v,e,o,imp,P,ph){
  const fade=1-smooth(.8,1.6,imp),c={x:o.x+e.dx*.6,z:o.z+e.dz*.6},p=v.P(c.x,c.z,0);
  if(ph==='pre'){runeCircle(v,c,2.4*easeOut(imp/.12),P,fade,v.time*.5,'blood');groundGlow(v,c,2.6,P,fade);cracks(v,c,2.6,12,17,easeOut(imp/.1),P,fade);shockRing(v,c,.4+3.2*easeOut(imp/.4),P,1-smooth(.1,.5,imp),4);shockRing(v,c,.3+2.2*easeOut((imp-.1)/.4),P,imp>.1?1-smooth(.25,.65,imp):0,2.5);dust(v,c,1.8,clamp(imp/1),.6,16,21,'#c9a891');return;}
  flash(v,v.P(c.x,c.z,.5),v.S*6,P,(1-imp/.28)*.95);beam(v,c,9,1.1,P,1-smooth(.05,.7,imp));
  screenSlash(v,{x:p.x,y:p.y-v.S*2.3},Math.PI/2-.1,v.S*2.6,v.S*.65,easeOut(imp/.06),1-smooth(.25,.65,imp),P,71,.05,12);
  rocks(v,c,imp,18,19,1.3);sparkBurst(v,{...c,h:.3},imp,P,22,23,5.5,.5);
 },
 hitSpark(v,e,o,a,P,ph){if(ph==='post')sparkBurst(v,{x:o.x,z:o.z,h:.9},a,P,e.crit?10:6,e.seed,2.6,.3);},
};
