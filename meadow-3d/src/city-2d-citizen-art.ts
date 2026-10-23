import {project} from './city-2d-sim.ts';
import {CITIZEN_PROFILES,citizenWalkFrame} from './city-2d-citizens.ts';
import type {Citizen} from './city-2d-life.ts';

type Frame=[number,number,number,number];
export type CitizenPose={frames:Frame[];duration:number;bodyPixels:number;feet:number[];image?:string};
type CharacterArt={key:string;image:string;states:{idle:CitizenPose;walk:CitizenPose}};
export function citizenPoseFrame(pose:CitizenPose,distance:number,moving:boolean,elapsed:number){
 return moving?citizenWalkFrame(distance,true):Math.floor(Math.max(0,elapsed)%pose.duration/pose.duration*pose.frames.length);
}
export async function loadCitizenArt(){
 const response=await fetch('/assets/city-poses-v2/citizens-manifest.json');
 if(!response.ok)throw new Error('โหลดภาพชาวเมืองไม่สำเร็จ');
 const manifest=await response.json() as {characters:CharacterArt[]};
 const atlases=new Map<string,{source:HTMLImageElement;walkSource:HTMLImageElement;art:CharacterArt}>();
 const images=new Map<string,Promise<HTMLImageElement>>();
 function image(path:string){
  if(!images.has(path))images.set(path,(async()=>{const source=new Image();source.src=path;await source.decode();return source;})());
  return images.get(path)!;
 }
 for(const p of CITIZEN_PROFILES){
  const art=manifest.characters.find(a=>a.key===p.key);
  if(!art||!['idle','walk'].every(state=>{const pose=art.states[state as 'idle'|'walk'];return pose&&pose.frames.length===4&&pose.feet.length===4&&Number.isFinite(pose.bodyPixels)&&pose.bodyPixels>0&&Number.isFinite(pose.duration)&&pose.duration>0;}))throw new Error('ภาพท่าทางชาวเมืองไม่ครบ: '+p.key);
 }
 await Promise.all(manifest.characters.map(async art=>{
  const [source,walkSource]=await Promise.all([image(art.image),image(art.states.walk.image??art.image)]);atlases.set(art.key,{source,walkSource,art});
 }));
 function draw(c:CanvasRenderingContext2D,n:Pick<Citizen,'profile'|'walk'|'moving'|'fx'|'fz'>&{phase?:number},screen:{x:number;y:number},scale:number){
  const entry=atlases.get(n.profile.key)!,pose=entry.art.states[n.moving?'walk':'idle'];
  const frame=citizenPoseFrame(pose,n.walk,n.moving,n.phase??n.walk),rect=pose.frames[frame],unit=n.profile.height*scale/pose.bodyPixels;
  const facing=project(n.fx,n.fz).x<0?-1:1;
  c.save();c.translate(screen.x,screen.y);
  c.fillStyle='#172c2938';c.beginPath();c.ellipse(0,0,scale*.33,scale*.16,0,0,Math.PI*2);c.fill();
  c.scale(facing,1);
  c.drawImage(n.moving?entry.walkSource:entry.source,...rect,-rect[2]*unit/2,-pose.feet[frame]*unit,rect[2]*unit,rect[3]*unit);
  c.restore();
 }
 return {draw,identities:CITIZEN_PROFILES.length};
}
