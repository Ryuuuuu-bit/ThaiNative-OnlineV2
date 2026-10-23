import layout from '../../data/city-layout.json' with {type:'json'};
import {FORTIFICATION_SOLIDS} from './city-details.js';

export interface CityLayoutItem {id:string;assetId:string;x:number;z:number;scale:number;flip:boolean;facing:0|1|2|3}
export const CITY_LAYOUT=layout as {version:2;mapId:'city_plaza';name:string;items:CityLayoutItem[]};
export function cityNpcPlacement(art:string){
 const item=CITY_LAYOUT.items.find(p=>p.assetId==='npc:'+art);
 if(!item)throw Error('Missing approved city NPC: '+art);
 return item;
}

/** Footprints follow the approved visual placements on both client and server. */
export function cityLayoutGeometry(items:readonly CityLayoutItem[]){
 const boxes:{x:number;z:number;w:number;d:number}[]=[...FORTIFICATION_SOLIDS];
 const circles:{x:number;z:number;r:number}[]=[];
 for(const p of items){
  const [kind,name,a,b]=p.assetId.split(':'),w=Number(a),d=Number(b);
  if(kind==='npc'||kind==='wall'||kind==='gate')continue;
  if(kind==='nature'){
   if(name.startsWith('tree-'))circles.push({x:p.x,z:p.z,r:(name==='tree-round'?.8:.55)*p.scale});
   continue;
  }
  if(name==='fountain'||name==='well'){circles.push({x:p.x,z:p.z,r:(name==='fountain'?2.5:w/2.2)*p.scale});continue;}
  if(name==='portal'||name==='marker'||name==='warp-core')continue;
  const width=name==='lamp'?.45:name==='banner'?.5:name==='dummy'?.7:name==='clocktower'?4:name==='stall'&&d===2.1?w+.7:w;
  const depth=['lamp','banner','dummy','clocktower'].includes(name)?width:name==='stall'&&d===2.1?d+.25:d;
  if(!Number.isFinite(width)||!Number.isFinite(depth))throw Error('Missing city footprint: '+p.assetId);
  // The market canopy also includes its crate and barrel at the front corner.
  const [dx,dz]=name==='stall'&&d===2.1?[[-.35,.125],[-.125,-.35],[.35,-.125],[.125,.35]][p.facing]:[0,0];
  boxes.push({x:p.x+dx*p.scale,z:p.z+dz*p.scale,w:(p.facing%2?depth:width)*p.scale,d:(p.facing%2?width:depth)*p.scale});
 }
 return {boxes,circles};
}
export const CITY_COLLISION=cityLayoutGeometry(CITY_LAYOUT.items);
