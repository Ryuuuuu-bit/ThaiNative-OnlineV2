import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,spawn,step,action,createSummon,validateHotbar,refreshStats,applyPlayerBurn} from '../src/index.node.js';
import {MASTERY_SCHOOLS} from '../src/mastery.js';
import {selectedMasteryMix} from '../src/game/mastery-mix.js';
import {advancedMasterySnapshot} from '../src/game/mastery-runtime.js';
const data=loadGameData();
function fixture(id:string){
 const m=data.mastery.mixes.find(m=>m.id===id)!,g=createGame(374,{...data.stats.defaultBuild,classId:'swordsman',level:40});g.enemies=[];g.random=()=>.5;const p=g.p;Object.assign(p,newJob());p.level=40;p.masteries=Object.fromEntries(MASTERY_SCHOOLS.map(s=>[s,100])) as typeof p.masteries;p.skills={...p.skills,...Object.fromEntries(data.mastery.skills.map(s=>[s.id,s.passive&&s.school!=='Swordsman'&&!['archer_07','mage_07','mage_08','rogue_07'].includes(s.id)?0:s.maxRank]))};refreshStats(g,p);
 p.x=0;p.z=4;p.fx=1;p.fz=0;p.hp=p.maxHp;p.mp=p.maxMp=10000;p.stats.atk=p.stats.matk=100;p.stats.hit=1000;p.stats.crit=0;p.stats.hpRegen=p.stats.spRegen=0;p.stats.weaponType=m.weapon==='sword'?'sword1h':m.weapon==='any'?'unarmed':m.weapon;p.cd={attack:999};
 const components=Object.keys(m.requires);p.hotbar=validateHotbar(p,p.hotbar.map((s,i)=>({...s,skill:components[i]??null,...(i===0?{signature:id}:{})})),data);
 const e=spawn(g,1.3,4);e.hp=e.maxHp=100000;e.cooldown=e.wander=999;e.fx=1;e.fz=0;g.target=e.id;
 if(Object.keys(m.requires).includes('shaman_01')){assert(createSummon(g,p,1));p.summon!.x=.7;p.summon!.z=4;p.summon!.cooldown=999;}
 return {g,p,e,m};
}
function advance(g:ReturnType<typeof createGame>,seconds:number){for(let i=0;i<Math.round(seconds/.05);i++)step(g,.05);}
function cast(f:ReturnType<typeof fixture>,id:string){f.p.cd[id]=0;assert(action(f.g,id),id);advance(f.g,Math.max(.1,f.p.castRemaining+.1));}
function bolt(f:ReturnType<typeof fixture>,damage=100){f.p.invulnerable=0;f.g.projectiles.push({id:f.g.nextId++,owner:f.e.id,attack:'bolt',x:f.p.x,z:f.p.z,vx:0,vz:0,life:1,damage,phase:1});step(f.g,.05);}
function combo(f:ReturnType<typeof fixture>){for(let n=0;n<3;n++){f.p.cd.attack=0;assert(action(f.g,'attack'));advance(f.g,.25);}}
function procs(f:ReturnType<typeof fixture>){return f.g.events.filter(e=>e.type==='masteryMix'&&e.mixId===f.m.id);}

test('all16 selected signatures activate only from their real setup and spend their additional MP',()=>{
 for(const m of data.mastery.mixes){const f=fixture(m.id),{g,p,e}=f;
  switch(m.kind){
   case 'frostBlade':cast(f,'endure');bolt(f);cast(f,'slash');break;
   case 'frontlineTriage':cast(f,'bulwark');p.hp=Math.min(p.hp,p.maxHp*.4);cast(f,'healer_01');break;
   case 'tauntBond':cast(f,'provoke');bolt(f);break;
   case 'venomRiposte':cast(f,'rogue_02');cast(f,'slash');cast(f,'endure');bolt(f);cast(f,'slash');break;
   case 'shatterArrow':cast(f,'mage_04');cast(f,'archer_01');break;
   case 'venomTrap':cast(f,'rogue_02');cast(f,'archer_01');cast(f,'archer_16');cast(f,'archer_01');break;
   case 'commandArrow':cast(f,'shaman_03');cast(f,'archer_01');break;
   case 'retreatMedicine':p.hp=p.maxHp*.4;cast(f,'healer_03');cast(f,'archer_05');advance(g,1.1);break;
   case 'pulseSpell':for(let n=0;n<3;n++){p.hp=p.maxHp*.3;cast(f,'healer_01');}cast(f,'mage_01');break;
   case 'elementBond':cast(f,'mage_01');p.summon!.cooldown=0;advance(g,.8);break;
   case 'veilDagger':cast(f,'mage_02');cast(f,'rogue_05');break;
   case 'sealedForce':cast(f,'boxer_06');bolt(f);cast(f,'boxer_16');break;
   case 'guardianThread':p.summon!.hp=p.summon!.maxHp*.5;p.hp=p.maxHp*.3;cast(f,'healer_01');break;
   case 'venomMedicine':cast(f,'rogue_02');assert(applyPlayerBurn(g,p));p.hp=p.maxHp*.3;cast(f,'healer_04');cast(f,'healer_01');break;
   case 'mercyCombo':combo(f);p.hp=p.maxHp*.3;cast(f,'healer_01');break;
   case 'petRetreat':combo(f);break;
  }
  assert.equal(procs(f).length,1,m.id+' '+m.kind);assert.equal(procs(f)[0].mp,m.mp,m.id);
  assert(!g.events.some(v=>v.autoSpell&&v.skillId===m.id),m.id);assert(Number.isFinite(e.hp)&&Number.isFinite(p.mp),m.id);
 }
});

test('signature selection rejects missing paid paths, uninstalled components, duplicates and automatic-only components',()=>{
 const f=fixture('M05');assert.equal(selectedMasteryMix(f.g)!.id,'M05');
 const slots=f.p.hotbar.map(s=>({...s}));slots[1].skill=null;assert.throws(()=>validateHotbar(f.p,slots,data));f.p.hotbar=slots;assert.equal(selectedMasteryMix(f.g),undefined);
 const r=fixture('M05');r.p.skills.mage_01=0;assert.throws(()=>validateHotbar(r.p,r.p.hotbar,data));
 const a=fixture('M05');a.p.hotbar[1].mode='autoSpell';assert.throws(()=>validateHotbar(a.p,a.p.hotbar,data));
});

test('venom area converts one bounded remaining budget and never multiplies it across three enemies or crits',()=>{
 const f=fixture('M06');cast(f,'rogue_02');cast(f,'archer_01');cast(f,'archer_16');
 for(const z of [4.2,4.4]){const e=spawn(f.g,1.3,z);e.hp=e.maxHp=100000;e.cooldown=e.wander=999;}
 const poison=f.e.masteryPoisons!.find(v=>v.owner===f.p.id)!,budget=Math.floor(poison.damage*.5),start=f.g.events.length;f.p.stats.crit=1;cast(f,'archer_01');
 const hits=f.g.events.slice(start).filter(v=>v.type==='hit'&&v.skillId==='M06');assert(hits.length>0&&hits.length<=3);assert(hits.reduce((n,v)=>n+v.damage,0)<=budget);assert(hits.every(v=>!v.crit));assert.equal(f.e.masteryPoisons?.find(v=>v.owner===f.p.id),undefined);
});

test('guardian transfer conserves actual healing and never activates from overheal or revives a dead pet',()=>{
 const f=fixture('M13'),pet=f.p.summon!;pet.hp=pet.maxHp*.5;f.p.hp=f.p.maxHp*.3;const before=f.p.hp,petBefore=pet.hp;cast(f,'healer_01');
 const primary=f.g.events.filter(e=>e.type==='heal'&&e.skillId==='healer_01').at(-1)!.amount,extra=f.g.events.find(e=>e.type==='summonHeal')!.amount;
 assert(Math.abs(f.p.hp-before-primary)<1);assert(Math.abs(pet.hp-petBefore-extra)<1e-8);assert(extra<=pet.maxHp*.08);const mp=f.p.mp;f.p.hp=f.p.maxHp;f.p.cd.healer_01=0;assert.equal(action(f.g,'healer_01'),false);assert.equal(f.p.mp,mp);
});

test('mercy basic finisher gives up its170-percent hit and consumes old Boxer steps for one finite physical barrier',()=>{
 const f=fixture('M15');f.p.boxerCombo={steps:3,until:30};combo(f);const third=f.g.events.filter(e=>e.type==='hit'&&e.skillId==='basic').at(-1)!;assert.equal(third.breakdown.base,f.p.stats.atk);assert.equal(f.p.boxerCombo,undefined);
 f.p.hp=f.p.maxHp*.3;cast(f,'healer_01');assert(advancedMasterySnapshot(f.g,f.p)!.effects.some(e=>e.id==='mix_physical_barrier'));const used=procs(f).length;combo(f);assert.equal(procs(f).length,used,'ICD prevents recharging after switching action');
});
