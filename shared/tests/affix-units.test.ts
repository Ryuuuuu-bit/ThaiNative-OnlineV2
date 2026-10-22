import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {rolledModifiers,validateItemRoll,loadGameData,createGame,spawn,action,starterInventory,applyInventory,refreshStats} from '../src/index.node.js';
import {lootEvadedWarning} from '../src/game/loot-effects.js';
const data=loadGameData();
test('saved integer crit and speed rolls use percentage units without changing their stored values',()=>{
 for(const [id,expected]of [['keen',{kind:'flat',stat:'crit',value:.02}],['quick',{kind:'percent',stat:'aspd',value:.02}]] as const){
  const roll={version:1 as const,itemLevel:1,quality:'magic' as const,affixes:[{id,value:2}]};assert.deepEqual(validateItemRoll('field_sword',roll,data),roll);assert.deepEqual(rolledModifiers({template:'field_sword',roll}),[expected]);assert.equal(roll.affixes[0].value,2);
 }
});
test('real basic cooldown follows derived attack speed and a speed affix makes the same weapon faster',()=>{
 const g=createGame();g.enemies=[];g.p.inventory=starterInventory(0,randomUUID);const e=spawn(g,g.p.x,g.p.z+1);e.hp=e.maxHp=100000;
 let inv=applyInventory({inventory:g.p.inventory,gold:0},{op:'admin',loot:[{template:'field_sword',qty:1,roll:{version:1,itemLevel:1,quality:'magic',affixes:[{id:'force',value:2}]}}]},g.p.profile,data,randomUUID).state;
 const item=inv.inventory.items.find(i=>i.template==='field_sword')!;inv=applyInventory(inv,{op:'equip',id:item.id},g.p.profile,data,randomUUID).state;g.p.inventory=inv.inventory;refreshStats(g,g.p);g.p.cd.attack=0;g.p.comboWindow=0;g.p.target=e.id;assert.ok(action(g,'attack'));const before=g.p.cd.attack;assert.ok(Math.abs(before-1/g.p.stats.aspd)<1e-8);
 g.p.inventory.items.find(i=>i.id===item.id)!.roll!.affixes=[{id:'quick',value:2}];refreshStats(g,g.p);g.p.cd.attack=0;g.p.comboWindow=0;g.p.target=e.id;assert.ok(action(g,'attack'));assert.ok(Math.abs(g.p.cd.attack/before-1/1.02)<1e-8);
});
test('Nue three-percent crit charge cannot become a sixty-percent chance in actual basic damage',()=>{
 const g=createGame();g.enemies=[];g.p.inventory=starterInventory(0,randomUUID);g.p.inventory.items.push({id:'card-test',template:'field_ring',location:'equip',slot:'accessory1',qty:1,refine:0,cards:['card_yokai_rain_nue'],bound:false,source:'test'});const e=spawn(g,g.p.x,g.p.z+1);e.hp=e.maxHp=100000;lootEvadedWarning(g.p,g);g.time=1;lootEvadedWarning(g.p,g);g.random=()=>.3;g.p.target=e.id;assert.ok(action(g,'attack'));assert.equal(g.events.find(v=>v.type==='hit'&&v.id===e.id)!.crit,false);
});
