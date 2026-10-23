import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,action,spawn,addPlayer,step,applySlow,applyEffects,DEFAULT_AUTO,type BossTelegraph} from '../src/index.node.js';
const data=loadGameData();
function fixture(){
 const g=createGame(381,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Healer=25;p.skills={healer_01:1,healer_02:1};p.x=0;p.z=4;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=p.maxMp=200;
 return {g,p};
}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
const preparation=(p:ReturnType<typeof fixture>['p'])=>p.statuses.find(s=>s.id==='slow_resist');

test('preparation learns classlessly and uses exact rank costs/delay while leaving an existing Slow unchanged',()=>{
 let progress=newJob();progress.skillPoints=3;progress.masteries.Healer=10;assert.throws(()=>learnSkill(progress,'healer_02',data));
 progress=learnSkill(learnSkill(progress,'healer_01',data),'healer_02',data);
 assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?'healer_02':null})),data)[0].skill,'healer_02');
 for(const rank of data.mastery.skills.find(s=>s.id==='healer_02')!.ranks){
  const {g,p}=fixture();p.skills.healer_02=rank.rank;p.statuses=[{id:'slow',sourceId:'old',remaining:10,value:.5}];const mp=p.mp;
  assert(action(g,'healer_02'));assert.equal(p.mp,mp-rank.mp);assert.equal(p.cd.healer_02,rank.cooldown);assert.equal(preparation(p),undefined);
  advance(g,.15);assert.equal(preparation(p),undefined);advance(g,.05);assert.equal(preparation(p)!.remaining,rank.params.duration);
  assert(Math.abs(p.statuses.find(s=>s.sourceId==='old')!.remaining-9.8)<1e-8);
  applySlow(p,'next',4,.25);assert.equal(p.statuses.find(s=>s.sourceId==='next')!.remaining,4*(1-rank.params.slowResist/100));assert.equal(preparation(p),undefined);
  applySlow(p,'second',4,.25);assert.equal(p.statuses.find(s=>s.sourceId==='second')!.remaining,4);
 }
});

test('preparation supports only alive in-range party members and rechecks identity/range/life at cast completion',()=>{
 for(const invalid of ['party','range','dead','left-party','moved','died','stun']){
  const {g,p}=fixture(),ally=addPlayer(g,'ally');ally.x=1;ally.z=4;ally.stats.hpRegen=0;g.partyMembers=()=>[p.id,ally.id];
  if(invalid==='party')g.partyMembers=()=>[p.id];if(invalid==='range')ally.x=9;if(invalid==='dead')ally.dead=true;
  const start=['party','range','dead'].includes(invalid),mp=p.mp;assert.equal(action(g,'healer_02',ally.id),!start);
  if(start){assert.equal(p.mp,mp);continue;}
  if(invalid==='left-party')g.partyMembers=()=>[p.id];if(invalid==='moved')ally.x=9;if(invalid==='died')ally.dead=true;
  if(invalid==='stun')p.statuses.push({id:'stun',sourceId:'test',remaining:1,value:0});advance(g,.2);
  assert.equal(preparation(ally),undefined);assert.equal(p.mp,mp-12);
 }
 const {g,p}=fixture(),ally=addPlayer(g,'ally');ally.x=7.9;ally.z=4;g.partyMembers=()=>[p.id,ally.id];
 assert(action(g,'healer_02',ally.id));advance(g,.2);assert(preparation(ally));assert.equal(preparation(p),undefined);
});

test('only a new Slow consumes preparation; other statuses, expiration, nonstacking and AUTO use existing lifecycle',()=>{
 const {g,p}=fixture();assert(action(g,'healer_02'));advance(g,.2);
 applyEffects(p,[{id:'root',sourceId:'test',remaining:1,value:1}]);assert(preparation(p));
 applyEffects(p,[{id:'slow',sourceId:'test',remaining:4,value:.5}]);assert.equal(p.statuses.find(s=>s.id==='slow')!.remaining,3.4);assert.equal(preparation(p),undefined);
 p.cd.healer_02=0;assert(action(g,'healer_02'));advance(g,.2);p.cd.healer_02=0;assert(action(g,'healer_02'));advance(g,.2);
 assert.equal(p.statuses.filter(s=>s.id==='slow_resist').length,1);
 p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:['healer_02']};p.cd.healer_02=0;const mp=p.mp;advance(g,.1);assert.equal(p.mp,mp);
 p.auto=false;advance(g,5);assert.equal(preparation(p),undefined);applySlow(p,'expired',4,.5);assert.equal(p.statuses.find(s=>s.sourceId==='expired')!.remaining,4);
});

test('real mist-weaver bolt applies one shortened Slow and does not retroactively alter earlier Slow',()=>{
 const {g,p}=fixture(),e=spawn(g,4,4,false,'pink',false,'mist_weaver');e.cooldown=999;
 assert(action(g,'healer_02'));advance(g,.2);p.statuses.push({id:'slow',sourceId:'old',remaining:9,value:.1});
 g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:p.x,z:p.z,vx:0,vz:0,life:1,damage:1,phase:1});step(g,.05);
 assert.equal(p.statuses.find(s=>s.sourceId==='thorn_web')!.remaining,1.5*.85);assert.equal(preparation(p),undefined);
 assert.equal(p.statuses.find(s=>s.sourceId==='old')!.remaining,8.95);
});

test('Desert, Yokai and endgame real area passes all use the same next-Slow preparation',()=>{
 for(const [id,key,duration] of [['desert_sand_ushabti','desert',3],['yokai_rain_nue','yokai',2],['dragon_cloud_carp','endgame',2.5]] as const){
  const {g,p}=fixture();p.hp=p.maxHp=100000;assert(action(g,'healer_02'));advance(g,.2);const e=spawn(g,1.4,4,false,'pink',true,id);e.cooldown=0;e.aggro=10;step(g,.05);
  const a=e[key]?.action;assert(a,id);const area:BossTelegraph={id:'fixture',nameTh:'fixture',x:p.x,z:p.z,radius:.35,shape:'circle',inner:0,angle:0,fx:1,fz:0,left:.01};
  a.left=.01;a.areas=[area];a.target={x:p.x,z:p.z};e.telegraph=area;
  if(key==='desert')e.desert!.action!.kind='bind';if(key==='yokai')e.yokai!.action!.kind='tail';p.invulnerable=0;step(g,.05);
  const slow=p.statuses.find(s=>s.id==='slow');assert(slow,id);assert.equal(slow.remaining,duration*.85,id);assert.equal(preparation(p),undefined,id);
 }
});
