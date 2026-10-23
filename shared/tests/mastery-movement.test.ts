import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,revive,applyEffects,slowMovementMultiplier,DEFAULT_AUTO} from '../src/index.node.js';
const data=loadGameData();
function fixture(){
 const g=createGame(1081,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Archer=25;p.masteries.Mage=25;Object.assign(p.skills,{archer_01:1,archer_04:1,mage_01:1,mage_04:1});p.x=0;p.z=4;p.stats.matk=101;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=p.maxMp=400;
 return {g,p};
}
function foe(g:ReturnType<typeof createGame>,x=4,z=4){const e=spawn(g,x,z);e.hp=e.maxHp=10000;e.cooldown=999;e.wander=999;return e;}
function advance(g:ReturnType<typeof createGame>,s:number,input={x:0,z:0}){for(let n=0;n<Math.round(s/.05);n++)step(g,.05,input);}
const fast=(p:ReturnType<typeof fixture>['p'])=>p.statuses.find(s=>s.id==='speed'&&s.sourceId==='archer_04');

test('movement skills retain every accepted rank/resource, classless prerequisite and hotbar gate',()=>{
 for(const id of ['archer_04','mage_04']){
  const school=id==='archer_04'?'Archer':'Mage',root=id==='archer_04'?'archer_01':'mage_01';let progress=newJob();progress.skillPoints=3;assert.throws(()=>learnSkill(progress,id,data));progress=learnSkill(progress,root,data);assert.throws(()=>learnSkill(progress,id,data),/Mastery 25/);progress.masteries[school]=25;progress=learnSkill(progress,id,data);
  assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?id:null})),data)[0].skill,id);
  for(const r of data.mastery.skills.find(s=>s.id===id)!.ranks){const {g,p}=fixture(),e=foe(g);p.skills[id]=r.rank;g.target=e.id;const mp=p.mp,s=resolveSkill(data,id,r.rank);assert.equal(s.sp,r.mp);assert.equal(s.cast,r.cast);assert.equal(s.cooldown,r.cooldown);assert(action(g,id));g.target=null;assert.equal(p.mp,mp-r.mp);assert.equal(p.cd[id],r.cooldown);advance(g,r.cast);
   if(id==='archer_04'){assert.equal(fast(p)!.value,r.params.move/100);assert.equal(fast(p)!.remaining,4);assert.equal(e.hp,10000);}
   else{const hit=g.events.find(v=>v.type==='hit'&&v.skillId===id)!;assert.equal(s.type,'magic');assert.equal(s.element,'water');assert.equal(hit.element,'water');assert.equal(hit.breakdown.base,101*r.params.damage/100);assert.equal(hit.breakdown.hitChance,1);assert.equal(e.statuses.find(s=>s.id==='slow')!.value,.25);assert.equal(e.statuses.find(s=>s.id==='slow')!.remaining,2);assert(!e.statuses.some(s=>s.id==='root'||s.id==='stun'||s.id==='knockup'));}
  }
 }
});

test('Archer increases actual server movement, retains Root/Slow and changes no base movement stat',()=>{
 function distance(buff:boolean,slow=0,root=false){const {g,p}=fixture();const base=p.stats.moveSpeed;if(slow)p.statuses.push({id:'slow',sourceId:'fixture',remaining:8,value:slow});if(root)p.statuses.push({id:'root',sourceId:'fixture',remaining:8,value:1});if(buff)assert(action(g,'archer_04'));advance(g,.45);advance(g,.25,{x:1,z:0});assert.equal(p.stats.moveSpeed,base);assert.equal(p.statuses.some(s=>s.id==='root'),root);assert.equal(p.statuses.some(s=>s.id==='slow'),slow>0);return p.x;}
 const base=distance(false);assert(Math.abs(distance(true)/base-1.12)<1e-8);assert(Math.abs(distance(true,.5)/base-.56)<1e-8);assert.equal(distance(true,.5,true),0);
});

test('speed sources coexist by source, use the strongest rather than add, and only the Archer source refreshes',()=>{
 const {g,p}=fixture();applyEffects(p,[{id:'speed',sourceId:'potion',remaining:10,value:.3}]);assert(action(g,'archer_04'));applyEffects(p,[{id:'speed',sourceId:p.id,remaining:8,value:.1}]);assert(fast(p));assert.equal(p.statuses.filter(s=>s.id==='speed').length,3);
 p.cd.archer_04=0;p.skills.archer_04=5;assert(action(g,'archer_04'));assert.equal(fast(p)!.value,.2);assert.equal(p.statuses.filter(s=>s.id==='speed').length,3);advance(g,4);assert.equal(fast(p),undefined);assert(p.statuses.some(s=>s.sourceId==='potion'));
});

test('Mage locks one target, spends at cast start and slows real walking without slowing the attack clock',()=>{
 function distance(slow:boolean){const {g}=fixture(),e=foe(g);if(slow){g.target=e.id;assert(action(g,'mage_04'));g.target=null;advance(g,.5);}e.x=4;e.z=4;e.aggro=10;e.motion='idle';e.motionTime=0;e.cooldown=20;const start=e.x;advance(g,.1);return {distance:start-e.x,motionTime:e.motionTime,cooldown:e.cooldown};}
 const a=distance(false),b=distance(true);assert(a.distance>0);assert(Math.abs(b.distance/a.distance-.75)<1e-8);assert.equal(b.motionTime,a.motionTime);assert.equal(b.cooldown,a.cooldown);
 const {g}=fixture(),e=foe(g),other=foe(g,4.1,4);g.target=e.id;assert(action(g,'mage_04'));g.target=null;advance(g,.45);assert.equal(e.hp,10000);advance(g,.05);assert(e.hp<10000);assert.equal(other.hp,10000);assert.equal(other.statuses.length,0);
});

test('Mage refreshes only its own Slow and keeps a stronger independent Slow; hard-control immunity does not turn it into Freeze',()=>{
 const {g,p}=fixture(),e=foe(g);e.statuses=[{id:'slow',sourceId:'other',remaining:4,value:.6}];e.controlImmuneUntil=100;g.target=e.id;assert(action(g,'mage_04'));g.target=null;advance(g,.5);assert.equal(e.statuses.filter(s=>s.id==='slow').length,2);assert.equal(slowMovementMultiplier(e),.4);
 p.cd.mage_04=0;g.target=e.id;assert(action(g,'mage_04'));g.target=null;advance(g,.5);assert.equal(e.statuses.filter(s=>s.id==='slow'&&s.sourceId===p.id).length,1);assert.equal(e.controlImmuneUntil,100);assert(!e.statuses.some(s=>s.id==='root'||s.id==='stun'||s.id==='knockup'));
});

test('regional continuous returns and clone chasing honor Slow while their action clocks keep normal time',()=>{
 for(const id of ['himmapan_blossom_deer','desert_03','frost_06','yokai_01']){
  function distance(slow:boolean){const {g}=fixture(),e=spawn(g,4,4,false,'pink',false,id);e.hp=e.maxHp/2;e.homeX=8;e.homeZ=4;e.cooldown=999;e.wander=999;
   if(id==='himmapan_blossom_deer')e.himmapan={next:0};if(id==='desert_03')e.desert={next:0,returnUntil:5};if(id==='frost_06')e.frost={next:0};if(id==='yokai_01'){const parent=foe(g,8,4);e.summonedBy=parent.id;e.yokai={next:0,clone:true,expires:100};}
   if(slow)e.statuses=[{id:'slow',sourceId:'test',remaining:2,value:.25}];step(g,.05);return {distance:Math.abs(e.x-4),clock:e.motionTime};}
  const a=distance(false),b=distance(true);assert(a.distance>0,id);assert(Math.abs(b.distance/a.distance-.75)<1e-8,id);assert.equal(b.clock,a.clock,id);
 }
});

test('fixed-position boss slam lands at the same place with Slow, and Slow multiplier is bounded',()=>{
 function landing(slow:boolean){const {g}=fixture(),e=spawn(g,4,4,true);e.hp=e.maxHp=10000;e.motion='slam';e.motionTime=.65;e.startX=4;e.startZ=4;e.aimX=6;e.aimZ=4;e.bossPhase=1;e.engaged=true;if(slow)e.statuses=[{id:'slow',sourceId:'fixture',remaining:2,value:.25}];step(g,.05);return e.x;}
 assert.equal(landing(true),landing(false));assert(landing(true)>4);
 assert.equal(slowMovementMultiplier({statuses:[{id:'slow',sourceId:'fixture',remaining:1,value:10}]}),0);assert.equal(slowMovementMultiplier({statuses:[{id:'slow',sourceId:'fixture',remaining:0,value:1}]}),1);
});

test('both skills are weapon:any, reject invalid rank/Mastery/MP/CC/ally starts and cancel locked Mage impacts safely',()=>{
 for(const id of ['archer_04','mage_04'])for(const reason of ['rank','mastery','mp','stun','ally']){const {g,p}=fixture(),e=foe(g);g.target=e.id;if(reason==='rank')p.skills[id]=6;if(reason==='mastery')p.masteries[id==='archer_04'?'Archer':'Mage']=0;if(reason==='mp')p.mp=0;if(reason==='stun')p.statuses.push({id:'stun',sourceId:'fixture',remaining:1,value:0});const mp=p.mp;assert.equal(action(g,id,reason==='ally'?p.id:undefined),false);assert.equal(p.mp,mp);assert.equal(p.cd[id]||0,0);}
 for(const weapon of ['bow','dagger','staff','sword1h','sword2h','unarmed'] as const)for(const id of ['archer_04','mage_04']){const {g,p}=fixture();g.target=foe(g).id;p.stats.weaponType=weapon;assert(action(g,id));}
 for(const reason of ['stun','dead','target','range']){const {g,p}=fixture(),e=foe(g);g.target=e.id;assert(action(g,'mage_04'));g.target=null;const mp=p.mp;if(reason==='stun')p.statuses.push({id:'stun',sourceId:'fixture',remaining:1,value:0});if(reason==='dead')p.dead=true;if(reason==='target'){e.dead=true;e.respawn=999;}if(reason==='range')e.x=20;advance(g,.5);assert.equal(e.hp,10000);assert.equal(p.mp,mp);assert(!e.statuses.some(s=>s.id==='slow'));}
});

test('speed expires and clears on invalid learning/Mastery and death/revive; AUTO avoids active-speed refresh and casts Mage',()=>{
 for(const reason of ['expiry','unlearn','mastery','dead','revive']){const {g,p}=fixture();assert(action(g,'archer_04'));if(reason==='unlearn')p.skills.archer_04=0;if(reason==='mastery')p.masteries.Archer=0;if(reason==='dead')p.dead=true;if(reason==='revive'){p.dead=true;revive(g);}advance(g,reason==='expiry'?4:.05);assert.equal(fast(p),undefined,reason);}
 const {g,p}=fixture();foe(g,1,4);assert(action(g,'archer_04'));p.cd.archer_04=0;p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:['archer_04'],off:Object.keys(p.skills).filter(s=>s!=='archer_04')};const mp=p.mp;advance(g,.1);assert.equal(p.mp,mp);
 p.autoCfg={...p.autoCfg,order:['mage_04'],off:Object.keys(p.skills).filter(s=>s!=='mage_04')};g.autoTimer=0;advance(g,.6);assert(g.events.some(v=>v.type==='hit'&&v.skillId==='mage_04'));
});
