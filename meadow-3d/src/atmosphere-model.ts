export interface AtmosphereSettings {enabled:boolean;hour:number;wind:number;sun:number;water:boolean;leaves:boolean}
export const DEFAULT_ATMOSPHERE:AtmosphereSettings={enabled:true,hour:10,wind:.4,sun:.72,water:true,leaves:true};
export function atmosphereSettings(previous:AtmosphereSettings,patch:Partial<AtmosphereSettings>):AtmosphereSettings{
 const next={...previous};for(const k of ['enabled','water','leaves']as const)if(typeof patch[k]==='boolean')next[k]=patch[k]!;
 for(const [k,lo,hi]of [['hour',7,18],['wind',0,1],['sun',0,1]]as const){const v=patch[k];if(typeof v==='number'&&Number.isFinite(v))next[k]=Math.max(lo,Math.min(hi,v));}return next;
}
export function sunPosition(hour:number){const angle=(hour-6)/12*Math.PI,elevation=Math.max(.18,Math.sin(angle));return{elevation,dx:Math.cos(angle)*.9,dy:.24,length:.18+(1-elevation)*.55};}
export function breeze(x:number,z:number,time:number,strength:number){return strength*(.65*Math.sin(time*.7+x*.035+z*.02)+.25*Math.sin(time*1.25+x*.07)+.1*Math.sin(time*2.1+z*.12));}
/** Same outline as the painted ground. A bridge is always cut OUT of the animated water mask. */
export function pondOutline(a:number){return 1.018+.015*Math.sin(a*7)+.012*Math.cos(a*11);}
export function pondSurface(p:{x:number;z:number;rx:number;rz:number;bridgeZ?:number;bridgeHalf?:number},x:number,z:number){
 if(p.bridgeZ!==undefined&&Math.abs(z-p.bridgeZ)<=(p.bridgeHalf??1.3))return false;
 const dx=(x-p.x)/p.rx,dz=(z-p.z)/p.rz;return Math.hypot(dx,dz)<pondOutline(Math.atan2(dz,dx));
}
const fract=(x:number)=>x-Math.floor(x);
export function leafPose(index:number,time:number,wind:number){
 const seed=fract(Math.sin(index*127.1+19.3)*43758.5453),duration=8+seed*6,progress=fract(time/duration+seed);
 return{progress,drift:progress*(1.4+wind*5),side:Math.sin(progress*7+seed*12)*.32,spin:time*(1.1+seed)+seed*20,flutter:.25+Math.abs(Math.cos(time*3+seed*11))*.75,alpha:Math.sin(progress*Math.PI)*(.3+seed*.3),size:.045+seed*.055};
}
