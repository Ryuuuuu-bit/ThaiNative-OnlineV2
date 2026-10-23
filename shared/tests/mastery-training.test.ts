import test from "node:test";
import assert from "node:assert/strict";
import {createGame, spawn, action, step, addPlayer, loadGameData, gainMasteryExp, normalizeMastery, resolveSkill} from "../src/index.node.js";
import {recordMasteryDamage, awardMasteryTraining} from "../src/game/mastery-training.js";
const data = loadGameData();
function fixture() {
 const g = createGame(71,{...data.stats.defaultBuild,classId:"swordsman"});g.enemies=[];g.random=()=>.5;
 const p=g.p;p.x=0;p.z=4;p.stats.weaponType="sword1h";p.stats.crit=0;
 const e=spawn(g,1,4),spec={...g.data.monsters.monsters.find(s=>s.id===e.dataId)!,jobExp:100};
 return {g,p,e,spec};
}

test("training uses the existing EXP table, caps at M100 and never grants skill points or HP",()=>{
 const p={...normalizeMastery({}),skillPoints:9,hp:21,mp:13};
 assert.equal(gainMasteryExp(p,"Mage",data.stats.expToNext[0]-1,data),0);
 assert.equal(p.masteryExp.Mage,data.stats.expToNext[0]-1);
 assert.equal(gainMasteryExp(p,"Mage",1,data),1);assert.equal(p.masteries.Mage,1);assert.equal(p.masteryExp.Mage,0);
 assert.equal(p.skillPoints,9);assert.equal(p.hp,21);assert.equal(p.mp,13);
 p.masteries.Mage=99;assert.equal(gainMasteryExp(p,"Mage",Number.MAX_SAFE_INTEGER,data),1);assert.equal(p.masteries.Mage,100);assert.equal(p.masteryExp.Mage,0);
 for(const amount of [0,-1,1.5,NaN,Infinity])assert.equal(gainMasteryExp(p,"Healer",amount,data),0);
 assert.equal(p.masteries.Healer,0);assert.equal(p.masteryExp.Healer,0);
});

test("existing M1 saves gain zero EXP fields without regranting levels or resetting other schools",()=>{
 const p=normalizeMastery({skills:{slash:8}});p.masteryExp.Archer=19;
 const {masteryExp,...old}=p;assert.equal(normalizeMastery(old).masteries.Swordsman,75);assert.equal(normalizeMastery(old).masteryExp.Archer,0);
 const loaded=normalizeMastery(p);assert.equal(loaded.masteryExp.Archer,19);loaded.masteryExp.Archer=0;assert.equal(p.masteryExp.Archer,19);
 assert.throws(()=>normalizeMastery({...p,masteryExp:{...p.masteryExp,Mage:-1}}),{name:"ZodError"});
});

test("only effective server-confirmed damage is credited; unknown item proc and zero damage do not count",()=>{
 const {g,p,e}=fixture(),basic=resolveSkill(g.data,"basic");
 for(const damage of [0,-1,NaN,Infinity])recordMasteryDamage(g,e,basic,damage);
 recordMasteryDamage(g,e,resolveSkill(g.data,"fire_bolt"),5);assert.equal(e.masteryDamage,undefined);
 recordMasteryDamage(g,e,basic,e.maxHp*10);assert.equal(e.masteryDamage![p.id].Swordsman,e.hp);
 e.dead=true;recordMasteryDamage(g,e,basic,5);assert.equal(e.masteryDamage![p.id].Swordsman,e.hp);
});

test("one monster budget is divided across real actors and schools without multiplying on duplicates",()=>{
 const {g,p,e,spec}=fixture(),other=addPlayer(g,"other");other.x=0;other.z=4;
 e.maxHp=100;e.hp=0;e.damageBy={[p.id]:60,[other.id]:40};
 e.masteryDamage={[p.id]:{Swordsman:60,Mage:60},[other.id]:{Archer:40}};
 awardMasteryTraining(g,e,spec,1);
 const trained=p.masteryExp.Swordsman+p.masteryExp.Mage+other.masteryExp.Archer;
 assert.equal(trained,100);assert.equal(p.masteryExp.Swordsman,30);assert.equal(p.masteryExp.Mage,30);assert.equal(other.masteryExp.Archer,40);
 awardMasteryTraining(g,e,spec,1);assert.equal(p.masteryExp.Mage,30);
});

test("idle, absent, dead, distant and level-carried players cannot train from somebody else's kill",()=>{
 for(const invalid of ["idle","absent","dead","distant","carrier","trivial","summoned"]){
  const {g,p,e,spec}=fixture(),other=addPlayer(g,"idle");other.x=0;other.z=4;
  e.hp=0;e.damageBy={[p.id]:e.maxHp};e.masteryDamage={[p.id]:{Swordsman:e.maxHp}};
  if(invalid==="idle"){awardMasteryTraining(g,e,spec,1);assert.equal(other.masteryExp.Swordsman,0);continue;}
  if(invalid==="absent")g.players.delete(p.id);
  if(invalid==="dead")p.dead=true;
  if(invalid==="distant")p.x=100;
  if(invalid==="trivial")p.level=100;
  if(invalid==="summoned")e.summoned=true;
  awardMasteryTraining(g,e,spec,invalid==="carrier"?100:1);
  assert.equal(p.masteryExp.Swordsman,0,invalid);assert.equal(p.masteries.Swordsman,0,invalid);
 }
});

test("actual basic attacks grant training on defeat once, while swings and nonlethal damage do not",()=>{
 const {g,p,e}=fixture();p.stats.atk=10000;p.stats.hit=1000;p.fx=1;p.fz=0;
 const expected=g.data.monsters.monsters.find(s=>s.id===e.dataId)!.jobExp;
 assert(action(g,"attack"));assert(e.dead);assert.equal(p.masteryExp.Swordsman,expected);
 p.cd.attack=0;action(g,"attack");assert.equal(p.masteryExp.Swordsman,expected);
 const second=spawn(g,1,4);second.maxHp=second.hp=100000;p.cd.attack=0;action(g,"attack");
 assert(!second.dead);assert.equal(p.masteryExp.Swordsman,expected);
});

test("abandoned bosses clear training contributions before reset or respawn",()=>{
 const {g,p}=fixture(),boss=spawn(g,10,4,true);g.enemies=[boss];
 boss.masteryDamage={[p.id]:{Swordsman:100}};boss.damageBy={[p.id]:100};boss.hp=1;boss.lastEngagedAt=-100;
 step(g,.05);assert.equal(boss.hp,boss.maxHp);assert.equal(boss.masteryDamage,undefined);
 boss.masteryDamage={[p.id]:{Swordsman:100}};boss.dead=true;boss.rewarded=true;boss.respawn=.01;
 step(g,.05);assert.equal(boss.dead,false);assert.equal(boss.masteryDamage,undefined);
});
