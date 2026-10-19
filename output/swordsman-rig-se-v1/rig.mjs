/** Authored SE biped gait. Pixel-space bones + exact two-bone IK, no generated pose frames. */
export const GAIT=Object.freeze({duration:.95,stance:.6,stride:26,upper:38,lower:38,rootY:-83,forward:[.86,.32]});
export const RIG_SCALE=168/182;
export const WALK_KEYS=Object.freeze([
 {phase:0,u:13,lift:0,roll:-.08},
 {phase:.15,u:6.5,lift:0,roll:0},
 {phase:.3,u:0,lift:0,roll:0},
 {phase:.45,u:-6.5,lift:0,roll:.03},
 {phase:.6,u:-13,lift:0,roll:.16},
 {phase:.7,u:-9,lift:8,roll:-.03},
 {phase:.8,u:0,lift:12,roll:-.14},
 {phase:.9,u:9,lift:6,roll:-.12},
 {phase:1,u:13,lift:0,roll:-.08}
]);
export const mod1=x=>((x%1)+1)%1;
export function keySample(phase){const p=mod1(phase);let k=0;while(k<WALK_KEYS.length-2&&p>WALK_KEYS[k+1].phase)k++;const a=WALK_KEYS[k],b=WALK_KEYS[k+1],t=(p-a.phase)/(b.phase-a.phase),s=p<GAIT.stance?t:t*t*(3-2*t);return {u:a.u+(b.u-a.u)*s,lift:a.lift+(b.lift-a.lift)*s,roll:a.roll+(b.roll-a.roll)*s};}
export function solveLeg(hip,ankle,a=GAIT.upper,b=GAIT.lower){const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],raw=Math.hypot(dx,dy);if(raw>a+b+1e-6)throw Error(`Unreachable ankle ${raw}`);const d=Math.max(Math.abs(a-b)+1e-5,Math.min(a+b-1e-5,raw)),along=(a*a-b*b+d*d)/(2*d),bend=Math.sqrt(Math.max(0,a*a-along*along)),ux=dx/raw,uy=dy/raw;return[hip[0]+ux*along+uy*bend,hip[1]+uy*along-ux*bend];}
export function sampleRig(phase,motion='walk'){
 const p=mod1(phase),walking=motion==='walk',bob=walking?1.1*Math.cos(4*Math.PI*p):.25*Math.sin(2*Math.PI*p),root=[0,GAIT.rootY+bob];
 const legs=['L','R'].map((id,i)=>{const q=mod1(p+i*.5),key=walking?keySample(q):{u:i?-3:3,lift:0,roll:0},depth=i?-2:2,hip=[i?-6:6,root[1]+(i?-1:1)],foot=[(i?-6:6)+key.u*GAIT.forward[0],depth+key.u*GAIT.forward[1]-key.lift],r=key.roll,ankle=[foot[0]-7*Math.cos(r)+13*Math.sin(r),foot[1]-7*Math.sin(r)-13*Math.cos(r)],knee=solveLeg(hip,ankle);return{id,phase:q,hip,knee,ankle,foot,u:key.u,lift:key.lift,roll:r,planted:!walking||q<GAIT.stance};});
 return{phase:p,root,legs,walking,cycleSeconds:GAIT.duration};
}
export function groundSpeed(){return GAIT.stride/GAIT.stance/GAIT.duration;}
export function worldFoot(cycles,id){const p=sampleRig(cycles),leg=p.legs.find(l=>l.id===id),u=cycles*GAIT.stride/GAIT.stance;return[leg.foot[0]+u*GAIT.forward[0],leg.foot[1]+u*GAIT.forward[1]];}
export const PARTS=Object.freeze({
 thigh:{a:[201,143],b:[209,173],poly:[[194,137],[209,138],[216,163],[216,175],[205,180],[196,167],[193,150]]},
 shin:{a:[209,173],b:[220,198],poly:[[199,164],[215,164],[223,190],[226,199],[216,204],[206,195],[200,180]]},
 boot:{a:[220,198],b:[228,211],poly:[[210,190],[223,189],[229,197],[237,207],[234,214],[219,214],[211,207],[208,198]]},
 body:{poly:[[100,35],[250,35],[250,145],[228,145],[219,141],[214,147],[206,151],[200,155],[189,150],[180,146],[171,140],[159,139],[150,133],[100,133]]},
 sword:{poly:[[109,187],[157,134],[166,122],[175,119],[179,128],[167,140],[118,189]]}
});
function clipPoly(ctx,poly){ctx.beginPath();poly.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.clip();}
function bonePart(c,image,part,a,b){const sa=part.a,sb=part.b,angle=Math.atan2(b[1]-a[1],b[0]-a[0])-Math.atan2(sb[1]-sa[1],sb[0]-sa[0]),s=Math.hypot(b[0]-a[0],b[1]-a[1])/Math.hypot(sb[0]-sa[0],sb[1]-sa[1]);c.save();c.translate(...a);c.rotate(angle);c.scale(s,s);c.translate(-sa[0],-sa[1]);clipPoly(c,part.poly);c.drawImage(image,0,0);c.restore();}
function torso(c,image,part,root,tilt){c.save();c.translate(...root);c.rotate(tilt);c.translate(-196,-143);clipPoly(c,part.poly);c.drawImage(image,0,0);c.restore();}
export function drawRig(c,image,pose,{bones=false,texture=true,feet=true}={}){
 if(texture){for(const leg of [...pose.legs].sort((a,b)=>a.foot[1]-b.foot[1])){c.save();if(leg.id==='R')c.filter='brightness(.88)';bonePart(c,image,PARTS.thigh,leg.hip,leg.knee);bonePart(c,image,PARTS.shin,leg.knee,leg.ankle);bonePart(c,image,PARTS.boot,leg.ankle,leg.foot);c.restore();}const tilt=pose.walking?.012*Math.sin(pose.phase*2*Math.PI):0;torso(c,image,PARTS.body,pose.root,tilt);torso(c,image,PARTS.sword,pose.root,tilt);}
 if(bones){c.lineCap='round';c.lineJoin='round';for(const leg of pose.legs){const col=leg.id==='L'?'#72e4bf':'#f0c16f';c.strokeStyle=col;c.fillStyle=col;c.lineWidth=1.1;c.beginPath();c.moveTo(...leg.hip);c.lineTo(...leg.knee);c.lineTo(...leg.ankle);c.lineTo(...leg.foot);c.stroke();for(const p of [leg.hip,leg.knee,leg.ankle]){c.beginPath();c.arc(...p,1.9,0,Math.PI*2);c.fill();}c.font='bold 7px sans-serif';c.textAlign='center';c.fillText(leg.id,leg.knee[0]-5,leg.knee[1]);}c.strokeStyle='#d6e0ca88';c.beginPath();c.moveTo(...pose.legs[0].hip);c.lineTo(...pose.legs[1].hip);c.moveTo(...pose.root);c.lineTo(pose.root[0],pose.root[1]-78);c.stroke();}
 if(feet){for(const leg of pose.legs){c.fillStyle=leg.id==='L'?'#72e4bf':'#f0c16f';c.globalAlpha=leg.planted?.8:.3;c.beginPath();c.ellipse(leg.foot[0],leg.foot[1]+1,4,1.3,0,0,Math.PI*2);c.fill();c.globalAlpha=1;}}
}
