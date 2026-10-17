/** Offline display-only review. This module is reached from art-review.html, never play.html. */
import * as T from 'three';
import {makePaintedHero} from './painted-hero';
import {makePaintedMonster} from './painted-monster';
import {mountSkillArt} from './skill-art';
import {JOB2_MOTIONS,BORROWED_MOTION,CAST_SECONDS,CONTACT_FRAME,MULTI_CONTACTS,preferOwnArt,type SkillMotion} from './skill-motions';
import type {PaintedLoader} from './assets';

export function mountJob2Review(scene:T.Scene,loader:PaintedLoader){
 const heroes:Array<{actor:ReturnType<typeof makePaintedHero>;p:any;id:SkillMotion;impact:boolean}>=[];
 const monsters:Array<{actor:ReturnType<typeof makePaintedMonster>;p:any}>=[];
 const root=new T.Group();scene.add(root);
 const art=mountSkillArt(scene,loader,root);
 let enabled=false,age=0,cycle=-1,borrowed=false,now=0;
 const contacts:any[]=[];
 const directions=[{x:1,z:1},{x:-1,z:1},{x:1,z:-1},{x:-1,z:-1}];
 const stops=Object.values(JOB2_MOTIONS).flat().flatMap(id=>directions.map((_,direction)=>({id,direction})));
 function clear(){for(const h of heroes.splice(0)){root.remove(h.actor.root);h.actor.dispose();}for(const m of monsters.splice(0)){root.remove(m.actor.root);m.actor.dispose();}}
 function setup(job:'guardian'|'berserker',direction=0,baseline=false,only?:SkillMotion,crowd=12){
  clear();enabled=true;borrowed=baseline;age=0;cycle=-1;contacts.length=0;
  if(!baseline)art.warmJob2();
  const ids=only?[only]:JOB2_MOTIONS[job];
  ids.forEach((id,i)=>{const actor=makePaintedHero(loader),d=directions[direction],x=(i-(ids.length-1)/2)*3.8;
   const p:any={id:'review-'+i,jobId:baseline?'swordsman':job,x,z:-30,fx:d.x,fz:d.z,dead:false,dash:0,hurt:0,attack:0,attackKind:'slash',invulnerable:0,statuses:[]};
   heroes.push({actor,p,id,impact:false});root.add(actor.root);
  });
  for(let i=0;i<crowd;i++){const actor=makePaintedMonster(loader),p={id:i,x:(i%6-2.5)*2.2,z:-27+Math.floor(i/6)*1.7,fx:0,fz:1,motion:'idle',motionTime:0,bossPhase:1,variant:'pink',hurt:0,dead:false,deathAge:0,boss:false,dataId:'small_jelly',statuses:i===0?[{id:'stun',remaining:2}]:[]};monsters.push({actor,p});root.add(actor.root);}
 }
 function update(dt:number){
  if(!enabled)return;age+=dt;now+=dt;
  const next=Math.floor(age/1.1),t=age%1.1;
  for(const h of heroes){
   const id=borrowed?BORROWED_MOTION[h.id]!:h.id;
   if(next!==cycle){h.impact=false;h.p.statuses=borrowed&&['bulwark','blood_rage'].includes(h.id)?[{id:'endure',remaining:8}]:h.id==='bulwark'?[{id:'guard',remaining:10}]:h.id==='blood_rage'?[{id:'rage',remaining:12}]:[];
    const e={type:'skill',skillId:id,playerId:h.p.id,x:h.p.x,z:h.p.z,dx:h.p.fx,dz:h.p.fz};h.actor.event(e);art.emit(e);
   }
   const cast=CAST_SECONDS[id];if(cast&&t>=cast&&!h.impact){h.impact=true;const e={type:'skillImpact',skillId:id,playerId:h.p.id,x:h.p.x,z:h.p.z};h.actor.event(e);art.emit(e);}
   h.actor.update(h.p,now);
   if(next!==cycle&&!cast||cast&&h.impact&&t<cast+dt){const snap=h.actor.snapshot();contacts.push({skill:id,expected:CONTACT_FRAME[id],frame:snap.frame,actualMotion:snap.actualMotion,reviewOnly:true});if(contacts.length>128)contacts.shift();}
  }
  cycle=next;for(const m of monsters)m.actor.update(m.p,now);art.update(dt,heroes.map(h=>h.p),undefined,monsters.map(m=>m.p));
 }
 async function replay(runs:any[]){
  const log:any[]=[];
  for(const run of runs){
   setup(run.job,0,false,run.skill);enabled=false;
   const h=heroes[0];h.actor.update(h.p,0);
   for(let i=0;i<300&&!h.actor.snapshot().skillsLoaded.includes(run.skill);i++)await new Promise(r=>setTimeout(r,50));
   let hit=0;
   for(const source of run.events){
    const e=preferOwnArt({...source,playerId:h.p.id});h.actor.event(e);h.actor.update(h.p,source.at);
    const isContact=source.type==='hit'||source.type==='skillImpact'||source.type==='skill'&&!run.events.some((e:any)=>e.type==='hit'||e.type==='skillImpact');
    if(isContact){const multi=MULTI_CONTACTS[run.skill as keyof typeof MULTI_CONTACTS],expected=multi?multi[Math.min(hit++,multi.length-1)]:CONTACT_FRAME[run.skill as SkillMotion],snap=h.actor.snapshot();
     log.push({skill:run.skill,event:source.type,simTime:source.at,expectedFrame:expected,renderedFrame:snap.frame,actualMotion:snap.actualMotion,passed:snap.actualMotion===run.skill&&Math.abs(snap.frame-expected)<=1,scope:'Headless offline authoritative-event replay through current client alias gate'});
    }
   }
  }
  enabled=true;return log;
 }
 function pose(seconds:number){enabled=true;age=0;cycle=-1;update(0);for(let t=0;t<seconds;t+=1/60)update(1/60);enabled=false;}
 return {setup,update,stops,replay,pose,point(index:number){const stop=stops[index];setup(JOB2_MOTIONS.guardian.includes(stop.id as any)?'guardian':'berserker',stop.direction,false,stop.id);return stop;},snapshot:()=>({borrowed,heroes:heroes.map(h=>({id:h.id,...h.actor.snapshot()})),monsters:monsters.length,contacts:[...contacts],vfx:art.snapshot()})};
}
