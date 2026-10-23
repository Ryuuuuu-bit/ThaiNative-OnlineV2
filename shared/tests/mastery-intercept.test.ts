import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,revive,addPlayer,DEFAULT_AUTO} from '../src/index.node.js';
import {awardMasteryTraining,recordMasteryWound,restoreMasteryHp} from '../src/game/mastery-training.js';
const data=loadGameData();
function fixture(){
 const g=createGame(1181,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;const p=g.p;Object.assign(p,newJob());p.masteries.Summoner=25;Object.assign(p.skills,{shaman_01:1,shaman_04:1});
 p.x=0;p.z=4;p.stats.hpRegen=0;p.stats.spRegen=0;p.stats.softMdef=0;p.stats.flee=-1000;p.hp=p.maxHp=10000;p.mp=p.maxMp=400;const e=spawn(g,4,4);e.hp=e.maxHp=10000;e.cooldown=999;e.wander=999;return {g,p,e};
}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
const spirit=(p:ReturnType<typeof fixture>['p'])=>p.statuses.find(s=>s.id==='spirit_intercept');
function bolt(f:ReturnType<typeof fixture>,damage:number,owner=f.e.id){f.p.invulnerable=0;f.g.projectiles.push({id:f.g.nextId++,owner,attack:'bolt',x:f.p.x,z:f.p.z,vx:0,vz:0,life:1,damage,phase:1});step(f.g,.05);}

test('spirit intercept follows all accepted ranks/learning/bar/costs and needs a learned root, not a live pet',()=>{
 let progress=newJob();progress.skillPoints=3;assert.throws(()=>learnSkill(progress,'shaman_04',data));progress=learnSkill(progress,'shaman_01',data);assert.throws(()=>learnSkill(progress,'shaman_04',data),/Mastery 25/);progress.masteries.Summoner=25;progress=learnSkill(progress,'shaman_04',data);
 assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?'shaman_04':null})),data)[0].skill,'shaman_04');
 for(const rank of data.mastery.skills.find(s=>s.id==='shaman_04')!.ranks){const f=fixture(),{g,p}=f;p.skills.shaman_04=rank.rank;const mp=p.mp,s=resolveSkill(data,'shaman_04',rank.rank);assert.equal(s.sp,rank.mp);assert.equal(s.cast,rank.cast);assert.equal(s.cooldown,rank.cooldown);assert(action(g,'shaman_04'));assert.equal(p.mp,mp-rank.mp);assert.equal(p.cd.shaman_04,rank.cooldown);assert.equal(p.summon,undefined);assert.equal(spirit(p)!.value,rank.params.intercept/100);assert.equal(spirit(p)!.remaining,4);
  bolt(f,100);const residual=Math.round(100*(1-rank.params.intercept/100));assert.equal(p.hp,10000-residual);assert.equal(spirit(p),undefined);assert.equal(f.e.masterySupport![p.id].Summoner,100-residual);
 }
});

test('intercept consumes once on magic or physical enemy hits and never creates a second pet or accumulated pool',()=>{
 const f=fixture();assert(action(f.g,'shaman_04'));bolt(f,100);assert.equal(f.p.hp,9910);bolt(f,100);assert.equal(f.p.hp,9810);assert.equal(f.g.events.filter(v=>v.type==='spiritIntercept').length,1);assert.equal(f.p.summon,undefined);
 function melee(guarded:boolean){const f=fixture();f.e.x=.9;f.e.motion='attack';f.e.motionTime=(f.e.behavior?.windup??.5)-.01;f.e.motionDuration=2;f.e.fx=-1;f.e.fz=0;f.e.attackApplied=false;if(guarded)assert(action(f.g,'shaman_04'));step(f.g,.05);return {amount:f.g.events.find(v=>v.type==='hurt')!.amount,guard:spirit(f.p)};}
 const base=melee(false),guard=melee(true);assert(base.amount>0);assert.equal(guard.amount,Math.round(base.amount*.9));assert.equal(guard.guard,undefined);
});

test('item barriers and magic ward absorb first; a fully absorbed hit preserves the spirit for residual damage',()=>{
 const f=fixture(),{g,p,e}=f;assert(action(g,'shaman_04'));p.lootEffects={cooldowns:{},shield:0,shieldFor:0,partyShields:[{amount:100,remaining:4,source:'fixture',owner:p.id,map:g.mapId}]};bolt(f,50);assert.equal(p.hp,10000);assert(spirit(p));assert.equal(e.masterySupport,undefined);
 p.lootEffects=undefined;p.masteries.Mage=25;Object.assign(p.skills,{mage_01:1,mage_02:1});p.stats.matk=100;assert(action(g,'mage_02'));bolt(f,50);assert.equal(p.hp,10000);assert(spirit(p));bolt(f,100);assert.equal(p.hp,9973);assert.equal(spirit(p),undefined);assert.equal(e.masterySupport![p.id].Mage,120);assert.equal(e.masterySupport![p.id].Summoner,3);
});

test('misses, invulnerability, god, zero, source-less harm, poison/bleed and HP costs do not spend the spirit',()=>{
 for(const reason of ['miss','invulnerable','god','zero','unknown','venom','bleed','hpCost']){
  const f=fixture(),{g,p,e}=f;assert(action(g,'shaman_04'));
  if(reason==='miss'){g.random=()=>.99;e.x=.9;e.motion='attack';e.motionTime=(e.behavior?.windup??.5)-.01;e.motionDuration=2;e.attackApplied=false;step(g,.05);}
  if(reason==='invulnerable'){p.invulnerable=2;g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:0,z:4,vx:0,vz:0,life:1,damage:100,phase:1});step(g,.05);}
  if(reason==='god'){p.god=true;bolt(f,100);}if(reason==='zero'){p.statuses.push({id:'guard',sourceId:'fixture',remaining:5,value:1});bolt(f,100);}if(reason==='unknown')bolt(f,30,999999);
  if(reason==='venom'){p.lootEffects={cooldowns:{},shield:0,shieldFor:0,venom:{remaining:3,tick:.99}};step(g,.05);}if(reason==='bleed'){p.lootEffects={cooldowns:{},shield:0,shieldFor:0,bleed:{remaining:3,tick:.99,damage:3,map:g.mapId}};step(g,.05);}if(reason==='hpCost')p.hp-=30;
  assert(spirit(p),reason);assert.equal(e.masterySupport,undefined,reason);assert.equal(g.events.filter(v=>v.type==='spiritIntercept').length,0);
 }
});

test('a summoned or defeated enemy projectile still consumes the spirit but grants no invalid support credit',()=>{
 for(const kind of ['summoned','dead']){const f=fixture();assert(action(f.g,'shaman_04'));if(kind==='summoned')f.e.summoned=true;else{f.e.dead=true;f.e.respawn=999;}bolt(f,100);assert.equal(f.p.hp,9910);assert.equal(spirit(f.p),undefined);assert.equal(f.e.masterySupport,undefined);}
});

test('a one-damage hit consumes the one-hit charge even when percentage rounding prevents zero HP',()=>{
 const f=fixture();assert(action(f.g,'shaman_04'));bolt(f,1);assert.equal(f.p.hp,9999);assert.equal(spirit(f.p),undefined);assert.equal(f.e.masterySupport,undefined);assert.equal(f.g.events.find(v=>v.type==='spiritIntercept')!.amount,0);
});

test('replacement never stacks; expiry, invalid learning/Mastery and death/revive clear transient spirit state',()=>{
 const f=fixture();assert(action(f.g,'shaman_04'));f.p.skills.shaman_04=5;f.p.cd.shaman_04=0;assert(action(f.g,'shaman_04'));assert.equal(f.p.statuses.filter(s=>s.id==='spirit_intercept').length,1);assert.equal(spirit(f.p)!.value,.2);advance(f.g,4);assert.equal(spirit(f.p),undefined);
 for(const reason of ['unlearn','mastery','death','revive']){const f=fixture();assert(action(f.g,'shaman_04'));if(reason==='unlearn')f.p.skills.shaman_04=0;if(reason==='mastery')f.p.masteries.Summoner=0;if(reason==='death')bolt(f,100000);if(reason==='revive'){f.p.dead=true;revive(f.g);}advance(f.g,.05);assert.equal(spirit(f.p),undefined,reason);}
});

test('invalid starts never spend MP/CD, while any held weapon is allowed and other owners remain independent',()=>{
 for(const reason of ['rank','mastery','root','mp','cc','ally']){const f=fixture();if(reason==='rank')f.p.skills.shaman_04=6;if(reason==='mastery')f.p.masteries.Summoner=0;if(reason==='root')f.p.skills.shaman_01=0;if(reason==='mp')f.p.mp=0;if(reason==='cc')f.p.statuses.push({id:'stun',sourceId:'fixture',remaining:1,value:0});const mp=f.p.mp;assert.equal(action(f.g,'shaman_04',reason==='ally'?f.p.id:undefined),false);assert.equal(f.p.mp,mp);assert.equal(f.p.cd.shaman_04||0,0);}
 for(const weapon of ['bow','dagger','staff','unarmed','sword1h','sword2h'] as const){const f=fixture();f.p.stats.weaponType=weapon;assert(action(f.g,'shaman_04'));}
 const f=fixture(),other=addPlayer(f.g,'other');Object.assign(other,newJob());other.masteries.Summoner=25;Object.assign(other.skills,{shaman_01:1,shaman_04:1});other.mp=100;other.x=1;other.z=4;assert(action(f.g,'shaman_04'));f.g.p=other;assert(action(f.g,'shaman_04'));f.g.p=f.p;bolt(f,100);assert.equal(spirit(f.p),undefined);assert(spirit(other));
});

test('intercept prevention shares one encounter support/EXP cap with healing and never credits more than threatened HP',()=>{
 const f=fixture(),{g,p,e}=f;e.hp=e.maxHp=100;assert(action(g,'shaman_04'));bolt(f,100);p.skills.healer_01=1;p.hp-=90;recordMasteryWound(g,p,e,90);restoreMasteryHp(p,90,g,p);assert.deepEqual(e.masterySupport![p.id],{Summoner:10,Healer:90});e.hp=0;e.damageBy={[p.id]:100};e.masteryDamage={[p.id]:{Swordsman:100}};awardMasteryTraining(g,e,{...data.monsters.monsters.find(s=>s.id===e.dataId)!,jobExp:100},1);assert.equal(p.masteryExp.Summoner,5);assert.equal(p.masteryExp.Healer,45);assert.equal(p.masteryExp.Swordsman,50);
 const small=fixture();small.p.hp=5;assert(action(small.g,'shaman_04'));bolt(small,100);assert(small.p.dead);assert.equal(small.e.masterySupport![small.p.id].Summoner,5);
});

test('AUTO uses one spirit and skips refreshing a live charge',()=>{
 const f=fixture();f.e.x=1;f.p.auto=true;f.p.autoCfg={...DEFAULT_AUTO,basic:false,order:['shaman_04'],off:['shaman_01']};const mp=f.p.mp;advance(f.g,.1);assert(spirit(f.p));assert.equal(f.p.mp,mp-20);f.p.cd.shaman_04=0;advance(f.g,.2);assert.equal(f.p.mp,mp-20);
});
