import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,spawn,step,action,createSummon,addPlayer,isMasteryAction,walkable} from '../src/index.node.js';
const data=loadGameData();
function fixture(){
 const g=createGame(171,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.skills={shaman_01:1};p.x=0;p.z=4;p.stats.hpRegen=0;p.stats.spRegen=0;p.stats.matk=100;
 return {g,p};
}
function advance(g:ReturnType<typeof createGame>,seconds:number){for(let n=0;n<Math.round(seconds/.05);n++)step(g,.05);}
test('summon action pays accepted MP/CD once and creates the pet only after its actual cast completes',()=>{
 const {g,p}=fixture(),mp=p.mp;assert.equal(isMasteryAction('shaman_01'),true);assert(action(g,'shaman_01'));assert.equal(p.summon,undefined);assert.equal(p.mp,mp-35);assert.equal(p.cd.shaman_01,20);
 advance(g,.95);assert.equal(p.summon,undefined);advance(g,.05);assert(p.summon);assert.equal(p.mp,mp-35);
});
test('trusted summon creation enforces owner/rank/Mastery and accepted MATK/HP scaling',()=>{
 const {g,p}=fixture();assert(createSummon(g,p,1));assert.equal(p.summon!.atk,35);assert.equal(p.summon!.maxHp,Math.round(p.maxHp*.45));
 const first=p.summon;assert.equal(createSummon(g,p,4),false);assert.equal(p.summon,first);
 p.skills.shaman_01=4;assert.equal(createSummon(g,p,4),false);p.masteries.Summoner=25;assert(createSummon(g,p,4));
 const rank=data.mastery.skills.find(s=>s.id==='shaman_01')!.ranks[3];assert.equal(p.summon!.atk,p.stats.matk*rank.params.petAtk/100);
 assert.equal(createSummon(g,{...p},4),false);
});
test('one summon per owner replaces the old identity while other players remain independent',()=>{
 const {g,p}=fixture(),other=addPlayer(g,'other');Object.assign(other,newJob());other.skills={shaman_01:1};other.x=2;other.z=4;
 assert(createSummon(g,p,1));assert(createSummon(g,other,1));const original=p.summon!.id,otherId=other.summon!.id;
 assert(createSummon(g,p,1));assert.notEqual(p.summon!.id,original);assert.equal(other.summon!.id,otherId);
 assert(g.events.some(v=>v.type==='summonEnd'&&v.petId===original&&v.reason==='replaced'));
});
test('current owner MATK/Max HP update the pet without granting healing on equipment swaps',()=>{
 const {g,p}=fixture();assert(createSummon(g,p,1));p.summon!.hp=20;
 p.stats.matk=200;p.maxHp=200;advance(g,.05);assert.equal(p.summon!.atk,70);assert.equal(p.summon!.maxHp,90);assert.equal(p.summon!.hp,20);
 p.maxHp=20;advance(g,.05);assert.equal(p.summon!.hp,9);p.maxHp=200;advance(g,.05);assert.equal(p.summon!.hp,9);
});
test('summon has a startup and attack windup, credits actual damage to its owner and never charges MP per hit',()=>{
 const {g,p}=fixture(),e=spawn(g,1.4,4);e.hp=e.maxHp=10000;e.cooldown=999;p.target=e.id;assert(createSummon(g,p,1));const mp=p.mp;
 advance(g,.85);assert.equal(e.hp,10000);advance(g,.1);assert(e.hp<10000);assert.equal(p.mp,mp);
 assert.equal(e.damageBy[p.id],10000-e.hp);assert.equal(e.masteryDamage![p.id].Summoner,10000-e.hp);
 const hit=g.events.find(v=>v.type==='hit'&&v.petId===p.summon!.id);assert.equal(hit!.playerId,p.id);assert.equal(hit!.skillId,'shaman_01');
});
test('pet damage uses its own neutral attack, suppresses owner attack bonuses/lifesteal and respects facing guards',()=>{
 function damage(ownerAtk:number){
  const {g,p}=fixture(),e=spawn(g,1.4,4);e.hp=e.maxHp=10000;e.cooldown=999;p.target=e.id;p.stats.atk=ownerAtk;p.stats.crit=1;p.skills.bloodlust=10;p.hp=20;
  assert(createSummon(g,p,1));advance(g,.95);assert.equal(p.hp,20);return 10000-e.hp;
 }
 assert.equal(damage(1),damage(100000));
 function guarded(front:boolean){
  const {g,p}=fixture(),e=spawn(g,1.4,4,false,'pink',true,'himmapan_jade_turtle');e.hp=e.maxHp=10000;e.fx=front?-1:1;e.fz=0;e.himmapan={next:100};e.cooldown=999;p.target=e.id;p.stats.matk=10000;
  e.statuses=[{id:'stun',sourceId:'fixture',remaining:10,value:0}];g.random=()=>0;
  assert(createSummon(g,p,1));advance(g,.95);return 10000-e.hp;
 }
 assert(guarded(true)<guarded(false));
});
test('lost target or leash cancels pet impact; no unrelated enemy is auto-attacked',()=>{
 const {g,p}=fixture(),e=spawn(g,1.4,4),other=spawn(g,1.6,4);for(const v of [e,other]){v.hp=v.maxHp=10000;v.cooldown=999;}
 assert(createSummon(g,p,1));advance(g,1);assert.equal(e.hp,10000);assert.equal(other.hp,10000);
 p.target=e.id;advance(g,.05);e.x=100;advance(g,.4);assert.equal(e.hp,10000);assert.equal(other.hp,10000);
});
test('owner death, map change, unlearning or pet HP depletion removes the summon',()=>{
 for(const invalid of ['owner-death','map','unlearn','pet-death']){
  const {g,p}=fixture();assert(createSummon(g,p,1));
  if(invalid==='owner-death')p.dead=true;if(invalid==='map')p.mapId='forest';if(invalid==='unlearn')delete p.skills.shaman_01;if(invalid==='pet-death')p.summon!.hp=0;
  advance(g,.05);assert.equal(p.summon,undefined,invalid);
 }
});
test('summon follows through walkable movement and kills grant one existing reward/training budget',()=>{
 const {g,p}=fixture();assert(createSummon(g,p,1));p.x=6;
 for(let n=0;n<40;n++){step(g,.05);assert(walkable(p.summon!.x,p.summon!.z,.3,g.mapId));}
 assert(p.summon!.x>3);
 const e=spawn(g,p.summon!.x+.5,p.summon!.z);e.hp=e.maxHp=1;e.cooldown=999;p.target=e.id;
 advance(g,1);assert(e.dead);const xp=p.masteryExp.Summoner;assert(xp>0);advance(g,.5);assert.equal(p.masteryExp.Summoner,xp);
 assert.equal(e.damageBy[p.id],1);assert.equal(g.events.filter(v=>v.type==='kill'&&v.id===e.id).length,1);
});
