import type {Game,Enemy,Player,MonsterMotion,BossTelegraph} from './sim.js';
import {telegraphContains} from './telegraph-area.js';import {pathSegmentWalkable} from './pathfinding.js';import {walkable} from './collision.js';import {LAYOUTS} from './maps.js';import {lootEvadedWarning} from './loot-effects.js';
export interface YokaiCombat {next:number;recovery?:number;openUntil?:number;stage?:number;pairFacing?:{x:number;z:number};clone?:boolean;expires?:number;action?:{kind:string;left:number;target:{x:number;z:number};areas:BossTelegraph[];targets:string[]};}
interface Hooks {motion:(e:Enemy,m:MonsterMotion)=>void;move:(e:Enemy,x:number,z:number)=>void;movePlayer:(p:Player,x:number,z:number)=>void;hurt:(p:Player,e:Enemy,attack?:string)=>boolean|void;spawn:(x:number,z:number,id:string,parent:number)=>Enemy;}
const ids=new Set(['yokai_01','yokai_rain_umbrella','yokai_03','yokai_bamboo_kodama','yokai_rain_nue','yokai_06','yokai_lantern_rokurokubi','yokai_08']);export const isYokaiEnemy=(id:string)=>ids.has(id);
const near=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z),contains=(a:BossTelegraph,p:{x:number;z:number})=>telegraphContains(a,p.x,p.z);
export function kappaNearWater(g:Game,e:Enemy){return LAYOUTS[g.mapId].water.some(w=>((e.x-w.x)/w.rx)**2+((e.z-w.z)/w.rz)**2<1.6);}
export function yokaiHitMultiplier(g:Game,e:Enemy,p:Player){const front=(p.x-e.x)*e.fx+(p.z-e.z)*e.fz>0;if(e.dataId==='yokai_01')return kappaNearWater(g,e)?.7:1.2;if(e.dataId==='yokai_rain_umbrella'&&front&&e.yokai?.action)return .6;return 1;}
/** Folklore encounters use readable signals and bounded, reward-free fox illusions. */
export function yokaiStep(g:Game,e:Enemy,dt:number,h:Hooks){
 if(!isYokaiEnemy(e.dataId))return false;const s=e.yokai??={next:0},p=g.p,d=near(e,p),boss=e.dataId==='yokai_08',clear=(x:number,z:number)=>walkable(x,z,.4,g.mapId);
 if(s.clone){if(g.time>=(s.expires??0)||!g.enemies.some(v=>v.id===e.summonedBy&&!v.dead)){e.dead=true;e.rewarded=true;e.deathAge=0;h.motion(e,'death');return true;}if(d>1.8){h.motion(e,'hop');h.move(e,(p.x-e.x)/(d||1)*2.8*dt,(p.z-e.z)/(d||1)*2.8*dt);}else{h.motion(e,'attack');e.motionDuration=1.5;}return true;}
 if(e.motion==='transform'){s.action=undefined;s.stage=0;if(e.motionTime<1.5)return true;h.motion(e,'idle');}
 if(e.motion==='hit'){if(e.motionTime<e.motionDuration)return true;h.motion(e,'idle');}
 if(s.recovery){if(s.recovery>g.time)return true;s.recovery=undefined;h.motion(e,'idle');}
 if(s.action){const a=s.action;if(e.motion!=='attack'||!e.telegraph){s.action=undefined;s.stage=0;s.recovery=g.time+.8;g.events.push({type:'warningCancel',id:e.id,x:e.x,z:e.z});return true;}
  a.left-=dt;e.windup=Math.max(0,a.left);e.telegraph.left=e.windup;if(a.left>0)return true;e.telegraph=undefined;s.action=undefined;
  if(a.kind==='split'){
   const points=[{x:e.x-2.4,z:e.z-.8},{x:e.x,z:e.z+2},{x:e.x+2.4,z:e.z-.8}].filter(q=>clear(q.x,q.z)&&pathSegmentWalkable(e,q,clear));
   if(points.length){const real=e.id%points.length;for(const [i,q]of points.entries())if(i!==real){const clone=h.spawn(q.x,q.z,'yokai_06',e.id);clone.yokai={next:Infinity,clone:true,expires:g.time+6};clone.rewarded=true;clone.hp=clone.maxHp=250;}e.x=points[real].x;e.z=points[real].z;g.events.push({type:'yokai_echo',id:e.id,x:e.x,z:e.z,r:2,duration:.6});}
   s.recovery=g.time+.5;return true;
  }
  let reached=true;if(a.kind==='hop'){const dx=a.target.x-e.x,dz=a.target.z-e.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.35));for(let i=0;i<steps;i++)h.move(e,dx/steps,dz/steps);reached=near(e,a.target)<.8;g.events.push({type:'yokai_puddle',id:e.id,x:e.x,z:e.z,r:1.5,duration:3});}
  if(a.kind==='dive'){reached=clear(a.target.x,a.target.z);if(reached){e.x=a.target.x;e.z=a.target.z;}}
  for(const victim of g.players.values())if(!victim.dead){const hit=reached&&a.areas.some(t=>contains(t,victim));if(a.targets.includes(victim.id)&&(!hit||victim.invulnerable>0&&victim.cd.dash>0))lootEvadedWarning(victim,g);if(hit){const connected=h.hurt(victim,e,a.areas[0].id);if(connected&&a.kind==='tug'&&!victim.dead){const distance=near(e,victim)||1;for(let i=0;i<5;i++)h.movePlayer(victim,(e.x-victim.x)/distance*.22,(e.z-victim.z)/distance*.22);}if(connected&&a.kind==='tail'&&!victim.dead)victim.statuses.push({id:'slow',sourceId:'nue_tail:'+e.id,remaining:2,value:.25});}}
  if(a.kind==='wind'){s.stage=1;s.next=g.time+.6;s.recovery=g.time+.4;}
  else if(a.kind==='tail'){s.stage=1;s.next=g.time+.45;s.recovery=g.time+.3;}
  else{s.stage=0;s.recovery=g.time+(a.kind==='club'?1.8:a.kind==='neck'?1.6:1.1);}
  g.events.push({type:'bossBlast',id:e.id,x:a.target.x,z:a.target.z,r:a.kind==='club'?5:2});e.attackApplied=true;return true;
 }
 if(d>(boss?16:8)||p.dead||g.time<s.next||e.motion==='attack')return boss;
 let kind='',windup=1.5,target={x:p.x,z:p.z},areas:BossTelegraph[]=[];const dx=(p.x-e.x)/(d||1),dz=(p.z-e.z)/(d||1);
 const area=(x:number,z:number,radius:number,shape:BossTelegraph['shape']='circle',angle=0,inner=0):BossTelegraph=>({id:'',nameTh:'',x,z,radius,shape,angle,inner,fx:dx,fz:dz,left:windup});
 if(e.dataId==='yokai_01'){kind='tug';areas=[area(e.x,e.z,4,'cone',80)];s.next=g.time+6;}
 else if(e.dataId==='yokai_rain_umbrella'){kind='hop';if(!clear(target.x,target.z)||!pathSegmentWalkable(e,target,clear))return false;areas=[area(target.x,target.z,2)];s.next=g.time+6.5;}
 else if(e.dataId==='yokai_03'){if(s.stage===1){kind='dive';windup=1.2;if(!clear(target.x,target.z)){s.stage=0;s.next=g.time+6;return false;}areas=[area(target.x,target.z,2.2)];s.next=g.time+7;}else{kind='wind';windup=1.6;areas=[area(e.x,e.z,7,'cone',38)];s.next=g.time+7;}}
 else if(e.dataId==='yokai_bamboo_kodama'){kind='echo';windup=1.8;areas=[area(e.x,e.z,3.3)];s.next=g.time+7;for(const side of [-1,1])g.events.push({type:'yokai_echo',id:e.id,x:e.x-dz*3*side,z:e.z+dx*3*side,r:3.3,duration:windup});}
 else if(e.dataId==='yokai_rain_nue'){if(s.stage===1){kind='claw';windup=1.1;const t=area(e.x,e.z,4.5,'cone',100);t.fx=-(s.pairFacing?.x??dz);t.fz=-(s.pairFacing?.z??-dx);areas=[t];s.next=g.time+7;}else{kind='tail';windup=1.5;const t=area(e.x,e.z,4.5,'cone',100);t.fx=dz;t.fz=-dx;s.pairFacing={x:t.fx,z:t.fz};areas=[t];s.next=g.time+7;}}
 else if(e.dataId==='yokai_06'){kind='split';windup=1.3;areas=[area(e.x,e.z,2)];s.next=g.time+12;}
 else if(e.dataId==='yokai_lantern_rokurokubi'){kind='neck';windup=2;areas=[area(e.x,e.z,7.5,'cone',30)];s.next=g.time+7.5;}
 else if(boss){const club=e.patternIndex++%2===0;kind=club?'club':'wave';windup=club?(e.bossPhase===2?1.8:2.3):(e.bossPhase===2?1.7:2.1);areas=[club?area(e.x,e.z,8,'cone',75):area(e.x,e.z,10,'ring',0,3.2)];if(!club)g.events.push({type:'safe_zone',id:e.id,x:e.x,z:e.z,r:3.2,duration:windup});g.events.push({type:'yokai_stance',id:e.id,x:e.x,z:e.z,r:1.5,text:club?'กระบองหนัก':'คลื่นโคม',duration:windup});s.next=g.time+(e.bossPhase===2?5.4:6.5);}
 if(!areas.length)return false;const names:Record<string,string>={tug:'มือคัปปะดึงธาร',hop:'ร่มขาเดียวพุ่งกวาด',wind:'ลมเท็งงูเส้นแคบ',dive:'เท็งงูโฉบตามเงา',echo:'เสียงก้องโคนไผ่',tail:'หางอสรพิษนูเอ',claw:'กรงเล็บนูเอสวนทิศ',split:'เงาคิทสึเนะสามร่าง',neck:'คอโคมชาดกวาดแนว',club:'กระบองโอนิประตูแดง',wave:'คลื่นโคมประตูแดง'};
 for(const t of areas){t.id='yokai_'+kind;t.nameTh=names[kind];t.left=windup;g.events.push({type:'warning',id:e.id,attack:t.id,x:t.x,z:t.z,r:t.radius,shape:t.shape,inner:t.inner,angle:t.angle,fx:t.fx,fz:t.fz,duration:windup,name:t.nameTh});}
 h.motion(e,'attack');e.fx=dx;e.fz=dz;e.windup=windup;e.motionDuration=windup+.7;e.cooldown=windup+1.3;e.telegraph=areas[0];s.action={kind,left:windup,target,areas,targets:[...g.players.values()].filter(p=>!p.dead&&areas.some(t=>contains(t,p))).map(p=>p.id)};return true;
}
