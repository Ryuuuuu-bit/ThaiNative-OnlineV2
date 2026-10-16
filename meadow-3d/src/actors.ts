import * as T from 'three';
import type {Player} from './sim';
const geo={sphere:new T.SphereGeometry(1,16,12),box:new T.BoxGeometry(1,1,1),cylinder:new T.CylinderGeometry(1,1,1,12),cone:new T.ConeGeometry(1,1,8)};
export function mat(color:string,metalness=0){return new T.MeshStandardMaterial({color,roughness:metalness?.45:.9,metalness});}
export function mesh(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,sx=1,sy=sx,sz=sx){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function group(parent:T.Object3D,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
export function makeHero(){
 const root=new T.Group(),body=group(root,0,0,0),hips=group(body,0,.94,0),torso=group(hips,0,.24,0);
 const skin=mat('#e7ba94'),skinDark=mat('#ca9979'),ivory=mat('#ede0b7'),teal=mat('#356d69'),darkTeal=mat('#264d50'),gold=mat('#cba767',.35),goldLight=mat('#f0d59a',.35),leather=mat('#71523d'),hair=mat('#5c4333'),hairLite=mat('#78543a'),steel=mat('#adc4c6',.65),black=mat('#30383c'),white=mat('#f8eddb');
 mesh(torso,geo.sphere,ivory,0,.14,0,.27,.34,.18);
 mesh(torso,new T.CylinderGeometry(.24,.32,.42,10),teal,0,-.21,0,1,1, .65);
 mesh(torso,new T.CylinderGeometry(.24,.245,.075,12),leather,0,-.08,0,1,1,.85);
 mesh(torso,geo.box,gold,0,-.08,.215,.105,.1,.035);mesh(torso,geo.box,leather,0,-.08,.24,.055,.055,.015);
 // Tabard panels and fine gold fasteners establish a readable fantasy silhouette.
 mesh(torso,geo.box,goldLight,0,-.29,.205,.025,.28,.018);
 for(const x of[-.14,.14])mesh(torso,geo.sphere,gold,x,.23,.145,.025,.025,.02);
 const strap=mesh(torso,geo.box,leather,0,.15,.171,.085,.45,.03);strap.rotation.z=-.5;
 const collar=mesh(torso,new T.TorusGeometry(.15,.045,8,20),darkTeal,0,.39,0);collar.rotation.x=Math.PI/2;
 const head=group(torso,0,.68,0);
 mesh(head,geo.sphere,skin,0,0,0,.34,.37,.305);
 mesh(head,geo.sphere,skin,0,-.105,.1,.255,.24,.225);
 for(const x of[-.326,.326])mesh(head,geo.sphere,skinDark,x,-.02,0,.075,.11,.055);
 mesh(head,geo.sphere,skin,0,-.075,.301,.035,.045,.04);
 for(const side of[-1,1]){
  const eye=group(head,side*.125,.005,.274);eye.rotation.y=side*.2;
  mesh(eye,geo.sphere,white,0,0,0,.071,.091,.026);mesh(eye,geo.sphere,mat('#654e3b'),0,-.006,.023,.041,.066,.015);mesh(eye,geo.sphere,black,0,-.003,.034,.022,.047,.008);mesh(eye,geo.sphere,white,-.013,.026,.041,.014,.02,.007);
  const brow=mesh(head,geo.box,hair,side*.125,.109,.275,.135,.026,.027);brow.rotation.z=side*-.09;
 }
 const mouth=mesh(head,geo.box,skinDark,0,-.19,.286,.074,.012,.012);mouth.rotation.z=-.03;
 mesh(head,geo.sphere,hair,0,.14,-.025,.365,.29,.32);
 // Sculpted overlapping locks; these are actual geometry, not a sprite.
 const locks=[[-.25,.17,.18,-.25,-.03,.28],[-.14,.25,.23,-.19,-.02,.29],[.01,.28,.24,-.06,.02,.32],[.15,.23,.23,.06,.04,.31],[.28,.16,.15,.23,.01,.22],[-.31,.08,.05,-.33,-.12,.11],[.31,.08,.03,.32,-.12,.08]];
 for(let i=0;i<locks.length;i++){const[x,y,z,ex,ey,ez]=locks[i];const path=new T.CatmullRomCurve3([new T.Vector3(x,y,z),new T.Vector3((x+ex)/2,y+.01,(z+ez)/2+.02),new T.Vector3(ex,ey,ez)]);const g=new T.TubeGeometry(path,6,.065,5,false);mesh(head,g,i%3?hair:hairLite,0,0,0);}
 for(let i=0;i<9;i++){const angle=i/9*6.28;const lock=mesh(head,geo.cone,i%3?hair:hairLite,Math.cos(angle)*.22,.37+Math.sin(i*2)*.035,Math.sin(angle)*.17,.085,.23,.09);lock.rotation.z=-Math.cos(angle)*.5;lock.rotation.x=Math.sin(angle)*.6;}
 const cape=group(torso,0,.34,-.19);const capeShape=new T.Shape();capeShape.moveTo(-.22,0);capeShape.lineTo(.22,0);capeShape.lineTo(.37,-.82);capeShape.quadraticCurveTo(.13,-.9,0,-.84);capeShape.quadraticCurveTo(-.2,-.91,-.37,-.82);capeShape.closePath();const capeGeo=new T.ShapeGeometry(capeShape,6);const capeMat=mat('#326d68');capeMat.side=T.DoubleSide;mesh(cape,capeGeo,capeMat,0,0,0);const capeEdge=new T.LineSegments(new T.EdgesGeometry(capeGeo),new T.LineBasicMaterial({color:'#c1a875'}));cape.add(capeEdge);
 const arms=[];
 for(const side of[-1,1]){const arm=group(torso,side*.3,.28,0);arm.rotation.z=side*.13;mesh(arm,geo.sphere,ivory,0,-.12,0,.1,.2,.1);const shoulder=mesh(arm,geo.sphere,gold,0,-.01,0,.145,.105,.14);mesh(arm,geo.sphere,steel,side*.025,.015,.025,.107,.075,.11);const elbow=group(arm,0,-.28,0);mesh(elbow,geo.cylinder,leather,0,-.09,0,.085,.2,.085);mesh(elbow,geo.cylinder,gold,0,-.17,0,.09,.035,.09);const hand=group(elbow,0,-.24,0);mesh(hand,geo.sphere,skin,0,0,0,.075,.09,.075);arms.push({arm,elbow,hand});}
 const sword=group(arms[1].hand,0,0,.02);sword.rotation.x=-Math.PI/2;
 mesh(sword,geo.cylinder,leather,0,-.07,0,.035,.2,.035);mesh(sword,geo.sphere,gold,0,-.185,0,.055);mesh(sword,geo.box,gold,0,.035,0,.3,.055,.065);
 const bladeShape=new T.Shape();bladeShape.moveTo(-.055,.06);bladeShape.lineTo(-.07,.74);bladeShape.lineTo(0,.95);bladeShape.lineTo(.07,.74);bladeShape.lineTo(.055,.06);bladeShape.closePath();const blade=mesh(sword,new T.ExtrudeGeometry(bladeShape,{depth:.025,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:1,steps:1}),steel,0,0,0);mesh(sword,geo.box,white,0,.43,.04,.013,.67,.008);
 const legs=[];
 for(const side of[-1,1]){const hip=group(hips,side*.15,-.12,0);mesh(hip,geo.cylinder,ivory,0,-.18,0,.105,.36,.105);const knee=group(hip,0,-.36,0);mesh(knee,geo.cylinder,leather,0,-.17,0,.12,.35,.12);mesh(knee,geo.cylinder,gold,0,-.04,0,.127,.045,.127);mesh(knee,geo.sphere,leather,0,-.34,.065,.127,.09,.2);mesh(knee,geo.box,gold,0,-.28,.18,.04,.025,.035);legs.push({hip,knee});}
 const baseY=.1;
 return{root,update(p:Player,time:number){const speed=p.moving?1:0,walk=Math.sin(time*10.5),a=p.attack;hips.position.y=.94+(p.moving?Math.abs(walk)*.055:Math.sin(time*2)*.009);body.rotation.set(p.dash>0?.45:p.moving?.1:0,0,0);torso.rotation.set(0,0,0);head.rotation.y=Math.sin(time*.6)*.025;cape.rotation.x=p.moving?-.24+Math.sin(time*11)*.1:-.03+Math.sin(time*2)*.025;
  for(let i=0;i<2;i++){const sign=i===0?1:-1;legs[i].hip.rotation.x=walk*.62*speed*sign;legs[i].knee.rotation.x=Math.max(0,-walk*sign)*.75*speed;arms[i].arm.rotation.set(-walk*.45*speed*sign,0,(i===0?-1:1)*.13);arms[i].elbow.rotation.x=-.18;}
  if(p.dash>0){legs[0].hip.rotation.x=-.8;legs[1].hip.rotation.x=.65;arms[1].arm.rotation.x=1.1;}
  if(a>0&&p.attackKind==='slash'){const progress=1-a/.34,phase=Math.sin(progress*Math.PI);torso.rotation.y=(p.combo===1?-1:1)*(progress-.5)*1.2;arms[1].arm.rotation.x=-1.2-phase*1.1;arms[1].arm.rotation.z=-.35+Math.cos(progress*Math.PI)*1.2;arms[1].elbow.rotation.x=-.15;arms[0].arm.rotation.x=-.35;}
  if(a>0&&p.attackKind==='spin'){torso.rotation.y=(1-a/.6)*Math.PI*4;arms[1].arm.rotation.z=-1.6;arms[1].arm.rotation.x=-.5;arms[0].arm.rotation.z=1.1;cape.rotation.x=-.6;}
  if(a>0&&p.attackKind==='meteor'){arms[0].arm.rotation.x=-2.4;arms[1].arm.rotation.x=-2;arms[0].elbow.rotation.x=-.3;torso.rotation.x=-.1;}
  if(p.dead){root.rotation.z=T.MathUtils.lerp(root.rotation.z,-Math.PI/2,.12);root.position.y=.25;}else{root.rotation.z=0;root.position.y=baseY;}
  root.position.x=p.x;root.position.z=p.z;const target=Math.atan2(p.fx,p.fz),delta=Math.atan2(Math.sin(target-root.rotation.y),Math.cos(target-root.rotation.y));root.rotation.y+=delta*.24;
 }};
}
/** Single unlit primitive used only while a painted monster texture is unavailable. */
export function makeMonsterFallback(boss=false){
 const shape=new T.Mesh(new T.SphereGeometry(1,10,6),new T.MeshBasicMaterial({color:boss?'#b989a1':'#d6abb9',transparent:true,opacity:.85}));
 const h=boss?5.8:1.3;shape.scale.set(h*.5,h*.5,h*.4);shape.position.y=h*.5;return shape;
}
