import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,spawn,step,action,resolveSkill,addPlayer,createSummon} from '../src/index.node.js';
import {ADVANCED_MASTERY_ACTIONS,MASTERY_SCHOOLS} from '../src/mastery.js';
import {advancedMasterySnapshot,advancedEnemyBlocked} from '../src/game/mastery-runtime.js';
const data=loadGameData();
function fixture(id:string){
 const g=createGame(2401,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries=Object.fromEntries(MASTERY_SCHOOLS.map(s=>[s,100])) as typeof p.masteries;
 p.skills={...p.skills,...Object.fromEntries(data.mastery.skills.map(s=>[s.id,s.passive&&s.school!=='Swordsman'&&!['archer_07','mage_07','mage_08','rogue_07'].includes(s.id)?0:s.maxRank]))};p.skills[id]=1;
 p.x=0;p.z=4;p.hp=p.maxHp=1000;p.mp=p.maxMp=10000;p.stats.atk=p.stats.matk=100;p.stats.hit=1000;p.stats.crit=0;p.stats.hpRegen=p.stats.spRegen=0;p.stats.weaponType=id.startsWith('archer')?'bow':id.startsWith('rogue')?'dagger':id.startsWith('boxer')?'unarmed':'sword1h';p.cd={attack:999};p.fx=1;p.fz=0;
 const e=spawn(g,1.3,4);e.hp=e.maxHp=100000;e.cooldown=e.wander=999;e.fx=1;e.fz=0;g.target=e.id;
 const ally=addPlayer(g,'ally',{...data.stats.defaultBuild,classId:'swordsman'});ally.x=.5;ally.z=4;ally.hp=400;ally.maxHp=1000;ally.stats.hpRegen=ally.stats.spRegen=0;ally.cd={attack:999};g.partyMembers=()=>[p.id,ally.id];
 if(id.startsWith('healer'))p.hp=600;
 if(id.startsWith('shaman')){assert(createSummon(g,p,1));p.summon!.x=.7;p.summon!.z=4;p.summon!.cooldown=999;}
 return {g,p,e,ally};
}
function advance(g:ReturnType<typeof createGame>,seconds:number,input={x:0,z:0}){for(let n=0;n<Math.round(seconds/.05);n++)step(g,.05,input);}
function bolt(f:ReturnType<typeof fixture>,damage=100){f.p.invulnerable=0;f.g.projectiles.push({id:f.g.nextId++,owner:f.e.id,attack:'bolt',x:f.p.x,z:f.p.z,vx:0,vz:0,life:1,damage,phase:1});step(f.g,.05);}

test('remaining58 actions use catalog MP/CD and real authoritative effects; failed prerequisites never spend resources',()=>{
 assert.equal(ADVANCED_MASTERY_ACTIONS.length,58);
 for(const id of ADVANCED_MASTERY_ACTIONS){
  const f=fixture(id),{g,p,e,ally}=f;
  if(id==='archer_19'){assert(action(g,'archer_16'));advance(g,1);}
  if(id==='rogue_13'){assert(action(g,'rogue_05'));advance(g,.3);}
  if(id==='healer_19'){assert(action(g,'healer_16'));advance(g,1);}
  if(id==='boxer_18'){assert(action(g,'boxer_17'));bolt(f);}
  p.castRemaining=0;const mp=p.mp,s=resolveSkill(data,id),allyId=['healer_05','healer_06','healer_11','healer_12','healer_13','healer_17'].includes(id)?ally.id:undefined;
  assert(action(g,id,allyId),id);if(id!=='archer_19')assert.equal(p.mp,mp-s.sp,id);assert.equal(p.cd[id],s.cooldown,id);
  advance(g,Math.max(2.1,s.cast+1));
  assert(g.events.some(v=>(v.type==='skillImpact'||v.type==='masteryZone'||v.type==='heal')&&v.skillId===id),id+' must produce an effect, not just a paid cast');
  assert(Number.isFinite(p.hp)&&Number.isFinite(p.mp)&&Number.isFinite(e.hp),id);
  const bad=fixture(id);bad.p.skills[id]=0;const before=bad.p.mp;assert.equal(action(bad.g,id),false,id);assert.equal(bad.p.mp,before,id);
 }
});

test('trap arms once after one second, hits at most three and recall refunds only actual paid MP',()=>{
 const {g,p,e}=fixture('archer_16');const before=e.hp;assert(action(g,'archer_16'));assert.equal(e.hp,before);advance(g,resolveSkill(data,'archer_16').cast+.9);assert.equal(e.hp,before);advance(g,.1);assert(e.hp<before);const hp=e.hp;advance(g,3);assert.equal(e.hp,hp);
 const r=fixture('archer_19');r.e.x=5;assert(action(r.g,'archer_16'));advance(r.g,resolveSkill(data,'archer_16',r.p.skills.archer_16).cast);const paid=resolveSkill(data,'archer_16',r.p.skills.archer_16).sp;const mp=r.p.mp;assert(action(r.g,'archer_19'));assert.equal(r.p.mp,mp-resolveSkill(data,'archer_19').sp+paid*.2);assert.equal(action(r.g,'archer_19'),false);
});

test('healer transfer charges HP without wound training and channels pay once, heal progressively and cancel on movement',()=>{
 const f=fixture('healer_05'),hp=f.p.hp;assert(action(f.g,'healer_05',f.ally.id));advance(f.g,2);assert.equal(f.p.hp,hp-80);assert(f.ally.hp>400);
 const c=fixture('healer_06'),mp=c.p.mp;assert(action(c.g,'healer_06',c.ally.id));advance(c.g,.5);const healed=c.ally.hp;assert(healed>400&&healed<720);advance(c.g,.05,{x:1,z:0});advance(c.g,2);assert.equal(c.ally.hp,healed);assert.equal(c.p.mp,mp-resolveSkill(data,'healer_06').sp);
});

test('area ticks require current occupancy and cannot stack same-owner same-skill fields',()=>{
 const {g,p,e}=fixture('mage_12');assert(action(g,'mage_12'));advance(g,resolveSkill(data,'mage_12').cast+1);assert(e.hp<e.maxHp);
 e.x=15;e.z=15;const hp=e.hp;advance(g,2);assert.equal(e.hp,hp);p.cd.mage_12=0;g.target=null;assert(action(g,'mage_12'));advance(g,resolveSkill(data,'mage_12').cast);assert.equal(advancedMasterySnapshot(g,p)!.zones.filter(z=>z.skillId==='mage_12').length,1);
});

test('counter requires a real guarded hit, spends its window and cannot be opened by self damage',()=>{
 const f=fixture('boxer_18');assert.equal(action(f.g,'boxer_18'),false);assert(action(f.g,'boxer_17'));f.p.hp-=10;assert.equal(action(f.g,'boxer_18'),false);bolt(f);assert(action(f.g,'boxer_18'));f.p.cd.boxer_18=0;assert.equal(action(f.g,'boxer_18'),false);
});


test('piercing arrows and wind chain cap at three unique enemies and the chain uses wind',()=>{
 for(const id of ['archer_12','mage_11']){const f=fixture(id);for(const x of [1.8,2.3,2.8]){const e=spawn(f.g,x,4);e.hp=e.maxHp=10000;e.cooldown=e.wander=999;}
 assert(action(f.g,id));advance(f.g,2);const hits=f.g.events.filter(e=>e.type==='hit'&&e.skillId===id);assert.equal(hits.length,3);assert.equal(new Set(hits.map(e=>e.id)).size,3);if(id==='mage_11')assert(hits.every(e=>e.element==='wind'));}
});

test('freeze breaks on the next real damage, bosses remain immune, and mirror consumes exactly one true magic projectile',()=>{
 const f=fixture('mage_16');assert(action(f.g,'mage_16'));advance(f.g,f.p.castRemaining+.05);assert(f.e.statuses.some(s=>s.id==='freeze'));
 f.p.cd.attack=0;assert(action(f.g,'attack'));assert(!f.e.statuses.some(s=>s.id==='freeze'));
 const boss=fixture('mage_16');boss.e.boss=true;assert(action(boss.g,'mage_16'));advance(boss.g,2);assert(!boss.e.statuses.some(s=>s.id==='freeze'));
 const mirror=fixture('mage_19');assert(action(mirror.g,'mage_19'));bolt(mirror);mirror.p.invulnerable=0;bolt(mirror);assert.equal(mirror.g.events.filter(e=>e.type==='masteryReflect').length,1);assert(mirror.e.hp<mirror.e.maxHp);
});

test('decoy receives a real enemy projectile without healing, attacking or reducing its owners HP',()=>{
 const f=fixture('rogue_19'),hp=f.p.hp;assert(action(f.g,'rogue_19'));advance(f.g,f.p.castRemaining+.05);const d=f.p.decoy!;assert(d);const before=d.hp;
 f.g.projectiles.push({id:f.g.nextId++,owner:f.e.id,attack:'bolt',x:d.x,z:d.z,vx:0,vz:0,life:1,damage:10,phase:1});step(f.g,.05);
 assert.equal(d.hp,before-10);assert.equal(f.p.hp,hp);const enemyHp=f.e.hp;advance(f.g,2);assert.equal(f.e.hp,enemyHp);advance(f.g,2);assert.equal(f.p.decoy,undefined);
});


test('ground targeting locks a real walkable position, ignores the selected enemy and rejects out-of-range or wrong-kind points without paying',()=>{
 const f=fixture('mage_12');f.e.x=20;const mp=f.p.mp;
 assert.equal(action(f.g,'mage_12',undefined,{x:30,z:4}),false);assert.equal(action(f.g,'mage_01',undefined,{x:1,z:4}),false);assert.equal(action(f.g,'mage_12',undefined,{x:NaN,z:4}),false);assert.equal(f.p.mp,mp);
 assert(action(f.g,'mage_12',undefined,{x:2,z:4}));advance(f.g,f.p.castRemaining+.05);const zone=advancedMasterySnapshot(f.g,f.p)!.zones[0];assert.equal(zone.x,2);assert.equal(zone.z,4);assert.equal(f.e.hp,f.e.maxHp);
});


test('element setup boosts exactly one subsequent direct spell; healing link shares effective healing once',()=>{
 const f=fixture('mage_13');assert(action(f.g,'mage_13'));advance(f.g,f.p.castRemaining+.1);
 const base=resolveSkill(data,'mage_01',f.p.skills.mage_01).percent;
 assert(action(f.g,'mage_01'));advance(f.g,f.p.castRemaining+.1);let hits=f.g.events.filter(e=>e.type==='hit'&&e.skillId==='mage_01');assert(Math.abs(hits.at(-1)!.breakdown.base-base*1.12)<1e-8);
 f.p.cd.mage_01=0;assert(action(f.g,'mage_01'));advance(f.g,f.p.castRemaining+.1);hits=f.g.events.filter(e=>e.type==='hit'&&e.skillId==='mage_01');assert(Math.abs(hits.at(-1)!.breakdown.base-base)<1e-8);
 const link=fixture('healer_12');assert(action(link.g,'healer_12',link.ally.id));advance(link.g,link.p.castRemaining+.1);const before=link.ally.hp;assert(action(link.g,'healer_01'));advance(link.g,link.p.castRemaining+.1);
 const direct=link.g.events.filter(e=>e.type==='heal'&&e.skillId==='healer_01').reduce((n,e)=>n+e.amount,0);assert(direct>0);assert(Math.abs(link.ally.hp-before-direct*.12)<1e-8);assert.equal(link.g.events.filter(e=>e.type==='heal'&&e.playerId===link.ally.id).length,1);
});

test('pet redirection conserves actual HP loss, guardian shields never refill HP and haste has a real attack interval effect',()=>{
 const f=fixture('shaman_10');f.p.stats.softMdef=0;const hp=f.p.hp,pet=f.p.summon!,petHp=pet.hp;assert(action(f.g,'shaman_10'));advance(f.g,f.p.castRemaining+.05);bolt(f);assert.equal(hp-f.p.hp,90);assert.equal(petHp-pet.hp,10);
 const guard=fixture('shaman_13');guard.p.summon!.hp-=20;const old=guard.p.summon!.hp;assert(action(guard.g,'shaman_13'));advance(guard.g,guard.p.castRemaining+.05);assert.equal(guard.p.summon!.hp,old);
 const slow=fixture('shaman_12'),fast=fixture('shaman_12');assert(action(fast.g,'shaman_12'));advance(fast.g,fast.p.castRemaining+.05);slow.p.summon!.cooldown=fast.p.summon!.cooldown=.01;
 advance(slow.g,.4);advance(fast.g,.4);assert(fast.p.summon!.cooldown<slow.p.summon!.cooldown);
});

test('emergency healing scales only below30percent and rear/execute bonuses use authoritative target state',()=>{
 const normal=fixture('healer_13'),low=fixture('healer_13');normal.ally.hp=400;low.ally.hp=200;assert(action(normal.g,'healer_13',normal.ally.id));assert(action(low.g,'healer_13',low.ally.id));advance(normal.g,2);advance(low.g,2);assert.equal(normal.ally.hp-400,170);assert.equal(low.ally.hp-200,213);
 for(const id of ['rogue_10','rogue_12']){const f=fixture(id);if(id==='rogue_12')f.e.hp=f.e.maxHp*.2;assert(action(f.g,id));advance(f.g,2);const hit=f.g.events.find(e=>e.type==='hit'&&e.skillId===id)!;const spec=resolveSkill(data,id);assert.equal(hit.breakdown.base,spec.percent*(id==='rogue_10'?1.25:1.4));}
});


test('stored force caps at15percent MaxHP, is spent by a real counter and cannot be banked past its window',()=>{
 const f=fixture('boxer_19');f.p.stats.softMdef=0;assert(action(f.g,'boxer_19'));assert(action(f.g,'boxer_17'));
 for(let i=0;i<5;i++){f.p.hp=f.p.maxHp;bolt(f,500);}
 assert(advancedMasterySnapshot(f.g,f.p)!.effects.some(e=>e.id==='boxer_force'));assert(action(f.g,'boxer_18'));advance(f.g,1);
 const hit=f.g.events.find(e=>e.type==='hit'&&e.skillId==='boxer_18')!;assert.equal(hit.breakdown.base,resolveSkill(data,'boxer_18',f.p.skills.boxer_18).percent+150);assert(!advancedMasterySnapshot(f.g,f.p)!.effects.some(e=>e.id==='boxer_force'));
});

test('reveal lasts its real window, dispel strips one allowed normal buff and summon seal preserves boss immunity',()=>{
 const f=fixture('shaman_06');f.e.statuses.push({id:'speed',sourceId:'stealth',remaining:4,value:0});assert(action(f.g,'shaman_06'));advance(f.g,f.p.castRemaining+.1);assert(!f.e.statuses.some(s=>s.sourceId==='stealth'));
 f.e.statuses.push({id:'speed',sourceId:'stealth',remaining:4,value:0});advance(f.g,.1);assert(!f.e.statuses.some(s=>s.sourceId==='stealth'));advance(f.g,2);f.e.statuses.push({id:'speed',sourceId:'stealth',remaining:4,value:0});advance(f.g,.1);assert(f.e.statuses.some(s=>s.sourceId==='stealth'));
 for(const boss of [false,true]){const d=fixture('shaman_17');d.e.boss=boss;d.e.statuses.push({id:'guard',sourceId:'fixture',remaining:10,value:.1});assert(action(d.g,'shaman_17'));advance(d.g,d.p.castRemaining+.1);assert.equal(d.e.statuses.some(s=>s.id==='guard'),boss);
 const seal=fixture('shaman_18');seal.e.boss=boss;assert(action(seal.g,'shaman_18'));advance(seal.g,seal.p.castRemaining+.1);assert.equal(advancedEnemyBlocked(seal.g,seal.e,'summon'),!boss);}
});

 test('legacy self buffs never attach an enemy selector to their zero-range network actions',async()=>{
 const {masteryTarget}=await import('../src/game/mastery-runtime.js');
 for(const id of ['endure','bulwark','blood_rage'])assert.equal(masteryTarget(id),'self');
 });
