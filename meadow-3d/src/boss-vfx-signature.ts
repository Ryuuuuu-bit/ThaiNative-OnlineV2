/**
 * Signature blasts so no two bosses share the same look. Keyed by `dataId/attack`, these override the
 * shared families in boss-vfx-2d (end-game bosses share attack ids like `endgame_focus`, so the boss id
 * decides). Visual only.
 */
import {PALS,type V,type Fx,type W,type Pal,type Pt,TAU,clamp,hash,smooth,easeOut,polyline,glint,streak,sparkBurst,burst,circlePts,shockRing,groundGlow,cracks,dust,rocks,paintBlade,buildRibbon,flash,beam,starBurst,rockShard,screenSlash,bolt,half,runeCircle,arcRibbon,boulder,shade} from './skill-vfx-2d.ts';
import {toonSplash,geyser,swirlColumn,dustCloud,elecFlash,vinePatch,glossyBubble,poisonPuddle,toxicSplat,veins} from './vfx-toon.ts';

export type Shape={shape:string;r:number;inner:number;angle:number;fx:number;fz:number};
export type Blast=(v:V,e:Fx,o:W,age:number,P:Pal,ph:'pre'|'post',s:Shape)=>void;

/** `dataId/attack` → signature family name. */
export const BOSS_FAMILY:Record<string,string>={
 'grove_crown/grove_crown_fall':'amberBloom','grove_crown/grove_crown_wave':'rootWave',
 'moon_titan/moon_titan_fall':'crescentDrop','moon_titan/moon_titan_wave':'moonPhases',
 'king_jelly/jelly_burst':'jellyBlast',
 'thorn_nest_mother/thorn_web':'toxicBurst','thorn_nest_mother/thorn_eggs':'venomEggs',
 'greek_minotaur/greek_axe_quake':'labyrinth',
 'himmapan_08/naga_water_surge':'serpentCoil',
 'desert_08/desert_glyph':'sunGlyph',
 'frost_08/frost_smash':'iceShatter',
 'yokai_08/yokai_club':'clubSlam',
 'dragon_cloud_dragon_lord/endgame_focus':'lightning','dragon_cloud_dragon_lord/endgame_fan':'windBreath',
 'volcano_golden_ash_zmey/endgame_focus':'fireBreath','volcano_golden_ash_zmey/endgame_trail':'eruption',
 'fae_twilight_antler_king/endgame_focus':'fairyBloom','fae_twilight_antler_king/endgame_ring':'antlerThorns',
 'ocean_stormcrown_kraken/endgame_focus':'tentacleSlam','ocean_stormcrown_kraken/endgame_cross':'waterJet',
 'astral_star_eating_eclipse/endgame_focus':'starfall','astral_star_eating_eclipse/endgame_ring':'eclipseRing',
 'abyss_primordial_sea_dragon/endgame_focus':'abyssMaw','abyss_primordial_sea_dragon/endgame_fan':'abyssBreath',
 'confluence_worldcore_sovereign/endgame_focus':'worldOrb','confluence_worldcore_sovereign/endgame_cross':'prismBeam','confluence_worldcore_sovereign/endgame_ring':'worldcore',
};

// ---------- small helpers ----------
const coneDir=(s:Shape)=>Math.atan2(s.fz,s.fx);
function coneAt(o:W,s:Shape,u:number,w:number):W{const half=s.angle*Math.PI/360,a=coneDir(s)-half+2*half*u;return{x:o.x+Math.cos(a)*s.r*w,z:o.z+Math.sin(a)*s.r*w};}
function ringAt(o:W,s:Shape,a:number,w:number):W{const r=s.inner+(s.r-s.inner)*w;return{x:o.x+Math.cos(a)*r,z:o.z+Math.sin(a)*r};}
function hex(h:number,sat:number,l:number){const f=(n:number)=>{const k=(n+h/30)%12,a=sat*Math.min(l,1-l),c=l-a*Math.max(-1,Math.min(k-3,9-k,1));return Math.round(c*255).toString(16).padStart(2,'0');};return'#'+f(0)+f(8)+f(4);}
/** A full palette from one hue (prism attacks cycle through these). */
export function huePal(h:number):Pal{return{edge:'#ffffff',hi:hex(h,1,.85),mid:hex(h,.9,.62),low:hex(h,.7,.38),deep:hex(h,.6,.14),fleck:'#ffffff',spark:hex(h,1,.8)};}
function blob(c:CanvasRenderingContext2D,p:Pt,r:number,col:string,a:number){if(a<=0||r<=0)return;const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,col+'ee');g.addColorStop(1,col+'00');c.globalAlpha=Math.min(1,a);c.fillStyle=g;c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.fill();c.globalAlpha=1;}
function dot(c:CanvasRenderingContext2D,p:Pt,r:number,col:string,a:number){if(a<=0||r<=0)return;c.globalAlpha=Math.min(1,a);c.fillStyle=col;c.beginPath();c.arc(p.x,p.y,r,0,TAU);c.fill();c.globalAlpha=1;}
/** Beam along a cone axis; `extra` adds the material (droplets, bubbles, prism bands). */
function axisBeam(v:V,o:W,s:Shape,age:number,P:Pal,width:number,extra?:(len:number,t:number)=>void){
 const fade=1-smooth(.5,1.2,age),grow=easeOut(age/.12),len=s.r*grow,px=-s.fz,pz=s.fx,w=Math.max(.4,width);
 const band=(k:number,h:number)=>[v.P(o.x+px*w*.2*k,o.z+pz*w*.2*k,h),v.P(o.x+s.fx*len+px*w*k,o.z+s.fz*len+pz*w*k,h),v.P(o.x+s.fx*len-px*w*k,o.z+s.fz*len-pz*w*k,h),v.P(o.x-px*w*.2*k,o.z-pz*w*.2*k,h)];
 for(const [L,k,col,al] of [[v.glow,1,P.mid,.8],[v.glow,.5,P.hi,1],[v.fx,.2,P.edge,.9]] as [CanvasRenderingContext2D,number,string,number][]){const q=band(k,1.2);L.globalAlpha=fade*al;L.fillStyle=col;L.beginPath();q.forEach((p,i)=>i?L.lineTo(p.x,p.y):L.moveTo(p.x,p.y));L.closePath();L.fill();}
 v.glow.globalAlpha=v.fx.globalAlpha=1;extra?.(len,fade);
}

const TOXIC:Pal={edge:'#fbffd8',hi:'#e8ff5a',mid:'#9be22a',low:'#3f7a14',deep:'#18300a',fleck:'#f6ff9a',spark:'#e8ff5a'};
const VENOM:Pal={edge:'#ffe8ff',hi:'#f290ff',mid:'#b52cf0',low:'#5a1490',deep:'#22053a',fleck:'#ffd0ff',spark:'#f290ff'};

export const SIG:Record<string,Blast>={
 /** Jelly king: the jelly body bursts — white flash, goo tongues and shock rings blast across the ring,
  *  glossy jelly blobs fly out and splat into wobbling puddles in the danger band. */
 jellyBlast(v,e,o,age,P,ph,s){
  const fade=1-smooth(1.25,1.7,age),c=v.P(o.x,o.z,1.4),m=(s.inner+s.r)/2,blobs=16;
  const land=(i:number)=>{const an=i/blobs*TAU+hash(i*3)*.3,r=s.inner+(s.r-s.inner)*(.25+.6*hash(i*5));return{an,r,x:o.x+Math.cos(an)*r,z:o.z+Math.sin(an)*r,t0:.28+.12*hash(i*7)};};
  if(ph==='pre'){
   groundGlow(v,o,s.r*1.05,P,(1-smooth(.2,.9,age))*1.1);
   for(let k=0;k<3;k++)shockRing(v,o,s.inner*.6+(s.r+.8-s.inner*.6)*easeOut((age-k*.08)/.45),P,age>k*.08?1-smooth(.15+k*.08,.6+k*.08,age):0,5-k);
   for(let i=0;i<blobs;i++){const L=land(i);if(age>L.t0)poisonPuddle(v,{x:L.x,z:L.z},.45+.35*hash(i*9),(age-L.t0)/1.2,P,i*29,fade);}
   return;}
  // core blast
  const flashA=(1-smooth(0,.22,age))*.8;v.glow.globalAlpha=flashA;const gr=v.glow.createRadialGradient(c.x,c.y,0,c.x,c.y,v.S*s.r*.8);gr.addColorStop(0,'#ffffff');gr.addColorStop(.3,P.hi);gr.addColorStop(1,P.mid+'00');v.glow.fillStyle=gr;v.glow.fillRect(c.x-v.S*s.r*1.4,c.y-v.S*s.r*1.4,v.S*s.r*2.8,v.S*s.r*2.8);v.glow.globalAlpha=1;
  // rolling jelly waves: a standing wall of jelly that rolls out from the body to past the ring edge
  for(let w=0;w<3;w++){const t=(age-w*.14)/.8;if(t<=0||t>=1)continue;const R=s.inner*.5+(s.r+.6-s.inner*.5)*easeOut(t),crest=(1.1-w*.25)*(1-smooth(.55,1,t))*(.5+.5*smooth(0,.15,t)),thick=.9-w*.2,al=1-smooth(.7,1,t);
   const ring=(front:boolean)=>half(v,front,()=>{const rb=buildRibbon(72,u=>{const an=u*TAU,wob=1+.05*Math.sin(an*6+v.time*8+w),h=crest*(1+.18*Math.sin(an*5+w*2+v.time*6)),x=Math.cos(an)*R*wob,z=Math.sin(an)*R*wob,xi=Math.cos(an)*(R-thick)*wob,zi=Math.sin(an)*(R-thick)*wob;return{o:v.P(o.x+x,o.z+z,h),i:v.P(o.x+xi,o.z+zi,0)};});
    paintBlade(v,rb,P,{alpha:al,seed:40+w,flecks:6,glow:.8});polyline(v.fx,rb.o,Math.max(1.2,v.S*.06),P.edge,al);polyline(v.glow,rb.o,v.S*.3,P.hi,al*.8);
    for(let k=0;k<18;k++){const an=k/18*TAU+w,pf=(v.time*1.4+hash(k*3+w))%1,q=v.P(o.x+Math.cos(an)*R,o.z+Math.sin(an)*R,crest+pf*.8);if((Math.sin(an)>0)!==front)continue;v.fx.globalAlpha=al*(1-pf);v.fx.fillStyle=k%3?P.mid:P.fleck;v.fx.beginPath();v.fx.arc(q.x,q.y,v.S*.06,0,TAU);v.fx.fill();}v.fx.globalAlpha=1;});
   ring(false);ring(true);}
  // jelly blobs arc out and land in the ring band
  for(let i=0;i<blobs;i++){const L=land(i),t=age/L.t0;if(t>=1)continue;const x=o.x+Math.cos(L.an)*L.r*t,z=o.z+Math.sin(L.an)*L.r*t,h=1.4+3.2*t-4.6*t*t,r=v.S*(.18+.14*hash(i*11))*(1+.25*Math.sin(t*20)),pp=v.P(x,z,Math.max(.1,h));glossyBubble(v.fx,{x:pp.x,y:pp.y},r,P,1);polyline(v.glow,[v.P(o.x+Math.cos(L.an)*L.r*Math.max(0,t-.15),o.z+Math.sin(L.an)*L.r*Math.max(0,t-.15),1.4),pp],r*.9,P.mid,.5);}
  // small droplets everywhere
  for(let i=0;i<30;i++){const t=age-hash(i)*.05;if(t<0)continue;const an=hash(i*2.7)*TAU,sp=2+hash(i*4.1)*5,h=1.2+(3+hash(i*6.3)*3)*t-6*t*t;if(h<0)continue;const q=v.P(o.x+Math.cos(an)*sp*t,o.z+Math.sin(an)*sp*t,h);v.fx.fillStyle=i%3?P.mid:P.fleck;v.fx.beginPath();v.fx.arc(q.x,q.y,v.S*(.05+.05*hash(i*8)),0,TAU);v.fx.fill();}
 },

 /** Thorn mother: a toxic glob bursts on the target, flinging goo, then leaves a bubbling poison pool. */
 toxicBurst(v,e,o,age,P,ph,s){
  const R=Math.min(3,s.r),fade=1-smooth(1.2,1.7,age),p=v.P(o.x,o.z,.6);
  if(ph==='pre'){poisonPuddle(v,o,R*.9,(age-.08)/1.4,TOXIC,Math.round(o.x*7+o.z*13),fade);
   for(let i=0;i<10;i++){const pf=(v.time*.5+hash(i*3))%1,an=hash(i*5)*TAU,q=v.P(o.x+Math.cos(an)*R*.8*hash(i*7),o.z+Math.sin(an)*R*.8*hash(i*7),.3+pf*1.8);v.glow.globalAlpha=fade*(1-pf)*.5;v.glow.fillStyle=TOXIC.mid;v.glow.beginPath();v.glow.arc(q.x,q.y,v.S*(.2+.2*pf),0,TAU);v.glow.fill();}v.glow.globalAlpha=1;return;}
  toxicSplat(v,p,v.S*R*.9,age/.7,TOXIC,Math.round(o.x*3+o.z*5));
  for(let i=0;i<14;i++){const t=age-hash(i)*.05;if(t<0)continue;const an=hash(i*3.3)*TAU,sp=1.5+hash(i*5.1)*2.5,h=(2.5+hash(i*7)*2)*t-6*t*t;if(h<0)continue;glossyBubble(v.fx,v.P(o.x+Math.cos(an)*sp*t,o.z+Math.sin(an)*sp*t,h+.3),v.S*(.07+.07*hash(i)),TOXIC,1);}
 },
 /** Thorn mother: clusters of glossy venom eggs swell up around the ring over spreading veins, then pop into purple mist. */
 venomEggs(v,e,o,age,P,ph,s){
  const fade=1-smooth(1.25,1.7,age),pop=smooth(.75,.95,age),m=(s.inner+s.r)/2,n=Math.max(5,Math.round(m*1.2));
  if(ph==='pre'){for(let i=0;i<n;i++){const an=i/n*TAU+.2,q={x:o.x+Math.cos(an)*m,z:o.z+Math.sin(an)*m};veins(v,q,(s.r-s.inner)*.6,(age-i*.03)/.9,VENOM,i*7+3,fade);poisonPuddle(v,q,(s.r-s.inner)*.32,(age-i*.03)/1,VENOM,i*11+5,fade*.9);}return;}
  const clusters=[] as {q:W;i:number;y:number}[];for(let i=0;i<n;i++){const an=i/n*TAU+.2,q={x:o.x+Math.cos(an)*m,z:o.z+Math.sin(an)*m};clusters.push({q,i,y:v.P(q.x,q.z,0).y});}
  clusters.sort((a,b)=>a.y-b.y);
  for(const {q,i} of clusters){const sw=easeOut((age-i*.03)/.35)*(1-pop);
   const eggs=[[0,0,.55],[.45,.25,.38],[-.4,.2,.34],[.15,-.35,.3],[-.2,-.3,.24],[.55,-.15,.2]];
   for(const [dx,dz,r] of eggs.sort((a,b)=>(a[0]*.39+a[1]*.59)-(b[0]*.39+b[1]*.59))){const rr=r*(.85+.3*hash(i*9+dx*10))*sw*(1+.05*Math.sin(v.time*5+i+dx*7)),pp=v.P(q.x+dx,q.z+dz,rr*.9);glossyBubble(v.fx,pp,v.S*rr,VENOM,fade);}
   if(pop>0&&pop<1){const pq=v.P(q.x,q.z,.5);toxicSplat(v,pq,v.S*1.1,pop,VENOM,i*17);for(let k=0;k<6;k++){const pf=pop,an=hash(i*5+k)*TAU,qq=v.P(q.x+Math.cos(an)*pf*1.2,q.z+Math.sin(an)*pf*1.2,.4+pf*1.5);v.glow.globalAlpha=(1-pf)*.6;v.glow.fillStyle=VENOM.mid;v.glow.beginPath();v.glow.arc(qq.x,qq.y,v.S*.35*(1+pf),0,TAU);v.glow.fill();}v.glow.globalAlpha=1;}}
  for(let i=0;i<14;i++){const pf=(v.time*.3+hash(i*2))%1,an=hash(i*3)*TAU,q=v.P(o.x+Math.cos(an)*m*(1+(hash(i)-.5)*.4),o.z+Math.sin(an)*m*(1+(hash(i)-.5)*.4),.3+pf*1.6);v.glow.globalAlpha=fade*(1-pf)*.35;v.glow.fillStyle=VENOM.mid;v.glow.beginPath();v.glow.arc(q.x,q.y,v.S*(.4+.5*pf),0,TAU);v.glow.fill();}
  v.glow.globalAlpha=1;
 },

 /** Grove crown: an amber crystal cluster bursts out of the ground, then shatters into shards and leaves. */
 amberBloom(v,e,o,age,P,ph,s){
  const fade=1-smooth(.9,1.6,age),grow=easeOut(age/.16),shatter=smooth(.55,.75,age),R=Math.min(3,s.r);
  if(ph==='pre'){groundGlow(v,o,R*1.2,P,fade);cracks(v,o,R*1.1,9,5,grow,P,fade);return;}
  const cols:[string,string,string,string]=['#7a3e08','#e09a2a','#c07a18','#fff0a8'];
  for(let i=0;i<8;i++){const a=i/8*TAU+hash(i)*.4,out={x:Math.cos(a)*.6,z:Math.sin(a)*.6},r=.2+.5*hash(i*3);rockShard(v,{x:o.x+Math.cos(a)*r,z:o.z+Math.sin(a)*r},out,(1.4+1.6*hash(i*5))*grow*(1-shatter),1.05,P,1-shatter,i,cols);}
  rockShard(v,o,{x:0,z:.05},3.2*grow*(1-shatter),1.6,P,1-shatter,9,cols);
  glint(v,v.P(o.x,o.z,1.6),v.S*1.2,(1-shatter)*.6,v.time,P);
  if(shatter>0){const t=age-.6;flash(v,v.P(o.x,o.z,1),v.S*4,P,(1-t/.25)*.8);rocks(v,o,t,18,7,1.2,['#9a5a12','#ffd27a']);
   for(let i=0;i<16;i++){const pf=clamp(t/1.1),a=hash(i*2)*TAU,r=.5+2.5*pf*hash(i*3),q=v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,2.5*pf*(1-pf)*4*hash(i*5)+.2),c=v.fx;c.save();c.translate(q.x+Math.sin(v.time*5+i)*6,q.y);c.rotate(v.time*3+i);c.globalAlpha=1-pf;c.fillStyle=i%3?'#a7d45a':'#ffd27a';c.beginPath();c.ellipse(0,0,v.S*.14,v.S*.06,0,0,TAU);c.fill();c.restore();}
   v.fx.globalAlpha=1;}
 },
 /** Grove crown: thick roots snake outward through the ring, leaf tips glowing. */
 rootWave(v,e,o,age,P,ph,s){
  const fade=1-smooth(1,1.7,age),leaf:Pal={edge:'#f6ffd8',hi:'#d8ff6a',mid:'#8fe23a',low:'#3d6a1c',deep:'#1c3a10',fleck:'#ffffff',spark:'#d8ff6a'};
  if(ph==='pre'){for(let i=0;i<5;i++){const an=i/5*TAU+.4,q=ringAt(o,s,an,.5);vinePatch(v,q,(s.r-s.inner)*.75,(age-i*.06)/1.2,leaf,i*31,fade);}vinePatch(v,o,s.inner*1.1,age/1.2,leaf,7,fade*.8);return;}
  for(let i=0;i<10;i++){const an=hash(i*3)*TAU,q=ringAt(o,s,an,hash(i*5));streak(v,{...q,h:.2},{x:0,z:0,h:3},age-hash(i)*.4,.8,leaf.hi,.12);}
 },
 /** Moon titan: a giant silver crescent drops edge-first onto the target. */
 crescentDrop(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.5,age),k=clamp(age/.18),imp=age-.18,p=v.P(o.x,o.z,0),R=Math.min(3,s.r);
  if(ph==='pre'){if(imp>0){groundGlow(v,o,R*1.3,P,fade);shockRing(v,o,.4+R*1.4*easeOut(imp/.4),P,1-smooth(.1,.5,imp),4);shockRing(v,o,.3+R*easeOut((imp-.1)/.4),P,imp>.1?1-smooth(.2,.6,imp):0,2);}return;}
  const drop=(1-easeOut(k))*v.S*6;screenSlash(v,{x:p.x,y:p.y-v.S*2.2-drop},Math.PI/2,v.S*2.4,v.S*1.1,1,1-smooth(.25,.6,age),P,7,.38,0);
  if(imp>0){flash(v,v.P(o.x,o.z,.4),v.S*5,P,(1-imp/.3)*.85);for(let i=0;i<18;i++){const pf=clamp((imp-hash(i)*.2)/1),a=hash(i*3)*TAU,r=R*hash(i*5),q=v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,pf*3);v.fx.globalAlpha=(1-pf)*(.5+.5*Math.sin(v.time*14+i));v.fx.fillStyle='#ffffff';v.fx.beginPath();v.fx.arc(q.x,q.y,1.5+hash(i)*1.5,0,TAU);v.fx.fill();}v.fx.globalAlpha=1;}
 },
 /** Moon titan: moon discs in every phase rise around the ring and flash in turn. */
 moonPhases(v,e,o,age,P,ph,s){
  const fade=1-smooth(.9,1.6,age),n=10,m=(s.inner+s.r)/2;
  if(ph==='pre'){groundGlow(v,o,s.r,P,fade*.5);paintBlade(v,arcRibbon(v,o,{R:s.r,T:.35,from:-v.time,to:-v.time+TAU*.9,seed:3,fade,jag:.2}),P,{alpha:fade*.8,seed:3,flecks:0,glow:.6});return;}
  for(let i=0;i<n;i++){const a=i/n*TAU,w={x:o.x+Math.cos(a)*m,z:o.z+Math.sin(a)*m},rise=easeOut((age-i*.04)/.25),q=v.P(w.x,w.z,.4+1.4*rise),r=v.S*.5,ph2=i/n,lit=1-smooth(.15,.45,age-i*.05)*.0;if(rise<=0)continue;
   blob(v.glow,q,r*2,P.mid,fade*.7);const mc=v.fx;mc.save();mc.globalAlpha=fade;mc.fillStyle='#2a3160';mc.beginPath();mc.arc(q.x,q.y,r,0,TAU);mc.fill();mc.beginPath();mc.arc(q.x,q.y,r,0,TAU);mc.clip();const mg=mc.createRadialGradient(q.x-r*.4,q.y-r*.4,r*.1,q.x,q.y,r*1.1);mg.addColorStop(0,'#ffffff');mg.addColorStop(.7,'#d6def8');mg.addColorStop(1,'#9aa6d8');mc.fillStyle=mg;mc.beginPath();mc.ellipse(q.x+(ph2-.5)*r*1.6,q.y,r*(.25+Math.abs(ph2-.5)*1.5),r,0,0,TAU);mc.rect(ph2<.5?q.x:q.x-r,q.y-r,r,r*2);mc.fill('nonzero');mc.fillStyle='#8f9ac8';mc.globalAlpha=fade*.5;for(let k=0;k<4;k++){mc.beginPath();mc.arc(q.x+(hash(i*3+k)-.5)*r*1.2,q.y+(hash(i*5+k)-.5)*r*1.2,r*(.08+.08*hash(k)),0,TAU);mc.fill();}mc.restore();mc.globalAlpha=fade;mc.strokeStyle='rgba(20,24,60,.7)';mc.lineWidth=Math.max(1,v.S*.04);mc.beginPath();mc.arc(q.x,q.y,r,0,TAU);mc.stroke();mc.globalAlpha=1;
   const fl=age-.3-i*.06;if(fl>0&&fl<.3){glint(v,q,v.S*.6*(1-fl/.3),1-fl/.3,0,P);polyline(v.glow,[v.P(w.x,w.z,0),q],v.S*.3,P.hi,(1-fl/.3)*lit);}}
  shockRing(v,o,s.r+1.2*easeOut((age-.3)/.5),P,age>.3?1-smooth(.5,.9,age):0,2.5);
 },
 /** Minotaur: maze walls of stone slam up through the ring, with gaps. */
 labyrinth(v,e,o,age,P,ph,s){
  const fade=1-smooth(1,1.6,age),stone=['#4a3c2c','#7d6a52','#c8b08a'];
  const wall=(r:number,a0:number,a1:number,h:number,i:number)=>{const n=8,T=.32,ring=(rr:number,hh:number)=>{const pts:Pt[]=[];for(let k=0;k<=n;k++){const a=a0+(a1-a0)*k/n;pts.push(v.P(o.x+Math.cos(a)*rr,o.z+Math.sin(a)*rr,hh));}return pts;};
   const outB=ring(r,0),outT=ring(r,h),inT=ring(r-T,h),c=v.fx,al=Math.min(1,fade*1.3),poly=(A:Pt[],B:Pt[])=>{c.beginPath();A.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));for(let k=B.length-1;k>=0;k--)c.lineTo(B[k].x,B[k].y);c.closePath();};
   const front=Math.sin((a0+a1)/2)>0,g=c.createLinearGradient(0,outB[0].y,0,outT[0].y);g.addColorStop(0,front?'#5e4d38':'#3e3224');g.addColorStop(1,front?'#9a8564':'#6b5a44');
   c.globalAlpha=al*.45;c.fillStyle='#000';poly(outB,outB.map(p=>({x:p.x+4,y:p.y+3})));c.fill();
   c.globalAlpha=al;c.fillStyle=g;poly(outB,outT);c.fill();
   c.fillStyle='#cdb68e';poly(outT,inT);c.fill();
   c.strokeStyle='rgba(30,22,14,.55)';c.lineWidth=1;for(const f of [.33,.66]){c.beginPath();outB.forEach((p,k)=>{const q={x:p.x+(outT[k].x-p.x)*f,y:p.y+(outT[k].y-p.y)*f};k?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.stroke();}
   for(let k=1;k<n;k++){const off=k%2?0:.33,p=outB[k],q=outT[k];c.beginPath();c.moveTo(p.x+(q.x-p.x)*off,p.y+(q.y-p.y)*off);c.lineTo(p.x+(q.x-p.x)*(off+.33),p.y+(q.y-p.y)*(off+.33));c.stroke();}
   c.strokeStyle='rgba(18,10,6,.8)';c.lineWidth=Math.max(1,v.S*.045);poly(outB,outT);c.stroke();poly(outT,inT);c.stroke();
   c.globalAlpha=al*.8;c.fillStyle='#6f8f3e';for(let k=0;k<3;k++){const q=outT[Math.floor(hash(i*5+k)*n)];c.beginPath();c.ellipse(q.x,q.y,v.S*.18,v.S*.07,0,0,TAU);c.fill();}
   polyline(v.glow,outB,5,P.mid,fade*.6);c.globalAlpha=1;};
  const walls:{r:number;a0:number;a1:number;y:number;i:number}[]=[];
  [s.inner+(s.r-s.inner)*.25,s.inner+(s.r-s.inner)*.6,s.r*.95].forEach((r,ring)=>{const segs=6+ring*2;for(let j=0;j<segs;j++){if(hash(j*7+ring*13)<.3)continue;const a0=j/segs*TAU+ring*.4,a1=a0+TAU/segs*.78,mid=(a0+a1)/2;walls.push({r,a0,a1,y:v.P(o.x+Math.cos(mid)*r,o.z+Math.sin(mid)*r,0).y,i:j+ring*20});}});
  const draw=(back:boolean)=>{for(const w of walls.filter(w=>(w.y<v.heroY)===back).sort((a,b)=>a.y-b.y)){const rise=easeOut((age-hash(w.i)*.15)/.1)*(1-smooth(1.1,1.5,age));if(rise>0)wall(w.r,w.a0,w.a1,1.4*rise,w.i);}};
  if(ph==='pre'){groundGlow(v,o,s.r,P,fade*.5);for(let i=0;i<7;i++){const an=i/7*TAU;dustCloud(v,ringAt(o,s,an,.55),1.4,clamp((age-hash(i)*.15)/1.4),fade,i*11);}draw(true);return;}
  draw(false);flash(v,v.P(o.x,o.z,.5),v.S*4,P,(1-age/.2)*.5);
 },
 /** Naga: a water serpent coils inward through the ring and rears up. */
 serpentCoil(v,e,o,age,P,ph,s){
  const fade=1-smooth(.9,1.6,age),head=easeOut(age/.8),a0=coneDir(s);
  const at=(t:number)=>{const a=a0+t*TAU*1.3,r=s.r*.92-(s.r*.92-s.inner*1.2)*t,h=.5+.35*Math.sin(t*14)+2.4*smooth(.85,1,t);return{x:o.x+Math.cos(a)*r,z:o.z+Math.sin(a)*r,h};};
  if(ph==='pre')groundGlow(v,o,s.r,P,fade*.6);
  half(v,ph==='post',()=>{const tail=Math.max(0,head-.65),rb=buildRibbon(48,u=>{const t=tail+(head-tail)*u,q=at(t),th=.95*Math.sin(Math.PI*Math.min(1,u*1.05))**.6;return{o:v.P(q.x,q.z,q.h+th),i:v.P(q.x,q.z,q.h-th*.6)};});
   paintBlade(v,rb,P,{alpha:fade,seed:5,flecks:14});
   for(let i=0;i<20;i++){const t=tail+(head-tail)*hash(i*3),q=at(t),pf=(v.time*1.5+hash(i))%1;dot(v.fx,v.P(q.x,q.z,q.h+pf*1.2),v.S*.06,P.edge,fade*(1-pf));}});
  if(ph==='post'){const hq=at(head);glint(v,v.P(hq.x,hq.z,hq.h+.3),v.S*.6,fade,v.time*3,P);if(head>.97)sparkBurst(v,{...hq,h:hq.h},age-.8,P,16,3,4,.5);}
 },
 /** Sphinx: a solar disc rises over the boss and sweeps sun rays across the ring. */
 sunGlyph(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.6,age),rot=age*1.6;
  if(ph==='pre'){runeCircle(v,o,s.inner*1.4,P,fade,v.time*.5,'holy');
   for(let i=0;i<24;i++){const a=i/24*TAU+rot,p1=v.P(o.x+Math.cos(a)*s.inner,o.z+Math.sin(a)*s.inner,.03),p2=v.P(o.x+Math.cos(a)*s.r*easeOut(age/.3),o.z+Math.sin(a)*s.r*easeOut(age/.3),.03),p3=v.P(o.x+Math.cos(a+.06)*s.r*easeOut(age/.3),o.z+Math.sin(a+.06)*s.r*easeOut(age/.3),.03);
    v.glow.globalAlpha=fade*(i%2?.5:.85);v.glow.fillStyle=P.mid;v.glow.beginPath();v.glow.moveTo(p1.x,p1.y);v.glow.lineTo(p2.x,p2.y);v.glow.lineTo(p3.x,p3.y);v.glow.closePath();v.glow.fill();polyline(v.fx,[p1,p2],1.2,P.edge,fade);}
   v.glow.globalAlpha=1;dust(v,o,s.r*.7,clamp(age/1.4),.5*fade,24,3,'#e6c98a');return;}
  const sun=v.P(o.x,o.z,4.5),R=v.S*1.2*easeOut(age/.2);blob(v.glow,sun,R*3,P.mid,fade);elecFlash(v,sun,R*1.6,P,fade,5);dot(v.fx,sun,R*.8,'#fff6d0',fade);
  for(let i=0;i<12;i++){const a=i/12*TAU+rot;polyline(v.glow,[sun,{x:sun.x+Math.cos(a)*R*2.4,y:sun.y+Math.sin(a)*R*2.4}],4,P.hi,fade*.8);}
 },
 /** Yotun: the cone freezes into an ice sheet, then shatters forward. */
 iceShatter(v,e,o,age,P,ph,s){
  const fade=1-smooth(.9,1.5,age),freeze=easeOut(age/.25),burst2=age-.35;
  if(ph==='pre'){const c=v.fx;for(let i=0;i<30;i++){const u=hash(i*2.1),w=Math.sqrt(hash(i*4.3))*freeze,a=coneAt(o,s,u,w),b=coneAt(o,s,clamp(u+.06),Math.min(1,w+.12)),cc=coneAt(o,s,clamp(u-.05),Math.min(1,w+.1)),pa=v.P(a.x,a.z,.02),pb=v.P(b.x,b.z,.02),pc=v.P(cc.x,cc.z,.02);c.globalAlpha=fade*(burst2>0?.5:.8);c.fillStyle=i%3?'#bfe8ff':'#eaf8ff';c.beginPath();c.moveTo(pa.x,pa.y);c.lineTo(pb.x,pb.y);c.lineTo(pc.x,pc.y);c.closePath();c.fill();polyline(v.glow,[pa,pb,pc],2,P.mid,fade*.6,true);}c.globalAlpha=1;groundGlow(v,coneAt(o,s,.5,.5),s.r*.5,P,fade);return;}
  if(burst2>0){for(let i=0;i<18;i++){const q=coneAt(o,s,hash(i*3),.2+.8*hash(i*5)),dir=coneDir(s)+(hash(i)-.5)*.6;rockShard(v,q,{x:Math.cos(dir),z:Math.sin(dir)},(.4+.6*hash(i*7))*(1-smooth(.3,.7,burst2)),.35,P,fade,i,['#1d4d7a','#6fb7e6','#5aa3d6','#eaf8ff']);streak(v,{...q,h:.3},{x:Math.cos(dir)*6,z:Math.sin(dir)*6,h:2},burst2-hash(i)*.05,.4,P.hi,.06);}
   flash(v,v.P(coneAt(o,s,.5,.6).x,coneAt(o,s,.5,.6).z,.5),v.S*5,P,(1-burst2/.25)*.7);}
 },
 /** Oni: the club smashes the far end of the cone; a burning line runs back to the boss. */
 clubSlam(v,e,o,age,P,ph,s){
  const fade=1-smooth(.9,1.6,age),imp=age-.1,end=coneAt(o,s,.5,.82);
  if(ph==='pre'){const pts:Pt[]=[];for(let k=0;k<=10;k++){const w=k/10*easeOut(age/.15)*.85,q=coneAt(o,s,.5+(hash(k)-.5)*.04,w);pts.push(v.P(q.x,q.z,.02));}polyline(v.glow,pts,v.S*.5,P.mid,fade);polyline(v.fx,pts,3,P.hi,fade);cracks(v,end,2.4,10,9,easeOut(imp/.1),P,fade);groundGlow(v,end,2.6,P,fade);return;}
  if(imp>0){const p=v.P(end.x,end.z,.3);flash(v,p,v.S*6,P,(1-imp/.25)*.9);starBurst(v,p,v.S*3.4*easeOut(imp/.07),P,1-smooth(.12,.4,imp),17);rocks(v,end,imp,14,3,1.2,['#2a0a06','#ff9a4a']);
   for(let i=0;i<20;i++){const pf=(v.time*.9+hash(i))%1;dot(v.fx,v.P(end.x+(hash(i*3)-.5)*3,end.z+(hash(i*5)-.5)*3,pf*3),1.5+hash(i)*1.5,i%2?P.fleck:P.hi,fade*(1-pf));}}
 },
 /** Cloud dragon: lightning bolts strike each storm pillar out of a dark cloud. */
 lightning(v,e,o,age,P,ph,s){
  const fade=1-smooth(.7,1.3,age),R=Math.min(3,s.r),p=v.P(o.x,o.z,0),fr=Math.floor(v.time*20);
  if(ph==='pre'){groundGlow(v,o,R*1.2,P,fade);shockRing(v,o,.3+R*1.2*easeOut(age/.35),P,1-smooth(.1,.5,age),3);cracks(v,o,R,8,7,easeOut(age/.08),P,fade);return;}
  const cloud=v.P(o.x,o.z,8);for(let i=0;i<6;i++)blob(v.fx,{x:cloud.x+(hash(i)-.5)*v.S*3,y:cloud.y+(hash(i*3)-.5)*v.S},v.S*(1+hash(i*5)),'#3a4a5a',fade*.8);
  for(let b=0;b<3;b++){const t=age-b*.08;if(t<0||t>.18)continue;bolt(v,{x:cloud.x+(hash(b+fr)-.5)*v.S,y:cloud.y},{x:p.x+(hash(b*7)-.5)*v.S*.6,y:p.y},fr+b*9,P,1-t/.18,2.6);}
  elecFlash(v,v.P(o.x,o.z,.6),v.S*1.8*easeOut(age/.06),P,1-smooth(.12,.45,age),11);sparkBurst(v,{x:o.x,z:o.z,h:.3},age,P,14,5,4,.4);
 },
 /** Cloud dragon: wind breath — curling gust streaks race along each cone. */
 windBreath(v,e,o,age,P,ph,s){
  const fade=1-smooth(.6,1.3,age);
  if(ph==='pre'){groundGlow(v,coneAt(o,s,.5,.55),s.r*.45,P,fade*.7);return;}
  for(let i=0;i<14;i++){const u=hash(i*2.3),off=hash(i*5.1)*.3,head=clamp((age-off)/.5);if(head<=0||head>=1.4)continue;const pts:Pt[]=[];for(let k=0;k<=12;k++){const w=Math.max(0,head-.35)+(.35*k/12),q=coneAt(o,s,clamp(u+Math.sin(w*9+i)*.05),Math.min(1,w)),h=.5+Math.sin(w*7+i)*.3;pts.push(v.P(q.x,q.z,h));}
   const a=fade*(1-smooth(.9,1.3,head));polyline(v.glow,pts,5,P.mid,a*.8);polyline(v.fx,pts,1.6,'#ffffff',a);}
  for(let i=0;i<10;i++){const q=coneAt(o,s,hash(i*7),easeOut(age/.8)*hash(i*3)),c=v.fx;c.save();const p=v.P(q.x,q.z,.6+Math.sin(v.time*6+i)*.3);c.translate(p.x,p.y);c.rotate(v.time*4+i);c.globalAlpha=fade;c.fillStyle=P.hi;c.beginPath();c.ellipse(0,0,v.S*.12,v.S*.05,0,0,TAU);c.fill();c.restore();}
 },
 /** Zmey: each head breathes a fire jet down its cone. */
 fireBreath(v,e,o,age,P,ph,s){
  const fade=1-smooth(.7,1.4,age);
  if(ph==='pre'){groundGlow(v,coneAt(o,s,.5,.6),s.r*.5,P,fade);for(let k=0;k<6;k++)cracks(v,coneAt(o,s,.5,(k+1)/7),.6,3,k*5,easeOut(age/.2),P,fade*.7);return;}
  for(let i=0;i<40;i++){const t=((age*1.6+hash(i))%1),w=t*easeOut(age/.15),q=coneAt(o,s,.5+(hash(i*3)-.5)*(.3+t*.7),w),p=v.P(q.x,q.z,1+t*.6),r=v.S*(.2+t*.9);
   blob(v.glow,p,r,t<.5?P.hi:P.mid,fade*(1-t)*.9);if(t>.6)blob(v.fx,p,r*.9,'#3a2a20',fade*(t-.6)*.6);}
 },
 /** Zmey: lava geysers burst up in a line toward the target. */
 eruption(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.5,age),R=Math.min(2.5,s.r);
  if(ph==='pre'){groundGlow(v,o,R*1.3,P,fade);cracks(v,o,R*1.2,8,3,easeOut(age/.1),P,fade);const pool=v.P(o.x,o.z,0);v.fx.save();v.fx.translate(pool.x,pool.y);v.fx.scale(1,.5);blob(v.fx,{x:0,y:0},v.S*R*.8,P.mid,fade);v.fx.restore();return;}
  swirlColumn(v,o,5,.4,1.1,age/1.5,P,Math.round(o.x*7+o.z*3));rocks(v,o,age,12,9,1,['#3a1208','#ff9a4a']);
  for(let i=0;i<14;i++){const t=age-hash(i)*.1;if(t<0)continue;const a=hash(i*3)*TAU,sp=1+hash(i*5)*2,h=(4+hash(i*7)*3)*t-6*t*t;if(h<0)continue;dot(v.fx,v.P(o.x+Math.cos(a)*sp*t,o.z+Math.sin(a)*sp*t,h),v.S*(.08+.06*hash(i)),i%2?P.hi:P.mid,fade);}
  flash(v,v.P(o.x,o.z,.5),v.S*3,P,(1-age/.2)*.6);
 },
 /** Antler king: a twilight flower blooms on the ground, then bursts into petals. */
 fairyBloom(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.5,age),R=Math.min(3,s.r),open=easeOut(age/.3),burst2=age-.45;
  if(ph==='pre'){const c=v.fx;for(let layer=0;layer<2;layer++)for(let i=0;i<8;i++){const a=i/8*TAU+layer*.4+v.time*.3,len=R*(layer?.65:1)*open,tip={x:o.x+Math.cos(a)*len,z:o.z+Math.sin(a)*len},l={x:o.x+Math.cos(a+.35)*len*.5,z:o.z+Math.sin(a+.35)*len*.5},r={x:o.x+Math.cos(a-.35)*len*.5,z:o.z+Math.sin(a-.35)*len*.5},c0=v.P(o.x,o.z,.03),pt=v.P(tip.x,tip.z,.03),pl=v.P(l.x,l.z,.03),pr=v.P(r.x,r.z,.03);
    c.globalAlpha=fade*(burst2>0?Math.max(0,1-burst2*3):1)*.85;c.fillStyle=layer?P.hi:P.mid;c.beginPath();c.moveTo(c0.x,c0.y);c.quadraticCurveTo(pl.x,pl.y,pt.x,pt.y);c.quadraticCurveTo(pr.x,pr.y,c0.x,c0.y);c.fill();}
   c.globalAlpha=1;groundGlow(v,o,R,P,fade*.8);return;}
  if(burst2>0){flash(v,v.P(o.x,o.z,.6),v.S*4,P,(1-burst2/.25)*.7);for(let i=0;i<20;i++){const pf=clamp(burst2/1),a=hash(i*2)*TAU,r=R*(.3+pf*1.2*hash(i*3)),q=v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,pf*3*hash(i*5)+.3),c=v.fx;c.save();c.translate(q.x,q.y);c.rotate(v.time*3+i);c.globalAlpha=1-pf;c.fillStyle=i%3?P.hi:P.fleck;c.beginPath();c.ellipse(0,0,v.S*.15,v.S*.07,0,0,TAU);c.fill();c.restore();}glint(v,v.P(o.x,o.z,1),v.S*.8,1-smooth(0,.4,burst2),0,P);}
 },
 /** Antler king: violet crystal antlers branch up all around the ring. */
 antlerThorns(v,e,o,age,P,ph,s){
  const fade=1-smooth(.9,1.6,age),n=Math.round(s.r*1.6);
  if(ph==='pre')groundGlow(v,o,s.r,P,fade*.6);
  half(v,ph==='post',()=>{for(let i=0;i<n;i++){const a=i/n*TAU+hash(i)*.2,q=ringAt(o,s,a,.3+.5*hash(i*3)),grow=easeOut((age-hash(i*5)*.2)/.25)*(1-smooth(1.1,1.5,age));if(grow<=0)continue;
   const b=v.P(q.x,q.z,0),H=v.S*(1.6+hash(i*7))*grow,lean=(hash(i*9)-.5)*v.S*.6,top={x:b.x+lean,y:b.y-H};polyline(v.glow,[b,top],6,P.mid,fade*.8);polyline(v.fx,[b,top],2.2,P.edge,fade);
   for(let k=0;k<3;k++){const f=.35+k*.22,m={x:b.x+lean*f,y:b.y-H*f},side=k%2?1:-1,tip={x:m.x+side*v.S*.5*grow,y:m.y-v.S*.45*grow};polyline(v.glow,[m,tip],4,P.mid,fade*.7);polyline(v.fx,[m,tip],1.4,P.hi,fade);}
   glint(v,top,v.S*.2,fade*.8,0,P);}});
 },
 /** Kraken: a tentacle slams down into each anchor circle. */
 tentacleSlam(v,e,o,age,P,ph,s){
  const fade=1-smooth(.7,1.4,age),k=easeOut(age/.18),R=Math.min(3,s.r),p=v.P(o.x,o.z,0),from={x:p.x-v.S*3.5,y:p.y-v.S*7},flesh:Pal={edge:'#e8f6ff',hi:'#a9c6e8',mid:'#5a74b8',low:'#2c3a78',deep:'#121a3a',fleck:'#ffffff',spark:'#bfe0ff'};
  if(ph==='pre'){if(age>.18){groundGlow(v,o,R*1.2,P,fade);shockRing(v,o,.3+R*1.3*easeOut((age-.18)/.35),P,1-smooth(.2,.6,age),3.5);}return;}
  const tip={x:from.x+(p.x-from.x)*k,y:from.y+(p.y-v.S*.2-from.y)*k},ctrl={x:from.x+v.S*3,y:from.y+v.S*.5};
  const rb=buildRibbon(24,u=>{const a=1-u,q={x:a*a*from.x+2*a*u*ctrl.x+u*u*tip.x,y:a*a*from.y+2*a*u*ctrl.y+u*u*tip.y},th=v.S*(.75-.6*u);return{o:{x:q.x-th*.5,y:q.y},i:{x:q.x+th*.5,y:q.y+th*.2}};});
  paintBlade(v,rb,flesh,{alpha:1-smooth(.4,.8,age),seed:3,flecks:0,glow:.3});
  polyline(v.fx,rb.o,Math.max(1,v.S*.05),'rgba(10,14,40,.8)',1-smooth(.4,.8,age));polyline(v.fx,rb.i,Math.max(1,v.S*.05),'rgba(10,14,40,.8)',1-smooth(.4,.8,age));
  for(let i=0;i<6;i++){const u=.3+i*.1,a=1-u,q={x:a*a*from.x+2*a*u*ctrl.x+u*u*tip.x,y:a*a*from.y+2*a*u*ctrl.y+u*u*tip.y};dot(v.fx,q,v.S*.08*(1-u*.6),'#f0d0e0',1-smooth(.4,.8,age));}
  if(age>.18)toonSplash(v,o,R*.7,(age-.18)/1,P,Math.round(o.x*13+o.z*7));
  if(age>.18){const t=age-.18;for(let i=0;i<10;i++){const a=hash(i*3)*TAU,sp=2+hash(i*5)*3,h=(3+hash(i*7)*2)*t-6*t*t;if(h<0)continue;dot(v.fx,v.P(o.x+Math.cos(a)*sp*t,o.z+Math.sin(a)*sp*t,h),v.S*.07,i%2?P.hi:P.edge,fade);}flash(v,v.P(o.x,o.z,.3),v.S*3.5,P,(1-t/.2)*.7);}
 },
 /** Kraken: high-pressure water jets with spray along each line. */
 waterJet(v,e,o,age,P,ph,s){
  const half2=s.angle*Math.PI/360,w=Math.tan(half2)*s.r*.6;
  if(ph==='pre'){groundGlow(v,coneAt(o,s,.5,.5),s.r*.4,P,(1-smooth(.5,1.2,age))*.6);return;}
  toonSplash(v,{x:o.x+s.fx*s.r,z:o.z+s.fz*s.r},1.2,(age-.1)/1.1,P,Math.round(s.fx*50));
  axisBeam(v,o,s,age,P,w,(len,fade)=>{for(let i=0;i<22;i++){const t=hash(i*3.3),q={x:o.x+s.fx*len*t,z:o.z+s.fz*len*t},side=(hash(i)-.5)*2,pf=(v.time*2+hash(i*5))%1;dot(v.fx,v.P(q.x-s.fz*side*w*(1+pf),q.z+s.fx*side*w*(1+pf),1.2+pf*1.2-pf*pf*2),v.S*.06,P.edge,fade*(1-pf));}});
 },
 /** Eclipse: meteors streak in diagonally onto each star mark. */
 starfall(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.5,age),k=clamp(age/.22),imp=age-.22,R=Math.min(3,s.r);
  if(ph==='pre'){if(imp>0){groundGlow(v,o,R*1.3,P,fade);cracks(v,o,R*1.1,10,13,easeOut(imp/.1),P,fade);shockRing(v,o,.4+R*1.3*easeOut(imp/.4),P,1-smooth(.1,.5,imp),3.5);}return;}
  if(imp<0){const from={x:o.x-4,z:o.z-4,h:9},q={x:from.x+(o.x-from.x)*k,z:from.z+(o.z-from.z)*k,h:from.h*(1-k)},tail={x:from.x+(o.x-from.x)*Math.max(0,k-.3),z:from.z+(o.z-from.z)*Math.max(0,k-.3),h:from.h*(1-Math.max(0,k-.3))},pq=v.P(q.x,q.z,q.h),pt=v.P(tail.x,tail.z,tail.h);
   polyline(v.glow,[pt,pq],v.S*.9,P.mid,.9);polyline(v.glow,[pt,pq],v.S*.35,P.hi,1);polyline(v.fx,[pt,pq],2,'#fff',.8);glint(v,pq,v.S*1,1,v.time*5,P);boulder(v.fx,pq.x,pq.y,v.S*.45,v.time*4,'#2a1838','#c8a8ff',5);return;}
  const p=v.P(o.x,o.z,.3);flash(v,p,v.S*5,P,(1-imp/.3)*.9);starBurst(v,p,v.S*3*easeOut(imp/.07),P,1-smooth(.12,.4,imp),29);
  for(let i=0;i<14;i++){const pf=clamp((imp-hash(i)*.2)/.9),a=hash(i*3)*TAU,q=v.P(o.x+Math.cos(a)*R*pf,o.z+Math.sin(a)*R*pf,pf*2.5);v.fx.globalAlpha=1-pf;v.fx.fillStyle=i%2?P.fleck:P.hi;v.fx.beginPath();for(let j=0;j<8;j++){const an=j*Math.PI/4+v.time,rr=j%2?2:6;v.fx.lineTo(q.x+Math.cos(an)*rr,q.y+Math.sin(an)*rr);}v.fx.closePath();v.fx.fill();}
  v.fx.globalAlpha=1;
 },
 /** Eclipse: a black sun with a gold corona; the shadow band spreads over the ring. */
 eclipseRing(v,e,o,age,P,ph,s){
  const fade=1-smooth(.9,1.6,age),spread=easeOut(age/.5);
  if(ph==='pre'){const outer=circlePts(v,o,s.inner+(s.r-s.inner)*spread,.02,64),inner=circlePts(v,o,s.inner,.02,64),c=v.fx;c.globalAlpha=fade*.7;c.fillStyle=P.deep??'#000';c.beginPath();outer.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();inner.slice().reverse().forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill('evenodd');c.globalAlpha=1;
   polyline(v.glow,outer,8,P.hi,fade,true);polyline(v.fx,outer,2,P.edge,fade,true);
   for(let i=0;i<16;i++){const a=i/16*TAU+age;streak(v,{...ringAt(o,s,a,spread*.9),h:.2},{x:Math.cos(a)*3,z:Math.sin(a)*3,h:1},age-.2-hash(i)*.2,.5,P.hi,.08);}return;}
  const sun=v.P(o.x,o.z,5),R=v.S*1.4*easeOut(age/.25);blob(v.glow,sun,R*3,P.hi,fade);blob(v.glow,sun,R*1.8,P.mid,fade);dot(v.fx,sun,R,'#07020e',fade);
  for(let i=0;i<10;i++){const a=i/10*TAU+v.time*.5,l=R*(1.3+.6*hash(i)+.3*Math.sin(v.time*6+i));polyline(v.glow,[{x:sun.x+Math.cos(a)*R,y:sun.y+Math.sin(a)*R},{x:sun.x+Math.cos(a)*l,y:sun.y+Math.sin(a)*l}],4,P.hi,fade);}
 },
 /** Sea dragon: a dark whirlpool drags inward, then erupts in a geyser. */
 abyssMaw(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.5,age),R=Math.min(3,s.r),erupt=age-.35;
  if(ph==='pre'){for(let i=0;i<5;i++){const st={a0:v.time*-4+i/5*TAU,a1:v.time*-4+i/5*TAU+2.2};const rb=buildRibbon(24,u=>{const a=st.a0+(st.a1-st.a0)*u,r=R*(1-u*.85),th=.3*(1-u);return{o:v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,.05),i:v.P(o.x+Math.cos(a)*(r-th),o.z+Math.sin(a)*(r-th),.05)};});paintBlade(v,rb,P,{alpha:fade*.9,seed:i,flecks:0,glow:.6});}
   const pool=v.P(o.x,o.z,0);v.fx.save();v.fx.translate(pool.x,pool.y);v.fx.scale(1,.5);blob(v.fx,{x:0,y:0},v.S*R*.6,'#020810',fade);v.fx.restore();return;}
  if(erupt>0){geyser(v,o,5.5,R*.45,erupt/1.1,P,Math.round(o.x*11+o.z*5));toonSplash(v,o,R*.6,erupt/1.1,P,Math.round(o.x*3+o.z*17));flash(v,v.P(o.x,o.z,.5),v.S*3,P,(1-erupt/.2)*.7);}
  for(let i=0;i<18;i++){const pf=(v.time*.8+hash(i))%1,a=hash(i*3)*TAU,r=R*.6*hash(i*5);const q=v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,pf*4);v.fx.globalAlpha=fade*(1-pf);v.fx.strokeStyle=P.hi;v.fx.lineWidth=1.2;v.fx.beginPath();v.fx.arc(q.x,q.y,v.S*(.05+.05*hash(i)),0,TAU);v.fx.stroke();}
  v.fx.globalAlpha=1;
 },
 /** Sea dragon: dark-teal breath beams full of bubbles. */
 abyssBreath(v,e,o,age,P,ph,s){
  if(ph==='pre'){groundGlow(v,coneAt(o,s,.5,.5),s.r*.4,P,(1-smooth(.5,1.2,age))*.6);return;}
  axisBeam(v,o,s,age,P,Math.tan(s.angle*Math.PI/360)*s.r*.45,(len,fade)=>{for(let i=0;i<26;i++){const t=hash(i*3.3),pf=(v.time*1.2+hash(i*5))%1,q={x:o.x+s.fx*len*t,z:o.z+s.fz*len*t};const p=v.P(q.x+(hash(i)-.5)*1.2,q.z+(hash(i*7)-.5)*1.2,1.2+pf*1.5);v.fx.globalAlpha=fade*(1-pf);v.fx.strokeStyle=P.edge;v.fx.lineWidth=1.2;v.fx.beginPath();v.fx.arc(p.x,p.y,v.S*(.06+.06*hash(i)),0,TAU);v.fx.stroke();}v.fx.globalAlpha=1;});
 },
 /** World core: a prism orb whose palette cycles through every element. */
 worldOrb(v,e,o,age,P,ph,s){const Q=huePal((v.time*120)%360);SIG.starfall(v,e,o,age,Q,ph,s);},
 /** World core: prism beams whose bands cycle hue. */
 prismBeam(v,e,o,age,P,ph,s){
  const hue=(v.time*160+hash(Math.round(coneDir(s)*10))*360)%360,Q=huePal(hue);
  if(ph==='pre'){groundGlow(v,coneAt(o,s,.5,.5),s.r*.45,Q,(1-smooth(.5,1.2,age))*.7);return;}
  axisBeam(v,o,s,age,Q,Math.tan(s.angle*Math.PI/360)*s.r*.5,(len,fade)=>{for(let k=1;k<=3;k++){const R=huePal((hue+k*90)%360),w=Math.tan(s.angle*Math.PI/360)*s.r*.5*(.15+k*.12),px=-s.fz,pz=s.fx;for(const sg of [1,-1])polyline(v.glow,[v.P(o.x,o.z,1.2),v.P(o.x+s.fx*len+px*w*sg,o.z+s.fz*len+pz*w*sg,1.2)],3,R.mid,fade*.8);}burst(v,{x:o.x+s.fx*len,z:o.z+s.fz*len,h:1.2},age,.4,1.3,Q);});
 },
 /** World core: elemental pillars of every colour, with tilted orbit rings around the boss. */
 worldcore(v,e,o,age,P,ph,s){
  const fade=1-smooth(.9,1.6,age),n=12,m=(s.inner+s.r)/2;
  if(ph==='pre')groundGlow(v,o,s.r,P,fade*.5);
  half(v,ph==='post',()=>{for(let k=0;k<3;k++){const Q=huePal((k*120+v.time*60)%360);paintBlade(v,arcRibbon(v,o,{R:s.inner+.5+k*.6,T:.25,from:v.time*(1+k*.4),to:v.time*(1+k*.4)+TAU*.75,h:1.5+k*.5,tilt:.8,tiltPhase:k*2,seed:k,fade,jag:.1}),Q,{alpha:fade,seed:k,flecks:0,glow:.7});}});
  if(ph==='post')for(let i=0;i<n;i++){const a=i/n*TAU,w={x:o.x+Math.cos(a)*m,z:o.z+Math.sin(a)*m},b=age-i*.03,Q=huePal(i/n*360);if(b<0)continue;beam(v,w,6.5,.5,Q,1-smooth(.1,.7,b));burst(v,{...w,h:.2},b,.3,.8,Q);}
 },
};
void PALS;
