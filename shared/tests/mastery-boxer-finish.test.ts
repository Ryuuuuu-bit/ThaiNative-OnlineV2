import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,revive,tickEffects,DEFAULT_AUTO} from '../src/index.node.js';
const data=loadGameData();
function fixture(){
 const g=createGame(981,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Boxer=75;Object.assign(p.skills,{boxer_01:3,boxer_03:1,boxer_10:1,boxer_11:1});
 p.x=0;p.z=4;p.stats.weaponType='unarmed';p.stats.atk=101;p.stats.hit=1000;p.stats.crit=0;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=p.maxMp=400;
 const e=spawn(g,1,4);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',remaining:99,value:1}];g.target=e.id;
 return {g,p,e};
}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
function combo(f:ReturnType<typeof fixture>,steps=1){f.p.boxerCombo={steps,until:f.g.time+4};}
const ready=(p:ReturnType<typeof fixture>['p'])=>p.statuses.find(s=>s.id==='finisher_ready');
const hits=(g:ReturnType<typeof createGame>,id:string)=>g.events.filter(v=>v.type==='hit'&&v.skillId===id);

test('Boxer preparation/elbow/finisher enforce the real learning path and preserve all accepted ranks/resources',()=>{
 let progress=newJob();progress.skillPoints=10;assert.throws(()=>learnSkill(progress,'boxer_03',data));progress=learnSkill(progress,'boxer_01',data);progress.masteries.Boxer=25;progress=learnSkill(progress,'boxer_03',data);
 progress.masteries.Boxer=50;assert.throws(()=>learnSkill(progress,'boxer_10',data));progress=learnSkill(learnSkill(progress,'boxer_01',data),'boxer_01',data);progress=learnSkill(progress,'boxer_10',data);
 assert.throws(()=>learnSkill(progress,'boxer_11',data),/Mastery 60/);progress.masteries.Boxer=60;progress=learnSkill(progress,'boxer_11',data);
 for(const id of ['boxer_03','boxer_10','boxer_11']){
  assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?id:null})),data)[0].skill,id);
  for(const rank of data.mastery.skills.find(s=>s.id===id)!.ranks){
   const f=fixture(),{g,p,e}=f;p.skills[id]=rank.rank;combo(f);const mp=p.mp,s=resolveSkill(data,id,rank.rank);assert.equal(s.sp,rank.mp);assert.equal(s.cast,rank.cast);assert.equal(s.cooldown,rank.cooldown);
   assert(action(g,id));g.target=null;assert.equal(p.mp,mp-rank.mp);assert.equal(p.cd[id],rank.cooldown);advance(g,rank.cast);
   if(id==='boxer_03'){assert.equal(ready(p)!.value,rank.params.nextCombo);assert.equal(ready(p)!.remaining,4);assert.equal(p.boxerCombo,undefined);assert.equal(e.hp,10000);}
   else{assert.equal(hits(g,id)[0].breakdown.base,101*rank.params.damage/100);assert.equal(hits(g,id)[0].breakdown.hitChance,.95);if(id==='boxer_10')assert.equal(e.statuses.find(s=>s.id==='stun')!.remaining,.5);}
  }
 }
});

test('preparation requires an unexpired positive combo, ends it, replaces one four-second bonus and cannot boost other attacks',()=>{
 for(const steps of [0,1,2,3]){
  const f=fixture(),{g,p}=f;combo(f,steps);const mp=p.mp;assert.equal(action(g,'boxer_03'),steps>0);assert.equal(p.mp,mp-(steps?10:0));if(steps)assert.equal(p.boxerCombo,undefined);
 }
 const f=fixture(),{g,p}=f;combo(f);p.boxerCombo!.until=0;assert.equal(action(g,'boxer_03'),false);combo(f);assert(action(g,'boxer_03'));p.cd.boxer_03=0;p.skills.boxer_03=10;combo(f);assert(action(g,'boxer_03'));
 assert.equal(p.statuses.filter(s=>s.id==='finisher_ready').length,1);assert.equal(ready(p)!.value,20);assert(action(g,'boxer_10'));assert.equal(hits(g,'boxer_10')[0].breakdown.base,101*160/100);assert(ready(p));
 assert(action(g,'boxer_01'));assert(ready(p));g.target=null;advance(g,4);assert.equal(ready(p),undefined);
});

test('finisher consumes every current step at cast start but gains its native bonus only from exactly three real steps',()=>{
 for(const steps of [0,1,2,3]){
  const f=fixture(),{g,p}=f;combo(f,steps);assert(action(g,'boxer_11'));g.target=null;assert.equal(p.boxerCombo,undefined);assert.equal(hits(g,'boxer_11').length,0);advance(g,.15);assert.equal(hits(g,'boxer_11').length,0);advance(g,.05);
  assert.equal(hits(g,'boxer_11')[0].breakdown.base,101*(230*(steps===3?1.25:1))/100);
 }
 const f=fixture();combo(f,3);f.p.boxerCombo!.until=0;assert(action(f.g,'boxer_11'));f.g.target=null;advance(f.g,.2);assert.equal(hits(f.g,'boxer_11')[0].breakdown.base,101*230/100);
});

test('a prepared finisher adds its one-use percentage to the three-step bonus, without banking consumed old steps',()=>{
 for(const rebuild of [false,true]){
  const f=fixture(),{g,p}=f;combo(f,3);assert(action(g,'boxer_03'));assert.equal(p.boxerCombo,undefined);if(rebuild)combo(f,3);
  assert(action(g,'boxer_11'));g.target=null;assert.equal(ready(p),undefined);advance(g,.2);assert.equal(hits(g,'boxer_11')[0].breakdown.base,101*(230*(1+(rebuild?35:10)/100))/100);
  p.cd.boxer_11=0;g.target=f.e.id;assert(action(g,'boxer_11'));g.target=null;advance(g,.2);assert.equal(hits(g,'boxer_11')[1].breakdown.base,101*230/100);
 }
});

test('real root hits build the combo, misses and the elbow do not grant extra steps and the finisher uses the resulting server state',()=>{
 const f=fixture(),{g,p,e}=f;for(let n=0;n<3;n++){p.cd.boxer_01=0;assert(action(g,'boxer_01'));}assert.equal(p.boxerCombo!.steps,3);
 assert(action(g,'boxer_10'));assert.equal(p.boxerCombo!.steps,3);assert(action(g,'boxer_11'));g.target=null;advance(g,.2);assert.equal(hits(g,'boxer_11')[0].breakdown.base,101*(230*1.25)/100);assert.equal(p.boxerCombo,undefined);assert(e.masteryDamage![p.id].Boxer!>0);
 const miss=fixture();miss.g.random=()=>.99;assert(action(miss.g,'boxer_01'));assert.equal(miss.p.boxerCombo,undefined);
});

test('elbow applies a fixed half-second stun on a hit and respects misses and existing boss hard-control immunity',()=>{
 const f=fixture();f.e.motion='attack';assert(action(f.g,'boxer_10'));assert.equal(f.e.statuses.find(s=>s.id==='stun')!.remaining,.5);assert.equal(f.e.motion,'idle');
 const miss=fixture();miss.g.random=()=>.99;assert(action(miss.g,'boxer_10'));assert(!miss.e.statuses.some(s=>s.id==='stun'));
 const b=fixture();b.e.boss=true;b.e.motion='attack';assert(action(b.g,'boxer_10'));assert.equal(b.e.controlImmuneUntil,15);assert.equal(b.e.statuses.find(s=>s.id==='stun')!.remaining,.5);
 b.e.statuses.find(s=>s.id==='stun')!.remaining=.1;b.p.cd.boxer_10=0;const hp=b.e.hp;assert(action(b.g,'boxer_10'));assert(b.e.hp<hp);assert.equal(b.e.statuses.find(s=>s.id==='stun')!.remaining,.1);
});

test('finisher miss, zero damage, cancellation or lost target spend the paid combo/preparation without refunds or retargeting',()=>{
 for(const reason of ['miss','zero','stun','knockup','weapon','dead','target','range']){
  const f=fixture(),{g,p,e}=f;combo(f);assert(action(g,'boxer_03'));combo(f,3);assert(action(g,'boxer_11'));g.target=null;const mp=p.mp;
  if(reason==='miss')g.random=()=>.99;if(reason==='zero')g.data={...g.data,elements:{...g.data.elements,table:{...g.data.elements.table,neutral:{...g.data.elements.table.neutral,neutral:0}}}};
  if(reason==='stun'||reason==='knockup')p.statuses.push({id:reason,sourceId:'fixture',remaining:1,value:0});if(reason==='weapon')p.stats.weaponType='staff';if(reason==='dead')p.dead=true;if(reason==='target'){e.dead=true;e.respawn=999;}if(reason==='range')e.x=10;
  advance(g,.2);assert.equal(e.hp,10000,reason);assert.equal(p.mp,mp);assert.equal(p.boxerCombo,undefined);assert.equal(ready(p),undefined);assert(p.cd.boxer_11>0);
 }
});

test('preparation clears on weapon change, expiry, death/revive and invalid learning/Mastery while leaving unrelated statuses',()=>{
 for(const reason of ['weapon','expiry','dead','revive','unlearn','mastery']){
  const f=fixture(),{g,p}=f;combo(f);assert(action(g,'boxer_03'));p.statuses.push({id:'slow',sourceId:'fixture',remaining:10,value:.1});g.target=null;
  if(reason==='weapon')p.stats.weaponType='staff';if(reason==='dead')p.dead=true;if(reason==='unlearn')p.skills.boxer_03=0;if(reason==='mastery')p.masteries.Boxer=0;if(reason==='revive'){p.dead=true;revive(g);}
  advance(g,reason==='expiry'?4:.05);assert.equal(ready(p),undefined,reason);if(reason!=='revive')assert(p.statuses.some(s=>s.id==='slow'));
 }
});

test('invalid Boxer starts preserve combo, preparation, MP and cooldown at weapon/learning/target/CC boundaries',()=>{
 for(const id of ['boxer_03','boxer_10','boxer_11'])for(const reason of ['weapon','rank','mastery','prerequisite','mp','stun','ally']){
  const f=fixture(),{g,p}=f;combo(f,3);p.statuses.push({id:'finisher_ready',sourceId:p.id,remaining:4,value:10});if(reason==='weapon')p.stats.weaponType='bow';if(reason==='rank')p.skills[id]=11;if(reason==='mastery')p.masteries.Boxer=0;if(reason==='prerequisite')p.skills[id==='boxer_11'?'boxer_10':'boxer_01']=0;if(reason==='mp')p.mp=0;if(reason==='stun')p.statuses.push({id:'stun',sourceId:'fixture',remaining:1,value:0});const mp=p.mp;
  assert.equal(action(g,id,reason==='ally'?p.id:undefined),false,id+reason);assert.equal(p.mp,mp);assert.equal(p.boxerCombo!.steps,3);assert.equal(ready(p)!.value,10);assert.equal(p.cd[id]||0,0);
 }
});

test('AUTO skips unusable preparation and uses a ready finisher through the same resource/bonus path',()=>{
 const f=fixture(),{g,p}=f;p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:['boxer_03'],off:Object.keys(p.skills).filter(s=>s!=='boxer_03')};const mp=p.mp;advance(g,.1);assert.equal(p.mp,mp);
 combo(f);g.autoTimer=0;advance(g,.1);assert.equal(p.mp,mp-10);assert(ready(p));p.autoCfg={...p.autoCfg,order:['boxer_11'],off:Object.keys(p.skills).filter(s=>s!=='boxer_11')};g.autoTimer=0;advance(g,.35);
 assert.equal(p.mp,mp-30);assert.equal(hits(g,'boxer_11').length,1);assert.equal(ready(p),undefined);assert.equal(hits(g,'boxer_11')[0].breakdown.base,101*(230*1.1)/100);
});


test('shared timed effects expire on their nominal tick despite floating-point subtraction residue',()=>{
 const p={statuses:[{id:'slow' as const,sourceId:'fixture',remaining:4,value:.1},{id:'finisher_ready' as const,sourceId:'fixture',remaining:4,value:10}]};
 for(let n=0;n<79;n++)tickEffects(p,.05);assert.equal(p.statuses.length,2);tickEffects(p,.05);assert.equal(p.statuses.length,0);
});


test('finisher snapshots combo and preparation at paid cast start even when their original window would expire mid-cast',()=>{
 const f=fixture(),{g,p}=f;combo(f,3);p.boxerCombo!.until=g.time+.05;p.statuses.push({id:'finisher_ready',sourceId:p.id,remaining:.05,value:10});
 assert(action(g,'boxer_11'));g.target=null;assert.equal(p.boxerCombo,undefined);assert.equal(ready(p),undefined);advance(g,.2);assert.equal(hits(g,'boxer_11')[0].breakdown.base,101*(230*1.35)/100);
});
