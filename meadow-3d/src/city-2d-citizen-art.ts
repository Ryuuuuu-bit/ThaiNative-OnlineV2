import {project} from './city-2d-sim.ts';
import {CITIZEN_PROFILES,citizenWalkFrame} from './city-2d-citizens.ts';
import type {Citizen} from './city-2d-life.ts';

type Frame=[number,number,number,number];
type Atlas={id:string;image:string;rows:{height:number;frames:Frame[]}[]};
export async function loadCitizenArt(){
 const response=await fetch('/assets/city-painted-v1/citizens-manifest.json');
 if(!response.ok)throw new Error('โหลดภาพชาวเมืองไม่สำเร็จ');
 const manifest=await response.json() as {atlases:Atlas[]};
 const atlases=new Map<string,{source:HTMLImageElement;atlas:Atlas}>();
 await Promise.all(manifest.atlases.map(async atlas=>{
  const source=new Image();source.src=atlas.image;await source.decode();atlases.set(atlas.id,{source,atlas});
 }));
 for(const p of CITIZEN_PROFILES){const row=atlases.get(p.atlas)?.atlas.rows[p.row];if(!row||row.frames.length!==4||!row.height)throw new Error('ภาพชาวเมืองไม่ครบ: '+p.key);}
 function draw(c:CanvasRenderingContext2D,n:Pick<Citizen,'profile'|'walk'|'moving'|'fx'|'fz'>,screen:{x:number;y:number},scale:number){
  const entry=atlases.get(n.profile.atlas)!,row=entry.atlas.rows[n.profile.row];
  const rect=row.frames[citizenWalkFrame(n.walk,n.moving)],unit=n.profile.height*scale/row.height;
  const facing=project(n.fx,n.fz).x<0?-1:1;
  c.save();c.translate(screen.x,screen.y);
  c.fillStyle='#172c2938';c.beginPath();c.ellipse(0,0,scale*.33,scale*.16,0,0,Math.PI*2);c.fill();
  c.scale(facing,1);
  // Use one scale for all poses and register each frame to its ground-contact bottom.
  c.drawImage(entry.source,...rect,-rect[2]*unit/2,-rect[3]*unit,rect[2]*unit,rect[3]*unit);
  c.restore();
 }
 return {draw,identities:CITIZEN_PROFILES.length};
}
