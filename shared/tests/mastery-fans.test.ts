import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,DEFAULT_AUTO} from '../src/index.node.js';
const data=loadGameData();
function fixture(id='archer_03'){
 const g=createGame(781,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Archer=75;p.masteries.Assassin=75;
 Object.assign(p.skills,{archer_01:1,archer_03:1,rogue_01:1,rogue_02:1,rogue_03:1});
 p.x=0;p.z=4;p.fx=1;p.fz=0;p.stats.weaponType=id==='archer_03'?'bow':'dagger';p.stats.atk=101;p.stats.hit=1000;p.stats.crit=0;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=p.maxMp=400;
 return {g,p};
}
function foe(g:ReturnType<typeof createGame>,x=3,z=4){const e=spawn(g,x,z);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',value:1,remaining:99}];return e;}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
const hits=(g:ReturnType<typeof createGame>,id:string)=>g.events.filter(v=>v.type==='hit'&&v.skillId===id);
const coat=(p:ReturnType<typeof fixture>['p'])=>p.statuses.some(s=>s.id==='poison_coat');

test('both fan skills use all accepted ranks, classless learning, bar, cost and physical HIT rules',()=>{
 for(const id of ['archer_03','rogue_03']){
  const school=id==='archer_03'?'Archer':'Assassin',root=id==='archer_03'?'archer_01':'rogue_01';let progress=newJob();progress.skillPoints=3;
  assert.throws(()=>learnSkill(progress,id,data));progress=learnSkill(progress,root,data);assert.throws(()=>learnSkill(progress,id,data),/Mastery 25/);
  progress.masteries[school]=25;progress=learnSkill(progress,id,data);assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?id:null})),data)[0].skill,id);
  for(const rank of data.mastery.skills.find(s=>s.id===id)!.ranks){
   const {g,p}=fixture(id),e=foe(g);p.skills[id]=rank.rank;g.target=e.id;const mp=p.mp,s=resolveSkill(data,id,rank.rank);
   assert.equal(s.sp,rank.mp);assert.equal(s.cooldown,rank.cooldown);assert.equal(s.cast,rank.cast);assert.equal(s.kind,'single');assert.equal(s.type,'physical');assert(action(g,id));g.target=null;
   assert.equal(p.mp,mp-rank.mp);assert.equal(p.cd[id],rank.cooldown);advance(g,rank.cast);assert.equal(hits(g,id).length,1);
   assert.equal(hits(g,id)[0].breakdown.base,101*rank.params.damage/100);assert.equal(hits(g,id)[0].breakdown.hitChance,.95);
  }
 }
});

test('Archer fan hits every enemy in the front 90-degree sector, with range and no simulation-count cap',()=>{
 const {g}=fixture(),front=[[3,4],[2,5],[2,3],[5,4],[7,4]].map(([x,z])=>foe(g,x,z));
 const excluded=[[7.01,4],[1,6],[-.1,4],[0,3]].map(([x,z])=>foe(g,x,z));g.target=front[0].id;
 assert(action(g,'archer_03'));g.target=null;advance(g,.25);assert.equal(hits(g,'archer_03').length,0);advance(g,.05);
 assert(front.every(e=>e.hp<10000));assert(excluded.every(e=>e.hp===10000));assert.equal(hits(g,'archer_03').length,5);
 const impact=g.events.find(v=>v.type==='skillImpact'&&v.skillId==='archer_03')!;assert.equal(impact.angle,90);assert.equal(impact.r,7);assert.equal(impact.dx,1);assert.equal(impact.dz,0);
});

test('fan boundaries are inclusive and point-blank enemies behind the caster are excluded in either aim direction',()=>{
 for(const vertical of [false,true]){
  const {g}=fixture(),primary=foe(g,vertical?0:3,vertical?7:4),edge=foe(g,1,5),outside=foe(g,vertical?1.001:1,vertical?5:5.001),rear=foe(g,vertical?0:-.1,vertical?3.9:4);
  g.target=primary.id;assert(action(g,'archer_03'));g.target=null;advance(g,.3);assert(edge.hp<10000);assert.equal(outside.hp,10000);assert.equal(rear.hp,10000);
 }
});

test('Archer cast locks server aim and still fires when its selected enemy moves or disappears',()=>{
 for(const change of ['moved','dead','removed']){
  const {g,p}=fixture(),e=foe(g),ahead=foe(g,4,4),side=foe(g,0,7);g.target=e.id;assert(action(g,'archer_03'));g.target=null;
  if(change==='moved'){e.x=0;e.z=7;}if(change==='dead'){e.dead=true;e.respawn=999;}if(change==='removed')g.enemies=g.enemies.filter(v=>v!==e);
  p.fx=0;p.fz=1;advance(g,.3);assert(ahead.hp<10000,change);assert.equal(side.hp,10000,change);
 }
});

test('Rogue fan caps at three with selected primary first and nearest remaining enemies, independent of array order',()=>{
 const {g,p}=fixture('rogue_03'),near=foe(g,1,4),next=foe(g,2,4),extra=foe(g,3,4),primary=foe(g,5,4),rear=foe(g,-.1,4);
 assert(action(g,'rogue_02'));g.target=primary.id;assert(action(g,'rogue_03'));g.target=null;
 assert.deepEqual(hits(g,'rogue_03').map(v=>v.id),[primary.id,near.id,next.id]);assert.equal(extra.hp,10000);assert.equal(rear.hp,10000);
 assert.equal(primary.masteryPoisons?.length,1);assert.equal(near.masteryPoisons,undefined);assert.equal(next.masteryPoisons,undefined);assert(!coat(p));
});

test('a missed or zero-damage Rogue primary cannot transfer its coating to a successful secondary',()=>{
 for(const reason of ['miss','zero']){
  const {g,p}=fixture('rogue_03'),secondary=foe(g,1,4),primary=foe(g,3,4);assert(action(g,'rogue_02'));g.target=primary.id;
  if(reason==='miss'){let n=0;g.random=()=>++n===1?.99:.5;}else{primary.dataId='confluence_worldcore_sovereign';}
  assert(action(g,'rogue_03'));g.target=null;assert.equal(primary.hp,10000,reason);assert(secondary.hp<10000,reason);assert.equal(primary.masteryPoisons,undefined);assert.equal(secondary.masteryPoisons,undefined);assert(coat(p),reason);
 }
});

test('Archer coating consumes once across its fan and all fan hits retain actual Mastery damage attribution',()=>{
 const {g,p}=fixture(),a=foe(g),b=foe(g,4,4);assert(action(g,'rogue_02'));g.target=a.id;assert(action(g,'archer_03'));g.target=null;advance(g,.3);
 assert.equal([a,b].filter(e=>e.masteryPoisons?.length).length,1);assert(!coat(p));assert(a.masteryDamage![p.id].Archer!>0);assert(b.masteryDamage![p.id].Archer!>0);
});

test('fan validation rejects wrong weapons, unpaid casts and invalid targets; interrupted casts retain spent resources',()=>{
 for(const id of ['archer_03','rogue_03'])for(const reason of ['weapon','mastery','rank','prerequisite','mp','range','ally','stun','dead']){
  const {g,p}=fixture(id),e=foe(g);g.target=e.id;
  if(reason==='weapon')p.stats.weaponType='staff';if(reason==='mastery')p.masteries[id==='archer_03'?'Archer':'Assassin']=0;
  if(reason==='rank')p.skills[id]=11;if(reason==='prerequisite')p.skills[id==='archer_03'?'archer_01':'rogue_01']=0;if(reason==='mp')p.mp=0;
  if(reason==='range')e.x=20;if(reason==='stun')p.statuses.push({id:'stun',sourceId:'fixture',value:0,remaining:1});if(reason==='dead')p.dead=true;
  const mp=p.mp;assert.equal(action(g,id,reason==='ally'?p.id:undefined),false,reason);assert.equal(p.mp,mp);assert.equal(p.cd[id]||0,0);
 }
 for(const reason of ['weapon','stun','dead']){
  const {g,p}=fixture(),e=foe(g);g.target=e.id;assert(action(g,'archer_03'));g.target=null;const mp=p.mp;
  if(reason==='weapon')p.stats.weaponType='staff';if(reason==='stun')p.statuses.push({id:'stun',sourceId:'fixture',value:0,remaining:1});if(reason==='dead')p.dead=true;
  advance(g,.3);assert.equal(e.hp,10000);assert.equal(p.mp,mp);
 }
});

test('AUTO can use both fan handlers through the same authoritative resource and geometry path',()=>{
 for(const id of ['archer_03','rogue_03']){
  const {g,p}=fixture(id),e=foe(g,1,4);foe(g,1.2,4.2);p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:[id],off:Object.keys(p.skills).filter(v=>v!==id)};g.target=e.id;
  advance(g,.65);assert(hits(g,id).length>=2,id);assert(p.cd[id]>0);assert.equal(p.mp,400-16);
 }
});

