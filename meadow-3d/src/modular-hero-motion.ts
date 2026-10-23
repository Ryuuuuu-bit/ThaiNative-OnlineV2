import type {HeroLayer,HeroLook,HERO_ATTACHMENTS,Sword} from './modular-hero';

type Point=readonly [number,number];
export type Matrix=readonly [number,number,number,number,number,number];
export type ModularMotion='idle'|'walk'|'attack'|'cast'|'heal';
export const MODULAR_MOTIONS={idle:{frames:1,seconds:1,label:'ยืน'},walk:{frames:12,seconds:.8,label:'เดิน'},attack:{frames:12,seconds:.9,label:'โจมตี'},cast:{frames:12,seconds:1.1,label:'ร่ายเวท'},heal:{frames:12,seconds:1.1,label:'ฮีล'}} as const;
export const MODULAR_IMPACT_FRAME={attack:5,bow:7,cast:5,heal:5} as const;
export const MODULAR_BOW={grip:[765,658],top:[534,84],bottom:[552,1168],scale:.55,rotation:.18} as const;
export function transformPoint(m:Matrix,p:Point):Point{return[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];}
function multiply(a:Matrix,b:Matrix):Matrix{return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function rotateAt(p:Point,angle:number,offset:Point=[0,0]):Matrix{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,p[0]-c*p[0]+s*p[1]+offset[0],p[1]-s*p[0]-c*p[1]+offset[1]];}
const distance=(a:Point,b:Point)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
function segment(a:Point,b:Point,targetA:Point,targetB:Point):Matrix{
 const rotation=Math.atan2(targetB[1]-targetA[1],targetB[0]-targetA[0])-Math.atan2(b[1]-a[1],b[0]-a[0]);
 return rotateAt(a,rotation,[targetA[0]-a[0],targetA[1]-a[1]]);
}

// shortcut: rigid SE cutouts; paint bent limbs and cloth frames before final animation polish.
const LEGS={
 far:{hip:[577,650],knee:[560,820],ankle:[542,960],phase:.5,
  thigh:[[520,610],[636,625],[640,712],[625,787],[610,845],[520,845],[505,778],[511,713]],
  shin:[[518,790],[615,798],[610,884],[590,950],[570,987],[505,985],[500,927],[510,863]],
  boot:[[505,939],[590,939],[593,980],[570,1015],[525,1025],[475,1020],[438,997],[448,962],[483,945]]},
 near:{hip:[705,650],knee:[753,850],ankle:[811,1050],phase:0,
  thigh:[[638,615],[734,625],[769,705],[793,787],[798,864],[745,900],[690,850],[662,784],[645,717]],
  shin:[[700,810],[798,815],[821,902],[846,990],[856,1070],[789,1085],[759,1035],[741,960],[720,889]],
  boot:[[775,1005],[847,1005],[870,1095],[865,1135],[805,1138],[776,1100],[767,1050]]},
} as const;
const TORSO:readonly Point[]=[[478,300],[746,300],[832,375],[813,428],[751,439],[740,520],[756,610],[755,694],[676,715],[626,683],[522,708],[512,627],[535,548],[546,440],[487,414],[469,365]];
const ARMS={
 right:{shoulder:[522,350] as Point,elbow:[480,460] as Point,
  upper:[[489,335],[551,349],[550,412],[529,456],[510,493],[451,489],[437,465],[458,414],[474,372]],
  lower:[[439,444],[515,453],[523,490],[502,533],[480,605],[414,599],[418,537],[433,491]]},
 left:{shoulder:[722,365] as Point,elbow:[785,490] as Point,
  upper:[[687,335],[739,334],[773,372],[789,429],[813,475],[797,520],[739,510],[720,474],[705,428]],
  lower:[[742,467],[807,463],[827,502],[847,560],[853,653],[786,662],[773,610],[752,546]]},
} as const;
function sample(keys:readonly (readonly [number,number])[],time:number){
 for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){const a=keys[i-1],b=keys[i],p=(time-a[0])/(b[0]-a[0]),ease=p*p*(3-2*p);return a[1]+(b[1]-a[1])*ease;}
 return keys[keys.length-1][1];
}
export function modularPose(motion:ModularMotion,frame:number,mount:typeof HERO_ATTACHMENTS['base'],weapon:Sword='iron'){
 const count=MODULAR_MOTIONS[motion].frames,index=Math.max(0,Math.min(count-1,Math.floor(Number.isFinite(frame)?frame:0))),t=index/count;
 const walking=motion==='walk',attacking=motion==='attack'&&weapon!=='bow',casting=motion==='cast'||motion==='heal',wave=Math.sin(t*Math.PI*2);
 const lunge=attacking?sample([[0,0],[.23,-12],[.4,30],[.55,25],[.87,0],[1,0]],t):0;
 const bodyOffset:Point=walking?[wave*3,31-3*Math.cos(t*4*Math.PI)]:[lunge,attacking?sample([[0,0],[.23,2],[.4,14],[.87,0],[1,0]],t):0];
 const torso=rotateAt([630,635],attacking?sample([[0,0],[.23,.045],[.4,-.055],[.87,0],[1,0]],t):walking?wave*.009:0,bodyOffset);
 const armAngles={
  right:walking?[wave*.11,-wave*.035,0]:attacking?
   [sample([[0,0],[.24,1.05],[.4,-.85],[.53,-.7],[.87,0],[1,0]],t),sample([[0,0],[.24,.25],[.4,-.35],[.87,0],[1,0]],t),sample([[0,0],[.24,.8],[.4,-.12],[.87,0],[1,0]],t)]:[0,0,0],
  left:walking?[-wave*.065,wave*.025,0]:attacking?[sample([[0,0],[.24,.14],[.53,.2],[.87,0],[1,0]],t),sample([[0,0],[.24,-.05],[.53,-.05],[.87,0],[1,0]],t),0]:[0,0,0],
 };
 const arms=Object.fromEntries((['right','left'] as const).map(side=>{
  const source=ARMS[side],rect=side==='right'?mount.rightHand:mount.leftHand;
  const wrist:Point=side==='right'?[rect[0]+44*rect[2]/75,rect[1]+48*rect[3]/110]:[rect[0]+46*rect[2]/90,rect[1]+24*rect[3]/90];
  const [upperAngle,lowerAngle,handAngle]=armAngles[side];
  let upper=multiply(torso,rotateAt(source.shoulder,upperAngle)),lower=multiply(upper,rotateAt(source.elbow,lowerAngle));
  let hand=multiply(lower,rotateAt(wrist,handAngle));
  if(weapon==='bow'&&motion==='attack'||casting){
   const grip=side==='right'?mount.rightGrip:mount.leftGrip;
   const amount=sample([[0,0],[.18,1],[.67,1],[.91,0],[1,0]],t);
   const draw=sample([[0,0],[.17,0],[.42,1],[.58,1],[.67,1.1],[1,0]],t);
   const target:Point=casting?(side==='left'?[weapon==='bow'?870:810,610]:motion==='heal'?[610,530]:[630,430]):side==='left'?[840,480]:[723-103*draw,441-6*draw];
   const end:Point=[grip[0]+(target[0]-grip[0])*amount,grip[1]+(target[1]-grip[1])*amount];
   const shoulder=transformPoint(torso,source.shoulder),a=distance(source.shoulder,source.elbow),b=distance(source.elbow,grip);
   const dx=end[0]-shoulder[0],dy=end[1]-shoulder[1],d=Math.min(a+b-.01,Math.max(Math.abs(a-b)+.01,Math.hypot(dx,dy)));
   const angle=Math.atan2(dy,dx),along=(a*a-b*b+d*d)/(2*d),bend=Math.sqrt(Math.max(0,a*a-along*along));
   const sign=side==='right'?1:-1,elbow:Point=[shoulder[0]+Math.cos(angle)*along-Math.sin(angle)*bend*sign,shoulder[1]+Math.sin(angle)*along+Math.cos(angle)*bend*sign];
   const reached:Point=[shoulder[0]+Math.cos(angle)*d,shoulder[1]+Math.sin(angle)*d];
   upper=segment(source.shoulder,source.elbow,shoulder,elbow);lower=segment(source.elbow,grip,elbow,reached);hand=lower;
  }
  const grip=transformPoint(hand,side==='right'?mount.rightGrip:mount.leftGrip);
  return[side,{upper,lower,hand,grip,wrist:transformPoint(lower,wrist)}];
 })) as Record<'right'|'left',{upper:Matrix;lower:Matrix;hand:Matrix;grip:Point;wrist:Point}>;
 const legs=Object.entries(LEGS).map(([id,leg])=>{
  const hip=transformPoint(torso,leg.hip),phase=(t+leg.phase)%1,stance=.6;
  let u=0,lift=0,planted=true;
  if(walking){if(phase<stance)u=44-88*phase/stance;else{const p=(phase-stance)/(1-stance),e=p*p*(3-2*p);u=-44+88*e;lift=48*Math.sin(Math.PI*p)**2;planted=false;}}
  const ankle:Point=[leg.ankle[0]+u*.85,leg.ankle[1]+u*.35-lift];
  const a=distance(leg.hip,leg.knee),b=distance(leg.knee,leg.ankle),dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],d=distance(hip,ankle);
  const along=(a*a-b*b+d*d)/(2*d),bend=Math.sqrt(Math.max(0,a*a-along*along));
  const cross=(leg.ankle[0]-leg.hip[0])*(leg.knee[1]-leg.hip[1])-(leg.ankle[1]-leg.hip[1])*(leg.knee[0]-leg.hip[0]);
  const sign=cross<0?1:-1,knee:Point=[hip[0]+dx/d*along+dy/d*bend*sign,hip[1]+dy/d*along-dx/d*bend*sign];
  return{id,hip,knee,ankle,planted,lift,upperLength:a,lowerLength:b,reachable:d<=a+b&&d>=Math.abs(a-b),
   thigh:segment(leg.hip,leg.knee,hip,knee),shin:segment(leg.knee,leg.ankle,knee,ankle),boot:rotateAt(leg.ankle,0,[ankle[0]-leg.ankle[0],ankle[1]-leg.ankle[1]])};
 });
 const bowPoint=(point:Point):Point=>{
  const dx=(point[0]-MODULAR_BOW.grip[0])*MODULAR_BOW.scale,dy=(point[1]-MODULAR_BOW.grip[1])*MODULAR_BOW.scale,c=Math.cos(MODULAR_BOW.rotation),s=Math.sin(MODULAR_BOW.rotation);
  return[arms.left.grip[0]+dx*c-dy*s,arms.left.grip[1]+dx*s+dy*c];
 };
 const top=bowPoint(MODULAR_BOW.top),bottom=bowPoint(MODULAR_BOW.bottom),rest:Point=[(top[0]+bottom[0])/2,(top[1]+bottom[1])/2];
 const releasing=motion==='attack'&&index>=MODULAR_IMPACT_FRAME.bow,drawn=motion==='attack'&&index>=2&&!releasing;
 const nock=drawn?arms.right.grip:rest,travel=releasing?(index-MODULAR_IMPACT_FRAME.bow)*230+40:0;
 const tail:Point=[nock[0]+Math.cos(MODULAR_BOW.rotation)*travel,nock[1]+Math.sin(MODULAR_BOW.rotation)*travel];
 const bow=weapon==='bow'?{top,bottom,nock,released:releasing,arrow:motion==='attack'&&index>=2&&index<=8?{tail,tip:[tail[0]+Math.cos(MODULAR_BOW.rotation)*340,tail[1]+Math.sin(MODULAR_BOW.rotation)*340] as Point}:undefined}:undefined;
 return{frame:index,torso,arms,legs,bow,neck:transformPoint(torso,mount.neck)};
}

export function animateModularLayers(look:HeroLook,motion:ModularMotion,frame:number,mount:typeof HERO_ATTACHMENTS['base'],standing:HeroLayer[]){
 if(motion==='idle')return{layers:standing,pose:modularPose('idle',0,mount,look.sword)};
 const pose=modularPose(motion,frame,mount,look.sword),layers:HeroLayer[]=[];
 const source=look.outfit==='base'?'body':look.outfit;
 const piece=(clip:readonly Point[],transform:Matrix):HeroLayer=>({asset:source,source:[0,0,1254,1254],target:[0,0,1254,1254],clip,transform});
 for(const leg of pose.legs){const geometry=LEGS[leg.id as keyof typeof LEGS];for(const part of ['thigh','shin','boot'] as const)layers.push(piece(geometry[part],leg[part]));}
 for(const side of ['right','left'] as const)layers.push(piece(ARMS[side].upper,pose.arms[side].upper));
 if(look.outfit==='base')layers.push({asset:'body',source:[515,105,230,275],target:[515,105,230,275],transform:pose.torso});
 else for(const layer of standing.filter(l=>l.asset==='body'&&l.source[0]===515&&!l.clip))layers.push({...layer,transform:pose.torso});
 layers.push(piece(TORSO,pose.torso));
 const sword=standing.find(l=>l.asset===look.sword&&l.origin);
 if(sword){
  const hand=pose.arms[look.sword==='bow'?'left':'right'].hand;
  layers.push({...sword,transform:hand,...(look.sword==='bow'?{rotation:MODULAR_BOW.rotation-Math.atan2(hand[1],hand[0])}:{})});
 }
 for(const side of ['right','left'] as const){
  layers.push(piece(ARMS[side].lower,pose.arms[side].lower));
  if(look.outfit!=='base'){
   const hand=standing.find(l=>l.asset==='body'&&l.target===mount[side==='right'?'rightHand':'leftHand']);
   if(hand)layers.push({...hand,transform:pose.arms[side].hand});
   // The cuff follows the forearm and covers the wrist's rear edge.
   layers.push(piece(ARMS[side].lower,pose.arms[side].lower));
  }else{const rect=mount[side==='right'?'rightHand':'leftHand'];layers.push({asset:'body',source:rect,target:rect,transform:pose.arms[side].hand});}
 }
 if(look.outfit!=='base')for(const layer of standing.filter(l=>l.asset==='body'&&l.clip))layers.push({...layer,transform:pose.torso});
 const shield=standing.find(l=>l.asset==='shield');if(shield)layers.push({...shield,transform:pose.arms.left.hand});
 return{layers,pose};
}
