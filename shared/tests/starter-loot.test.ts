import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadGameData,rollEquipment,validateItemRoll,STARTER_AFFIXES,rollDrops,applyInventory,starterInventory,inventoryProfile,deriveStats,refreshStats,createGame,spawn,action,step,applyTrade,IntentSchema,applyPotionEffect,lootAbsorb,tickPlayerLoot,tickEnemyLoot,lootAfterHurt,lootHitDamage,type OwnedItem} from '../src/index.js';
const data=loadGameData(),profile={...data.stats.defaultBuild,level:10};
function rng(seed=31){let n=seed;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
const owned=(template:string,slot:string|null='accessory1'):OwnedItem=>({id:randomUUID(),template,qty:1,location:'equip',slot,refine:0,cards:[],source:'test',bound:false,roll:rollEquipment(template,10,data,rng())});
function fixture(){const g=createGame(1,profile,'loot-test',data);g.enemies=[];const inventory=starterInventory(5,randomUUID);g.p.inventory=applyInventory({inventory,gold:0},{op:'equip',id:inventory.items.find(i=>i.template==='training_sword')!.id},profile,data,randomUUID).state.inventory;g.p.level=10;refreshStats(g,g.p);return g;}

test('rolled loot has bounded, distinct families and prefix/suffix limits; numeric rolls vary across copies',()=>{
 const random=rng(),seen=new Set<string>();
 for(const template of data.items.items.filter(t=>t.id.startsWith('field_'))){
  for(const level of [1,5,10])for(let n=0;n<60;n++){
   const roll=rollEquipment(template.id,level,data,random)!;validateItemRoll(template.id,roll,data);
   const families=roll.affixes.map(a=>a.id);assert.equal(new Set(families).size,families.length);
   for(const side of ['prefix','suffix'])assert.ok(families.filter(id=>STARTER_AFFIXES.find(a=>a.id===id)?.side===side).length<=(roll.quality==='magic'?1:3));
   seen.add(JSON.stringify(roll));
  }
 }
 assert.ok(seen.size>500);
 const u=rollEquipment('unique_mist_weaver',9,data,random)!;assert.equal(u.itemLevel,10);assert.deepEqual(u.affixes.map(a=>a.id),['accuracy','venom']);
 const invalid=structuredClone(u);invalid.affixes[0].value=999;assert.throws(()=>validateItemRoll('unique_mist_weaver',invalid,data));
 assert.throws(()=>validateItemRoll('training_sword',u,data));
 assert.throws(()=>validateItemRoll('field_sword',{...u,affixes:[]},data));
});
test('drops hold server rolls before pickup; retries/storage/equipping do not reroll or accumulate modifiers',()=>{
 const m=data.monsters.monsters.find(m=>m.id==='king_jelly')!;
 const loot=rollDrops(m,()=>0,data);const drop=loot.find(d=>d.template==='field_sword')!;assert.ok(drop.roll);
 let state=applyInventory({gold:2000,inventory:starterInventory(0,randomUUID)},{op:'pickup',loot:[drop]},profile,data,randomUUID).state;
 const item=state.inventory.items.find(i=>i.template===drop.template)!,original=structuredClone(item.roll);
 state=applyInventory(state,{op:'store',id:item.id},profile,data,randomUUID).state;
 state=applyInventory(state,{op:'retrieve',id:item.id},profile,data,randomUUID).state;
 state=applyInventory(state,{op:'equip',id:item.id},profile,data,randomUUID).state;
 assert.deepEqual(state.inventory.items.find(i=>i.id===item.id)!.roll,original);
 const g=fixture();g.p.inventory=state.inventory;refreshStats(g,g.p);const before=structuredClone(g.p.stats);refreshStats(g,g.p);assert.deepEqual(g.p.stats,before);
 assert.deepEqual(g.p.stats,deriveStats(inventoryProfile(g.p.profile,state.inventory,data),data));
 assert.equal(IntentSchema.safeParse({t:'inv',op:'pickup',req:randomUUID(),loot:[drop]}).success,false);
 assert.throws(()=>applyInventory(state,{op:'admin',loot:[{template:'field_sword',qty:1,roll:{...original!,affixes:[{id:'force',value:999}]}}]},profile,data,randomUUID));
 assert.throws(()=>applyInventory(state,{op:'admin',loot:[{template:'field_sword',qty:1}]},profile,data,randomUUID));
});
test('card insertion honors real sockets, rolled gear stats and unique/level restrictions without destroying old items',()=>{
 let state=applyInventory({gold:5000,inventory:starterInventory(0,randomUUID)},{op:'admin',loot:[{template:'field_armour',qty:1,roll:rollEquipment('field_armour',8,data,rng(), 'rare')},{template:'card_jelly_pink',qty:1},{template:'unique_mist_weaver',qty:1,roll:rollEquipment('unique_mist_weaver',10,data,rng())}]},profile,data,randomUUID).state;
 const armour=state.inventory.items.find(i=>i.template==='field_armour')!,card=state.inventory.items.find(i=>i.template==='card_jelly_pink')!,unique=state.inventory.items.find(i=>i.template==='unique_mist_weaver')!;
 state=applyInventory(state,{op:'equip',id:armour.id},profile,data,randomUUID).state;
 const before=deriveStats(inventoryProfile(profile,state.inventory,data),data).maxHp;
 state=applyInventory(state,{op:'card',id:armour.id,card:card.id},profile,data,randomUUID).state;
 assert.ok(deriveStats(inventoryProfile(profile,state.inventory,data),data).maxHp>=before+50);
 assert.throws(()=>applyInventory(state,{op:'socket',id:unique.id},profile,data,randomUUID),/Unique/);
 assert.throws(()=>applyInventory(state,{op:'equip',id:unique.id},{...profile,level:9},data,randomUUID),/ระดับ/);
 assert.ok(state.inventory.items.find(i=>i.template==='traveler_clothes'));
});
test('trade preserves item identity, rolls and installed cards',()=>{
 const item={...owned('field_ring'),location:'bag' as const,slot:null,cards:['card_bud_shroom']};
 const a={state:{gold:0,inventory:{version:1 as const,autoPickup:true,items:[item]}},offer:{gold:0,items:[{id:item.id,qty:1}]},profile};
 const b={state:{gold:0,inventory:starterInventory(0,randomUUID)},offer:{gold:0,items:[]},profile};
 const out=applyTrade(a,b,data),received=out.b.state.inventory.items.find(i=>i.id===item.id)!;
 assert.deepEqual(received.roll,item.roll);assert.deepEqual(received.cards,item.cards);assert.equal(out.a.state.inventory.items.length,0);
});
test('unique potion pool and king card shield have duration/cooldowns and do not stack from repeated triggers',()=>{
 const g=fixture(),p=g.p;p.inventory!.items.push(owned('unique_tide_crown'));p.inventory!.items.find(i=>i.slot==='weapon')!.cards=['card_king_jelly'];
 // Give the starter test sword one physical socket; modifiers are validated by refresh.
 p.inventory!.items.find(i=>i.slot==='weapon')!.sockets=1;refreshStats(g,p);p.hp=10;
 applyPotionEffect(g,p,'hp',10);assert.ok(p.hp>20);assert.equal(p.lootEffects!.shield,20);assert.ok(p.cd.potion>data.skills.skills.find(s=>s.id==='potion')!.cooldown);
 assert.equal(lootAbsorb(p,12),0);assert.equal(p.lootEffects!.shield,8);
 applyPotionEffect(g,p,'hp',1);assert.equal(p.lootEffects!.shield,8);
 const hp=p.hp;tickPlayerLoot(g,p,3);assert.equal(p.hp,hp+18);assert.equal(p.lootEffects!.pool,undefined);
 tickPlayerLoot(g,p,1);assert.equal(lootAbsorb(p,12),12);
 p.dead=true;const deadHp=p.hp;applyPotionEffect(g,p,'hp',100);assert.equal(p.hp,deadHp);
});
test('six starter cards trigger distinct effects, deduplicate and stop when removed',()=>{
 const g=fixture(),p=g.p,inv=p.inventory!;
 inv.items.find(i=>i.slot==='body')!.cards=['card_jelly_pink'];inv.items.find(i=>i.slot==='body')!.sockets=1;
 p.hp=20;lootAfterHurt(g,p,2);assert.equal(p.hp,26);lootAfterHurt(g,p,2);assert.equal(p.hp,26);
 p.hp=0;lootAfterHurt(g,p,10);assert.equal(p.hp,0);
 const ring=owned('field_ring');ring.cards=['card_bud_shroom'];inv.items.push(ring);
 const otherRing=owned('field_ring','ring2');otherRing.cards=['card_bud_shroom'];inv.items.push(otherRing);
 p.mp=0;applyPotionEffect(g,p,'sp',20);assert.equal(p.mp,23);
 inv.items.find(i=>i.slot==='body')!.cards=['card_clay_puff'];p.hp=20;g.time=10;p.lastCombat=0;tickPlayerLoot(g,p,1);assert.equal(p.hp,22);
 inv.items.find(i=>i.slot==='weapon')!.cards=['card_pebble_puff'];const enemy=spawn(g,p.x,p.z+1);assert.equal(lootHitDamage(g,p,enemy,'basic',100,false),110);assert.equal(lootHitDamage(g,p,enemy,'basic',100,false),100);
 ring.cards=['card_shade_wolf'];p.mp=0;lootHitDamage(g,p,enemy,'basic',10,true);assert.equal(p.mp,3);lootHitDamage(g,p,enemy,'item_poison',10,true);assert.equal(p.mp,3);
 inv.items.find(i=>i.slot==='body')!.cards=[];const hp=p.hp;tickPlayerLoot(g,p,1);assert.equal(p.hp,hp);
});
test('actual basic attacks trigger unique poison; ticks reward kills exactly once and never recursively proc',()=>{
 const g=fixture(),p=g.p;g.random=()=>.1;p.inventory!.items.push(owned('unique_mist_weaver'));refreshStats(g,p);
 const enemy=spawn(g,p.x,p.z+1);enemy.hp=enemy.maxHp=1000;enemy.cooldown=100;
 for(let n=0;n<3;n++){enemy.x=p.x;enemy.z=p.z+1;p.cd.attack=0;assert.equal(action(g,'attack'),true);}
 assert.equal(enemy.itemPoisons?.length,1);assert.equal(p.lootEffects?.combo?.count,0);
 const hp=enemy.hp;let ticks=0;tickEnemyLoot(g,enemy,1,(_owner,damage)=>{ticks++;enemy.hp-=damage;});assert.equal(ticks,1);assert.ok(enemy.hp<hp);
 assert.equal(p.lootEffects?.combo?.count,0);
 enemy.hp=1;step(g,1);assert.equal(enemy.dead,true);const killed=g.kills;step(g,.2);assert.equal(g.kills,killed);
 const next=spawn(g,p.x,p.z+1);next.itemPoisons=[{owner:p.id,remaining:4,tick:0,damage:9}];p.inventory!.items=p.inventory!.items.filter(i=>i.template!=='unique_mist_weaver');
 tickEnemyLoot(g,next,1,()=>assert.fail('Unequipped item must stop poison'));assert.equal(next.itemPoisons.length,0);
});
test('poison crossing half boss HP enters phase two and cannot skip the boss transition',()=>{
 const g=fixture(),p=g.p;p.inventory!.items.push(owned('unique_mist_weaver'));
 const boss=spawn(g,0,10,true);boss.hp=boss.maxHp*.5+1;boss.cooldown=100;
 boss.itemPoisons=[{owner:p.id,remaining:4,tick:0,damage:3}];step(g,1);
 assert.equal(boss.bossPhase,2);assert.ok(g.events.some(e=>e.type==='phase2'));
});
