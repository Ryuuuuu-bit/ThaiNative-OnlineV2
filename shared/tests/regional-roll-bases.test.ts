import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {loadGameData,rollEquipment,validateItemRoll,rollDrops,applyInventory,starterInventory,inventoryProfile,deriveStats,huntList} from '../src/index.node.js';
const data=loadGameData(),kinds=['sword','staff','bow','armour','shield','cloak','boots','ring'];

test('Regional roll bases preserve the existing Lv35/Lv50 equipment stats and original starter icon/socket support',()=>{
 for(const tier of ['sunsteel','naga'])for(const kind of kinds){const native=data.items.items.find(i=>i.id===tier+'_'+kind)!,regional=data.items.items.find(i=>i.id==='field_'+tier+'_'+kind)!,starter=data.items.items.find(i=>i.id==='field_'+kind)!;assert.ok(native&&regional&&starter);assert.deepEqual(regional,{...native,id:'field_'+tier+'_'+kind,rarity:'rare',slots:starter.slots,icon:starter.icon,npcPrice:Math.round(native.level*180)});const roll=rollEquipment(regional.id,regional.level+9,data,()=>.5,'rare')!;assert.equal(roll.itemLevel,regional.level+9);assert.deepEqual(validateItemRoll(regional.id,roll,data),roll);assert.equal(rollEquipment(native.id,native.level,data,()=>.5),undefined,'Existing common shop equipment stays unrolled');}
});

test('All32 new regional species drop rolled bases from their own level band instead of starter equipment',()=>{
 for(const map of ['himmapan','desert','frost','yokai'] as const){const tier=map==='himmapan'||map==='desert'?'sunsteel':'naga';for(const listed of huntList(map,data)){const m=data.monsters.monsters.find(m=>m.id===listed.id)!;const gear=rollDrops(m,()=>0,data,0,0,()=>0).filter(d=>d.template.startsWith('field_'));assert.ok(gear.length>=3,m.id);for(const drop of gear){assert.ok(drop.template.startsWith('field_'+tier+'_'),m.id);assert.equal(drop.roll!.itemLevel,m.level);assert.deepEqual(validateItemRoll(drop.template,drop.roll,data),drop.roll);}}}
});

test('Regional sword really raises equipped attack, retains its socketed card through storage and cannot bypass item-level requirements',()=>{
 const build={...data.stats.defaultBuild,level:67},roll=rollEquipment('field_naga_sword',67,data,()=>.5,'rare')!,oldRoll=rollEquipment('field_sword',67,data,()=>.5,'rare')!,card=data.cards.cards.find(c=>c.slot==='weapon'&&data.items.items.some(i=>i.id===c.id))!;
 let state=applyInventory({inventory:starterInventory(0,randomUUID),gold:0},{op:'admin',loot:[{template:'field_naga_sword',qty:1,roll},{template:'field_sword',qty:1,roll:oldRoll},{template:card.id,qty:1}]},build,data,randomUUID).state;
 const sword=state.inventory.items.find(i=>i.template==='field_naga_sword')!,starter=state.inventory.items.find(i=>i.template==='field_sword')!,ownedCard=state.inventory.items.find(i=>i.template===card.id)!;assert.throws(()=>applyInventory(state,{op:'equip',id:sword.id},{...build,level:66},data,randomUUID),/ระดับ/);
 state=applyInventory(state,{op:'equip',id:starter.id},build,data,randomUUID).state;const lowAttack=deriveStats(inventoryProfile(build,state.inventory,data),data).atk;
 state=applyInventory(state,{op:'equip',id:sword.id},build,data,randomUUID).state;const highAttack=deriveStats(inventoryProfile(build,state.inventory,data),data).atk;assert.ok(highAttack>lowAttack);
 state=applyInventory(state,{op:'card',id:sword.id,card:ownedCard.id},build,data,randomUUID).state;state=applyInventory(state,{op:'unequip',id:sword.id},build,data,randomUUID).state;state=applyInventory(state,{op:'store',id:sword.id},build,data,randomUUID).state;state=applyInventory(state,{op:'retrieve',id:sword.id},build,data,randomUUID).state;const saved=JSON.parse(JSON.stringify(state.inventory.items.find(i=>i.id===sword.id)));assert.deepEqual(saved.roll,roll);assert.deepEqual(saved.cards,[card.id]);assert.deepEqual(state.inventory.items.find(i=>i.id===starter.id)!.roll,oldRoll);
});

test('Existing unrolled level60 equipment can still be granted, stored and equipped without gaining random affixes',()=>{
 const build={...data.stats.defaultBuild,level:60};let state=applyInventory({inventory:starterInventory(0,randomUUID),gold:0},{op:'admin',loot:[{template:'naga_sword',qty:1}]},build,data,randomUUID).state;const sword=state.inventory.items.find(i=>i.template==='naga_sword')!;state=applyInventory(state,{op:'equip',id:sword.id},build,data,randomUUID).state;assert.equal(state.inventory.items.find(i=>i.id===sword.id)!.roll,undefined);
});
