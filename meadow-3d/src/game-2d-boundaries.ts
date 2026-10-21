import {LAYOUTS,type MapId} from '@the-beginning-online/shared/maps';

export type BoundaryRoad={x:number;z:number;dx:number;dz:number;width:number};
export function boundaryRoads(id:MapId):BoundaryRoad[]{
 const l=LAYOUTS[id];
 if(id==='city_plaza')return [{x:0,z:-48,dx:0,dz:-1,width:4},{x:0,z:48,dx:0,dz:1,width:4},{x:-48,z:0,dx:-1,dz:0,width:4},{x:48,z:0,dx:1,dz:0,width:4}];
 const roads:BoundaryRoad[]=[];
 for(const p of l.paths)for(const [x,z]of [p.points[0],p.points[p.points.length-1]]){
  if(Math.abs(x)>=l.halfX-.1)roads.push({x,z,dx:Math.sign(x),dz:0,width:p.width});
  else if(Math.abs(z)>=l.halfZ-.1)roads.push({x,z,dx:0,dz:Math.sign(z),width:p.width});
 }
 return roads;
}
export function outsideRoadClearance(x:number,z:number,roads:BoundaryRoad[]){
 return roads.every(p=>{const dx=x-p.x,dz=z-p.z;return dx*p.dx+dz*p.dz<0||Math.abs(dx*p.dz-dz*p.dx)>p.width+4;});
}
/** Decorative scenery is outside the authoritative playable area, with open road corridors. */
export function boundaryPlants(id:MapId){
 const l=LAYOUTS[id],roads=boundaryRoads(id),plants:{x:number;z:number;variant:number;h:number}[]=[];
 for(let gx=-Math.ceil((l.halfX+65)/5);gx<=Math.ceil((l.halfX+65)/5);gx++)for(let gz=-Math.ceil((l.halfZ+65)/5);gz<=Math.ceil((l.halfZ+65)/5);gz++){
  const hash=Math.sin(gx*127.1+gz*311.7)*43758.5453,n=hash-Math.floor(hash);
  const x=gx*5+(n-.5)*3,z=gz*5+(Math.sin(gx*9+gz*7)) *1.5;
  if(Math.abs(x)<l.halfX+2&&Math.abs(z)<l.halfZ+2)continue;
  if(!outsideRoadClearance(x,z,roads))continue;
  plants.push({x,z,variant:Math.floor(n*6),h:5+n*3});
 }
 return plants;
}
