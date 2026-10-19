export interface SwordEvent {type:string;skillId?:string;x?:number;z?:number;dx?:number;dz?:number;combo?:number;crit?:boolean;reflect?:boolean}
export interface SwordArc {x:number;z:number;dx:number;dz:number;age:number;life:number;flip:number;strong:boolean}
export interface SwordSpark {x:number;z:number;vx:number;vz:number;height:number;rise:number;age:number;life:number;gold:boolean}

export function swordEffectKind(e:SwordEvent){
 if(e.type==='slash'||e.type==='skill'&&e.skillId==='slash')return 'slash';
 if(e.type==='hit'&&!e.reflect&&(!e.skillId||e.skillId==='basic'||e.skillId==='slash'))return 'hit';
 return null;
}

/** Bounded visual state only. Never changes damage, movement or authoritative events. */
export class SwordVfxModel {
 arcs:SwordArc[]=[];sparks:SwordSpark[]=[];private seed=73451;
 private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/2**32;}
 clear(){this.arcs.length=0;this.sparks.length=0;}
 event(e:SwordEvent,reduced=false){
  const kind=swordEffectKind(e);if(!kind||!Number.isFinite(e.x)||!Number.isFinite(e.z))return false;
  if(kind==='slash'){
   const d=Math.hypot(e.dx??1,e.dz??0)||1;
   this.arcs.push({x:e.x!,z:e.z!,dx:(e.dx??1)/d,dz:(e.dz??0)/d,age:0,life:reduced?.22:.32,flip:(e.combo??0)%2?-1:1,strong:e.skillId==='slash'});
   if(this.arcs.length>24)this.arcs.splice(0,this.arcs.length-24);
  }else{
   const count=reduced?4:e.crit?18:11;
   for(let i=0;i<count;i++){
    const angle=this.random()*Math.PI*2,speed=(reduced?.35:1.4)+this.random()*(e.crit?2.8:1.8);
    this.sparks.push({x:e.x!,z:e.z!,vx:Math.cos(angle)*speed,vz:Math.sin(angle)*speed,height:.85,rise:1+this.random()*1.8,age:0,life:.18+this.random()*.24,gold:i%3!==0});
   }
   if(this.sparks.length>384)this.sparks.splice(0,this.sparks.length-384);
  }
  return true;
 }
 update(dt:number){
  // Position is derived from age when drawing, avoiding frame-rate-dependent integration.
  dt=Math.max(0,Math.min(dt,.1));
  for(const a of this.arcs)a.age+=dt;
  for(const p of this.sparks)p.age+=dt;
  this.arcs=this.arcs.filter(a=>a.age<a.life);this.sparks=this.sparks.filter(p=>p.age<p.life);
 }
}
