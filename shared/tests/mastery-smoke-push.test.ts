import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,resolveSkill,validateHotbar,action,spawn,step,addPlayer,DEFAULT_AUTO} from '../src/index.node.js';
const data=loadGameData();
function fixture(){const g=createGame(1381,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;const p=g.p;Object.assign(p,newJob());p.masteries.Assassin=p.masteries.Boxer=25;Object.assign(p.skills,{rogue_01:1,rogue_04:1,boxer_01:1,boxer_04:1});p.x=0;p.z=4;p.stats.hpRegen=0;p.stats.spRegen=0;p.hp=p.maxHp=10000;p.mp=p.maxMp=400;p.cd.attack=999;return {g,p};}
function foe(g:ReturnType<typeof createGame>,x=1,z=4,boss=false){const e=spawn(g,x,z,boss);e.hp=e.maxHp=10000;e.cooldown=e.wander=999;return e;}
function advance(g:ReturnType<typeof createGame>,s:number){for(let i=0;i<Math.round(s/.05);i++)step(g,.05);}
function melee(g:ReturnType<typeof createGame>,e:ReturnType<typeof foe>){e.motion='attack';e.motionTime=(e.behavior?.windup??.5)-.01;e.motionDuration=2;e.fx=-1;e.fz=0;e.attackApplied=false;g.p.invulnerable=0;step(g,.05);return g.events.find(v=>v.type==='hurt'||v.type==='miss');}

test('smoke and qi push use all accepted ranks, shared learning/bar gates and exact manual resources',()=>{
 for(const id of ['rogue_04','boxer_04']){let progress=newJob();progress.skillPoints=3;const root=id==='rogue_04'?'rogue_01':'boxer_01',school=id==='rogue_04'?'Assassin':'Boxer';assert.throws(()=>learnSkill(progress,id,data));progress=learnSkill(progress,root,data);assert.throws(()=>learnSkill(progress,id,data),/Mastery 25/);progress.masteries[school]=25;progress=learnSkill(progress,id,data);assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?id:null})),data)[0].skill,id);
  for(const r of data.mastery.skills.find(s=>s.id===id)!.ranks){const {g,p}=fixture(),e=foe(g);p.skills[id]=r.rank;const skill=resolveSkill(data,id,r.rank);assert.equal(skill.sp,r.mp);assert.equal(skill.cast,r.cast);assert.equal(skill.cooldown,r.cooldown);assert(action(g,id));assert.equal(p.mp,400-r.mp);assert.equal(p.cd[id],r.cooldown);assert.equal(e.hp,10000);if(id==='rogue_04'){assert.equal(g.smokeFields[0].until,2);assert.equal(g.smokeFields[0].level,r.rank);}else{assert(Math.abs(e.x-3)<1e-8);assert.equal(e.statuses.find(s=>s.id==='slow')!.value,r.params.slow/100);assert.equal(e.statuses.find(s=>s.id==='slow')!.remaining,1);}}
 }
});

test('smoke changes real physical HIT in its fixed area without damage, stealth, taunt reset or a three-target cap',()=>{
 function chance(smoke:boolean){const {g,p}=fixture(),e=foe(g,.9);p.stats.flee=data.monsters.monsters.find(s=>s.id===e.dataId)!.hit;p.target=e.id;if(smoke)assert(action(g,'rogue_04'));const hp=e.hp,event=melee(g,e)!;assert.equal(e.hp,hp);assert.equal(p.target,e.id);return event.breakdown.hitChance;}
 assert(Math.abs(chance(false)-chance(true)-.15)<1e-8);
 const {g,p}=fixture();const enemies=[foe(g,.5),foe(g,1),foe(g,1.5),foe(g,2),foe(g,3.1)];assert(action(g,'rogue_04'));p.x=10;assert.equal(g.smokeFields[0].x,0);for(const e of enemies){p.x=e.x-.9;p.z=e.z;g.events=[];p.stats.flee=data.monsters.monsters.find(s=>s.id===e.dataId)!.hit;const event=melee(g,e)!;assert(Math.abs(event.breakdown.hitChance-(e.x<=3?.65:.8))<1e-8);}assert.equal(g.smokeFields.length,1);
});

test('smoke overlap takes strongest HIT reduction; refresh is one field per owner and invalid/lapsed owners clear',()=>{
 const {g,p}=fixture(),other=addPlayer(g,'other');Object.assign(other,newJob());other.masteries.Assassin=25;Object.assign(other.skills,{rogue_01:1,rogue_04:5});other.mp=400;other.x=0;other.z=4;assert(action(g,'rogue_04'));g.p=other;assert(action(g,'rogue_04'));g.p=p;p.cd.rogue_04=0;assert(action(g,'rogue_04'));assert.equal(g.smokeFields.length,2);const e=foe(g,.9);p.stats.flee=data.monsters.monsters.find(s=>s.id===e.dataId)!.hit;assert(Math.abs(melee(g,e)!.breakdown.hitChance-.55)<1e-8);
 for(const reason of ['expiry','dead','depart','unlearn','mastery','map']){const {g,p}=fixture();assert(action(g,'rogue_04'));if(reason==='dead')p.dead=true;if(reason==='depart')g.players.delete(p.id);if(reason==='unlearn')p.skills.rogue_04=0;if(reason==='mastery')p.masteries.Assassin=0;if(reason==='map')p.mapId='city_plaza';advance(g,reason==='expiry'?2:.05);assert.equal(g.smokeFields.length,0,reason);}
});

test('smoke does not cause magic projectiles to miss or alter base HIT/flee stats',()=>{
 const {g,p}=fixture(),e=foe(g,.9),hit=data.monsters.monsters.find(s=>s.id===e.dataId)!.hit,flee=p.stats.flee;assert(action(g,'rogue_04'));g.random=()=>.99;p.stats.softMdef=0;g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:p.x,z:p.z,vx:0,vz:0,life:1,damage:100,phase:1});step(g,.05);assert.equal(p.hp,9900);assert.equal(p.stats.flee,flee);assert.equal(data.monsters.monsters.find(s=>s.id===e.dataId)!.hit,hit);
});

test('qi push affects every nearby live enemy, keeps hard-control immunity, and bosses resist movement but receive Slow',()=>{
 const {g}=fixture(),enemies=[foe(g,.5),foe(g,1),foe(g,1.5),foe(g,2),foe(g,2.1)],boss=foe(g,1,5,true);boss.controlImmuneUntil=999;const bx=boss.x,bz=boss.z;assert(action(g,'boxer_04'));for(const [i,e] of enemies.entries()){assert.equal(e.hp,10000);assert.equal(e.statuses.some(s=>s.id==='slow'),i<4);if(i<4)assert(Math.abs(e.x-(.5+i*.5+2))<1e-8);}assert.equal(boss.x,bx);assert.equal(boss.z,bz);assert(boss.statuses.some(s=>s.id==='slow'));assert.equal(boss.controlImmuneUntil,999);assert(!boss.statuses.some(s=>s.id==='stun'||s.id==='knockup'));
});

test('qi push honors server swept collision, leaves rooted enemies in place and respects actual Slow immunity',()=>{
 const {g}=fixture(),e=foe(g);let calls=0;g.resolveMonsterKnockback=(from,delta)=>{calls++;assert.equal(delta.x,2);return {x:from.x+.3,z:from.z};};assert(action(g,'boxer_04'));assert.equal(calls,1);assert.equal(e.x,1.3);
 const rooted=fixture(),r=foe(rooted.g);r.statuses.push({id:'root',sourceId:'fixture',remaining:3,value:1});rooted.g.resolveMonsterKnockback=()=>{throw Error('root moved');};assert(action(rooted.g,'boxer_04'));assert.equal(r.x,1);assert(r.statuses.some(s=>s.id==='root'));assert(r.statuses.some(s=>s.id==='slow'));
 const immune=fixture();immune.g.data={...data,status:{...data.status,bossImmune:[...data.status.bossImmune,'slow']}};const boss=foe(immune.g,1,4,true);assert(action(immune.g,'boxer_04'));assert(!boss.statuses.some(s=>s.id==='slow'));
});

test('both defensive utilities allow any weapon and reject invalid mastery/rank/root/MP/control/ally starts without spending',()=>{
 for(const id of ['rogue_04','boxer_04']){const school=id==='rogue_04'?'Assassin':'Boxer',root=id==='rogue_04'?'rogue_01':'boxer_01';for(const reason of ['rank','mastery','root','mp','cc','ally']){const {g,p}=fixture();if(reason==='rank')p.skills[id]=6;if(reason==='mastery')p.masteries[school]=0;if(reason==='root')p.skills[root]=0;if(reason==='mp')p.mp=0;if(reason==='cc')p.statuses.push({id:'stun',sourceId:'fixture',remaining:1,value:0});const mp=p.mp;assert.equal(action(g,id,reason==='ally'?p.id:undefined),false);assert.equal(p.mp,mp);assert.equal(p.cd[id]||0,0);}for(const weapon of ['unarmed','dagger','bow','staff','sword1h','sword2h'] as const){const {g,p}=fixture();p.stats.weaponType=weapon;assert(action(g,id));}}
});

test('AUTO skips empty areas and an active smoke field, then casts against an actual nearby threat',()=>{
 for(const id of ['rogue_04','boxer_04']){const {g,p}=fixture();p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:[id],off:Object.keys(p.skills).filter(s=>s!==id)};advance(g,.1);assert.equal(p.mp,400);foe(g);g.autoTimer=0;advance(g,.1);assert.equal(p.mp,382);p.cd[id]=0;g.autoTimer=0;if(id==='rogue_04'){advance(g,.1);assert.equal(p.mp,382);}}
});
