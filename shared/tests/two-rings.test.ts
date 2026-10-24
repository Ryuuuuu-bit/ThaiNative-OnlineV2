import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameData,starterInventory,applyInventory,equipped,deriveStats,IntentSchema,type InventoryOp} from '../src/index.js';
const data=loadGameData(),profile=data.stats.defaultBuild;
function fixture(){let id=0;const uuid=()=>String(++id);let state={gold:0,inventory:starterInventory(0,uuid)};
 const run=(op:InventoryOp)=>{const result=applyInventory(state,op,profile,data,uuid);state=result.state;return result;};
 run({op:'admin',loot:[{template:'jade_ring',qty:3},{template:'sky_amulet',qty:1}]});
 return {run,get state(){return state;},rings:state.inventory.items.filter(i=>i.template==='jade_ring').map(i=>i.id),amulet:state.inventory.items.find(i=>i.template==='sky_amulet')!.id};
}
test('two separate copies of the same ring fill both slots and contribute both bonuses beside an amulet',()=>{
 const f=fixture(),base=deriveStats({...profile,equipment:equipped(f.state.inventory)},data);
 f.run({op:'equip',id:f.rings[0]});f.run({op:'equip',id:f.rings[1]});f.run({op:'equip',id:f.amulet});
 assert.equal(f.state.inventory.items.find(i=>i.id===f.rings[0])!.slot,'accessory1');
 assert.equal(f.state.inventory.items.find(i=>i.id===f.rings[1])!.slot,'ring2');
 assert.equal(f.state.inventory.items.find(i=>i.id===f.amulet)!.slot,'accessory2');
 const stats=deriveStats({...profile,equipment:equipped(f.state.inventory)},data);assert.ok(Math.abs(stats.atk-base.atk-4)<1e-9);assert.equal(stats.maxSp-base.maxSp,15);
 f.run({op:'unequip',id:f.rings[0]});assert.ok(Math.abs(deriveStats({...profile,equipment:equipped(f.state.inventory)},data).atk-base.atk-2)<1e-9);
 assert.equal(f.state.inventory.items.find(i=>i.id===f.rings[1])!.slot,'ring2');
});
test('explicit replacement changes only the selected ring; third ring cannot create a third equipped slot',()=>{
 const f=fixture();f.run({op:'equip',id:f.rings[0]});f.run({op:'equip',id:f.rings[1]});
 f.run({op:'equip',id:f.rings[2],slot:'ring2'});
 assert.equal(f.state.inventory.items.find(i=>i.id===f.rings[0])!.slot,'accessory1');
 assert.equal(f.state.inventory.items.find(i=>i.id===f.rings[1])!.location,'bag');
 assert.equal(f.state.inventory.items.find(i=>i.id===f.rings[2])!.slot,'ring2');
 f.run({op:'equip',id:f.rings[1]});assert.equal(equipped(f.state.inventory).filter(id=>id==='jade_ring').length,2);
 assert.equal(f.state.inventory.items.find(i=>i.id===f.rings[2])!.slot,'ring2');
});
test('foreign destinations, amulets in ring slots and double-equipping a single item fail atomically',()=>{
 const f=fixture();f.run({op:'equip',id:f.rings[0],slot:'ring2'});const before=structuredClone(f.state);
 for(const op of [{op:'equip',id:f.rings[1],slot:'ring3'},{op:'equip',id:f.rings[1],slot:'accessory2'},{op:'equip',id:f.amulet,slot:'ring2'},{op:'equip',id:f.rings[0],slot:'accessory1'}] as InventoryOp[]){assert.throws(()=>f.run(op));assert.deepEqual(f.state,before);}
 const packet={t:'inv',op:'equip',req:'00000000-0000-4000-8000-000000000001',id:f.rings[1]};
 assert.equal(IntentSchema.safeParse({...packet,slot:'ring2'}).success,true);assert.equal(IntentSchema.safeParse({...packet,slot:'ring3'}).success,false);
});
