import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,createSummon,addPlayer,DEFAULT_AUTO,OBSTACLES} from '../src/index.node.js';
import {clearMasteryEncounter} from '../src/game/mastery-training.js';
const data=loadGameData();
function fixture(){
 const g=createGame(881,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.masteries.Summoner=75;Object.assign(p.skills,{shaman_01:1,shaman_03:1});
 p.x=0;p.z=4;p.stats.matk=101;p.stats.hpRegen=0;p.stats.spRegen=0;p.mp=p.maxMp=400;assert(createSummon(g,p,1));const pet=p.summon!;pet.cooldown=99;
 return {g,p,pet};
}
function foe(g:ReturnType<typeof createGame>,x=1.4,z=4){const e=spawn(g,x,z);e.hp=e.maxHp=10000;e.cooldown=999;e.statuses=[{id:'root',sourceId:'fixture',remaining:99,value:1}];return e;}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
const petHits=(g:ReturnType<typeof createGame>,id:string)=>g.events.filter(v=>v.type==='hit'&&v.skillId===id&&v.petId!==undefined);

test('pet command learns through accepted prerequisite/Mastery, saves to hotbar and preserves every rank cost/scaling',()=>{
 let progress=newJob();progress.skillPoints=3;assert.throws(()=>learnSkill(progress,'shaman_03',data));progress=learnSkill(progress,'shaman_01',data);assert.throws(()=>learnSkill(progress,'shaman_03',data),/Mastery 25/);progress.masteries.Summoner=25;progress=learnSkill(progress,'shaman_03',data);
 assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?'shaman_03':null})),data)[0].skill,'shaman_03');
 for(const rank of data.mastery.skills.find(s=>s.id==='shaman_03')!.ranks){
  const {g,p,pet}=fixture(),e=foe(g);p.skills.shaman_03=rank.rank;g.target=e.id;const mp=p.mp,s=resolveSkill(data,'shaman_03',rank.rank);
  assert.equal(s.sp,rank.mp);assert.equal(s.cast,rank.cast);assert.equal(s.cooldown,rank.cooldown);assert.equal(s.percent,rank.params.petBurst);assert(action(g,'shaman_03'));g.target=null;
  assert.equal(p.mp,mp-rank.mp);assert.equal(p.cd.shaman_03,rank.cooldown);assert.equal(p.summon,pet);assert.equal(pet.command!.nextBonus,rank.params.petNextBonus);
  const hit=petHits(g,'shaman_03')[0];assert.equal(hit.breakdown.base,pet.atk*rank.params.petBurst/100);assert.equal(hit.petId,pet.id);assert.equal(e.masteryDamage![p.id].Summoner,10000-e.hp);
 }
});

test('command retargets the same pet immediately, cancels its old windup and retains normal recovery and main-pet identity',()=>{
 const {g,p,pet}=fixture(),old=foe(g,1.2,4),target=foe(g,1.4,4);pet.target=old.id;pet.attack=.2;pet.state='attack';const cd=pet.cooldown;g.target=target.id;
 assert(action(g,'shaman_03'));g.target=null;assert.equal(p.summon,pet);assert.equal(pet.target,target.id);assert.equal(pet.attack,0);assert.equal(pet.cooldown,cd);assert.equal(old.hp,10000);assert(target.hp<10000);
 advance(g,.3);assert.equal(old.hp,10000);assert.equal(pet.command!.target,target.id);assert.equal(petHits(g,'shaman_01').length,0);
 const impact=g.events.find(v=>v.type==='skillImpact'&&v.skillId==='shaman_03')!;assert.equal(impact.petId,pet.id);assert.equal(impact.id,target.id);
});

test('one next-normal bonus survives the burst, applies once and cannot stack across repeated commands',()=>{
 const {g,p,pet}=fixture(),e=foe(g);g.target=e.id;assert(action(g,'shaman_03'));p.cd.shaman_03=0;p.skills.shaman_03=10;assert(action(g,'shaman_03'));g.target=null;assert.equal(pet.command!.nextBonus,45);
 pet.cooldown=0;advance(g,.4);assert.equal(petHits(g,'shaman_01').length,1);assert.equal(petHits(g,'shaman_01')[0].breakdown.base,pet.atk*1.45);assert.equal(pet.command!.nextBonus,0);
 advance(g,1.6);assert.equal(petHits(g,'shaman_01')[1].breakdown.base,pet.atk);
});

test('next-normal attempt consumes the bonus even on a miss and a burst miss does not consume it',()=>{
 const {g,pet}=fixture(),e=foe(g);g.target=e.id;g.random=()=>.99;assert(action(g,'shaman_03'));g.target=null;assert.equal(petHits(g,'shaman_03').length,0);assert.equal(pet.command!.nextBonus,20);
 pet.cooldown=0;advance(g,.4);assert.equal(pet.command!.nextBonus,0);assert(g.events.some(v=>v.type==='miss'&&v.skillId==='shaman_01'&&v.petId===pet.id));
});

test('command burst uses current pet MATK-derived ATK, with no owner ATK/weapon/lifesteal/coating influence',()=>{
 function run(atk:number,weapon:'staff'|'bow'){
  const {g,p,pet}=fixture(),e=foe(g);p.stats.atk=atk;p.stats.weaponType=weapon;p.stats.matk=200;p.skills.bloodlust=10;p.hp=20;p.skills.rogue_01=1;p.skills.rogue_02=1;p.masteries.Assassin=25;
  assert(action(g,'rogue_02'));g.target=e.id;assert(action(g,'shaman_03'));g.target=null;assert.equal(p.hp,20);assert(p.statuses.some(s=>s.id==='poison_coat'));assert.equal(e.masteryPoisons,undefined);assert.equal(pet.atk,70);return 10000-e.hp;
 }
 assert.equal(run(1,'staff'),run(100000,'bow'));
});

test('command rejects missing/dead/foreign/out-of-map/controlled pets, invalid learning, resources and melee reach without spending',()=>{
 for(const reason of ['missing','hp','dead','foreign','map','stun','knockup','far','ownerRange','rank','mastery','rootRank','mp','ownerCC','ownerDead','ally']){
  const {g,p,pet}=fixture(),e=foe(g);g.target=e.id;
  if(reason==='missing')p.summon=undefined;if(reason==='hp')pet.hp=0;if(reason==='dead')pet.dead=true;if(reason==='foreign')pet.ownerId='other';if(reason==='map')pet.mapId='forest';
  if(reason==='stun'||reason==='knockup')pet.statuses.push({id:reason,sourceId:'fixture',value:0,remaining:5});if(reason==='far')e.x=3;if(reason==='ownerRange'){pet.x=8;e.x=9;}
  if(reason==='rank')p.skills.shaman_03=11;if(reason==='mastery')p.masteries.Summoner=0;if(reason==='rootRank')p.skills.shaman_01=0;if(reason==='mp')p.mp=0;
  if(reason==='ownerCC')p.statuses.push({id:'stun',sourceId:'fixture',value:0,remaining:5});if(reason==='ownerDead')p.dead=true;const mp=p.mp;
  assert.equal(action(g,'shaman_03',reason==='ally'?p.id:undefined),false,reason);assert.equal(p.mp,mp);assert.equal(p.cd.shaman_03||0,0);assert.equal(e.hp,10000);
 }
});

test('real collision prevents a command through an obstructed target while a rooted pet already in reach can strike',()=>{
 const {g,p,pet}=fixture(),e=foe(g);pet.statuses=[{id:'root',sourceId:'fixture',value:1,remaining:5}];g.target=e.id;assert(action(g,'shaman_03'));
 p.cd.shaman_03=0;const obstacle=OBSTACLES[0];e.x=obstacle.x;e.z=obstacle.z;pet.x=e.x-.8;pet.z=e.z;p.x=pet.x;p.z=pet.z;const mp=p.mp;
 assert.equal(action(g,'shaman_03'),false);assert.equal(p.mp,mp);
});

test('commanded target wins over owner selection until encounter ends, then bonus can follow to the next ordinary enemy',()=>{
 const {g,p,pet}=fixture(),target=foe(g,1.4,4),other=foe(g,1.3,4.2);g.target=target.id;assert(action(g,'shaman_03'));g.target=other.id;p.cd.attack=999;pet.cooldown=0;advance(g,.4);
 assert.equal(petHits(g,'shaman_01')[0].id,target.id);p.cd.shaman_03=0;g.target=target.id;assert(action(g,'shaman_03'));target.dead=true;target.respawn=999;clearMasteryEncounter(g,target);
 assert.equal(pet.command!.target,null);assert.equal(pet.command!.nextBonus,20);g.target=other.id;pet.cooldown=0;advance(g,.4);assert.equal(petHits(g,'shaman_01').at(-1)!.id,other.id);assert.equal(pet.command!.nextBonus,0);
});

test('unlearning the command clears its target and pending bonus, replacement/death/travel remove the transient command',()=>{
 const {g,p,pet}=fixture(),e=foe(g);g.target=e.id;assert(action(g,'shaman_03'));g.target=null;p.skills.shaman_03=0;advance(g,.05);assert.equal(pet.command,undefined);
 for(const invalid of ['replace','death','map']){
  const f=fixture(),target=foe(f.g);f.g.target=target.id;assert(action(f.g,'shaman_03'));f.g.target=null;
  if(invalid==='replace')assert(createSummon(f.g,f.p,1));if(invalid==='death')f.p.dead=true;if(invalid==='map')f.p.mapId='forest';advance(f.g,.05);
  assert.equal(f.p.summon?.command,undefined,invalid);
 }
});

test('burst defeat records one kill/training budget and command state remains isolated between owners',()=>{
 const {g,p,pet}=fixture(),e=foe(g),other=addPlayer(g,'other');Object.assign(other,newJob());other.skills.shaman_01=1;other.x=1;other.z=4;assert(createSummon(g,other,1));const otherPet=other.summon!;
 e.hp=e.maxHp=1;g.target=e.id;const kills=p.kills;assert(action(g,'shaman_03'));g.target=null;assert(e.dead);assert.equal(p.kills,kills+1);assert(p.masteryExp.Summoner>0);assert.equal(pet.command!.target,null);assert.equal(pet.command!.nextBonus,20);assert.equal(otherPet.command,undefined);
 advance(g,1);assert.equal(g.events.filter(v=>v.type==='kill'&&v.id===e.id).length,1);
});

test('AUTO waits for an owned pet in actual reach and uses the same command path once ready',()=>{
 const {g,p,pet}=fixture(),e=foe(g,3,4);p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:['shaman_03'],off:['shaman_01']};const mp=p.mp;advance(g,.1);assert.equal(p.mp,mp);
 e.x=1.4;pet.x=.8;g.autoTimer=0;advance(g,.1);assert.equal(p.mp,mp-12);assert.equal(petHits(g,'shaman_03').length,1);assert.equal(p.summon,pet);
});
