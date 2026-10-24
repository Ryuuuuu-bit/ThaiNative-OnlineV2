import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,spawn,step,action,setBossTimer,bossTimer,LAYOUTS,THORN_NEST,walkable,STARTER_CARD_TEXT,lootAfterHurt,lootGuard,lootReflect,lootStillReduction,lootInterrupted,lootHitDamage,tickPlayerLoot,lootOnKill,tickEnemyLoot} from '../src/index.node.js';
const data=loadGameData();
const ids=['jelly_pink','lotus_rabbit','dew_beetle','king_jelly','forest_young_1','dewdrop_moth','pine_hedgehog','ruins_young_1','tile_sparrow','clay_pot_doll','canyon_young_1','oretail_lizard','iron_pincer_crab','mist_shroom','root_boar','shade_wolf','mist_weaver','thorn_nest_mother'];
function fixture(){const g=createGame(7,undefined,'test',data,'forest');g.enemies=[];g.p.x=-24;g.p.z=30;g.p.hp=g.p.maxHp=500;g.p.mp=0;return g;}
function card(g:ReturnType<typeof fixture>,id:string){g.p.inventory={items:[{id:'test-item',template:'field_armour',qty:1,location:'equip',slot:'body',cards:[id],refine:0,bound:false,source:'test'}]} as any;}
test('all 18 starter species have real habitats, distinct cards/materials and exactly the intended Unique sources',()=>{
 const cards=new Set<string>();
 for(const id of ids){const m=data.monsters.monsters.find(m=>m.id===id)!;assert.ok(m&&m.level<=20);assert.ok(id==='thorn_nest_mother'||id==='king_jelly'||Object.values(LAYOUTS).some(l=>l.spawns.some(s=>s.dataId===id)),id);
  const card=m.drops.filter(d=>d.item.startsWith('card_'));assert.equal(card.length,1,id);assert.ok(STARTER_CARD_TEXT[card[0].item]);cards.add(card[0].item);
  assert.ok(m.drops.some(d=>data.items.items.find(i=>i.id===d.item)?.type==='material'),id);
 }
 assert.equal(cards.size,18);
 for(const [unique,boss]of [['unique_tide_crown','king_jelly'],['unique_mist_weaver','thorn_nest_mother']])assert.deepEqual(data.monsters.monsters.filter(m=>m.drops.some(d=>d.item===unique)).map(m=>m.id),[boss]);
});
test('gate creatures stay passive until struck and long windups retain contact/recovery time',()=>{
 const g=fixture(),e=spawn(g,-23,30,false,'pink',false,'forest_young_1');g.random=()=>.5;
 for(let i=0;i<20;i++)step(g,.05);assert.equal(e.aggro,0);assert.equal(g.p.hp,g.p.maxHp);
 g.p.x=e.x;g.p.z=e.z+1;action(g,'attack');assert.ok(e.aggro>0);
 const boar=spawn(g,-23,30,false,'pink',false,'root_boar');boar.aggro=5;boar.cooldown=0;g.enemies=[boar];g.p.x=-22;g.p.z=30;step(g,.05);
 assert.equal(boar.motion,'attack');assert.ok(boar.motionDuration>=boar.behavior!.windup+.35);
});
test('forest bosses have independent timers and nest arena has walkable attack and escape space',()=>{
 const g=createGame(1,undefined,'test',data,'forest');assert.equal(g.enemies.filter(e=>e.boss).length,2);
 setBossTimer(g,10,'thorn_nest_mother');assert.equal(bossTimer(g,'thorn_nest_mother'),10);assert.equal(bossTimer(g,'mist_warden'),0);
 for(const [dx,dz]of [[0,0],[2,0],[-2,0],[0,2],[0,-2]])assert.ok(walkable(THORN_NEST.x+dx,THORN_NEST.z+dz,.4,'forest'));
});
test('mother locks a web warning, creates bounded destructible eggs and gives no summon drops',()=>{
 const g=fixture(),boss=spawn(g,-24,30,true,'pink',false,'thorn_nest_mother');g.p.x=-23;boss.cooldown=0;g.p.god=true;
 step(g,.05);assert.equal(boss.telegraph?.id,'thorn_web');const locked={x:boss.telegraph!.x,z:boss.telegraph!.z};g.p.x=-19.5;step(g,.1);assert.deepEqual({x:boss.telegraph!.x,z:boss.telegraph!.z},locked);
 for(let i=0;i<45;i++)step(g,.05);assert.equal(g.p.statuses.some(s=>s.sourceId==='thorn_web'),false,'escaping avoids web');
 boss.cooldown=0;step(g,.05);assert.equal(boss.telegraph?.id,'thorn_eggs');for(let i=0;i<51;i++)step(g,.05);
 const eggs=g.enemies.filter(e=>e.nestEgg);assert.ok(eggs.length>0&&eggs.length<=3);assert.ok(eggs.every(e=>e.rewarded&&e.summonedBy===boss.id));
 const egg=eggs[0];g.p.x=egg.x;g.p.z=egg.z+1;egg.hp=1;g.p.cd.attack=0;g.random=()=>.5;action(g,'attack');for(let i=0;i<50;i++)step(g,.05);assert.ok(egg.dead);assert.equal(g.drops.length,0);
});
test('reactive cards have cooldowns, stop after removal and never resurrect a defeated player',()=>{
 const g=fixture(),p=g.p;card(g,'card_lotus_rabbit');lootAfterHurt(g,p,10);lootAfterHurt(g,p,10);assert.equal(p.statuses.filter(s=>s.sourceId==='card_lotus_rabbit').length,1);
 card(g,'card_dew_beetle');p.hp=100;lootGuard(g,p);lootGuard(g,p);assert.equal(p.hp,105);p.hp=0;lootGuard(g,p);assert.equal(p.hp,0);
 card(g,'card_pine_hedgehog');assert.equal(lootReflect(p),4);assert.equal(lootReflect(p),0);tickPlayerLoot(g,p,4);assert.equal(lootReflect(p),4);p.inventory!.items=[];tickPlayerLoot(g,p,4);assert.equal(lootReflect(p),0);
});
test('standing guard, slow/web recovery and poison resistance cards use bounded state',()=>{
 const g=fixture(),p=g.p;card(g,'card_clay_pot_doll');tickPlayerLoot(g,p,2.1);assert.equal(lootStillReduction(p),.92);p.moving=true;assert.equal(lootStillReduction(p),1);
 card(g,'card_oretail_lizard');p.statuses=[{id:'slow',sourceId:'test',remaining:4,value:.5}];tickPlayerLoot(g,p,3);assert.equal(p.statuses[0].remaining,3);
 card(g,'card_mist_weaver');p.statuses=[{id:'slow',sourceId:'thorn_web',remaining:3,value:1}];tickPlayerLoot(g,p,.7);assert.ok(Math.abs(p.statuses[0].remaining-2.7)<1e-6);
 card(g,'card_mist_shroom');p.lootEffects!.venom={remaining:4,tick:0};step(g,3.01);assert.equal(p.lootEffects!.venom,undefined);
});
test('interrupt and bleeding cards proc on direct attacks without recursive combo effects',()=>{
 const g=fixture(),p=g.p,e=spawn(g,-23,30,false,'pink',false,'root_boar');card(g,'card_iron_pincer_crab');lootInterrupted(p);assert.equal(lootHitDamage(g,p,e,'basic',100,false),115);assert.equal(lootHitDamage(g,p,e,'basic',100,false),100);
 card(g,'card_root_boar');lootHitDamage(g,p,e,'basic',10,false);assert.equal(e.itemPoisons?.[0].bleed,true);tickPlayerLoot(g,p,3);lootHitDamage(g,p,e,'basic',10,false);assert.equal(p.mp,2);
});
test('mother card poison spreads once, does not chain, and expires on unequip',()=>{
 const g=fixture(),p=g.p,e=spawn(g,-24,30,false),other=spawn(g,-23,30,false);card(g,'card_thorn_nest_mother');e.itemPoisons=[{owner:p.id,remaining:2,tick:0,damage:2}];lootOnKill(g,e,p);assert.equal(other.itemPoisons?.[0].card,true);
 tickPlayerLoot(g,p,9);const third=spawn(g,-22,30,false);lootOnKill(g,other,p);assert.equal(third.itemPoisons,undefined);
 p.inventory!.items=[];let damage=0;tickEnemyLoot(g,other,2,(_,d)=>damage+=d);assert.equal(damage,0);assert.equal(other.itemPoisons?.length,0);
});
