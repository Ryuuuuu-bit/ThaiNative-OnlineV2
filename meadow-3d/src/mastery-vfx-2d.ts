import {masteryVisual,masteryVisualEvent} from './mastery-visuals.ts';
import type {VfxFrame} from './skill-vfx-2d.ts';
type Point={x:number;z:number};
type Frame=VfxFrame&{enemy:(id:number)=>any;reducedMotion?:boolean};
type Fx={e:any;id:string;name:string;family:string;color:string;phase:string;t0:number;life:number};
const TAU=Math.PI*2,clamp=(n:number)=>Math.max(0,Math.min(1,n));
const noise=(n:number)=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const arrowFamilies=new Set(['arrow','aim','pierce','countershot','knockback','retreat']);
const daggerFamilies=new Set(['stab','ambush','execute','poisonknife','knifefan']);
const healFamilies=new Set(['heal','hot','compress','cleanse','purify','healzone','channel','transfer','link','emergency','mist']);
const zoneFamilies=new Set(['flameburst','meteor','firezone','frostzone','healzone','castzone','banishzone','rain','trap','roottrap','smoke']);

/** Presentation consumes server events and snapshots; it never changes the combat model. */
export class MasteryVfx2D{
 time=0;readonly max=96;effects:Fx[]=[];
 readonly petAttacks=new Map<number,number>();
 private facing=new Map<string,{dx:number;dz:number}>();
 private casting=new Map<string,{id:string;until:number;automatic:boolean;target?:Point;radius:number;petId?:number}>();
 event(e:any){
  if(e.type==='bowShot'&&[e.x,e.z,e.dx,e.dz,e.targetX,e.targetZ].every(Number.isFinite)){
   this.effects.push({e:{...e},id:'basic-bow',name:'ยิงธนู',family:'basic-bow',color:'#e5d6a8',phase:'hit',t0:this.time,life:.34});
   if(this.effects.length>this.max)this.effects.shift();return true;
  }
  if(e.type==='skillCancel'){const pet=this.casting.get(e.playerId)?.petId;if(pet!==undefined)this.petAttacks.delete(pet);this.casting.delete(e.playerId);return true;}
  if(e.type==='hit'&&Number.isFinite(e.petId))this.petAttacks.set(e.petId,this.time-.3);
  const visual=masteryVisualEvent(e);if(!visual)return false;
  if(e.type==='summonAttack'&&Number.isFinite(e.petId))this.petAttacks.set(e.petId,this.time);
  if(e.type==='summonEnd')this.petAttacks.delete(e.petId);
  if(e.type==='skill'&&Number.isFinite(e.petId)&&['shaman_03','shaman_11'].includes(e.skillId))this.petAttacks.set(e.petId,this.time+(e.duration??0)-.3);
  if(e.type==='skill'&&e.playerId){this.facing.set(e.playerId,{dx:e.dx??0,dz:e.dz??-1});this.casting.set(e.playerId,{id:visual.v.id,until:this.time+(e.duration??0),automatic:!!e.autoSpell,target:Number.isFinite(e.targetX)&&Number.isFinite(e.targetZ)?{x:e.targetX,z:e.targetZ}:undefined,radius:e.r??2.5,petId:e.petId});}
  if(visual.phase==='state'||visual.phase==='handled')return true;
  const dir=this.facing.get(e.playerId);
  this.effects.push({e:{...dir,...e},id:visual.v.id,name:visual.v.name,family:visual.v.family,color:visual.v.color,phase:visual.phase,t0:this.time,life:visual.life});
  if(this.effects.length>this.max)this.effects.splice(0,this.effects.length-this.max);
  return true;
 }
 clear(){this.effects.length=0;this.petAttacks.clear();this.facing.clear();this.casting.clear();}
 advance(dt:number){this.time+=Math.max(0,Math.min(.1,dt));this.effects=this.effects.filter(f=>this.time-f.t0<f.life);for(const[id,at]of this.petAttacks)if(this.time-at>1)this.petAttacks.delete(id);}
 snapshot(){return{effects:this.effects.length,skills:[...new Set(this.effects.map(f=>f.id))],petAttacks:this.petAttacks.size};}
 private ring(f:Frame,p:Point,r:number,color:string,alpha:number,width=1.5,start=0,end=TAU){
  const c=f.ctx;c.save();c.globalAlpha=clamp(alpha);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();
  for(let i=0;i<=40;i++){const a=start+(end-start)*i/40,q=f.screen(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r,.04);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);}c.stroke();c.restore();
 }
 private glow(f:Frame,p:Point,color:string,r:number,alpha:number,height=.7){
  const c=f.ctx,q=f.screen(p.x,p.z,height),size=Math.max(2,r*f.scale);c.save();c.globalAlpha=clamp(alpha);
  const g=c.createRadialGradient(q.x,q.y,0,q.x,q.y,size);g.addColorStop(0,'#fff9e5');g.addColorStop(.16,color);g.addColorStop(1,color+'00');
  c.globalCompositeOperation='lighter';c.fillStyle=g;c.beginPath();c.arc(q.x,q.y,size,0,TAU);c.fill();c.restore();
 }
 private sparks(f:Frame,p:Point,color:string,age:number,life:number,seed:number,count=9,radius=1.2){
  if(f.reducedMotion){count=Math.min(count,3);radius*=.4;}
  const c=f.ctx,k=clamp(age/life),fade=(1-k)**1.5;c.save();c.strokeStyle=color;c.lineCap='round';
  for(let i=0;i<count;i++){const a=noise(seed+i*3)*TAU,speed=.4+noise(seed+i*7),r=radius*k*speed,h=.25+Math.sin(k*Math.PI)*(.4+noise(i+seed)),q=f.screen(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r,h),b=f.screen(p.x+Math.cos(a)*Math.max(0,r-.15),p.z+Math.sin(a)*Math.max(0,r-.15),h-.07);c.globalAlpha=fade*(.5+noise(seed+i));c.lineWidth=1+noise(seed+i*2)*2;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(q.x,q.y);c.stroke();}c.restore();
 }
 private ray(f:Frame,a:Point,b:Point,color:string,alpha:number,arrow=false){
  const c=f.ctx,p=f.screen(a.x,a.z,.85),q=f.screen(b.x,b.z,.8),angle=Math.atan2(q.y-p.y,q.x-p.x);c.save();c.globalAlpha=clamp(alpha);c.lineCap='round';
  c.strokeStyle=color+'55';c.lineWidth=7;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
  c.strokeStyle=arrow?'#e5d6a8':'#fff7dc';c.lineWidth=arrow?2:1.2;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
  if(arrow){c.fillStyle='#fff0d2';c.translate(q.x,q.y);c.rotate(angle);c.beginPath();c.moveTo(5,0);c.lineTo(-9,-3);c.lineTo(-6,0);c.lineTo(-9,3);c.closePath();c.fill();}c.restore();
 }
 private flames(f:Frame,p:Point,age:number,life:number,radius:number,seed:number,continuous=false){
  const c=f.ctx,k=clamp(age/life),fade=continuous?.8:(1-k)**1.2;
  c.save();c.globalAlpha=fade;
  for(let i=0;i<(f.reducedMotion?3:f.highQuality?9:5);i++){
   const t=continuous?(age*1.1+i*.17)%1:k,a=i/9*TAU,r=radius*(.25+t*.65),q=f.screen(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r,.15),h=f.scale*(.55+noise(seed+i)*.8)*(continuous?1-t*.65:1-k),w=h*.32,lean=Math.sin(a+age*6)*w;
   c.fillStyle=i%2?'#ed7739':'#ffb54e';c.beginPath();c.moveTo(q.x-w,q.y);c.bezierCurveTo(q.x-w*.7,q.y-h*.4,q.x+lean-w*.3,q.y-h*.4,q.x+lean,q.y-h);c.bezierCurveTo(q.x+w*.3,q.y-h*.35,q.x+w*1.3,q.y-h*.18,q.x+w,q.y);c.closePath();c.fill();
   c.fillStyle='#ffe5a0';c.beginPath();c.moveTo(q.x-w*.5,q.y);c.lineTo(q.x+lean*.5,q.y-h*.55);c.lineTo(q.x+w*.5,q.y);c.fill();
  }c.restore();
 }
 private ice(f:Frame,p:Point,age:number,life:number,seed:number){
  const c=f.ctx,k=clamp(age/life);c.save();c.globalAlpha=(1-k)*.85;
  for(let i=0;i<7;i++){const a=i*TAU/7,r=k*(.5+noise(seed+i)),q=f.screen(p.x+Math.cos(a)*r,p.z+Math.sin(a)*r,.35+Math.sin(k*Math.PI)*.5),h=f.scale*(.1+noise(i)*.12);c.fillStyle='#b4e6ef';c.strokeStyle='#e5fbff';c.lineWidth=.8;c.beginPath();c.moveTo(q.x,q.y-h);c.lineTo(q.x+h*.45,q.y);c.lineTo(q.x,q.y+h*.65);c.lineTo(q.x-h*.45,q.y);c.closePath();c.fill();c.stroke();}c.restore();
 }
 pre(f:Frame,actors:any[],smoke:any[],serverTime:number){
  const motion=f.reducedMotion?0:this.time;
  for(const field of smoke.slice(-32)){
   if(field.until<=serverTime)continue;
   this.ring(f,field,3,'#c3afd9',.65,1.5);
   const c=f.ctx;c.save();
   for(let i=0;i<(f.highQuality?12:6);i++){const a=noise(field.id+i)*TAU+motion*.15,r=Math.sqrt(noise(field.id+i*7))*2.8,q=f.screen(field.x+Math.cos(a)*r,field.z+Math.sin(a)*r,.15+noise(i)*.3),size=f.scale*(.5+noise(i*3)*.45);const g=c.createRadialGradient(q.x,q.y,0,q.x,q.y,size);g.addColorStop(0,'#b6accb65');g.addColorStop(1,'#5b466c00');c.fillStyle=g;c.beginPath();c.arc(q.x,q.y,size,0,TAU);c.fill();}c.restore();
  }
  for(const p of actors){
   if(p.dead)continue;
   const cast=this.casting.get(p.id),v=masteryVisual(cast?.id??p.attackKind);
   if((p.castRemaining>0||cast?.automatic&&cast.until>this.time)&&v&&!v.passive&&v.family!=='legacy-sword'){
    this.ring(f,p,.7,v.color,.7,2,motion*.8,motion*.8+TAU*.82);
    this.ring(f,p,.9,v.color,.3,1,-motion,-motion+TAU*.7);
    if(cast?.target&&zoneFamilies.has(v.family))this.ring(f,cast.target,cast.radius,v.color,.6,1.8);
   }
   if((!cast?.automatic&&p.castRemaining<=0)||(cast?.automatic&&cast.until<=this.time)||p.dead)this.casting.delete(p.id);
   for(const zone of (p.masteryFx?.zones??[]).slice(-8)){
    const v=masteryVisual(zone.skillId);if(!v||zone.until<=serverTime)continue;
    const armed=zone.armed>serverTime,alpha=armed?.25:.65;
    this.ring(f,zone,zone.radius,v.color,alpha,armed?1:2);
    const c=f.ctx;c.save();c.globalAlpha=alpha;c.strokeStyle=v.color;c.lineWidth=1.5;
    if(['trap','roottrap'].includes(v.family)){
     for(let i=0;i<6;i++){const a=i*TAU/6,q=f.screen(zone.x+Math.cos(a)*.8,zone.z+Math.sin(a)*.8,.02),b=f.screen(zone.x+Math.cos(a+.6)*.4,zone.z+Math.sin(a+.6)*.4,.02);c.beginPath();c.moveTo(q.x,q.y);c.lineTo(b.x,b.y);c.stroke();}
    }else if(v.family==='rain'){
     for(let i=0;i<(f.reducedMotion?3:10);i++){const a=noise(i+zone.id)*TAU,r=noise(i*7+zone.id)*zone.radius,t=(motion*2+i*.17)%1,pos={x:zone.x+Math.cos(a)*r,z:zone.z+Math.sin(a)*r};const q=f.screen(pos.x,pos.z,3*(1-t));c.strokeStyle='#ffe6b4';c.lineWidth=2;c.shadowColor='#5b482e';c.shadowBlur=2;c.beginPath();c.moveTo(q.x-8,q.y-24);c.lineTo(q.x,q.y);c.lineTo(q.x-5,q.y-5);c.moveTo(q.x,q.y);c.lineTo(q.x+1,q.y-8);c.stroke();}
    }else if(v.family==='firezone')this.ring(f,zone,zone.radius*.7,v.color,.3);
    else if(v.family==='frostzone')this.ice(f,zone,motion%1,1,zone.id);
    else {this.ring(f,zone,zone.radius*.75,v.color,.25,1,motion*.2,motion*.2+TAU*.85);const q=f.screen(zone.x,zone.z,.06);c.font='16px serif';c.textAlign='center';c.fillStyle=v.color;c.fillText(['healzone','mist'].includes(v.family)?'✚':['banishzone','castzone','summonseal'].includes(v.family)?'◇':'✦',q.x,q.y);}
    c.restore();
   }
   if(p.healingOverTime&&p.healingOverTime.until>serverTime)this.ring(f,p,.65,'#a9e5b9',.45+.15*Math.sin(motion*5));
  }
  for(const fx of this.effects){
   if(fx.phase!=='impact'||!zoneFamilies.has(fx.family))continue;
   const age=this.time-fx.t0,k=clamp(age/fx.life),radius=Math.min(8,fx.e.r??(fx.family==='flameburst'?2.5:2));
   this.ring(f,fx.e,radius*(.3+.7*(1-(1-k)**3)),fx.color,(1-k)*.8,2.5);
   if(fx.family==='frostzone')this.ring(f,fx.e,radius*.85,fx.color,(1-k)*.5);
  }
 }
 post(f:Frame,actors:any[],enemies:any[],serverTime:number){
  const motion=f.reducedMotion?0:this.time;
  for(const p of actors){
   if(p.dead)continue;
   // Flames sit above actors so their source area stays readable during clustered combat.
   for(const z of p.masteryFx?.zones??[])if(z.skillId==='mage_12'&&z.until>serverTime)this.flames(f,z,motion,1,z.radius,z.id,true);
   const q=f.screen(p.x,p.z,1),on=(id:string)=>p.statuses?.some((s:any)=>s.id===id&&s.remaining>0);
   if(q.x< -100||q.y< -100||q.x>f.width+100||q.y>f.height+100)continue;
   if(on('magic_shield')){
    const c=f.ctx,r=f.scale*.75;c.save();c.globalAlpha=.36;c.strokeStyle='#b8d9fa';c.fillStyle='#9ac9f515';c.lineWidth=2;c.beginPath();c.ellipse(q.x,q.y,r,r*1.45,0,0,TAU);c.fill();c.stroke();c.globalAlpha=.65;c.beginPath();c.ellipse(q.x,q.y,r*.9,r*.35,-.3+Math.sin(motion)*.12,0,TAU);c.stroke();c.restore();
   }
   if(on('spirit_intercept')){const a=motion*2;this.glow(f,{x:p.x+Math.cos(a)*.65,z:p.z+Math.sin(a)*.65},'#b4d9e4',.25,.65,1.4);}
   if(on('poison_coat'))this.glow(f,{x:p.x+p.fx*.35,z:p.z+p.fz*.35},'#b7d68d',.3,.35,1);
   if(on('push_resist')||on('finisher_ready'))this.ring(f,p,.55,on('finisher_ready')?'#f4d6a0':'#dfbe7f',.7,2,motion*.4,motion*.4+TAU*.65);
   if(on('speed'))for(let i=0;i<3;i++)this.ring(f,p,.35+i*.15,'#c5e6b2',.5,1.4,motion*2+i,motion*2+i+1.4);
   if(p.healingOverTime&&p.healingOverTime.until>serverTime)for(let i=0;i<3;i++){const a=i*TAU/3+motion*.6,t=(motion*.6+i*.33)%1;this.glow(f,{x:p.x+Math.cos(a)*.4,z:p.z+Math.sin(a)*.4},'#a8e1ac',.09,(1-t)*.6,t*1.7);}
   if(p.wisp&&p.wisp.until>=serverTime)for(let i=0;i<Math.min(3,p.wisp.hitsLeft);i++){const a=motion*1.7+i*TAU/3;this.glow(f,{x:p.x+Math.cos(a)*.8,z:p.z+Math.sin(a)*.8},'#bedddb',.19,.8,1.3+Math.sin(a*2)*.16);}
   const link=p.masteryFx?.link;if(link&&link.until>serverTime){const ally=actors.find(a=>a.id===link.ally&&!a.dead);if(ally)this.ray(f,p,ally,'#a5e2bf',.4);}
   for(const effect of (p.masteryFx?.effects??[]).slice(0,16)){
    if(effect.until<=serverTime)continue;
    if(effect.id==='mix_physical_barrier'){this.ring(f,p,.8,'#d9debd',.7,3);this.glow(f,p,'#c3d7b8',.6,.15);continue;}
    if(effect.id==='boxer_counter'){this.ring(f,p,.8,'#f4cc81',.8,2,-motion*2,-motion*2+TAU*.8);continue;}
    const v=masteryVisual(effect.id);if(!v)continue;
    if(p.summon&&['recall','redirect','haste','guardian'].includes(v.family)){this.ring(f,p.summon,.65,v.color,.7,2);if(v.family==='redirect'||v.family==='recall')this.ray(f,p,p.summon,v.color,.45);if(v.family==='guardian')this.glow(f,p.summon,v.color,.6,.2);}
    const c=f.ctx;
    if(['stealth','evasion','decoy'].includes(v.family))this.ring(f,p,.65,v.color,.45,1,motion,motion+4);
    else if(['parry','guard','reflect','coat','force','guardian'].includes(v.family)){const q=f.screen(p.x+p.fx*.45,p.z+p.fz*.45,1);c.save();c.strokeStyle=v.color;c.globalAlpha=.7;c.lineWidth=2;c.beginPath();c.moveTo(q.x-10,q.y-10);c.lineTo(q.x+10,q.y-10);c.lineTo(q.x+8,q.y+3);c.lineTo(q.x,q.y+10);c.lineTo(q.x-8,q.y+3);c.closePath();c.stroke();c.restore();}
    else this.ring(f,p,.6,v.color,.5,1.5,motion*.6,motion*.6+TAU*.65);
    if(effect.targetId!==undefined){const enemy=f.enemy(effect.targetId);if(enemy&&!enemy.dead)this.ring(f,enemy,.6,v.color,.65,2);}
   }
   if(p.decoy&&!p.decoy.dead){const d=p.decoy,q=f.screen(d.x,d.z,.6),c=f.ctx;this.ring(f,d,.45,'#c7a0d9',.6);c.save();c.globalAlpha=.8;c.fillStyle='#e6d2ee';c.font='12px sans-serif';c.textAlign='center';c.fillText('เงาลวง',q.x,q.y-f.scale*.95);c.fillRect(q.x-15,q.y+f.scale*.55,30*Math.max(0,d.hp/d.maxHp),2);c.restore();}
   const mark=p.statuses?.find((s:any)=>s.id==='archer_mark'&&s.remaining>0);
   if(mark?.targetId!==undefined){const target=f.enemy(mark.targetId);if(target&&!target.dead){this.ring(f,target,.65,'#d8e7a0',.85,2);const at=f.screen(target.x,target.z,1.8),c=f.ctx;c.save();c.strokeStyle='#e8e2af';c.lineWidth=2;for(const sign of [-1,1]){c.beginPath();c.moveTo(at.x+sign*9,at.y-5);c.lineTo(at.x+sign*4,at.y);c.lineTo(at.x+sign*9,at.y+5);c.stroke();}c.restore();}}
   if(p.boxerCombo?.steps){const c=f.ctx,at=f.screen(p.x,p.z,1.95);c.save();for(let i=0;i<3;i++){c.fillStyle=i<p.boxerCombo.steps?'#efc781':'#776a4f';c.beginPath();c.arc(at.x+(i-1)*7,at.y,2.3,0,TAU);c.fill();}c.restore();}
  }
  for(const e of enemies){
   if(e.dead)continue;
   if(e.statuses?.some((s:any)=>s.id==='slow'&&s.remaining>0))this.ring(f,e,.55,'#acccdf',.45,1,motion,motion+4.3);
   if(e.statuses?.some((s:any)=>s.id==='freeze'&&s.remaining>0))this.ice(f,e,.2,.8,e.id);
   if(e.statuses?.some((s:any)=>s.id==='stun'&&s.remaining>0)){const c=f.ctx,q=f.screen(e.x,e.z,1.8);c.save();c.fillStyle='#ead392';for(let i=0;i<3;i++){const a=motion*4+i*TAU/3;c.fillRect(q.x+Math.cos(a)*11-2,q.y+Math.sin(a)*4-2,4,4);}c.restore();}
  }
  for(const fx of this.effects){
   const age=this.time-fx.t0,k=clamp(age/fx.life),fade=1-k,e=fx.e,p=e as Point,q=f.screen(p.x,p.z,.8);
   if(q.x< -150||q.y< -150||q.x>f.width+150||q.y>f.height+150)continue;
   const seed=(e.id??0)+(e.hitIndex??0)*13;
   if(fx.family==='mix'){this.ring(f,p,.5+k*1.8,'#e5c987',fade,2);this.ring(f,p,.4+k*1.4,'#a9cbd5',fade,2,-age*2,TAU-age*2);this.sparks(f,p,fx.color,age,fx.life,seed,12,1.4);const c=f.ctx;c.save();c.globalAlpha=fade;c.fillStyle='#ffedb6';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(e.mixId+' · '+fx.name,q.x,q.y-28-k*12);c.restore();continue;}
   if(fx.phase==='displace'){
    const c=f.ctx,a=f.screen(e.fromX,e.fromZ,.08),b=f.screen(p.x,p.z,.08);
    c.save();c.globalAlpha=fade*.7;c.strokeStyle=fx.color;c.lineWidth=2;c.setLineDash([4,4]);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.restore();
    this.ring(f,p,.3+k*.3,fx.color,fade,1.5);continue;
   }
   if(fx.family==='basic-bow'){
    const c=f.ctx,a=f.screen(e.x+e.dx*.45,e.z+e.dz*.45,.95),b=f.screen(e.targetX,e.targetZ,.8),t=clamp(age/fx.life),angle=Math.atan2(b.y-a.y,b.x-a.x);
    c.save();c.translate(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);c.rotate(angle);c.strokeStyle='#e5d6a8';c.fillStyle='#fff0d2';c.lineWidth=2;c.beginPath();c.moveTo(-16,0);c.lineTo(0,0);c.stroke();c.beginPath();c.moveTo(5,0);c.lineTo(-4,-3);c.lineTo(-4,3);c.closePath();c.fill();c.restore();continue;
   }
   if(fx.phase==='start'){
    // Small hand pulse; the sustained cast is driven by castRemaining, so cancellation clears immediately.
    this.glow(f,p,fx.color,.26,fade*.4,1);continue;
   }
   if(fx.phase==='end'){this.sparks(f,p,fx.color,age,fx.life,seed,5,.7);continue;}
   if(fx.family==='chain'&&e.chain&&Number.isFinite(e.fromX)&&Number.isFinite(e.fromZ)){this.ray(f,{x:e.fromX,z:e.fromZ},p,fx.color,fade);this.sparks(f,p,fx.color,age,fx.life,seed,6,.6);continue;}
   if(fx.phase==='hit'){
    if(e.dot){this.glow(f,p,fx.color,.2,fade*.5);this.sparks(f,p,fx.color,age,fx.life,seed,4,.35);continue;}
    const owner=actors.find(p=>p.id===e.playerId),pet=e.petId&&owner?.summon;
    const origin=pet??owner;
    if(origin&&(arrowFamilies.has(fx.family)||['fire','ice','wisp','reflect','poisonknife','medical'].includes(fx.family)))this.ray(f,origin,p,fx.color,fade,arrowFamilies.has(fx.family));
    if(daggerFamilies.has(fx.family)){
     const c=f.ctx;c.save();c.globalAlpha=fade;c.strokeStyle='#eadbd3';c.lineWidth=2.5;c.beginPath();c.moveTo(q.x-13,q.y+8);c.lineTo(q.x+13,q.y-10);c.stroke();c.restore();
    }
    if(fx.family==='fire')this.flames(f,p,age,fx.life,.7,seed);
    if(fx.family==='ice')this.ice(f,p,age,fx.life,seed);
    if(['punch','elbow','finisher','flurry','palm','counter'].includes(fx.family)){
     const c=f.ctx,dir=Math.atan2(e.dz??owner?.fz??-1,e.dx??owner?.fx??0),a=f.screen(p.x-Math.cos(dir)*.6,p.z-Math.sin(dir)*.6,.8);c.save();c.globalAlpha=fade;c.lineCap='round';c.strokeStyle='#efc080';c.lineWidth=fx.family==='finisher'?9:5;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(q.x,q.y);c.stroke();c.strokeStyle='#fff1c7';c.lineWidth=2;c.stroke();c.restore();
    }
    this.glow(f,p,fx.color,['finisher','execute'].includes(fx.family)?.65:.35,fade*.8);
    this.sparks(f,p,fx.color,age,fx.life,seed,f.highQuality?10:6,['finisher','flurry'].includes(fx.family)?1.6:.85);
    continue;
   }
   if(!zoneFamilies.has(fx.family)&&!['flameburst','meteor'].includes(fx.family)){const name=masteryVisual(fx.id)?.name;if(name){const c=f.ctx;c.save();c.globalAlpha=fade*.85;c.font='12px sans-serif';c.textAlign='center';c.strokeStyle='#203035';c.lineWidth=3;c.strokeText((e.immune?'ต้านทาน · ':'')+name,q.x,q.y-24-k*8);c.fillStyle=fx.color;c.fillText((e.immune?'ต้านทาน · ':'')+name,q.x,q.y-24-k*8);c.restore();}}
   if(healFamilies.has(fx.family)){
    this.ring(f,p,.4+k*.8,fx.color,fade,2);
    for(let i=0;i<5;i++){const a=i*TAU/5;this.glow(f,{x:p.x+Math.cos(a)*.5,z:p.z+Math.sin(a)*.5},fx.color,.09,fade,.2+k*1.4);}
    if(['cleanse','purify'].includes(fx.family)){this.ring(f,p,.9,fx.color,fade,1.8);this.sparks(f,p,'#fff0bf',age,fx.life,seed,8,1.5);}
   }else if(['fan','knifefan','push','sweep'].includes(fx.family)){
    const a=Math.atan2(e.dz??-1,e.dx??0),span=fx.family==='push'||fx.family==='sweep'?TAU:Math.PI/2,radius=Math.min(7,e.r??masteryVisual(fx.id)!.range);
    this.ring(f,p,radius*(.2+.8*k),fx.color,fade,2,a-span/2,a+span/2);
    if(fx.family==='fan'||fx.family==='knifefan')for(let i=0;i<5;i++){const t=a-span/2+span*i/4,to={x:p.x+Math.cos(t)*radius*k,z:p.z+Math.sin(t)*radius*k};this.ray(f,p,to,fx.color,fade,fx.family==='fan');}
   }else if(['ward','intercept','guard','parry','coat','chi','combo','reflect','focus','haste','guardian','force'].includes(fx.family)){
    this.ring(f,p,.4+k*.7,fx.color,fade,2);this.glow(f,p,fx.color,.4,fade*.45,1.1);this.sparks(f,p,fx.color,age,fx.life,seed,6,.6);
   }else if(['mark','seal','silence','infuse','weakpoint','summonseal','dispel','reveal'].includes(fx.family)){
    const c=f.ctx;c.save();c.globalAlpha=fade;c.strokeStyle=fx.color;c.lineWidth=2;const r=f.scale*(.35+.3*k);c.translate(q.x,q.y);c.rotate(Math.PI/4+k*.3);c.strokeRect(-r/2,-r/2,r,r);c.beginPath();c.moveTo(-r*.65,0);c.lineTo(r*.65,0);c.stroke();c.restore();this.glow(f,p,fx.color,.3,fade*.4);
   }else{
    const big=zoneFamilies.has(fx.family)||['poisonburst','react','talisman','duo'].includes(fx.family),radius=big?Math.min(4,e.r??2):.9;
    this.glow(f,p,fx.color,radius*.65,fade*.65,.2);
    this.sparks(f,p,fx.color,age,fx.life,seed,f.highQuality?16:8,radius);
    if(big)this.ring(f,p,radius*k,fx.color,fade,2.5);
    if(['flameburst','meteor','firezone'].includes(fx.family))this.flames(f,p,age,fx.life,radius,seed);
    if(fx.family==='frostzone')this.ice(f,p,age,fx.life,seed);
   }
  }
 }
}
