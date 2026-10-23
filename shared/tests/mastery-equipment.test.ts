import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadGameData,newJob,starterInventory,applyInventory,deriveStats,canEquipWeapon} from '../src/index.node.js';
const data=loadGameData();
test('Mastery characters equip bows through the real inventory rules without losing ownership or level checks',()=>{
 const legacy=structuredClone(data.stats.defaultBuild),profile={...legacy,masteries:newJob().masteries};
 assert.equal(canEquipWeapon(legacy,'bow',data),false);assert.equal(canEquipWeapon(profile,'bow',data),true);
 const inv=starterInventory(5,randomUUID),bow={id:randomUUID(),template:'bamboo_bow',qty:1,location:'bag' as const,slot:null,refine:0,cards:[],bound:false,source:'test'};inv.items.push(bow);
 const state={gold:0,inventory:inv};
 assert.throws(()=>applyInventory(state,{op:'equip',id:bow.id},legacy,data,randomUUID),/cannot equip/);
 const equipped=applyInventory(state,{op:'equip',id:bow.id},profile,data,randomUUID).state;
 assert.equal(equipped.inventory.items.find(i=>i.id===bow.id)!.location,'equip');
 assert.equal(deriveStats({...profile,equipment:['bamboo_bow']},data).weaponType,'bow');
 assert.throws(()=>applyInventory(state,{op:'equip',id:randomUUID()},profile,data,randomUUID));
 assert.throws(()=>deriveStats({...profile,equipment:['crystal_sword']},data),/requires level/);
});
