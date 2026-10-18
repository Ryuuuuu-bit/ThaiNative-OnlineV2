import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameData,starterInventory,applyInventory,deriveStats,equipped} from '../src/index.js';

const data=loadGameData(),forge=data.economy.shops.forge;
const power=(t: typeof data.items.items[number])=>t.atk??t.modifiers.reduce((n,m)=>n+('value' in m&&typeof m.value==='number'?m.value:0),0);
const levels=[10,20,30,40,50,60,70,80,90,99];
const gear=data.items.items.filter(t=>t.slot&&t.level>=10&&forge[t.id]!==undefined);

test('every equipment tier supports every current class and all physical equipment slots',()=>{
 for(const level of levels){
  const tier=gear.filter(t=>t.level===level);
  for(const slot of ['weapon','body','shield','garment','footgear','accessory1','accessory2']) assert.ok(tier.some(t=>t.slot===slot),`${level}: ${slot}`);
  for(const job of data.classes.classes){
   const weapon=tier.find(t=>t.weaponType&&job.weapons.includes(t.weaponType));assert.ok(weapon,job.id);
   const equipment=[weapon.id,...tier.filter(t=>t.slot!=='weapon'&&!t.id.includes('arcane_ring')).map(t=>t.id),tier.find(t=>t.id.endsWith('_ring')&&!t.id.includes('arcane'))!.id];
   const stats=deriveStats({...data.stats.defaultBuild,level,classId:job.id,equipment},data);
   for(const field of ['maxHp','maxSp','atk','matk','hardDef','hardMdef'] as const) assert.ok(Number.isFinite(stats[field])&&stats[field]>0,`${level}/${job.id}/${field}`);
  }
 }
});

test('prices are increasing by tier, resale cannot create gold, and boss loot stays outside NPC shops',()=>{
 for(const shop of Object.values(data.economy.shops)) for(const [id,price] of Object.entries(shop)){
  const t=data.items.items.find(t=>t.id===id)!;assert.ok(t,id);assert.ok(Number.isSafeInteger(price)&&price>0);
  assert.ok(Math.floor(t.npcPrice*data.economy.sellMultiplier)<price,id);
 }
 for(const suffix of ['sword','staff','bow','armour','shield','cloak','boots','ring','arcane_ring','amulet']){
  const items=levels.map(level=>gear.find(t=>t.level===level&&t.id.endsWith('_'+suffix)&& (suffix!=='ring'||!t.id.includes('arcane')))!);
  for(let i=0;i<items.length;i++){
   assert.ok(items[i]);assert.equal(items[i].slots,0);
   assert.equal(Math.floor(items[i].npcPrice*data.economy.sellMultiplier),Math.floor(forge[items[i].id]/4));
   if(i){assert.ok(forge[items[i].id]>forge[items[i-1].id]);assert.ok(power(items[i])>power(items[i-1]));}
  }
 }
 for(const id of ['crystal_sword','royal_armour','card_king_jelly','warden_heart']) assert.ok(Object.values(data.economy.shops).every(shop=>shop[id]===undefined));
});

test('level 99 purchase, level gate, two rings, replacement and resale use authoritative prices',()=>{
 let n=0;const uuid=()=>String(++n),low=data.stats.defaultBuild,high={...low,level:99};
 let state={gold:20_000_000,inventory:starterInventory(0,uuid)};
 for(const template of ['eternal_sword','eternal_ring','eternal_ring']) state=applyInventory(state,{op:'buy',shop:'forge',template},low,data,uuid).state;
 const sword=state.inventory.items.find(i=>i.template==='eternal_sword')!;
 const before=structuredClone(state);assert.throws(()=>applyInventory(state,{op:'equip',id:sword.id},low,data,uuid));assert.deepEqual(state,before);
 state=applyInventory(state,{op:'equip',id:sword.id},high,data,uuid).state;
 const rings=state.inventory.items.filter(i=>i.template==='eternal_ring');
 for(const ring of rings) state=applyInventory(state,{op:'equip',id:ring.id},high,data,uuid).state;
 assert.deepEqual(state.inventory.items.filter(i=>i.template==='eternal_ring').map(i=>i.slot),['accessory1','ring2']);
 const withRings=deriveStats({...high,equipment:equipped(state.inventory)},data);
 const noRings=deriveStats({...high,equipment:equipped(state.inventory).filter(id=>id!=='eternal_ring')},data);
 assert.ok(Math.abs(withRings.atk-noRings.atk-44)<1e-9);
 state=applyInventory(state,{op:'unequip',id:sword.id},high,data,uuid).state;
 const gold=state.gold;state=applyInventory(state,{op:'sell',id:sword.id},high,data,uuid).state;
 assert.equal(state.gold-gold,forge.eternal_sword/4);
 const poor={...state,gold:forge.eternal_sword-1};assert.throws(()=>applyInventory(poor,{op:'buy',shop:'forge',template:'eternal_sword'},high,data,uuid));assert.equal(poor.gold,forge.eternal_sword-1);
});

test('larger potions consume one item and pay for convenience without undercutting smaller potions',()=>{
 let n=0;const uuid=()=>String(++n),profile=data.stats.defaultBuild;
 for(const ids of [['red_medium','red_large','red_greater','red_supreme'],['blue_potion','blue_large','blue_greater','blue_supreme']]){
  let previous=Infinity;
  for(const id of ids){const t=data.items.items.find(t=>t.id===id)!,price=data.economy.shops.market[id];assert.ok(t.amount!/price<=previous);previous=t.amount!/price;
   let state={gold:price,inventory:starterInventory(0,uuid)};state=applyInventory(state,{op:'buy',shop:'market',template:id},profile,data,uuid).state;
   const item=state.inventory.items.find(i=>i.template===id)!;const result=applyInventory(state,{op:'use',id:item.id},profile,data,uuid);
   assert.deepEqual(result.effect,{kind:t.effect,amount:t.amount});assert.equal(result.state.inventory.items.some(i=>i.id===item.id),false);
  }
 }
});
