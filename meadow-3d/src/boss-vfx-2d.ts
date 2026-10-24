/**
 * Boss attack VFX for the Canvas2D world, painted through the same layers as the sword skills.
 * Telegraphs keep a red danger language (zone + filling progress) with each boss's own accent;
 * blasts and basic attacks use the boss palette. Most blasts share a few families
 * (falling object, spike ring, light/water pillars, cleave, beam, tide, fire ring, web, blobs, orbs)
 * re-coloured per boss. Visual only.
 */
import {PALS,DRAW,LIFE,LIFE_OF,EXTRA_KINDS,PALETTE_FOR,PALETTE_OF,type V,type Fx,type W,type Pal,type Pt,type Stroke,
 TAU,clamp,hash,smooth,easeOut,polyline,glint,streak,sparkBurst,burst,circlePts,shockRing,groundGlow,cracks,dust,rocks,paintBlade,arcRibbon,windStroke,flash,beam,runeCircle,starBurst,rockShard,diamond,buildRibbon,boulder,shade} from './skill-vfx-2d.ts';
import {BOSS_FAMILY,SIG} from './boss-vfx-signature.ts';
import {toonSplash,swirlColumn,dustCloud,stonePillar,elecFlash} from './vfx-toon.ts';
/** Family for a telegraph/blast event: the boss's own signature first, then the shared family by attack id. */
function familyOf(d:any):[string,string?]|undefined{const sig=BOSS_FAMILY[`${d?.dataId}/${d?.attack}`];return sig?['sig:'+sig]:FAMILY[String(d?.attack??'')];}

Object.assign(PALS,{
 danger:{edge:'#ffe1d6',hi:'#ff9c84',mid:'#ff5a3c',low:'#c2301c',deep:'#4a0e08',fleck:'#ffd0c0',spark:'#ffb09a'},
 jelly:{edge:'#fff0f6',hi:'#ffc2dc',mid:'#ff7fb6',low:'#c2427f',deep:'#5a1238',fleck:'#c9fff3',spark:'#9ff5e2'},
 mist:{edge:'#f2fff8',hi:'#c8ecdc',mid:'#7fc9b0',low:'#3f7f6c',deep:'#173a33',fleck:'#e8fff6',spark:'#bfeee0'},
 relic:{edge:'#fffbe6',hi:'#ffe69a',mid:'#e8b84a',low:'#2fa39a',deep:'#123c3a',fleck:'#9ff0e6',spark:'#ffe08a'},
 magma:{edge:'#fff1d6',hi:'#ffc06a',mid:'#ff7a2a',low:'#b8361a',deep:'#3a1a10',fleck:'#ffd28a',spark:'#ffb04a'},
 amberleaf:{edge:'#fffbe0',hi:'#ffe08a',mid:'#e0a63a',low:'#6f9a3a',deep:'#2e4a1a',fleck:'#c8f07a',spark:'#ffd56a'},
 moon:{edge:'#ffffff',hi:'#dfe8ff',mid:'#9fb6ff',low:'#5866b8',deep:'#1c2150',fleck:'#ffffff',spark:'#dfe8ff'},
 thorn:{edge:'#f6ffe8',hi:'#d6f59a',mid:'#8fca4a',low:'#6b2f7a',deep:'#2a1030',fleck:'#f2a6ff',spark:'#c8f07a'},
 bronze:{edge:'#fff3e0',hi:'#ffcf8a',mid:'#d98b3a',low:'#8a3a1e',deep:'#33150a',fleck:'#ffd9a0',spark:'#ffb46a'},
 naga:{edge:'#f0fffb',hi:'#b8f5e6',mid:'#3fcfb4',low:'#1a7f86',deep:'#0a3340',fleck:'#e0fff6',spark:'#9ff0e0'},
 solar:{edge:'#fffdf0',hi:'#ffeaa0',mid:'#ffc23a',low:'#b85a1a',deep:'#2a1405',fleck:'#fff2c0',spark:'#ffd86a'},
 ice:{edge:'#ffffff',hi:'#d8f3ff',mid:'#7fd0ff',low:'#2f7fc8',deep:'#0e2b55',fleck:'#ffffff',spark:'#c8f0ff'},
 oni:{edge:'#fff0e6',hi:'#ffae7a',mid:'#ff4a2a',low:'#8a1010',deep:'#1a0505',fleck:'#ffd06a',spark:'#ff9a4a'},
 cloud:{edge:'#ffffff',hi:'#dcfff2',mid:'#7fe0c0',low:'#3a8fa0',deep:'#123040',fleck:'#ffffff',spark:'#c8fff0'},
 ash:{edge:'#fff6dc',hi:'#ffd88a',mid:'#e8a23a',low:'#6a4a3a',deep:'#1e1410',fleck:'#ffe6a0',spark:'#ffb04a'},
 twilight:{edge:'#f8f0ff',hi:'#d6c2ff',mid:'#9a7cff',low:'#3f8f6a',deep:'#1a1838',fleck:'#c8ffd8',spark:'#e0d0ff'},
 eclipse:{edge:'#fff6e0',hi:'#ffd27a',mid:'#b46cff',low:'#4a1f8a',deep:'#0c0518',fleck:'#ffe6a0',spark:'#e0b8ff'},
 abyss:{edge:'#e8fffb',hi:'#8ff0e0',mid:'#1fb6a6',low:'#1a3f6a',deep:'#040d18',fleck:'#b0fff0',spark:'#7fe8ff'},
 prism:{edge:'#ffffff',hi:'#ffe6f5',mid:'#b8a0ff',low:'#4a7aa0',deep:'#141428',fleck:'#a0fff0',spark:'#ffe08a'},
} as Record<string,Pal>);

export const BOSS_PAL:Record<string,string>={king_jelly:'jelly',mist_warden:'mist',relic_warden:'relic',crag_titan:'magma',grove_crown:'amberleaf',moon_titan:'moon',thorn_nest_mother:'thorn',greek_minotaur:'bronze',himmapan_08:'naga',desert_08:'solar',frost_08:'ice',yokai_08:'oni',
 dragon_cloud_dragon_lord:'cloud',volcano_golden_ash_zmey:'ash',fae_twilight_antler_king:'twilight',ocean_stormcrown_kraken:'storm',astral_star_eating_eclipse:'eclipse',abyss_primordial_sea_dragon:'abyss',confluence_worldcore_sovereign:'prism'};
const PREFIX_PAL:[string,string][]=[['jelly','jelly'],['mist','mist'],['relic','relic'],['crag','magma'],['grove','amberleaf'],['moon','moon'],['thorn','thorn'],['greek','bronze'],['naga','naga'],['desert','solar'],['frost','ice'],['yokai','oni']];
/** Boss palette from the caster's data id, or from a telegraph id's prefix. */
export function bossPalette(d:any):string{
 if(d?.dataId&&BOSS_PAL[d.dataId])return BOSS_PAL[d.dataId];
 const a=String(d?.attack??'');return PREFIX_PAL.find(([p])=>a.startsWith(p))?.[1]??'magma';
}
/** Which blast family draws each telegraph id (and the material it uses). */
export const FAMILY:Record<string,[string,string?]>={
 jelly_wave:['jellyWave'],jelly_burst:['blobRing'],mist_crush:['mistCrush'],mist_tide:['mistTide'],relic_warden_seal:['seal'],relic_warden_ring:['pillarRing','glyph'],
 crag_titan_fall:['fall','rock'],crag_titan_ring:['spikeRing','rock'],grove_crown_fall:['fall','amber'],grove_crown_wave:['spikeRing','wood'],moon_titan_fall:['fall','moon'],moon_titan_wave:['pillarRing','light'],
 thorn_web:['web'],thorn_eggs:['blobRing','egg'],greek_axe_cleave:['cleave','rock'],greek_axe_quake:['spikeRing','rock'],naga_water_wave:['tide'],naga_water_surge:['pillarRing','water'],
 desert_glyph:['pillarRing','glyph'],desert_beam:['beam'],frost_quake:['spikeBurst','ice'],frost_smash:['cleave','ice'],yokai_club:['cleave','fire'],yokai_wave:['fireRing'],
 endgame_focus:['orb'],endgame_fan:['cleave','energy'],endgame_cross:['cleave','energy'],endgame_trail:['spikeBurst','energy'],endgame_ring:['pillarRing','light'],endgame_quake:['spikeRing','rock'],endgame_dive:['fall','rock'],endgame_pair:['fall','rock'],endgame_split:['orb'],endgame_guard:['orb'],endgame_pull:['tide'],endgame_retreat:['orb'],
};
const BASIC=new Set(['slam','sweep','charge','spit','summon']);
EXTRA_KINDS.push(e=>e.type==='warning'?'bossTele':e.type==='bossBlast'?'bossBlast':e.type==='slam'&&e.id!=null?'bossSlam':e.type==='sweep'&&e.id!=null?'bossSweep':e.type==='spit'&&e.id!=null?'bossSpit':undefined);
Object.assign(LIFE,{bossBlast:1.7,bossSlam:1,bossSweep:.75,bossSpit:.45});
LIFE_OF.bossTele=e=>(e.duration??1)+.05;
for(const k of ['bossTele','bossBlast','bossSlam','bossSweep','bossSpit']){PALETTE_FOR[k]=e=>bossPalette(e.data);PALETTE_OF[k]='magma';}

// ---------- zone shapes on the ground ----------
type Shape={shape:string;r:number;inner:number;angle:number;fx:number;fz:number};
const shapeOf=(d:any):Shape=>({shape:d.shape??'circle',r:d.r??2,inner:d.inner??0,angle:d.angle??0,fx:d.fx??1,fz:d.fz??0});
function zonePath(v:V,o:W,s:Shape,k:number){
 const pts:Pt[]=[],out=s.shape==='ring'?s.inner+(s.r-s.inner)*k:s.r*k;
 if(s.shape==='cone'){const base=Math.atan2(s.fz,s.fx),half=s.angle*Math.PI/360;pts.push(v.P(o.x,o.z,.02));for(let i=0;i<=24;i++){const a=base-half+2*half*i/24;pts.push(v.P(o.x+Math.cos(a)*out,o.z+Math.sin(a)*out,.02));}return{outer:pts,inner:[] as Pt[]};}
 return{outer:circlePts(v,o,out,.02,64),inner:s.shape==='ring'?circlePts(v,o,s.inner,.02,64):[]};
}
function fillZone(c:CanvasRenderingContext2D,z:{outer:Pt[];inner:Pt[]},color:string,alpha:number){
 if(alpha<=0)return;c.globalAlpha=Math.min(1,alpha);c.fillStyle=color;c.beginPath();z.outer.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
 if(z.inner.length){z.inner.slice().reverse().forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();}
 c.fill('evenodd');c.globalAlpha=1;
}
/** A point inside the zone: u across (0..1 angle/around), w outward (0..1). */
function zonePoint(o:W,s:Shape,u:number,w:number):W{
 if(s.shape==='cone'){const base=Math.atan2(s.fz,s.fx),half=s.angle*Math.PI/360,a=base-half+2*half*u,r=s.r*w;return{x:o.x+Math.cos(a)*r,z:o.z+Math.sin(a)*r};}
 const a=u*TAU,r=s.shape==='ring'?s.inner+(s.r-s.inner)*w:s.r*Math.sqrt(w);return{x:o.x+Math.cos(a)*r,z:o.z+Math.sin(a)*r};
}
const SHARD:Record<string,[string,string,string,string]>={rock:['#3e2a16','#7d5a30','#6c4e2a','#c2914a'],wood:['#2e1d0e','#6b4a22','#5a3d1c','#a7d45a'],ice:['#1d4d7a','#6fb7e6','#5aa3d6','#eaf8ff'],fire:['#2a0a06','#8a2a14','#6e1e0e','#ffb070'],energy:['#1b1838','#5f4fb0','#4a3e94','#e6dcff']};
const ROCK:Record<string,[string,string]>={rock:['#5a4430','#c8a878'],amber:['#9a5a12','#ffd27a'],moon:['#8f98c8','#ffffff'],ice:['#4f8fc8','#eaf8ff'],fire:['#3a1208','#ff9a4a'],energy:['#2a2050','#d6c8ff']};

// ---------- blast families ----------
type Blast=(v:V,e:Fx,o:W,age:number,P:Pal,ph:'pre'|'post',s:Shape,mat:string)=>void;
const F:Record<string,Blast>={
 jellyWave(v,e,o,age,P,ph,s){
  if(ph==='pre'){groundGlow(v,o,s.r*.8,P,(1-smooth(.8,1.7,age))*.8);return;}
  const base=Math.atan2(s.fz,s.fx),half=s.angle*Math.PI/360;
  for(let i=0;i<3;i++){const R=s.r*easeOut((age-i*.09)/.5);if(R<=.3)continue;const f2=1-smooth(.35+i*.08,.8,age);paintBlade(v,arcRibbon(v,o,{R,T:1.6-i*.35,from:base-half,to:base+half,seed:40+i,fade:f2,jag:.5,n:36}),P,{alpha:f2,seed:40+i,flecks:8});}
  for(let i=0;i<34;i++){const t=clamp((age-hash(i)*.15)/.6),w=t*(.4+.6*hash(i*3.3)),q=zonePoint(o,s,hash(i*7.7),w),h=Math.sin(t*Math.PI)*(.6+hash(i*2)*1.2),p=v.P(q.x,q.z,h),r=v.S*(.16+.2*hash(i*5))*(1-t*.4);if(t<=0||t>=1)continue;v.fx.globalAlpha=1-t*.6;v.fx.fillStyle=i%4?P.mid:P.fleck;v.fx.beginPath();v.fx.arc(p.x,p.y,r,0,TAU);v.fx.fill();v.fx.fillStyle=P.edge;v.fx.beginPath();v.fx.arc(p.x-r*.3,p.y-r*.35,r*.3,0,TAU);v.fx.fill();}
  v.fx.globalAlpha=1;sparkBurst(v,{x:o.x+s.fx*s.r*.8,z:o.z+s.fz*s.r*.8,h:.5},age-.25,P,16,3,4,.5);
 },
 /** Rounded blobs (jelly spikes or bursting eggs) rising through a ring band. */
 blobRing(v,e,o,age,P,ph,s,mat){
  const fade=1-smooth(.8,1.7,age);
  if(ph==='pre'){groundGlow(v,o,s.r,P,fade*.7);shockRing(v,o,s.inner+(s.r-s.inner)*easeOut(age/.3),P,1-smooth(.1,.5,age),3.5);return;}
  for(let i=0;i<22;i++){const q=zonePoint(o,s,i/22+hash(i)*.03,.2+.6*hash(i*3.1)),rise=easeOut((age-hash(i*5)*.12)/.12)*(1-smooth(.6,1.1,age)),egg=mat==='egg',h=v.S*(egg?.7+.4*hash(i*2.2):1+1.2*hash(i*2.2))*rise,w=v.S*(egg?.4:.35+.2*hash(i*7)),b=v.P(q.x,q.z,0);if(h<1)continue;
   const g=v.fx.createLinearGradient(0,b.y,0,b.y-h);g.addColorStop(0,egg?P.deep??P.low:P.low);g.addColorStop(.6,P.mid);g.addColorStop(1,P.hi);v.fx.globalAlpha=.92;v.fx.fillStyle=g;v.fx.beginPath();
   if(egg){v.fx.ellipse(b.x,b.y-h*.5,w,h*.55,0,0,TAU);}else{v.fx.moveTo(b.x-w,b.y);v.fx.quadraticCurveTo(b.x-w*.9,b.y-h*.7,b.x,b.y-h);v.fx.quadraticCurveTo(b.x+w*.9,b.y-h*.7,b.x+w,b.y);v.fx.closePath();}v.fx.fill();
   v.fx.fillStyle=egg?P.fleck:P.edge;v.fx.globalAlpha=.7;v.fx.beginPath();v.fx.ellipse(b.x-w*.3,b.y-h*.65,w*.15,h*.12,0,0,TAU);v.fx.fill();
   if(egg){v.fx.globalAlpha=.6;v.fx.fillStyle=shade(P.low,-.3);for(let k=0;k<6;k++){v.fx.beginPath();v.fx.arc(b.x+(hash(i*9+k)-.5)*w*1.2,b.y-h*(.2+.6*hash(i*7+k)),w*.07,0,TAU);v.fx.fill();}}
   v.fx.globalAlpha=.85;v.fx.strokeStyle='rgba(20,8,20,.7)';v.fx.lineWidth=Math.max(1,v.S*.04);v.fx.beginPath();if(egg)v.fx.ellipse(b.x,b.y-h*.5,w,h*.55,0,0,TAU);else{v.fx.moveTo(b.x-w,b.y);v.fx.quadraticCurveTo(b.x-w*.9,b.y-h*.7,b.x,b.y-h);v.fx.quadraticCurveTo(b.x+w*.9,b.y-h*.7,b.x+w,b.y);}v.fx.stroke();}
  v.fx.globalAlpha=1;for(let i=0;i<6;i++)sparkBurst(v,{...zonePoint(o,s,i/6,.5),h:.8},age-.05,P,6,i*9,3.5,.5);
 },
 mistCrush(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.7,age),drop=clamp(age/.14),imp=age-.14,hit=v.P(o.x,o.z,.3);
  if(ph==='pre'){if(imp>0){groundGlow(v,o,s.r*1.1,P,fade);cracks(v,o,s.r*1.1,10,61,easeOut(imp/.1),P,fade);shockRing(v,o,.5+s.r*1.2*easeOut(imp/.35),P,1-smooth(.1,.45,imp),4);dust(v,o,s.r*.9,clamp(imp/1.2),.85*fade,22,8,'#a9c9bc');}return;}
  const top=6*(1-easeOut(drop)),c0=v.P(o.x,o.z,top+1.6),bt=v.P(o.x,o.z,0);
  if(imp<.3){const a=imp<0?.9:1-imp/.3,w=v.S*s.r*.55,g=v.glow.createLinearGradient(0,c0.y-v.S*3,0,bt.y);g.addColorStop(0,P.mid+'00');g.addColorStop(.5,P.mid+'aa');g.addColorStop(1,P.hi);v.glow.globalAlpha=a;v.glow.fillStyle=g;v.glow.fillRect(bt.x-w,c0.y-v.S*3,w*2,bt.y-c0.y+v.S*3);v.glow.globalAlpha=1;dust(v,o,.4,.2,a*.8,8,3,'#5c7d71');}
  if(imp>0){flash(v,hit,v.S*5,P,(1-imp/.25)*.8);starBurst(v,hit,v.S*3.4*easeOut(imp/.07),P,1-smooth(.12,.4,imp),11);for(let i=0;i<12;i++)streak(v,{...zonePoint(o,s,i/12,.6),h:.2},{x:0,z:0,h:4},imp-hash(i)*.2,.6,P.hi,.12);}
 },
 mistTide(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.7,age);
  if(ph==='pre'){groundGlow(v,o,s.r,P,fade*.6);for(let i=0;i<7;i++){const r=s.inner+(s.r-s.inner)*(.15+i*.12),a1=hash(i*3.3)*TAU+age*(i%2?1.3:-1.3)*2,len=1+hash(i*5)*1.2,st:Stroke={a0:a1-len,a1,r,h:.15,T:.45,tilt:.05,ph:0,seed:70+i};paintBlade(v,windStroke(v,o,st,st.a0,st.a1,fade),P,{alpha:fade*clamp(age/.1),seed:70+i,flecks:0,glow:.6});}return;}
  for(let i=0;i<40;i++){const q=zonePoint(o,s,hash(i*1.7)+age*.12*(i%2?1:-1),hash(i*4.4));dust(v,q,.01,clamp(age/1.4),.75*fade,1,i,i%3?'#cfe6dc':'#8fb3a5');}
  for(let i=0;i<16;i++)streak(v,{...zonePoint(o,s,i/16,.5),h:.3},{x:0,z:0,h:3.5},age-hash(i)*.4,.7,P.hi,.14);
 },
 seal(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.7,age),hit=v.P(o.x,o.z,.3);
  if(ph==='pre'){runeCircle(v,o,s.r,P,1-smooth(.2,1,age),v.time*.6,'holy');groundGlow(v,o,s.r*1.2,P,fade);shockRing(v,o,.4+s.r*1.3*easeOut(age/.4),P,1-smooth(.1,.5,age),4);return;}
  beam(v,o,10,s.r*.45,P,1-smooth(.05,.8,age));flash(v,hit,v.S*6,P,(1-age/.25)*.9);starBurst(v,hit,v.S*3.2*easeOut(age/.07),P,1-smooth(.12,.4,age),13);
  for(let i=0;i<14;i++){const q=zonePoint(o,s,hash(i*2),hash(i*5)),pf=clamp((age-hash(i)*.3)/.9),p=v.P(q.x,q.z,pf*5);if(pf<=0||pf>=1)continue;v.fx.globalAlpha=1-pf;v.fx.fillStyle=i%2?P.hi:P.fleck;diamond(v.fx,p.x,p.y,v.S*.16,Math.PI/2);v.fx.fill();}
  v.fx.globalAlpha=1;sparkBurst(v,{x:o.x,z:o.z,h:.5},age,P,20,5,5,.55);
 },
 /** Something drops out of the sky onto the zone: boulder, amber crystal, moon shard or ice block. */
 fall(v,e,o,age,P,ph,s,mat){
  const fade=1-smooth(.8,1.7,age),fall=clamp(age/.2),imp=age-.2,hit=v.P(o.x,o.z,.3),R=Math.min(3,s.r);
  if(ph==='pre'){if(imp>0){groundGlow(v,o,R*1.2,P,fade);cracks(v,o,R*1.3,12,17,easeOut(imp/.1),P,fade);shockRing(v,o,.5+R*1.4*easeOut(imp/.4),P,1-smooth(.1,.5,imp),4);if(mat==='rock')dustCloud(v,o,R*1.1,clamp(imp/1.4),fade,9);else dust(v,o,R,clamp(imp/1.3),.85*fade,22,9,mat==='moon'||mat==='ice'?'#c9d6ea':'#7d6a58');}return;}
  if(imp<0){const h=9*(1-fall*fall),p=v.P(o.x,o.z,h+1),rr=v.S*R*.42,[dark,lite]=ROCK[mat]??ROCK.rock;
   polyline(v.glow,[v.P(o.x,o.z,h+4),p],v.S*.5,P.mid,.6);polyline(v.fx,[v.P(o.x,o.z,h+3),p],2,P.hi,.6);
   if(mat==='moon'){const g=v.fx.createRadialGradient(p.x-rr*.35,p.y-rr*.4,rr*.1,p.x,p.y,rr);g.addColorStop(0,'#ffffff');g.addColorStop(.6,lite);g.addColorStop(1,dark);v.fx.fillStyle=g;v.fx.beginPath();v.fx.arc(p.x,p.y,rr,0,TAU);v.fx.fill();
    for(let k=0;k<5;k++){const ca=hash(k*3)*TAU,cr=rr*(.15+.12*hash(k*5)),cd=rr*.55*hash(k*7);v.fx.fillStyle=shade(dark,-.1);v.fx.globalAlpha=.55;v.fx.beginPath();v.fx.arc(p.x+Math.cos(ca)*cd,p.y+Math.sin(ca)*cd,cr,0,TAU);v.fx.fill();}
    v.fx.globalAlpha=1;v.fx.strokeStyle='rgba(20,24,50,.7)';v.fx.lineWidth=Math.max(1,rr*.06);v.fx.beginPath();v.fx.arc(p.x,p.y,rr,0,TAU);v.fx.stroke();glint(v,p,rr*1.3,.6,0,P);}
   else if(mat==='amber'||mat==='ice'){const n=6;v.fx.save();v.fx.translate(p.x,p.y);v.fx.rotate(fall*1.2);const pts:Pt[]=[];for(let k=0;k<n;k++){const a2=k/n*TAU,r2=rr*(k%2?.62:1.15);pts.push({x:Math.cos(a2)*r2,y:Math.sin(a2)*r2});}
    for(let k=0;k<n;k++){const q=pts[k],q2=pts[(k+1)%n],lit=Math.cos(k/n*TAU-.8)*.5+.5;v.fx.fillStyle=shade(lite,(lit-.55)*.9);v.fx.beginPath();v.fx.moveTo(0,0);v.fx.lineTo(q.x,q.y);v.fx.lineTo(q2.x,q2.y);v.fx.closePath();v.fx.fill();}
    v.fx.strokeStyle=shade(dark,-.5);v.fx.lineWidth=Math.max(1,rr*.07);v.fx.beginPath();pts.forEach((q,k)=>k?v.fx.lineTo(q.x,q.y):v.fx.moveTo(q.x,q.y));v.fx.closePath();v.fx.stroke();v.fx.restore();glint(v,p,rr*.9,.6,0,P);}
   else{for(let k=1;k<=5;k++){const q=v.P(o.x,o.z,h+1+k*.7);polyline(v.glow,[q,p],v.S*(.9-k*.12),P.mid,.5-k*.08);}boulder(v.fx,p.x,p.y,rr*1.25,fall*1.2,dark,lite,7);}
   return;}
  flash(v,hit,v.S*6,P,(1-imp/.28)*.85);starBurst(v,hit,v.S*4*easeOut(imp/.07),P,1-smooth(.14,.42,imp),23);rocks(v,o,imp,22,31,1.6,ROCK[mat]??ROCK.rock);sparkBurst(v,{x:o.x,z:o.z,h:.4},imp,P,26,7,6,.6);
 },
 /** Shards erupt through a ring band in a wave around the caster. */
 spikeRing(v,e,o,age,P,ph,s,mat){
  const fade=1-smooth(.8,1.7,age),heroY=v.heroY,n=Math.round(14+s.r*2.4),shards:{base:W;out:{x:number;z:number};h:number;w:number;seed:number;y:number}[]=[];
  for(let i=0;i<n;i++){const u=i/n,a=u*TAU,out={x:Math.cos(a),z:Math.sin(a)},r=s.inner+(s.r-s.inner)*(.2+.6*hash(i*3.3)),base={x:o.x+out.x*r,z:o.z+out.z*r},rise=easeOut((age-u*.25)/.1)*(1-smooth(1.1,1.6,age));shards.push({base,out,h:(.7+.8*hash(i*2.7))*rise,w:.6+.4*hash(i*9.3),seed:i,y:v.P(base.x,base.z,0).y});}
  const cols=SHARD[mat]??SHARD.rock,stone=mat==='rock',draw=(back:boolean)=>{for(const sh of shards.filter(q=>(q.y<heroY)===back).sort((a,b)=>a.y-b.y)){if(stone)stonePillar(v,sh.base,sh.h*1.4,sh.w*.9,Math.atan2(sh.out.z,sh.out.x),{x:sh.out.x*.18,z:sh.out.z*.18},Math.min(1,fade*1.4),sh.seed);else rockShard(v,sh.base,sh.out,sh.h,sh.w,P,Math.min(1,fade*1.4),sh.seed,cols);}};
  if(ph==='pre'){groundGlow(v,o,s.r,P,fade*.7);for(let i=0;i<10;i++){const a=i/10*TAU,m=(s.inner+s.r)/2;cracks(v,{x:o.x+Math.cos(a)*m,z:o.z+Math.sin(a)*m},1.6,4,i*7,easeOut(age/.15),P,fade);}if(stone)for(let i=0;i<8;i++){const a=i/8*TAU;dustCloud(v,{x:o.x+Math.cos(a)*(s.inner+s.r)/2,z:o.z+Math.sin(a)*(s.inner+s.r)/2},1.3,clamp((age-i/8*.25)/1.3),fade,i*7);}else dust(v,o,s.r*.85,clamp(age/1.3),.7*fade,30,13,mat==='ice'?'#d6e6f2':'#7d6a58');draw(true);return;}
  draw(false);for(let i=0;i<8;i++)sparkBurst(v,{...zonePoint(o,s,i/8,.5),h:.4},age-i/8*.25,P,6,i*5,4,.5);
 },
 /** Columns rising around a ring: holy light, glyph light (with rune circles) or water geysers. */
 pillarRing(v,e,o,age,P,ph,s,mat){
  const fade=1-smooth(.8,1.7,age),n=Math.max(8,Math.round(s.r*1.7)),m=(s.inner+s.r)/2;
  if(ph==='pre'){if(mat==='glyph'){runeCircle(v,o,s.r,P,1-smooth(.3,1.1,age),-v.time*.5,'holy');runeCircle(v,o,s.inner,P,1-smooth(.3,1.1,age),v.time*.7,'holy');}groundGlow(v,o,s.r,P,fade*.6);if(mat==='water')shockRing(v,o,s.inner+(s.r-s.inner)*easeOut(age/.5),P,1-smooth(.2,.7,age),3);return;}
  for(let i=0;i<n;i++){const a=i/n*TAU,w={x:o.x+Math.cos(a)*m,z:o.z+Math.sin(a)*m},b=age-i*(.3/n);if(b<0)continue;beam(v,w,mat==='water'?5:7,mat==='water'?.7:.55,P,1-smooth(.1,.7,b));burst(v,{...w,h:.2},b,.3,.9,P);
   if(mat==='water')for(let k=0;k<5;k++){const t=b-k*.03;if(t<0||t>.7)continue;const sp=1+hash(i*5+k)*1.5,an=hash(i*3+k)*TAU,q=v.P(w.x+Math.cos(an)*sp*t,w.z+Math.sin(an)*sp*t,4*t-5*t*t+.3);v.fx.globalAlpha=1-t/.7;v.fx.fillStyle=k%2?P.hi:P.edge;v.fx.beginPath();v.fx.arc(q.x,q.y,v.S*.08,0,TAU);v.fx.fill();}}
  v.fx.globalAlpha=1;flash(v,v.P(o.x,o.z,1),v.S*7,P,(1-age/.3)*.5);shockRing(v,o,s.r+1.5*easeOut(age/.5),P,1-smooth(.2,.7,age),3);
 },
 /** A heavy weapon/claw arc sweeps across the cone, leaving cracks and shards along its edge. */
 cleave(v,e,o,age,P,ph,s,mat){
  if(s.shape==='circle'){F.orb(v,e,o,age,P,ph,s,mat);return;}
  if(s.angle<40){F.beam(v,e,o,age,P,ph,s,mat);return;}
  const fade=1-smooth(.6,1.4,age),base=Math.atan2(s.fz,s.fx),half=s.angle*Math.PI/360,L=.4,tl=age/L,head=easeOut(tl/.6),tail=clamp((tl-.25)/.75)**1.5;
  if(ph==='pre'){groundGlow(v,{x:o.x+s.fx*s.r*.5,z:o.z+s.fz*s.r*.5},s.r*.6,P,fade*.8);for(let i=0;i<5;i++){const a=base-half+2*half*(i+.5)/5,len=s.r*easeOut(age/.15),pts:Pt[]=[];let ang=a;for(let k=0;k<=6;k++){ang+=(hash(i*13+k)-.5)*.12;pts.push(v.P(o.x+Math.cos(ang)*len*k/6,o.z+Math.sin(ang)*len*k/6,.02));}polyline(v.glow,pts,5,P.mid,fade*.8);polyline(v.fx,pts,1.6,P.edge,fade);}dust(v,{x:o.x+s.fx*s.r*.6,z:o.z+s.fz*s.r*.6},s.r*.45,clamp(age/1),.6*fade,16,5,mat==='ice'?'#d6e6f2':'#9a8a76');return;}
  if(tl<=1){const R=s.r*.78;paintBlade(v,arcRibbon(v,o,{R,T:s.r*.32,from:base-half+2*half*tail,to:base-half+2*half*head,h:.8,tilt:.25,seed:91,fade:1-smooth(.5,1,tl),jag:.5,n:40}),P,{alpha:Math.min(1,tl*10)*(1-smooth(.6,1,tl)),seed:91,flecks:10});}
  const hit=v.P(o.x+s.fx*s.r*.7,o.z+s.fz*s.r*.7,.3);flash(v,hit,v.S*4,P,(1-age/.25)*.6);
  for(let i=0;i<7;i++){const q=zonePoint(o,s,(i+.5)/7,.85),out={x:Math.cos(Math.atan2(q.z-o.z,q.x-o.x)),z:Math.sin(Math.atan2(q.z-o.z,q.x-o.x))},rise=easeOut((age-.1-i*.02)/.1)*(1-smooth(.9,1.3,age));if(mat==='rock')stonePillar(v,q,(.7+.7*hash(i))*rise,.55,Math.atan2(out.z,out.x),{x:out.x*.25,z:out.z*.25},fade,i);else rockShard(v,q,out,(.5+.5*hash(i))*rise,.5,P,fade,i,SHARD[mat]??SHARD.rock);}
  if(mat==='rock')dustCloud(v,zonePoint(o,s,.5,.8),s.r*.3,clamp((age-.1)/1.2),fade,13);
  sparkBurst(v,{x:o.x+s.fx*s.r*.7,z:o.z+s.fz*s.r*.7,h:.6},age-.05,P,16,7,5,.5);
 },
 /** A straight beam along a narrow cone. */
 beam(v,e,o,age,P,ph,s){
  const fade=1-smooth(.5,1.2,age),half=s.angle*Math.PI/360,end={x:o.x+s.fx*s.r,z:o.z+s.fz*s.r},w=Math.max(.5,Math.tan(half)*s.r),grow=easeOut(age/.12);
  if(ph==='pre'){groundGlow(v,{x:o.x+s.fx*s.r*.5,z:o.z+s.fz*s.r*.5},s.r*.5,P,fade*.8);for(let i=0;i<8;i++)cracks(v,{x:o.x+s.fx*s.r*(i+1)/9,z:o.z+s.fz*s.r*(i+1)/9},w*.7,3,i*11,grow,P,fade);return;}
  const px=-s.fz,pz=s.fx,len=s.r*grow,band=(scale:number,h:number)=>{const L=v.P(o.x+px*w*.15*scale,o.z+pz*w*.15*scale,h),R=v.P(o.x-px*w*.15*scale,o.z-pz*w*.15*scale,h),L2=v.P(o.x+s.fx*len+px*w*scale,o.z+s.fz*len+pz*w*scale,h),R2=v.P(o.x+s.fx*len-px*w*scale,o.z+s.fz*len-pz*w*scale,h);return[L,L2,R2,R];};
  for(const [L,k,col,al] of [[v.glow,1,P.mid,.8],[v.glow,.5,P.hi,1],[v.fx,.2,P.edge,.9]] as [CanvasRenderingContext2D,number,string,number][]){const q=band(k,1.2);L.globalAlpha=fade*al;L.fillStyle=col;L.beginPath();q.forEach((p,i)=>i?L.lineTo(p.x,p.y):L.moveTo(p.x,p.y));L.closePath();L.fill();}
  v.glow.globalAlpha=v.fx.globalAlpha=1;flash(v,v.P(o.x,o.z,1.2),v.S*3,P,fade);burst(v,{...end,h:1.2},age,.35,1.2,P);
  for(let i=0;i<12;i++){const t=hash(i*3.3),q={x:o.x+s.fx*len*t,z:o.z+s.fz*len*t,h:1.2};streak(v,q,{x:px*(hash(i)-.5)*6,z:pz*(hash(i)-.5)*6,h:2},age-t*.1,.4,P.spark,.05);}
 },
 /** Water rings roll outward through a ring band, with crashing spray. */
 tide(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.7,age);
  if(ph==='pre'){groundGlow(v,o,s.r,P,fade*.7);for(let i=0;i<4;i++){const r=s.inner+(s.r-s.inner)*easeOut((age-i*.12)/.7);if(r>s.inner)shockRing(v,o,r,P,(1-smooth(.3,.9,age-i*.12))*.9,3.5-i*.5);}return;}
  for(let w=0;w<3;w++){const R=s.inner+(s.r-s.inner)*(.25+w*.3),n=Math.round(R*1.1);for(let i=0;i<n;i++){const an=i/n*TAU+w*.4,t=(age-w*.18-hash(i*3+w)*.08)/1.1;toonSplash(v,{x:o.x+Math.cos(an)*R,z:o.z+Math.sin(an)*R},.8+.3*hash(i+w*9),t,P,i*13+w*101);}}
  v.fx.globalAlpha=1;
 },
 /** Flame tongues leap around a ring band. */
 fireRing(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.7,age),k=Math.min(1,age/.12)*fade;
  if(ph==='pre'){groundGlow(v,o,s.r,P,fade);shockRing(v,o,s.inner+(s.r-s.inner)*easeOut(age/.35),P,1-smooth(.1,.5,age),4);dust(v,o,s.r*.85,clamp(age/1.4),.5*fade,24,11,'#3a1a10');return;}
  for(let i=0;i<6;i++){const an=i/6*TAU+.3,q=zonePoint(o,s,i/6+.05,.55);swirlColumn(v,q,4.5,.5,1.3,(age-i*.05)/1.6,P,i*17);void an;}
  const c=v.fx,n=Math.round(s.r*2.5);
  for(let j=0;j<n;j++){const q=zonePoint(o,s,j/n+hash(j)*.02,.3+.5*hash(j*3)),b=v.P(q.x,q.z,0),hgt=v.S*(1.2+1.6*(.5+.5*Math.sin(v.time*8+j*1.7)))*k,sway=Math.sin(v.time*6+j)*v.S*.25,w=v.S*(.3+.15*hash(j*5));
   const g=c.createLinearGradient(0,b.y,0,b.y-hgt);g.addColorStop(0,P.mid);g.addColorStop(.45,P.hi+'cc');g.addColorStop(1,P.hi+'00');c.globalAlpha=k*.85;c.fillStyle=g;c.globalCompositeOperation='lighter';c.beginPath();c.moveTo(b.x-w,b.y);c.quadraticCurveTo(b.x-w*.4+sway*.5,b.y-hgt*.5,b.x+sway,b.y-hgt);c.quadraticCurveTo(b.x+w*.4+sway*.5,b.y-hgt*.5,b.x+w,b.y);c.closePath();c.fill();c.globalCompositeOperation='source-over';}
  c.globalAlpha=1;flash(v,v.P(o.x,o.z,1),v.S*6,P,(1-age/.25)*.5);for(let i=0;i<8;i++)sparkBurst(v,{...zonePoint(o,s,i/8,.5),h:.6},age-hash(i)*.2,P,6,i*3,3.5,.6);
 },
 /** Thorn web: the web glows, then thorns stab up along its strands. */
 web(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.7,age);
  if(ph==='pre'){webLines(v,o,s.r,P,fade);groundGlow(v,o,s.r,P,fade*.6);return;}
  for(let i=0;i<20;i++){const q=zonePoint(o,s,hash(i*2.3),.15+.85*hash(i*5.1)),out={x:Math.cos(hash(i)*TAU),z:Math.sin(hash(i)*TAU)},rise=easeOut((age-hash(i*7)*.1)/.08)*(1-smooth(.8,1.3,age));rockShard(v,q,out,(.6+.6*hash(i*3))*rise,.3,P,fade,i,['#2a1030','#6b2f7a','#4a1f58','#c8f07a']);}
  for(let i=0;i<5;i++)sparkBurst(v,{...zonePoint(o,s,i/5,.6),h:.5},age,P,6,i*7,3,.5);flash(v,v.P(o.x,o.z,.5),v.S*3,P,(1-age/.2)*.5);
 },
 /** Small eruption of shards from one point (ice spikes, trail bursts). */
 spikeBurst(v,e,o,age,P,ph,s,mat){
  const fade=1-smooth(.6,1.3,age),R=Math.max(1,Math.min(3,s.r));
  if(ph==='pre'){groundGlow(v,o,R*1.2,P,fade);cracks(v,o,R*1.2,8,13,easeOut(age/.1),P,fade);shockRing(v,o,.3+R*1.2*easeOut(age/.3),P,1-smooth(.1,.45,age),3);return;}
  for(let i=0;i<12;i++){const a=i/12*TAU+hash(i)*.3,out={x:Math.cos(a),z:Math.sin(a)},r=R*(.2+.5*hash(i*3)),rise=easeOut((age-hash(i*5)*.06)/.08)*(1-smooth(.7,1.2,age));rockShard(v,{x:o.x+out.x*r,z:o.z+out.z*r},out,(.6+.8*hash(i*2))*rise*R/2,.45,P,fade,i,SHARD[mat]??SHARD.rock);}
  const hit=v.P(o.x,o.z,.3);starBurst(v,hit,v.S*R*1.2*easeOut(age/.07),P,1-smooth(.12,.36,age),37);sparkBurst(v,{x:o.x,z:o.z,h:.4},age,P,12,5,4,.45);
 },
 /** Energy orb drops into a focus circle (end-game marks). */
 orb(v,e,o,age,P,ph,s){
  const fade=1-smooth(.8,1.6,age),R=Math.min(3,s.r),drop=clamp(age/.16),imp=age-.16,hit=v.P(o.x,o.z,.3);
  if(ph==='pre'){runeCircle(v,o,R,P,1-smooth(.2,1,age),v.time*.8,'holy');if(imp>0){groundGlow(v,o,R*1.2,P,fade);shockRing(v,o,.4+R*1.3*easeOut(imp/.35),P,1-smooth(.1,.45,imp),3.5);}return;}
  if(imp<0){const p=v.P(o.x,o.z,7*(1-drop*drop)+1);polyline(v.glow,[v.P(o.x,o.z,9),p],v.S*.6,P.mid,.8);glint(v,p,v.S*R*.35,1,v.time*3,P);return;}
  flash(v,hit,v.S*5,P,(1-imp/.25)*.85);starBurst(v,hit,v.S*R*1.2*easeOut(imp/.07),P,1-smooth(.12,.4,imp),41);beam(v,o,6,R*.3,P,1-smooth(.05,.5,imp));sparkBurst(v,{x:o.x,z:o.z,h:.4},imp,P,18,9,5,.55);
 },
};
function webLines(v:V,o:W,r:number,P:Pal,a:number){
 if(a<=0)return;for(let i=0;i<8;i++){const an=i/8*TAU,pts=[v.P(o.x,o.z,.03),v.P(o.x+Math.cos(an)*r,o.z+Math.sin(an)*r,.03)];polyline(v.glow,pts,3,P.mid,a*.6);polyline(v.fx,pts,1,P.hi,a);}
 for(const f of [.35,.65,.95]){const pts:Pt[]=[];for(let i=0;i<=8;i++){const an=i/8*TAU,rr=r*f*(i%2?.92:1);pts.push(v.P(o.x+Math.cos(an)*rr,o.z+Math.sin(an)*rr,.03));}polyline(v.glow,pts,3,P.mid,a*.6);polyline(v.fx,pts,1,P.hi,a);}
}

// ---------- painters ----------
const B:Record<string,(v:V,e:Fx,o:W,age:number,P:Pal,ph:'pre'|'post')=>void>={
 /** Wind-up: red zone that fills from its inner edge, a pulsing rim and the boss's own marks. */
 bossTele(v,e,o,age,P,ph){
  const d=e.data,s=shapeOf(d),dur=d.duration??1,k=clamp(age/dur),D=PALS.danger,attack=String(d.attack??''),late=smooth(.75,1,k),[fam,mat]=familyOf(d)??[''];
  if(ph==='pre'){
   const full=zonePath(v,o,s,1),prog=zonePath(v,o,s,easeOut(k));
   fillZone(v.fx,full,D.low,.16+.06*Math.sin(v.time*10));fillZone(v.fx,prog,D.mid,.22+.12*late);
   fillZone(v.glow,prog,D.mid,.25+.35*late);
   polyline(v.glow,full.outer,5,D.mid,.7+.3*late,s.shape!=='cone');polyline(v.fx,full.outer,1.8,D.edge,.9,s.shape!=='cone');
   if(full.inner.length){polyline(v.glow,full.inner,4,D.mid,.6,true);polyline(v.fx,full.inner,1.4,D.edge,.8,true);}
   if(s.shape!=='cone')for(let i=0;i<16;i++){const a0=i/16*TAU+v.time*(BASIC.has(attack)?1.5:.8),pts:Pt[]=[];for(let j=0;j<=4;j++){const a=a0+j*.04;pts.push(v.P(o.x+Math.cos(a)*s.r*1.04,o.z+Math.sin(a)*s.r*1.04,.03));}polyline(v.glow,pts,4,P.mid,.7);polyline(v.fx,pts,1.6,P.edge,.9);}
   // family marks while it winds up
   if(fam==='seal'||fam==='orb')runeCircle(v,o,Math.min(3,s.r)*.95,P,.35+.65*k,v.time*.9,'holy');
   if(fam==='pillarRing'&&mat==='glyph'){runeCircle(v,o,s.r*.98,P,.3+.5*k,-v.time*.5,'holy');for(let i=0;i<12;i++){const a=i/12*TAU-v.time*.4,m=(s.inner+s.r)/2,q=v.P(o.x+Math.cos(a)*m,o.z+Math.sin(a)*m,.04);v.fx.globalAlpha=.5+.5*k;v.fx.fillStyle=P.hi;diamond(v.fx,q.x,q.y,v.S*.22,Math.PI/2);v.fx.fill();glint(v,q,v.S*.18,k*.6,0,P);}v.fx.globalAlpha=1;}
   if(fam==='fall'){const q=v.P(o.x,o.z,0),rr=v.S*Math.min(3,s.r)*.7*easeOut(k);v.fx.save();v.fx.translate(q.x,q.y);v.fx.scale(1,.5);v.fx.globalAlpha=.25+.4*k;v.fx.fillStyle='#120804';v.fx.beginPath();v.fx.arc(0,0,rr,0,TAU);v.fx.fill();v.fx.restore();v.fx.globalAlpha=1;}
   if(fam==='spikeRing'||fam==='fireRing')for(let i=0;i<10;i++){const a=i/10*TAU,m=(s.inner+s.r)/2;cracks(v,{x:o.x+Math.cos(a)*m,z:o.z+Math.sin(a)*m},1.2*k,3,i*7,k,P,.5+.5*k);}
   if(fam==='web')webLines(v,o,s.r,P,.3+.6*k);
   if(fam==='mistCrush'||fam==='mistTide'){const tide=fam==='mistTide',n=tide?26:14;for(let i=0;i<n;i++){const q=zonePoint(o,s,(hash(i*3.1)+v.time*(tide?.05:.15))%1,tide?hash(i*5.7):1-k*.6*hash(i*5.7));dust(v,q,.01,.3+.4*k,.45+.3*k,1,i,P.hi);}}
   if(fam==='jellyWave'||fam==='blobRing'||fam==='tide'){for(let i=0;i<18;i++){const ph2=(v.time*.8+hash(i*2.2))%1,q=zonePoint(o,s,hash(i*4.1),hash(i*6.3)),p=v.P(q.x,q.z,ph2*1.2),r=v.S*(.06+.1*hash(i))*(1-ph2*.5);v.fx.globalAlpha=(.4+.5*k)*(1-ph2);v.fx.fillStyle=P.mid;v.fx.beginPath();v.fx.arc(p.x,p.y,r,0,TAU);v.fx.fill();v.fx.fillStyle=P.edge;v.fx.beginPath();v.fx.arc(p.x-r*.3,p.y-r*.3,r*.35,0,TAU);v.fx.fill();}v.fx.globalAlpha=1;}
   if(fam==='cleave'||fam==='beam'){const base=Math.atan2(s.fz,s.fx);for(let i=0;i<4;i++){const t=(v.time*.7+i/4)%1,r=s.r*t,a=base,q=v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,.04);v.fx.globalAlpha=(1-t)*(.4+.5*k);v.fx.fillStyle=P.hi;diamond(v.fx,q.x,q.y,v.S*.25,a);v.fx.fill();}v.fx.globalAlpha=1;}
   if(attack==='summon')runeCircle(v,o,s.r,P,.3+.7*k,v.time*1.2,'blood');
  }else if(late>0){
   const full=zonePath(v,o,s,1);polyline(v.glow,full.outer,8,D.hi,late*.6*(.5+.5*Math.sin(v.time*30)),s.shape!=='cone');
  }
 },
 bossBlast(v,e,o,age,P,ph){
  const d=e.data,s=shapeOf(d),[fam,mat]=familyOf(d)??['generic'];
  if(fam.startsWith('sig:')){SIG[fam.slice(4)]?.(v,e,o,age,P,ph,s);return;}
  const f=F[fam];
  if(f){f(v,e,o,age,P,ph,s,mat??'rock');return;}
  const fade=1-smooth(.8,1.7,age);if(ph==='pre'){shockRing(v,o,.4+s.r*easeOut(age/.4),P,1-smooth(.1,.5,age),3);dust(v,o,s.r*.8,clamp(age/1),.6*fade,16,3);}else flash(v,v.P(o.x,o.z,.3),v.S*4,P,(1-age/.25)*.7);
 },
 bossSlam(v,e,o,age,P,ph){
  const fade=1-smooth(.4,1,age),jelly=bossPalette(e.data)==='jelly';
  if(ph==='pre'){groundGlow(v,o,2.6,P,fade*.7);if(!jelly)cracks(v,o,2.4,9,21,easeOut(age/.1),P,fade);shockRing(v,o,.5+2.4*easeOut(age/.35),P,1-smooth(.1,.45,age),3.5);dust(v,o,2,clamp(age/.9),.7*fade,16,5,jelly?'#f7c7dc':'#c9b79f');return;}
  const p=v.P(o.x,o.z,.3);flash(v,p,v.S*4,P,(1-age/.22)*.75);starBurst(v,p,v.S*2.6*easeOut(age/.07),P,1-smooth(.12,.36,age),31);
  if(jelly){for(let i=0;i<16;i++){const a=i/16*TAU+hash(i),sp=2+hash(i*3)*3,t=age,r=.4+sp*t,h=(2+hash(i*5)*2)*t-5*t*t;if(h<0)continue;const q=v.P(o.x+Math.cos(a)*r,o.z+Math.sin(a)*r,h),rr=v.S*(.1+.1*hash(i*7));v.fx.fillStyle=P.mid;v.fx.beginPath();v.fx.arc(q.x,q.y,rr,0,TAU);v.fx.fill();}}else rocks(v,o,age,12,41,1.2);
  sparkBurst(v,{x:o.x,z:o.z,h:.4},age,P,14,9,4,.45);
 },
 bossSweep(v,e,o,age,P,ph){
  if(ph!=='post')return;const L=.6,tl=age/L;if(tl>1)return;const head=easeOut(tl/.45)*TAU*.85,tail=clamp((tl-.15)/.85)**1.5*TAU*.85,fade=1-smooth(.55,1,tl),start=Math.atan2(e.dz,e.dx)-1.6;
  paintBlade(v,arcRibbon(v,o,{R:3.3,T:1.1,from:start+tail,to:start+head,tilt:.25,tiltPhase:.4,seed:51,fade,spiral:.05}),P,{alpha:Math.min(1,tl*10)*(.3+.7*fade),seed:51,flecks:10});
  dust(v,o,3,clamp(age/.7),.5*fade,14,7,'#c9b79f');
 },
 bossSpit(v,e,o,age,P,ph){if(ph!=='post')return;const p=v.P(o.x,o.z,2.2);flash(v,p,v.S*1.6,P,(1-age/.2)*.7);sparkBurst(v,{x:o.x,z:o.z,h:2.2},age,P,10,e.seed,2.5,.35);},
};
Object.assign(DRAW,B);
void buildRibbon;
