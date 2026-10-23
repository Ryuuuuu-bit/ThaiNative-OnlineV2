import {city2dWalkable,route} from './city-2d-layout.ts';
import {CITIZEN_PROFILES,type CitizenProfile,type CitizenRole} from './city-2d-citizens.ts';
export type Citizen={id:number;profile:CitizenProfile;x:number;z:number;fx:number;fz:number;phase:number;walk:number;moving:boolean;wait:number;role:CitizenRole;palette:number;route:{x:number;z:number}[];stop:number;stops:[number,number][];speech:string};
const routes:Record<CitizenRole,[number,number][]>= {
 buyer:[[18,12],[30,4],[35,18],[28,24],[17,18],[16,5]],
 guard:[[-4,39],[-4,18],[-4,4],[4,4],[4,22],[4,39]],
 scholar:[[-12,-20],[0,-23],[12,-15],[23,-27],[5,-13],[-5,-13]],
 artisan:[[-18,-12],[-23,-7],[-18,0],[-25,4],[-33,6]],
 gardener:[[-17,16],[-20,26],[-27,31],[-18,30],[-12,23]],
 resident:[[7,20],[14,21],[25,25],[27,35],[5,35]],
 traveler:[[-4,10],[4,10],[11,0],[4,-9],[-6,-8],[-10,0]],
};
export function createCityLife(){
 const citizens:Citizen[]=[];
 for(const profile of CITIZEN_PROFILES){
  const {id,role}=profile,stops=routes[role].map(p=>[...p] as [number,number]);
  // Vary destinations, direction, pace and pauses rather than marching in identical loops.
  if(role==='buyer'&&id%3===0)stops.push([19,23]);
  if(role==='guard'&&id%2===0)stops.splice(3,0,[40,0],[0,-40]);
  if(role==='scholar'&&id%2===1)stops.push([6,15]);
  if(role==='traveler')stops.push(id%2?[30,4]:[0,40]);
  if(id%2)stops.reverse();
  const stop=id%stops.length,p=stops[stop];let spawn:{x:number;z:number}|undefined;
  for(let ring=0;ring<8&&!spawn;ring++)for(let j=0;j<(ring?8*ring:1);j++){
   const a=j/(8*ring||1)*Math.PI*2+id*.37,x=p[0]+Math.cos(a)*ring*.65,z=p[1]+Math.sin(a)*ring*.65;
   if(city2dWalkable(x,z,.48)&&citizens.every(n=>Math.hypot(n.x-x,n.z-z)>.85)){spawn={x,z};break;}
  }
  if(!spawn)throw new Error('ไม่มีพื้นที่เริ่มต้นสำหรับ '+profile.key);
  citizens.push({id,profile,...spawn,fx:0,fz:1,phase:id*1.37,walk:id*.19,moving:false,wait:(id*.83)%4,role,palette:id%8,route:[],stop,stops,speech:profile.speech});
 }
 return {citizens,step(dt:number){
  dt=Math.min(dt,.05);
  for(const n of citizens){n.phase+=dt;n.moving=false;if(n.wait>0){n.wait-=dt;continue;}
   if(!n.route.length){n.stop=(n.stop+1)%n.stops.length;const [x,z]=n.stops[n.stop];n.route=route(n,{x,z});if(!n.route.length){n.wait=2;continue;}}
   const target=n.route[0],dx=target.x-n.x,dz=target.z-n.z,dist=Math.hypot(dx,dz);
   if(dist<.06){n.route.shift();if(!n.route.length)n.wait=n.profile.rest;continue;}
   const step=Math.min(dist,n.profile.speed*dt),x=n.x+dx/dist*step,z=n.z+dz/dist*step;
   if(city2dWalkable(x,z,.3)){n.fx=dx/dist;n.fz=dz/dist;n.x=x;n.z=z;n.walk+=step;n.moving=true;}else{n.route=[];n.wait=1;}
  }
 }};
}
