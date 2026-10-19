/** Wall-clock visual holds: never modify simulation, snapshots, input or audio. */
export class CombatFeel {
 enabled=true;
 private holds=new Map<string,number>();
 private flashes=new Map<number,number>();
 private nudges=new Map<number,{until:number;dx:number;dz:number}>();
 private earthContactUntil=0;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 shake=0;
 constructor(){try{this.enabled=localStorage.getItem('tn-combat-feel')!=='off';}catch{}}
 setEnabled(on:boolean){this.enabled=on;this.holds.clear();this.flashes.clear();this.nudges.clear();this.shake=0;try{localStorage.setItem('tn-combat-feel',on?'on':'off');}catch{}}
 frozen(id:string,now:number){const until=this.holds.get(id)||0;if(now>=until){this.holds.delete(id);return false;}return this.enabled;}
 hold(id:string,ms:number,now:number){this.holds.set(id,Math.max(this.holds.get(id)||0,now+ms));}
 event(e:any,you:string,player:{x:number;z:number},now:number){
  if(!this.enabled)return;
  if(e.playerId===you&&['skill','slash','dash'].includes(e.type))this.earthContactUntil=0;
  if(e.type==='skillImpact'&&e.skillId==='earth_break'){
   if(e.playerId===you){this.hold(you,120,now);this.earthContactUntil=now+16;}
   this.shake=Math.max(this.shake,.2);
  }
  if(e.type==='slam')this.shake=Math.max(this.shake,.2);
  if(e.type!=='hit')return;
  this.flashes.set(e.id,now+60);
  if(!e.boss){const d=Math.hypot(e.x-player.x,e.z-player.z)||1;this.nudges.set(e.id,{until:now+140,dx:(e.x-player.x)/d*.075,dz:(e.z-player.z)/d*.075});}
  if(e.playerId===you){
   const ms=now<this.earthContactUntil?120:e.crit?95:e.skillId==='slash'?75:55;this.hold(you,ms,now);this.hold('monster:'+e.id,ms,now);
   // Every own sword contact gets a small kick; crits and the Slash skill hit harder.
   this.shake=Math.max(this.shake,e.crit?.16:e.skillId==='slash'?.11:.07);
  }
  if(e.crit)this.shake=Math.max(this.shake,.075);
 }
 flash(id:number,now:number){if(!this.enabled)return 0;if(now<(this.flashes.get(id)||0))return 1;this.flashes.delete(id);return 0;}
 nudge(id:number,now:number){const n=this.nudges.get(id);if(!n||now>=n.until||!this.enabled||this.reduced.matches){this.nudges.delete(id);return {x:0,z:0};}const f=(n.until-now)/140;return {x:n.dx*f,z:n.dz*f};}
 camera(dt:number){const value=this.enabled&&!this.reduced.matches?this.shake:0;this.shake=Math.max(0,this.shake-dt*.9);return value;}
}
export class AutoQuality {
 lowSeconds=0; automatic=false;
 private sampleSeconds=0;private sampleFrames=0;
 threshold(){return innerWidth<650?28:45;}
 update(dt:number,ready:boolean){
  if(!ready){this.sampleSeconds=this.sampleFrames=this.lowSeconds=0;return false;}
  this.sampleSeconds+=Math.max(0,dt);this.sampleFrames++;
  if(this.sampleSeconds<1)return false;
  this.lowSeconds=this.sampleFrames/this.sampleSeconds<this.threshold()?this.lowSeconds+this.sampleSeconds:0;
  this.sampleSeconds=this.sampleFrames=0;
  if(!this.automatic&&this.lowSeconds>=3){this.automatic=true;return true;}return false;
 }
 reset(){this.lowSeconds=this.sampleSeconds=this.sampleFrames=0;this.automatic=false;}
}
