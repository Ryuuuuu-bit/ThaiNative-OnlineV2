import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,spawn,step,createSummon,action,DEFAULT_AUTO,type BossTelegraph} from '../src/index.node.js';
import {summonDot,enemyTarget} from '../src/game/summons.js';
const data=loadGameData();
function fixture(){
 const g=createGame(171,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;
 const p=g.p;Object.assign(p,newJob());p.skills={shaman_01:1};p.x=0;p.z=4;p.stats.hpRegen=0;p.stats.spRegen=0;p.maxHp=p.hp=100000;
 assert(createSummon(g,p,1));return {g,p,pet:p.summon!};
}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
test('enemy melee selects the nearby pet; pet death never subtracts owner HP/EXP or grants monster rewards',()=>{
 const {g,p,pet}=fixture(),e=spawn(g,1.1,4);e.motion='attack';e.motionTime=e.behavior!.windup;e.attackApplied=false;pet.hp=1;
 assert.equal(enemyTarget(g,e),pet);const hp=p.hp,xp=p.xp,kills=g.kills;step(g,.05);
 assert(pet.dead);assert.equal(p.summon,undefined);assert.equal(p.hp,hp);assert.equal(p.xp,xp);assert.equal(g.kills,kills);
 assert(g.events.some(v=>v.type==='summonEnd'&&v.reason==='defeated'));assert(!g.events.some(v=>v.type==='death'));
});
test('taunt still targets its player, and projectile collisions hurt the actual pet without player loot hooks',()=>{
 const {g,p,pet}=fixture(),e=spawn(g,4,4);e.cooldown=999;e.statuses=[{id:'taunt',remaining:2,value:0,sourceId:p.id}];assert.equal(enemyTarget(g,e),p);
 g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:pet.x,z:pet.z,vx:0,vz:0,life:1,damage:10,phase:1});
 const hp=p.hp,before=pet.hp;step(g,.05);assert.equal(pet.hp,before-10);assert.equal(p.hp,hp);assert.equal(p.lootEffects?.shield??0,0);
});
test('all five region attack controllers hit pets in their real area pass, including slow/bleed',()=>{
 for(const [id,key]of [['himmapan_jade_turtle','himmapan'],['desert_sand_ushabti','desert'],['frost_ice_lindworm','frost'],['yokai_rain_nue','yokai'],['volcano_ash_spine_boar','endgame']] as const){
  const {g,p,pet}=fixture(),e=spawn(g,2.4,4,false,'pink',true,id);e.cooldown=0;e.aggro=10;step(g,.05);
  const action=e[key]?.action;assert(action,id);
  const area:BossTelegraph={id:'fixture',nameTh:'fixture',x:pet.x,z:pet.z,radius:.35,shape:'circle',inner:0,angle:0,fx:1,fz:0,left:.01};
  action.left=.01;action.areas=[area];action.target={x:pet.x,z:pet.z};e.telegraph=area;const hp=p.hp,before=pet.hp;
  step(g,.05);assert(pet.hp<before,id);assert.equal(p.hp,hp,id);
  if(key==='frost'||key==='endgame')assert(pet.dots?.some(d=>d.kind==='bleed'),id);
  if(key==='desert'||key==='yokai')assert(pet.statuses.some(s=>s.id==='slow'),id);
 }
});
test('generic boss telegraphs include pet victims while keeping the distant owner unharmed',()=>{
 const {g,p,pet}=fixture(),boss=spawn(g,3,4,true);boss.engaged=true;
 boss.telegraph={id:'slam',nameTh:'fixture',shape:'circle',x:pet.x,z:pet.z,radius:.35,inner:0,angle:0,fx:1,fz:0,left:.01};
 const before=pet.hp,hp=p.hp;step(g,.05);assert(pet.hp<before);assert.equal(p.hp,hp);
});
test('pet poison/bleed ticks real HP without touching owner state, and stun/root/slow prevent attacks/movement',()=>{
 const {g,p,pet}=fixture(),hp=p.hp;pet.invulnerable=10;summonDot(pet,'poison',3,1);summonDot(pet,'bleed',4,1);advance(g,1.05);
 assert.equal(pet.hp,pet.maxHp-7);assert.equal(p.hp,hp);assert.equal(pet.dots!.length,0);
 pet.invulnerable=0;const e=spawn(g,1.3,4);e.cooldown=999;e.hp=e.maxHp=10000;p.target=e.id;
 pet.statuses=[{id:'stun',sourceId:'fixture',remaining:1,value:0}];advance(g,.5);assert.equal(e.hp,10000);
 p.target=null;p.x=6;pet.statuses=[{id:'root',sourceId:'fixture',remaining:1,value:0}];const x=pet.x;advance(g,.3);assert.equal(pet.x,x);
 pet.statuses=[{id:'slow',sourceId:'fixture',remaining:1,value:1}];advance(g,.3);assert.equal(pet.x,x);
});
test('summon interruption keeps spent resources and the old pet; successful recast replaces only on completion',()=>{
 for(const cc of ['stun','knockup']as const){
  const {g,p,pet}=fixture(),mp=p.mp;assert(action(g,'shaman_01'));p.statuses=[{id:cc,sourceId:'fixture',remaining:.1,value:0}];advance(g,1.1);
  assert.equal(p.summon,pet);assert.equal(p.mp,mp-35);assert(p.cd.shaman_01>0);assert.equal(g.meteors.length,0);
 }
 const {g,p,pet}=fixture();assert(action(g,'shaman_01'));advance(g,.95);assert.equal(p.summon,pet);advance(g,.05);assert.notEqual(p.summon,pet);
});
test('summon rejects unlearned/MP/cooldown/ally starts and AUTO does not replace an existing healthy pet',()=>{
 for(const invalid of ['unlearned','mp','cooldown','ally']){
  const {g,p}=fixture();p.summon=undefined;
  if(invalid==='unlearned')delete p.skills.shaman_01;if(invalid==='mp')p.mp=0;if(invalid==='cooldown')p.cd.shaman_01=1;
  const mp=p.mp;assert.equal(action(g,'shaman_01',invalid==='ally'?p.id:undefined),false);assert.equal(p.mp,mp);
 }
 const {g,p,pet}=fixture(),e=spawn(g,1.2,4);e.hp=e.maxHp=10000;e.cooldown=999;p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:['shaman_01']};
 const mp=p.mp;advance(g,.2);assert.equal(p.mp,mp);assert.equal(p.summon,pet);
});
