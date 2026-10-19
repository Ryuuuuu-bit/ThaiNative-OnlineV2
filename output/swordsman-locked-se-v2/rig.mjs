// Original sprite cutouts, rigid torso/arms/sword, authored alternating feet.
// All coordinates and bone lengths are measured on original-idle-SE.png.
export const CONFIG=Object.freeze({duration:1,stance:.6,stride:16,forward:[.75,.33],frames:32});
export const SOURCE=Object.freeze({
 far:{hip:[176,160],knee:[174,182],ankle:[170,202],toe:[160,215],base:[167,212],phase:.5,
 thigh:[[167,158],[185,159],[185,174],[182,187],[166,188],[166,174]],
 shin:[[166,178],[183,179],[183,194],[180,207],[165,210],[163,198]],
 boot:[[163,199],[181,199],[181,209],[174,215],[162,220],[153,217],[153,211],[158,206]]},
 near:{hip:[200,161],knee:[211,187],ankle:[218,217],toe:[222,234],base:[211,232],phase:0,
 thigh:[[190,158],[207,157],[218,177],[220,188],[211,197],[200,190],[193,176]],
 shin:[[200,181],[217,180],[226,195],[228,216],[222,226],[211,223],[207,210],[204,198]],
 boot:[[209,208],[225,208],[230,222],[234,235],[230,242],[217,241],[212,232],[209,218]]}
});
// Includes both original arms, unchanged, and the coat tails. Blade has its own mask.
export const TORSO=[[[147,65],[240,65],[240,161],[221,172],[212,167],[203,165],[194,169],[188,164],[184,163],[181,165],[168,164],[158,154],[148,155]],
 [[111,213],[154,156],[159,146],[170,143],[172,155],[160,161],[119,215]]];
export const mod1=x=>((x%1)+1)%1;
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
export function footKey(phase){const p=mod1(phase),q=p<CONFIG.stance?p/CONFIG.stance:(p-CONFIG.stance)/(1-CONFIG.stance),smooth=q*q*(3-2*q);return p<CONFIG.stance?{u:8-16*q,lift:0}:{u:-8+16*smooth,lift:7*Math.sin(Math.PI*q)**2};}
function ik(hip,ankle,a,b){const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],d=Math.hypot(dx,dy);if(d>=a+b||d<=Math.abs(a-b))throw Error(`Unreachable target: ${d} for ${a}+${b}`);const along=(a*a-b*b+d*d)/(2*d),bend=Math.sqrt(a*a-along*along);return[hip[0]+dx/d*along+dy/d*bend,hip[1]+dy/d*along-dx/d*bend];}
export function sample(phase){return {phase:mod1(phase),torso:{position:[0,0],rotation:0,scale:1},legs:Object.entries(SOURCE).map(([id,s])=>{const p=mod1(phase+s.phase),k=footKey(p),toe=[s.base[0]+k.u*CONFIG.forward[0],s.base[1]+k.u*CONFIG.forward[1]-k.lift],ankle=[toe[0]-(s.toe[0]-s.ankle[0]),toe[1]-(s.toe[1]-s.ankle[1])],hip=[...s.hip],upper=distance(s.hip,s.knee),lower=distance(s.knee,s.ankle),knee=ik(hip,ankle,upper,lower);return{id,phase:p,hip,knee,ankle,toe,upper,lower,planted:p<CONFIG.stance,u:k.u,lift:k.lift};})};}
function clip(c,poly){c.beginPath();poly.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.clip();}
// Rigid rotations only: every segment retains the exact source size, no resizing.
function part(c,image,poly,sa,sb,a,b){c.save();c.translate(...a);c.rotate(Math.atan2(b[1]-a[1],b[0]-a[0])-Math.atan2(sb[1]-sa[1],sb[0]-sa[0]));c.translate(-sa[0],-sa[1]);clip(c,poly);c.drawImage(image,0,0);c.restore();}
export function draw(c,image,pose,{bones=false,marks=false}={}){
 for(const leg of pose.legs){const s=SOURCE[leg.id];part(c,image,s.thigh,s.hip,s.knee,leg.hip,leg.knee);part(c,image,s.shin,s.knee,s.ankle,leg.knee,leg.ankle);part(c,image,s.boot,s.ankle,s.toe,leg.ankle,leg.toe);}
 for(const poly of TORSO){c.save();clip(c,poly);c.drawImage(image,0,0);c.restore();}
 if(bones)for(const leg of pose.legs){c.strokeStyle=leg.id==='near'?'#72e4bf':'#f0c16f';c.fillStyle=c.strokeStyle;c.lineWidth=1;c.beginPath();c.moveTo(...leg.hip);c.lineTo(...leg.knee);c.lineTo(...leg.ankle);c.lineTo(...leg.toe);c.stroke();for(const p of [leg.hip,leg.knee,leg.ankle]){c.beginPath();c.arc(...p,1.6,0,2*Math.PI);c.fill();}}
 if(marks)for(const leg of pose.legs){c.fillStyle=leg.id==='near'?'#72e4bf':'#f0c16f';c.globalAlpha=leg.planted?.9:.25;c.beginPath();c.ellipse(leg.toe[0],leg.toe[1]+2,4,1.5,0,0,2*Math.PI);c.fill();c.globalAlpha=1;}
}
export function metadata(){return{method:'2D rigid cutout rig from original sprite; AutoSprite v1 retained only for comparison, not newly generated',source:'original-idle-SE.png',cell:[384,256],anchor:[192,240],...CONFIG,bones:SOURCE,torso:{rotation:0,scale:1,translation:[0,0]},noAdditionalCredits:true,liveGameUnchanged:true};}

