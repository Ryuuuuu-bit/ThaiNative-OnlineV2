/**
 * Toon-style VFX primitives (approved references): cel-shaded water splashes and geysers, swirling
 * fire/sand columns, stone pillars with puffy dust clouds, electric flashes, and a glowing vine patch.
 * All paint through the shared fx/glow layers. Visual only.
 */
import {type V,type W,type Pal,type Pt,TAU,clamp,hash,smooth,easeOut,polyline,shade} from './skill-vfx-2d.ts';

const OUT='rgba(14,10,8,.75)';
function poly(c:CanvasRenderingContext2D,pts:Pt[]){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}
function smoothPoly(c:CanvasRenderingContext2D,pts:Pt[]){const n=pts.length;c.beginPath();const m=(p:Pt,q:Pt)=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2});const s=m(pts[n-1],pts[0]);c.moveTo(s.x,s.y);for(let k=0;k<n;k++){const q=m(pts[k],pts[(k+1)%n]);c.quadraticCurveTo(pts[k].x,pts[k].y,q.x,q.y);}c.closePath();}
function dropBlob(c:CanvasRenderingContext2D,p:Pt,r:number,P:Pal,a:number){if(a<=0||r<=.4)return;c.globalAlpha=Math.min(1,a);c.fillStyle=P.mid;c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.fill();c.fillStyle=P.edge;c.beginPath();c.arc(p.x-r*.35,p.y-r*.35,r*.35,0,TAU);c.fill();c.globalAlpha=1;}

/** Water crown: curling spikes around a ripple, cel-banded with white highlight streaks, plus droplets. */
export function toonSplash(v:V,o:W,R:number,t:number,P:Pal,seed:number,alpha=1){
 if(alpha<=0||t<=0||t>=1)return;const c=v.fx,grow=easeOut(t/.35),fall=1-smooth(.55,1,t),n=14;
 // ripple on the ground
 const rip=(rr:number,col:string,w:number,al:number)=>{const pts:Pt[]=[];for(let k=0;k<40;k++){const a=k/40*TAU;pts.push(v.P(o.x+Math.cos(a)*rr,o.z+Math.sin(a)*rr,.02));}polyline(c,[...pts,pts[0]],w,col,al);};
 c.globalAlpha=alpha*.45*fall;c.fillStyle=P.low;{const pts:Pt[]=[];for(let k=0;k<40;k++){const a=k/40*TAU;pts.push(v.P(o.x+Math.cos(a)*R*grow,o.z+Math.sin(a)*R*grow,.02));}poly(c,pts);c.fill();}c.globalAlpha=1;
 rip(R*grow*.9,P.edge,1.5,alpha*fall*.8);rip(R*grow*.6,P.hi,1.2,alpha*fall*.6);rip(R*grow*1.05,P.mid,2,alpha*fall*.7);
 const spike=(i:number,back:boolean)=>{const a=i/n*TAU+hash(seed+i)*.3;if((Math.sin(a)<0)!==back)return;const r=R*(.55+.45*grow),H=R*(1.1+1.1*hash(seed+i*3))*Math.sin(Math.PI*clamp(t*1.3))*(.6+.4*fall),bw=R*.32,
  b=v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,0),bl=v.P(o.x+Math.cos(a-.18)*r,o.z+Math.sin(a-.18)*r,0),br=v.P(o.x+Math.cos(a+.18)*r,o.z+Math.sin(a+.18)*r,0),out={x:Math.cos(a)*R*.5*grow,z:Math.sin(a)*R*.5*grow},
  tip=v.P(o.x+Math.cos(a)*r+out.x,o.z+Math.sin(a)*r+out.z,H),mid=v.P(o.x+Math.cos(a)*r+out.x*.3,o.z+Math.sin(a)*r+out.z*.3,H*.55);void bw;
  const shape=[bl,{x:mid.x-(br.x-bl.x)*.25,y:mid.y},tip,{x:mid.x+(br.x-bl.x)*.15,y:mid.y+3},br];
  c.globalAlpha=alpha*fall;c.fillStyle=back?P.low:P.mid;smoothPoly(c,shape);c.fill();c.strokeStyle=back?shade(P.low,-.4):shade(P.low,-.25);c.lineWidth=Math.max(1,v.S*.04);c.stroke();
  if(!back){c.fillStyle=P.hi;smoothPoly(c,[{x:(bl.x*2+b.x)/3,y:b.y},{x:mid.x-(br.x-bl.x)*.12,y:mid.y},tip,{x:mid.x,y:mid.y+2}]);c.fill();polyline(c,[mid,tip],Math.max(1,v.S*.04),P.edge,alpha*fall);}
  c.globalAlpha=1;polyline(v.glow,[b,tip],v.S*.25,P.mid,alpha*fall*.6);};
 for(let i=0;i<n;i++)spike(i,true);for(let i=0;i<n;i++)spike(i,false);
 for(let i=0;i<16;i++){const a=hash(seed+i*1.7)*TAU,sp=R*(1+hash(seed+i*2.3)*1.5),h=R*(2.2+hash(seed+i*3.9)*1.8)*t-R*3*t*t,q=v.P(o.x+Math.cos(a)*sp*t,o.z+Math.sin(a)*sp*t,Math.max(0,h));if(h>0)dropBlob(c,q,v.S*(.05+.06*hash(seed+i)),P,alpha);}
}

/** Geyser: a jagged water (or energy) column with spiky crown and side flicks. */
export function geyser(v:V,o:W,H:number,W0:number,t:number,P:Pal,seed:number,alpha=1){
 if(alpha<=0||t<=0||t>=1)return;const c=v.fx,up=easeOut(t/.25),fall=1-smooth(.5,1,t),h=H*up,b=v.P(o.x,o.z,0),top=v.P(o.x,o.z,h),w=v.S*W0;
 const side=(k:number,dir:number)=>{const pts:Pt[]=[];for(let j=0;j<=8;j++){const f=j/8,jag=(j%2?1:.55)*(1-f*.6)*(.8+.4*hash(seed+j*3+k));pts.push({x:b.x+dir*w*jag*(1-f*.35),y:b.y+(top.y-b.y)*f});}return pts;};
 const layer=(scale:number,col:string)=>{const L=side(1,-1).map(p=>({x:b.x+(p.x-b.x)*scale,y:p.y})),R=side(2,1).map(p=>({x:b.x+(p.x-b.x)*scale,y:p.y}));const crown:Pt[]=[];for(let j=0;j<7;j++){const f=j/6,x=top.x+(f-.5)*w*1.6*scale,hh=(j%2?.35:.9)*(.7+.5*hash(seed+j*5))*w*1.6*scale;crown.push({x,y:top.y-hh});}
  c.fillStyle=col;poly(c,[...L,...crown,...R.reverse()]);c.fill();};
 c.globalAlpha=alpha*fall;layer(1.15,shade(P.low,-.2));layer(1,P.mid);layer(.6,P.hi);layer(.25,P.edge);c.globalAlpha=1;
 polyline(v.glow,[b,top],w*1.6,P.mid,alpha*fall*.8);
 for(let i=0;i<14;i++){const a=hash(seed+i)*TAU,sp=1+hash(seed+i*3)*2,tt=t,hh=h*(.4+.6*hash(seed+i*5))+3*tt-5*tt*tt;dropBlob(c,v.P(o.x+Math.cos(a)*sp*tt,o.z+Math.sin(a)*sp*tt,Math.max(0,hh)),v.S*(.05+.05*hash(seed+i*7)),P,alpha*fall);}
}

/** Swirling column (fire or sand tornado): stacked wobbly elliptical bands that spin, brighter toward the core. */
export function swirlColumn(v:V,o:W,H:number,R0:number,R1:number,t:number,P:Pal,seed:number,alpha=1){
 if(alpha<=0||t<=0||t>=1)return;const up=easeOut(t/.3),fall=1-smooth(.6,1,t),bands=14,spin=v.time*7;
 const base=v.P(o.x,o.z,0);v.glow.globalAlpha=alpha*fall*.7;const g=v.glow.createRadialGradient(base.x,base.y,0,base.x,base.y,v.S*R1*1.6);g.addColorStop(0,P.mid);g.addColorStop(1,P.mid+'00');v.glow.fillStyle=g;v.glow.beginPath();v.glow.ellipse(base.x,base.y,v.S*R1*1.6,v.S*R1*.7,0,0,TAU);v.glow.fill();v.glow.globalAlpha=1;
 for(let b=0;b<bands;b++){const f=b/(bands-1),h=H*up*f,r=(R0+(R1-R0)*f**1.2)*(.85+.3*hash(seed+b*1.3)),a0=spin*(1+f*.5)+hash(seed+b)*TAU,len=TAU*(.55+.3*hash(seed+b*2.1));
  const pts:Pt[]=[];for(let k=0;k<=18;k++){const a=a0+len*k/18,wob=1+.12*Math.sin(a*3+b);pts.push(v.P(o.x+Math.cos(a)*r*wob,o.z+Math.sin(a)*r*wob,h+Math.sin(a*2+b)*.12));}
  const al=alpha*fall*(.55+.45*(1-Math.abs(f-.4)));polyline(v.glow,pts,v.S*.45*(1-f*.4),P.mid,al*.8);polyline(v.fx,pts,v.S*.22*(1-f*.4),P.hi,al);polyline(v.fx,pts.slice(4,12),Math.max(1,v.S*.06),P.edge,al);}
 for(let i=0;i<10;i++){const pf=(v.time*1.3+hash(seed+i))%1,a=hash(seed+i*3)*TAU+v.time*4,r=R1*(1+pf*.6),q=v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,H*up*pf);v.fx.globalAlpha=alpha*fall*(1-pf);v.fx.fillStyle=P.spark;v.fx.beginPath();v.fx.arc(q.x,q.y,1.5+hash(i)*1.5,0,TAU);v.fx.fill();}
 v.fx.globalAlpha=1;
}

/** Puffy cartoon dust cloud: overlapping cel-shaded lumps with a soft outline, rising and spreading. */
export function dustCloud(v:V,o:W,R:number,t:number,alpha:number,seed:number,col='#e9dcb8'){
 if(alpha<=0||t<=0||t>=1)return;const c=v.fx,grow=easeOut(t/.4),fade=1-smooth(.5,1,t),n=14,lumps:{p:Pt;r:number;y:number}[]=[];
 for(let i=0;i<n;i++){const a=i/n*TAU+hash(seed+i)*.5,rr=R*(.55+.5*hash(seed+i*3))*(.6+.6*grow),h=(.2+.6*hash(seed+i*5))*grow,p=v.P(o.x+Math.cos(a)*rr,o.z+Math.sin(a)*rr,h);lumps.push({p,r:v.S*R*(.22+.18*hash(seed+i*7))*(.5+.7*grow)*(1-.25*smooth(.6,1,t)),y:p.y});}
 lumps.sort((a,b)=>a.y-b.y);
 for(const l of lumps){c.globalAlpha=Math.min(1,alpha*fade);c.fillStyle=shade(col,-.22);c.beginPath();c.arc(l.p.x+l.r*.12,l.p.y+l.r*.15,l.r,0,TAU);c.fill();c.fillStyle=col;c.beginPath();c.arc(l.p.x,l.p.y,l.r*.92,0,TAU);c.fill();c.fillStyle=shade(col,.35);c.beginPath();c.arc(l.p.x-l.r*.3,l.p.y-l.r*.32,l.r*.38,0,TAU);c.fill();
  c.strokeStyle=shade(col,-.45);c.lineWidth=Math.max(.8,v.S*.03);c.beginPath();c.arc(l.p.x,l.p.y,l.r*.92,Math.PI*.1,Math.PI*1.1);c.stroke();}
 c.globalAlpha=1;
}

/** Stone pillar erupting from the ground: a tall slab with top face, grain streaks, outline and shadow. */
export function stonePillar(v:V,base:W,h:number,w:number,rot:number,lean:{x:number;z:number},alpha:number,seed:number,cols=['#7a5a32','#c49a5a','#e8c88a']){
 if(alpha<=0||h<=.05)return;const c=v.fx,al=Math.min(1,alpha),d=w/2,cr=Math.cos(rot),sr=Math.sin(rot);
 const corner=(i:number,top:boolean)=>{const sx=i===0||i===3?-d:d,sz=i<2?-d:d,x=base.x+sx*cr-sz*sr+(top?lean.x*h:0),z=base.z+sx*sr+sz*cr+(top?lean.z*h:0);return v.P(x,z,top?h:0);};
 const B=[0,1,2,3].map(i=>corner(i,false)),T=[0,1,2,3].map(i=>corner(i,true)),g0=v.P(base.x,base.z,0);
 c.globalAlpha=al*.45;c.fillStyle='#000';c.beginPath();c.ellipse(g0.x+3,g0.y+2,v.S*w*.85,v.S*w*.38,0,0,TAU);c.fill();c.globalAlpha=al;
 // side faces: draw the two whose bottom edge is nearest the camera (largest screen y)
 const faces=[0,1,2,3].map(i=>({i,y:(B[i].y+B[(i+1)%4].y)/2})).sort((a,b)=>a.y-b.y).slice(2);
 for(const {i} of faces){const j=(i+1)%4,lit=B[j].x>B[i].x?1:0,face=[B[i],B[j],T[j],T[i]],gr=c.createLinearGradient(0,B[i].y,0,T[i].y);gr.addColorStop(0,shade(cols[lit],-.25));gr.addColorStop(1,cols[lit]);c.fillStyle=gr;poly(c,face);c.fill();
  c.strokeStyle=shade(cols[0],-.35);c.lineWidth=Math.max(.8,v.S*.025);for(let k=0;k<4;k++){const u=.15+.7*hash(seed+i*7+k),f0=.05+.2*hash(seed+k*3),f1=.55+.4*hash(seed+k*5),p0={x:B[i].x+(B[j].x-B[i].x)*u,y:B[i].y+(B[j].y-B[i].y)*u},p1={x:T[i].x+(T[j].x-T[i].x)*u,y:T[i].y+(T[j].y-T[i].y)*u};c.beginPath();c.moveTo(p0.x+(p1.x-p0.x)*f0,p0.y+(p1.y-p0.y)*f0);c.lineTo(p0.x+(p1.x-p0.x)*f1,p0.y+(p1.y-p0.y)*f1);c.stroke();}
  c.strokeStyle=OUT;c.lineWidth=Math.max(1,v.S*.045);poly(c,face);c.stroke();}
 c.fillStyle=cols[2];poly(c,T);c.fill();c.strokeStyle=OUT;c.lineWidth=Math.max(1,v.S*.045);c.stroke();c.globalAlpha=1;
}

/** Electric flash: glowing core, long four-point star, short rays, a broken ring and jagged arcs. */
export function elecFlash(v:V,p:Pt,r:number,P:Pal,alpha:number,seed:number){
 if(alpha<=0||r<=1)return;const c=v.fx,g=v.glow,a=Math.min(1,alpha);
 g.globalAlpha=a;const gr=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r*1.6);gr.addColorStop(0,'#ffffff');gr.addColorStop(.25,P.hi);gr.addColorStop(1,P.mid+'00');g.fillStyle=gr;g.fillRect(p.x-r*1.6,p.y-r*1.6,r*3.2,r*3.2);g.globalAlpha=1;
 const star=(len:number,wid:number,rot:number,pts:number,col:string)=>{c.fillStyle=col;c.beginPath();for(let k=0;k<pts*2;k++){const an=rot+k*Math.PI/pts,rr=k%2?wid:len*(k%4===0?1:.75);c.lineTo(p.x+Math.cos(an)*rr,p.y+Math.sin(an)*rr);}c.closePath();c.fill();};
 c.globalAlpha=a;star(r*1.4,r*.09,-Math.PI/2,4,P.hi);star(r*1.2,r*.05,-Math.PI/2,4,'#ffffff');star(r*.6,r*.08,Math.PI/8,8,P.edge);
 c.fillStyle='#ffffff';c.beginPath();c.arc(p.x,p.y,r*.2,0,TAU);c.fill();
 for(let k=0;k<5;k++){const a0=k/5*TAU+hash(seed+k)*.5;c.strokeStyle=P.hi;c.lineWidth=Math.max(1.2,r*.05);c.beginPath();c.arc(p.x,p.y,r*.85,a0,a0+.7);c.stroke();}
 for(let k=0;k<3;k++){const an=hash(seed+k*3)*TAU,pts:Pt[]=[p];let q=p;for(let j=1;j<=5;j++){const d=r*.3,aa=an+(hash(seed+k*11+j)-.5)*1.2;q={x:q.x+Math.cos(aa)*d,y:q.y+Math.sin(aa)*d};pts.push(q);}polyline(g,pts,4,P.mid,a);polyline(c,pts,Math.max(1,r*.04),'#ffffff',a);}
 c.globalAlpha=1;
}

/** Glowing grass patch with curling vines, grass tufts and drifting leaves. */
export function vinePatch(v:V,o:W,R:number,t:number,P:Pal,seed:number,alpha=1){
 if(alpha<=0||t<=0)return;const c=v.fx,grow=easeOut(t/.35),a=Math.min(1,alpha);
 const edge:Pt[]=[];for(let k=0;k<28;k++){const an=k/28*TAU,rr=R*grow*(.82+.3*hash(seed+k*2.3)+.08*Math.sin(an*5));edge.push(v.P(o.x+Math.cos(an)*rr,o.z+Math.sin(an)*rr,.02));}
 c.globalAlpha=a*.85;c.fillStyle=shade(P.low,-.2);smoothPoly(c,edge);c.fill();c.globalAlpha=a*.55;c.fillStyle=P.low;smoothPoly(c,edge.map(p=>{const m=v.P(o.x,o.z,0);return{x:m.x+(p.x-m.x)*.7,y:m.y+(p.y-m.y)*.7};}));c.fill();
 c.globalAlpha=1;polyline(v.glow,[...edge,edge[0]],v.S*.25,P.mid,a*.8);polyline(c,[...edge,edge[0]],Math.max(1,v.S*.04),P.hi,a*.7);
 for(let i=0;i<22;i++){const an=hash(seed+i*1.9)*TAU,rr=R*grow*.85*Math.sqrt(hash(seed+i*3.7)),q=v.P(o.x+Math.cos(an)*rr,o.z+Math.sin(an)*rr,0),hgt=v.S*.25*grow;c.strokeStyle=i%3?shade(P.mid,-.1):P.hi;c.lineWidth=1.3;c.globalAlpha=a;c.beginPath();c.moveTo(q.x-3,q.y-hgt);c.lineTo(q.x,q.y);c.lineTo(q.x+2,q.y-hgt*1.1);c.moveTo(q.x,q.y);c.lineTo(q.x+5,q.y-hgt*.8);c.stroke();}
 for(let i=0;i<7;i++){const an0=hash(seed+i*5.1)*TAU,start=R*.75*Math.sqrt(hash(seed+i*2.9)),len=easeOut((t-hash(seed+i)*.15)/.5),pts:Pt[]=[];if(len<=0)continue;
  for(let k=0;k<=40*len;k++){const f=k/40,turn=an0+f*(3+hash(seed+i*7)*3),rr=start*(1-f*.4)+R*.25*Math.sin(f*3),curl=f>.75?(f-.75)*4:0,cx=Math.cos(turn)*rr,cz=Math.sin(turn)*rr,ca=turn*3+f*12;pts.push(v.P(o.x+cx+Math.cos(ca)*curl*R*.12,o.z+cz+Math.sin(ca)*curl*R*.12,.05));}
  polyline(v.glow,pts,v.S*.22,P.mid,a);polyline(c,pts,Math.max(1.2,v.S*.07),P.hi,a);polyline(c,pts,Math.max(.6,v.S*.025),'#ffffff',a*.8);}
 for(let i=0;i<14;i++){const pf=(v.time*.35+hash(seed+i))%1,an=hash(seed+i*4.3)*TAU,rr=R*1.1*hash(seed+i*6.1),q=v.P(o.x+Math.cos(an)*rr,o.z+Math.sin(an)*rr,pf*3);c.save();c.translate(q.x+Math.sin(v.time*3+i)*5,q.y);c.rotate(v.time*2+i);c.globalAlpha=a*(1-pf);c.fillStyle=i%2?P.hi:P.mid;c.beginPath();c.ellipse(0,0,v.S*.1,v.S*.045,0,0,TAU);c.fill();c.restore();}
 c.globalAlpha=1;
}

// ---------- poison (thorn nest mother) ----------
/** Glossy sphere: radial shading, white specular and a dark rim. */
export function glossyBubble(c:CanvasRenderingContext2D,p:Pt,r:number,P:Pal,alpha:number){
 if(alpha<=0||r<=.5)return;const a=Math.min(1,alpha),g=c.createRadialGradient(p.x-r*.35,p.y-r*.4,r*.08,p.x,p.y,r);
 g.addColorStop(0,P.edge);g.addColorStop(.25,P.hi);g.addColorStop(.7,P.mid);g.addColorStop(1,P.low);
 c.globalAlpha=a;c.fillStyle=g;c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.fill();
 c.fillStyle='#ffffff';c.globalAlpha=a*.9;c.beginPath();c.ellipse(p.x-r*.38,p.y-r*.45,r*.28,r*.14,-.6,0,TAU);c.fill();c.beginPath();c.arc(p.x+r*.35,p.y+r*.3,r*.07,0,TAU);c.fill();
 c.globalAlpha=a;c.strokeStyle=shade(P.low,-.5);c.lineWidth=Math.max(.8,r*.07);c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.stroke();c.globalAlpha=1;
}
/** Glossy, rippled poison puddle with bubbles that swell and pop and satellite droplets. */
export function poisonPuddle(v:V,o:W,R:number,t:number,P:Pal,seed:number,alpha=1){
 if(alpha<=0||t<=0)return;const c=v.fx,grow=easeOut(t/.3),a=Math.min(1,alpha),wob=v.time*2;
 const ring=(scale:number,jit:number,ox=0,oz=0)=>{const pts:Pt[]=[];for(let k=0;k<26;k++){const an=k/26*TAU,rr=R*grow*scale*(1+jit*(hash(seed+k*2.3)-.5)+.05*Math.sin(an*3+wob));pts.push(v.P(o.x+ox+Math.cos(an)*rr,o.z+oz+Math.sin(an)*rr,.02));}return pts;};
 c.globalAlpha=a*.5;c.fillStyle='#000';smoothPoly(c,ring(1.05,.5,.1,.1));c.fill();
 c.globalAlpha=a;c.fillStyle=P.low;smoothPoly(c,ring(1,.5));c.fill();c.fillStyle=P.mid;smoothPoly(c,ring(.75,.4,-.1,-.08));c.fill();
 c.globalAlpha=a*.75;c.fillStyle=P.hi;smoothPoly(c,ring(.42,.35,-.25,-.2));c.fill();
 c.globalAlpha=1;polyline(v.glow,ring(1,.5),v.S*.3,P.mid,a*.8,true);polyline(c,ring(1,.5),Math.max(1,v.S*.04),shade(P.low,-.5),a,true);
 // glossy rims (concentric highlights)
 for(let k=0;k<3;k++){const cx=o.x+(hash(seed+k*7)-.5)*R*.9,cz=o.z+(hash(seed+k*9)-.5)*R*.7,rr=R*grow*(.18+.12*hash(seed+k)),pts:Pt[]=[];for(let j=0;j<=16;j++){const an=Math.PI*1.1+j/16*Math.PI*.9;pts.push(v.P(cx+Math.cos(an)*rr,cz+Math.sin(an)*rr,.03));}polyline(c,pts,Math.max(1,v.S*.05),P.edge,a*.8);polyline(v.glow,pts,v.S*.15,P.hi,a*.6);}
 for(let i=0;i<9;i++){const cyc=(v.time*.7+hash(seed+i*3))%1,an=hash(seed+i*5)*TAU,rr=R*grow*.75*Math.sqrt(hash(seed+i*7)),q=v.P(o.x+Math.cos(an)*rr,o.z+Math.sin(an)*rr,.05),br=v.S*(.08+.14*hash(seed+i))*easeOut(cyc/.8);
  if(cyc<.85)glossyBubble(c,{x:q.x,y:q.y-br*.6},br,P,a);else{const pr=br*(1+(cyc-.85)*8);c.globalAlpha=a*(1-(cyc-.85)/.15);c.strokeStyle=P.edge;c.lineWidth=1.2;c.beginPath();c.ellipse(q.x,q.y,pr,pr*.5,0,0,TAU);c.stroke();c.globalAlpha=1;}}
 for(let i=0;i<8;i++){const an=hash(seed+i*11)*TAU,rr=R*grow*(1.15+.35*hash(seed+i*13)),q=v.P(o.x+Math.cos(an)*rr,o.z+Math.sin(an)*rr,.02),dr=v.S*(.08+.1*hash(seed+i*17))*grow;c.globalAlpha=a;c.fillStyle=P.mid;c.beginPath();c.ellipse(q.x,q.y,dr,dr*.5,0,0,TAU);c.fill();c.fillStyle=P.edge;c.beginPath();c.ellipse(q.x-dr*.3,q.y-dr*.15,dr*.3,dr*.12,0,0,TAU);c.fill();}
 c.globalAlpha=1;
}
/** Toxic splash: a hot core flash and goopy tongues flung outward. */
export function toxicSplat(v:V,p:Pt,r:number,t:number,P:Pal,seed:number,alpha=1){
 if(alpha<=0||t<=0||t>=1)return;const c=v.fx,g=v.glow,grow=easeOut(t/.25),fade=1-smooth(.45,1,t),a=Math.min(1,alpha)*fade;
 g.globalAlpha=a;const gr=g.createRadialGradient(p.x,p.y,0,p.x,p.y,r*1.3);gr.addColorStop(0,'#ffffff');gr.addColorStop(.25,P.hi);gr.addColorStop(1,P.mid+'00');g.fillStyle=gr;g.fillRect(p.x-r*1.3,p.y-r*1.3,r*2.6,r*2.6);g.globalAlpha=1;
 for(let i=0;i<11;i++){const an=i/11*TAU+(hash(seed+i)-.5)*.5,len=r*(.6+.7*hash(seed+i*3))*grow,w=r*(.12+.1*hash(seed+i*5)),tip={x:p.x+Math.cos(an)*len,y:p.y+Math.sin(an)*len*.7},cur=(hash(seed+i*7)-.5)*1.2,ctrl={x:p.x+Math.cos(an+cur)*len*.6,y:p.y+Math.sin(an+cur)*len*.42},nx=-Math.sin(an),ny=Math.cos(an);
  for(const [col,k] of [[P.low,1.25],[P.mid,1],[P.hi,.45]] as [string,number][]){c.globalAlpha=a;c.fillStyle=col;c.beginPath();c.moveTo(p.x+nx*w*k,p.y+ny*w*k);c.quadraticCurveTo(ctrl.x+nx*w*k*.6,ctrl.y+ny*w*k*.6,tip.x,tip.y);c.quadraticCurveTo(ctrl.x-nx*w*k*.6,ctrl.y-ny*w*k*.6,p.x-nx*w*k,p.y-ny*w*k);c.closePath();c.fill();}
  const d=v.S*(.06+.06*hash(seed+i*9));c.fillStyle=P.mid;c.beginPath();c.arc(tip.x+Math.cos(an)*r*.2*t,tip.y+Math.sin(an)*r*.14*t,d,0,TAU);c.fill();}
 c.globalAlpha=a;c.fillStyle=P.edge;c.beginPath();for(let k=0;k<8;k++){const an=k*Math.PI/4-Math.PI/2,rr=k%2?r*.08:r*(k%4===0?.75:.4);c.lineTo(p.x+Math.cos(an)*rr*grow,p.y+Math.sin(an)*rr*grow);}c.closePath();c.fill();c.globalAlpha=1;
}
/** Branching veins crawling out over the ground. */
export function veins(v:V,o:W,R:number,t:number,P:Pal,seed:number,alpha=1){
 if(alpha<=0||t<=0)return;const grow=easeOut(t/.5),a=Math.min(1,alpha);
 const branch=(x:number,z:number,an:number,len:number,depth:number,id:number)=>{const pts:Pt[]=[v.P(x,z,.03)];let cx=x,cz=z,ca=an;for(let k=1;k<=5;k++){ca+=(hash(seed+id*13+k)-.5)*.7;cx+=Math.cos(ca)*len/5*grow;cz+=Math.sin(ca)*len/5*grow;pts.push(v.P(cx,cz,.03));
   if(depth>0&&k===2||depth>0&&k===4)branch(cx,cz,ca+(k===2?.7:-.7),len*.5,depth-1,id*3+k);}
  polyline(v.glow,pts,v.S*.18*(depth+1)*.6,P.mid,a*.7);polyline(v.fx,pts,Math.max(1,v.S*.05*(depth+1)),P.hi,a);polyline(v.fx,pts,Math.max(.5,v.S*.02*(depth+1)),P.edge,a*.6);};
 for(let i=0;i<9;i++)branch(o.x,o.z,i/9*TAU+hash(seed+i),R*(.7+.4*hash(seed+i*3)),2,i+1);
}
