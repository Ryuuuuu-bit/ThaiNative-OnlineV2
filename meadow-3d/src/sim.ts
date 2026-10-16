import { MONSTER_MOTIONS } from './monster-motion-data.ts';
export type Action='attack'|'spin'|'meteor'|'dash'|'potion';
export type SlimeVariant='pink'|'mint'|'sky';
export type KingAttack='slam'|'sweep'|'charge'|'spit'|'summon';
export type MonsterMotion=keyof typeof MONSTER_MOTIONS.slime|keyof typeof MONSTER_MOTIONS.king;
export interface Vec{x:number;z:number}
export interface Enemy extends Vec{
 id:number;hp:number;maxHp:number;boss:boolean;dead:boolean;respawn:number;homeX:number;homeZ:number;
 aggro:number;cooldown:number;windup:number;aimX:number;aimZ:number;hurt:number;phase:number;wander:number;wx:number;wz:number;
 motion:MonsterMotion;motionTime:number;motionDuration:number;bossPhase:1|2;variant:SlimeVariant;deathAge:number;rewarded:boolean;
 attackApplied:boolean;patternIndex:number;history:KingAttack[];engaged:boolean;summoned:boolean;startX:number;startZ:number;
 fx:number;fz:number;vx:number;vz:number;moving:boolean;
}
export interface Player extends Vec{hp:number;maxHp:number;mp:number;maxMp:number;level:number;xp:number;nextXp:number;gold:number;potions:number;dead:boolean;fx:number;fz:number;moving:boolean;attack:number;attackKind:string;combo:number;comboWindow:number;dash:number;invulnerable:number;hurt:number;cd:Record<Action,number>}
export interface Event extends Vec{type:string;[key:string]:any}
export interface Drop extends Vec{id:number;gold:number;xp:number;time:number}
export interface Projectile extends Vec{id:number;owner:number;vx:number;vz:number;life:number;damage:number;phase:1|2}
export const CAMP={x:-7,z:8},ARENA={x:1,z:-9};
export const CD:Record<Action,number>={attack:.38,spin:4,meteor:6,dash:1.5,potion:7};
export const KING_PATTERN:KingAttack[]=['slam','sweep','charge','spit','summon'];
export const OBSTACLES=[{x:-11,z:-6,r:1.1},{x:-8,z:-10,r:1},{x:8,z:-9,r:1},{x:-12,z:5,r:1},{x:10,z:8,r:1},{x:5,z:10,r:.8},{x:-5,z:-2,r:.7},{x:5,z:3,r:.6}];
export function water(x:number,z:number){return ((x-11)/3.1)**2+((z+1)/4.2)**2<1&&Math.abs(z)>.8;}
export function walkable(x:number,z:number,r=.3){return x>-17+r&&x<17-r&&z>-14+r&&z<14-r&&!water(x,z)&&!OBSTACLES.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+r);}
function move(e:Vec,x:number,z:number){if(walkable(e.x+x,e.z))e.x+=x;if(walkable(e.x,e.z+z))e.z+=z;}
export function createGame(seed=123){
 let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 const p:Player={x:-1,z:6,hp:120,maxHp:120,mp:80,maxMp:80,level:1,xp:0,nextXp:60,gold:0,potions:5,dead:false,fx:0,fz:-1,moving:false,attack:0,attackKind:'',combo:0,comboWindow:0,dash:0,invulnerable:0,hurt:0,cd:{attack:0,spin:0,meteor:0,dash:0,potion:0}};
 const g={p,time:0,random,enemies:[] as Enemy[],events:[] as Event[],drops:[] as Drop[],projectiles:[] as Projectile[],nextId:1,kills:0,bossSpawned:false,won:false,target:null as number|null,destination:null as Vec|null,meteors:[] as {x:number;z:number;time:number}[]};
 const positions=[[-4,3],[2,3],[-6,-.5],[3,-1],[-8,-5],[5,-6],[7,5],[-2,-6],[0,0],[7,-10]];
 positions.forEach(([x,z],i)=>spawn(g,x,z,false,i===6?'mint':i===9?'sky':'pink'));return g;
}
export type Game=ReturnType<typeof createGame>;
function duration(e:Enemy,motion:MonsterMotion){return (MONSTER_MOTIONS[e.boss?'king':'slime'] as any)[motion]?.duration||1;}
function setMotion(e:Enemy,motion:MonsterMotion){if(e.motion!==motion){e.motion=motion;e.motionTime=0;e.motionDuration=duration(e,motion);e.attackApplied=false;}}
export function spawn(g:Game,x:number,z:number,boss=false,variant:SlimeVariant='pink',summoned=false){
 const hp=boss?900:summoned?28:variant==='pink'?48:72;
 const e:Enemy={id:g.nextId++,x,z,hp,maxHp:hp,boss,dead:false,respawn:0,homeX:x,homeZ:z,aggro:0,cooldown:.8,windup:0,aimX:x,aimZ:z,hurt:0,phase:g.random()*6.28,wander:0,wx:x,wz:z,motion:'idle',motionTime:0,motionDuration:boss?1.8:1.65,bossPhase:1,variant,deathAge:0,rewarded:false,attackApplied:false,patternIndex:0,history:[],engaged:false,summoned,startX:x,startZ:z,fx:0,fz:1,vx:0,vz:0,moving:false};g.enemies.push(e);return e;
}
function emit(g:Game,type:string,data:any={}){g.events.push({type,x:g.p.x,z:g.p.z,...data});}
function warn(g:Game,e:Enemy,x:number,z:number,r:number,time:number){emit(g,'warning',{x,z,r,duration:time,id:e.id,attack:e.motion});}
function reward(g:Game,e:Enemy){
 if(e.rewarded)return;e.rewarded=true;
 g.drops.push({id:g.nextId++,x:e.x,z:e.z,gold:e.boss?180:e.summoned?3:7+Math.floor(g.random()*8),xp:e.boss?200:e.summoned?4:24,time:0});
 if(e.boss){g.won=true;emit(g,'victory');}
}
function defeat(g:Game,e:Enemy){
 e.dead=true;e.deathAge=0;e.respawn=12;e.windup=0;e.hurt=0;setMotion(e,'death');g.kills++;
 if(g.target===e.id)g.target=null;
 emit(g,'kill',{x:e.x,z:e.z,id:e.id,boss:e.boss,variant:e.variant});
 if(e.boss){g.projectiles=g.projectiles.filter(p=>p.owner!==e.id);for(const minion of g.enemies)if(minion.summoned&&!minion.dead){minion.dead=true;minion.deathAge=0;minion.rewarded=true;setMotion(minion,'death');}}
 if(g.kills>=6&&!g.bossSpawned){g.bossSpawned=true;spawn(g,ARENA.x,ARENA.z,true);emit(g,'boss');}
}
function hit(g:Game,e:Enemy,damage:number,crit=false){
 if(e.dead)return;damage=Math.round(damage*(e.boss&&e.motion==='stun'?1.25:1));e.hp=Math.max(0,e.hp-damage);e.hurt=.18;e.aggro=e.boss?30:10;
 if(!e.boss){const dx=e.x-g.p.x,dz=e.z-g.p.z,d=Math.hypot(dx,dz)||1;move(e,dx/d*.23,dz/d*.23);}
 emit(g,'hit',{x:e.x,z:e.z,id:e.id,damage,crit,boss:e.boss,variant:e.variant});
 if(e.hp===0){defeat(g,e);return;}
 if(e.boss&&e.bossPhase===1&&e.hp<=e.maxHp*.5){e.bossPhase=2;e.windup=0;setMotion(e,'transform');g.projectiles=g.projectiles.filter(p=>p.owner!==e.id);emit(g,'phase2',{x:e.x,z:e.z,id:e.id});}
 else if(e.boss&&(e.motion==='idle'||e.motion==='move'))setMotion(e,'hit');
}
function hurt(g:Game,amount:number){const p=g.p;if(p.dead)return;if(p.invulnerable>0){emit(g,'evade');return;}p.hp=Math.max(0,p.hp-amount);p.hurt=.3;p.invulnerable=.55;emit(g,'hurt',{amount});if(p.hp===0){p.dead=true;g.target=null;g.destination=null;emit(g,'death');}}
export function action(g:Game,a:Action){
 const p=g.p;if(p.dead||p.cd[a]>0)return false;
 if(a==='attack'){
  if(p.dash>0)return false;p.combo=p.comboWindow>0?(p.combo+1)%3:0;p.comboWindow=1.1;p.attack=.34;p.attackKind='slash';p.cd.attack=p.combo===2?.55:CD.attack;
  const nearby=g.enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<2.3).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
  if(nearby){const d=Math.hypot(nearby.x-p.x,nearby.z-p.z)||1;p.fx=(nearby.x-p.x)/d;p.fz=(nearby.z-p.z)/d;}
  emit(g,'slash',{dx:p.fx,dz:p.fz,combo:p.combo});
  for(const e of [...g.enemies]){const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);if(!e.dead&&d<(e.boss?2.3:1.8)&&(dx*p.fx+dz*p.fz)/(d||1)>-.2)hit(g,e,(p.combo===2?28:16)+(p.level-1)*3,p.combo===2);}return true;
 }
 if(a==='spin'||a==='meteor'){
  const cost=a==='spin'?20:30;if(p.mp<cost){emit(g,'notice',{text:'MP ไม่พอ รอพลังฟื้นสักครู่'});return false;}p.mp-=cost;p.cd[a]=CD[a];p.attack=a==='spin'?.6:.8;p.attackKind=a;
  if(a==='spin'){emit(g,'spin');for(const e of [...g.enemies])if(!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<3.1)hit(g,e,38+(p.level-1)*4,true);}
  else{const target=g.enemies.find(e=>e.id===g.target&&!e.dead)||g.enemies.filter(e=>!e.dead&&Math.hypot(e.x-p.x,e.z-p.z)<8).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];g.meteors.push({x:target?target.x:p.x+p.fx*4,z:target?target.z:p.z+p.fz*4,time:.65});emit(g,'meteor',{...g.meteors[g.meteors.length-1],duration:.65});}return true;
 }
 if(a==='dash'){p.cd.dash=CD.dash;p.dash=.22;p.invulnerable=.35;g.target=null;g.destination=null;emit(g,'dash',{dx:p.fx,dz:p.fz});return true;}
 if(a==='potion'){if(p.potions<=0){emit(g,'notice',{text:'ยาหมดแล้ว กลับไปฟื้นพลังที่แคมป์'});return false;}if(p.hp>=p.maxHp)return false;const amount=Math.min(65,p.maxHp-p.hp);p.hp+=amount;p.potions--;p.cd.potion=CD.potion;emit(g,'heal',{amount});return true;}return false;
}
export function revive(g:Game){const p=g.p;p.x=CAMP.x;p.z=CAMP.z;p.hp=p.maxHp;p.mp=p.maxMp;p.potions=5;p.dead=false;p.invulnerable=3;p.dash=0;p.attack=0;p.hurt=0;g.projectiles=[];for(const e of g.enemies){e.aggro=0;e.windup=0;if(!e.dead){setMotion(e,'idle');e.cooldown=1;e.engaged=false;}}emit(g,'notice',{text:'พักฟื้นแล้ว พร้อมออกผจญภัยอีกครั้ง'});}
function face(e:Enemy,x:number,z:number){const d=Math.hypot(x-e.x,z-e.z)||1;e.fx=(x-e.x)/d;e.fz=(z-e.z)/d;}
function startKingAttack(g:Game,e:Enemy){
 const attack=KING_PATTERN[e.patternIndex++%KING_PATTERN.length];setMotion(e,attack);e.history.push(attack);e.startX=e.x;e.startZ=e.z;e.aimX=g.p.x;e.aimZ=g.p.z;face(e,e.aimX,e.aimZ);
 const speed=e.bossPhase===2?1.3:1;e.windup=(attack==='slam'?.85:attack==='sweep'?.7:attack==='summon'?.9:.8)/speed;
 if(attack==='charge'){e.aimX=e.x+e.fx*6;e.aimZ=e.z+e.fz*6;for(const t of [.25,.5,.75,1])warn(g,e,e.x+e.fx*6*t,e.z+e.fz*6*t,1.1,e.windup);}
 else warn(g,e,attack==='slam'?e.aimX:e.x,attack==='slam'?e.aimZ:e.z,attack==='slam'?2.6:attack==='sweep'?3.5:attack==='summon'?2.3:1.2,e.windup);
 emit(g,'kingAttack',{x:e.x,z:e.z,id:e.id,attack,phase:e.bossPhase});
}
function summon(g:Game,e:Enemy){
 // Cap lingering summons, while each summon cast still creates exactly three.
 const living=g.enemies.filter(m=>m.summoned&&!m.dead);for(const old of living.slice(0,Math.max(0,living.length-6))){old.dead=true;old.rewarded=true;old.deathAge=0;setMotion(old,'death');}
 const ids:number[]=[];
 for(let i=0;i<3;i++){let x=e.x,z=e.z;for(let j=0;j<12;j++){const a=i/3*Math.PI*2+j*.27,tx=e.x+Math.cos(a)*2.2,tz=e.z+Math.sin(a)*2.2;if(walkable(tx,tz)){x=tx;z=tz;break;}}const m=spawn(g,x,z,false,e.bossPhase===2?(i%2?'sky':'mint'):'pink',true);m.aggro=30;ids.push(m.id);}
 emit(g,'summon',{x:e.x,z:e.z,id:e.id,minions:ids});
}
function kingStep(g:Game,e:Enemy,dt:number){
 const p=g.p,dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||1;
 if(d<9)e.aggro=10;
 if(!e.engaged&&e.aggro>0){e.engaged=true;setMotion(e,'roar');face(e,p.x,p.z);return;}
 const speed=e.bossPhase===2?1.3:1;
 if(['slam','sweep','charge','spit','summon'].includes(e.motion)){
  const t=e.motionTime;e.windup=Math.max(0,e.windup-dt);
  if(e.motion==='slam'){
   if(t>=.55&&t<.85){const k=Math.min(1,(t-.55)/.3);const x=e.startX+(e.aimX-e.startX)*k,z=e.startZ+(e.aimZ-e.startZ)*k;move(e,x-e.x,z-e.z);}
   if(t>=.85&&!e.attackApplied){e.attackApplied=true;if(Math.hypot(p.x-e.aimX,p.z-e.aimZ)<2.6)hurt(g,e.bossPhase===2?30:24);emit(g,'slam',{x:e.aimX,z:e.aimZ,id:e.id});}
  }
  if(e.motion==='sweep'&&t>=.7&&!e.attackApplied){e.attackApplied=true;if(d<3.5)hurt(g,e.bossPhase===2?25:20);emit(g,'sweep',{x:e.x,z:e.z,id:e.id});}
  if(e.motion==='charge'&&t>=.8&&t<1.4){move(e,e.fx*10*dt*speed,e.fz*10*dt*speed);if(!e.attackApplied&&Math.hypot(p.x-e.x,p.z-e.z)<1.55){e.attackApplied=true;hurt(g,e.bossPhase===2?28:22);}}
  if(e.motion==='spit'&&t>=.8&&!e.attackApplied){e.attackApplied=true;const a=Math.atan2(e.fz,e.fx);for(const delta of[-.25,0,.25])g.projectiles.push({id:g.nextId++,owner:e.id,x:e.x+e.fx*1.1,z:e.z+e.fz*1.1,vx:Math.cos(a+delta)*4.5*speed,vz:Math.sin(a+delta)*4.5*speed,life:2.5,damage:e.bossPhase===2?16:12,phase:e.bossPhase});emit(g,'spit',{x:e.x,z:e.z,id:e.id});}
  if(e.motion==='summon'&&t>=.9&&!e.attackApplied){e.attackApplied=true;summon(g,e);}
  if(t>=e.motionDuration){if(e.motion==='slam'){setMotion(e,'stun');emit(g,'stun',{x:e.x,z:e.z,id:e.id});}else{setMotion(e,'idle');e.cooldown=e.bossPhase===2?.6:1.1;}}return;
 }
 if(['hit','stun','roar','transform'].includes(e.motion)){
  if(e.motionTime>=e.motionDuration){const prior=e.motion;setMotion(e,'idle');e.cooldown=prior==='transform'?.25:prior==='stun'?.45:.25;}return;
 }
 if(e.aggro<=0){setMotion(e,'idle');return;}
 if(d>6){setMotion(e,'move');move(e,dx/d*1.5*dt*speed,dz/d*1.5*dt*speed);}
 else{setMotion(e,'idle');if(e.cooldown<=0)startKingAttack(g,e);}
}
function slimeStep(g:Game,e:Enemy,dt:number){
 const p=g.p,dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||1;if(d<2.6)e.aggro=Math.max(e.aggro,6);
 if(e.motion==='attack'){
  e.windup=Math.max(0,.5-e.motionTime);
  if(e.motionTime>=.5&&e.motionTime<.68){move(e,e.fx*5*dt,e.fz*5*dt);if(!e.attackApplied&&Math.hypot(p.x-e.x,p.z-e.z)<1.7){e.attackApplied=true;hurt(g,e.variant==='pink'?9:13);}}
  if(e.motionTime>=e.motionDuration){setMotion(e,'idle');e.cooldown=1.5;}return;
 }
 if(e.aggro>0){
  if(e.cooldown<=0&&d<1.35){face(e,p.x,p.z);setMotion(e,'attack');e.windup=.5;warn(g,e,p.x,p.z,.9,.5);}
  else if(d>1.0){setMotion(e,'hop');move(e,dx/d*(e.variant==='pink'?2:2.2)*dt,dz/d*(e.variant==='pink'?2:2.2)*dt);}
  else setMotion(e,'idle');
 }else{
  e.wander-=dt;if(e.wander<=0){e.wander=2+g.random()*3;e.wx=e.homeX+(g.random()-.5)*3;e.wz=e.homeZ+(g.random()-.5)*3;}
  const x=e.wx-e.x,z=e.wz-e.z,length=Math.hypot(x,z);if(length>.2){setMotion(e,'hop');move(e,x/length*.45*dt,z/length*.45*dt);}else setMotion(e,'idle');
 }
}
export function step(g:Game,dt:number,input:Vec={x:0,z:0}){
 const p=g.p;g.time+=dt;for(const a of Object.keys(p.cd)as Action[])p.cd[a]=Math.max(0,p.cd[a]-dt);for(const a of['attack','comboWindow','invulnerable','hurt']as const)p[a]=Math.max(0,p[a]-dt);
 if(!p.dead){
  p.mp=Math.min(p.maxMp,p.mp+dt*4);if(Math.hypot(p.x-CAMP.x,p.z-CAMP.z)<2)p.hp=Math.min(p.maxHp,p.hp+dt*20);
  let ix=input.x,iz=input.z;if(Math.hypot(ix,iz)>.05){g.target=null;g.destination=null;}
  const target=g.enemies.find(e=>e.id===g.target&&!e.dead);
  if(target){const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);if(d>(target.boss?2:1.4)){ix=dx/d;iz=dz/d;}else{ix=iz=0;action(g,'attack');}}
  else if(g.destination){const dx=g.destination.x-p.x,dz=g.destination.z-p.z,d=Math.hypot(dx,dz);if(d>.15){ix=dx/d;iz=dz/d;}else g.destination=null;}
  if(p.dash>0){const t=Math.min(dt,p.dash);move(p,p.fx*14*t,p.fz*14*t);p.dash=Math.max(0,p.dash-dt);p.moving=true;}
  else{const d=Math.hypot(ix,iz);p.moving=d>.05;if(p.moving){ix/=Math.max(1,d);iz/=Math.max(1,d);p.fx=ix;p.fz=iz;const speed=p.attack>0?1.6:4.5;move(p,ix*speed*dt,iz*speed*dt);}}
 }
 for(const e of [...g.enemies]){
  e.hurt=Math.max(0,e.hurt-dt);e.cooldown=Math.max(0,e.cooldown-dt);e.aggro=Math.max(0,e.aggro-dt);e.vx=e.vz=0;e.moving=false;
  if(e.dead){e.deathAge+=dt;e.motionTime=e.deathAge;e.respawn-=dt;if(e.deathAge>=duration(e,'death'))reward(g,e);if(e.respawn<=0&&!e.boss&&!e.summoned){e.dead=false;e.hp=e.maxHp;e.x=e.homeX;e.z=e.homeZ;e.aggro=0;e.windup=0;e.rewarded=false;e.deathAge=0;setMotion(e,'idle');}continue;}
  if(p.dead){e.windup=0;setMotion(e,'idle');continue;}
  const x=e.x,z=e.z;e.motionTime+=dt*(e.boss&&e.bossPhase===2&&e.motion!=='transform'?1.3:1);
  if(e.boss)kingStep(g,e,dt);else slimeStep(g,e,dt);
  e.vx=(e.x-x)/dt;e.vz=(e.z-z)/dt;e.moving=Math.hypot(e.vx,e.vz)>.01;
  if(e.moving){const v=Math.hypot(e.vx,e.vz);e.fx=e.vx/v;e.fz=e.vz/v;}
 }
 for(let i=g.projectiles.length-1;i>=0;i--){const projectile=g.projectiles[i];projectile.life-=dt;projectile.x+=projectile.vx*dt;projectile.z+=projectile.vz*dt;const collision=Math.hypot(p.x-projectile.x,p.z-projectile.z)<.55;if(collision){hurt(g,projectile.damage);projectile.life=0;}if(projectile.life<=0||!walkable(projectile.x,projectile.z,.05))g.projectiles.splice(i,1);}
 for(let i=g.meteors.length-1;i>=0;i--){const m=g.meteors[i];m.time-=dt;if(m.time<=0){emit(g,'impact',{x:m.x,z:m.z});for(const e of [...g.enemies])if(!e.dead&&Math.hypot(e.x-m.x,e.z-m.z)<2.8)hit(g,e,58+(p.level-1)*5,true);g.meteors.splice(i,1);}}
 for(let i=g.drops.length-1;i>=0;i--){const d=g.drops[i];d.time+=dt;const dx=p.x-d.x,dz=p.z-d.z,dist=Math.hypot(dx,dz);if(!p.dead&&dist<4&&d.time>.25){const speed=Math.min(dist,dt*9);d.x+=dx/(dist||1)*speed;d.z+=dz/(dist||1)*speed;}if(!p.dead&&dist<.45){p.gold+=d.gold;p.xp+=d.xp;emit(g,'pickup',{gold:d.gold,xp:d.xp});while(p.xp>=p.nextXp){p.xp-=p.nextXp;p.level++;p.nextXp=Math.round(p.nextXp*1.45);p.maxHp+=20;p.hp=p.maxHp;p.maxMp+=5;p.mp=p.maxMp;emit(g,'level',{level:p.level});}g.drops.splice(i,1);}else if(d.time>40)g.drops.splice(i,1);}
 g.enemies=g.enemies.filter(e=>!e.summoned||!e.dead||e.deathAge<3);
}
