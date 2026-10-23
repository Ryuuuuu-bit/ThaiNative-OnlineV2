type BossPose={boss?:boolean;dead?:boolean;motion:string;motionTime:number;windup?:number;fx:number;fz:number};
/** Only add body cues where several boss moves share one attack strip. Server windup owns the timing. */
export function bossAnticipation(e:BossPose,sharedAttack:boolean){
 const remaining=e.windup??0;
 if(!sharedAttack||!e.boss||e.dead||remaining<=0||!['slam','charge','spit'].includes(e.motion))return null;
 const progress=Math.max(0,Math.min(1,e.motionTime/(e.motionTime+remaining))),p=progress*progress*(3-2*progress);
 if(e.motion==='slam')return {x:1-.18*p,y:1+.35*p,skew:0};
 if(e.motion==='charge')return {x:1+.25*p,y:1-.32*p,skew:-Math.sign(13*e.fx-9*e.fz)*.12*p};
 return {x:1+.18*p,y:1+.12*p,skew:0};
}
