import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MemoryStore} from '../store/memory.js';
import {PostgresStore} from '../store/postgres.js';
import {loadGameData,rollEquipment} from '@the-beginning-online/shared';
const data=loadGameData(),context={profile:{...data.stats.defaultBuild,level:10}};
async function exercise(store:MemoryStore|PostgresStore){
 const a=await store.createGuest(randomUUID()),c=await store.createCharacter(a.id,'Loot'+randomUUID().slice(0,8),'loot'+randomUUID().slice(0,8));
 const run=(op:any,req=randomUUID())=>store.inventoryOp(a.id,c.id,req,op,context);
 const roll=rollEquipment('field_sword',9,data,()=>.5,'rare')!,request=randomUUID();
 const requests=await Promise.all(Array.from({length:15},()=>run({op:'pickup',loot:[{template:'field_sword',qty:1,roll}]},request)));
 assert.equal(requests.filter(r=>!r.duplicate).length,1);
 const found=(await store.inventory(a.id,c.id)).inventory.items.filter(i=>i.template==='field_sword');assert.equal(found.length,1);const id=found[0].id;
 assert.equal((await run({op:'equip',id})).error,undefined);
 assert.equal((await run({op:'unequip',id})).error,undefined);
 assert.equal((await run({op:'store',id})).error,undefined);
 assert.deepEqual((await store.inventory(a.id,c.id)).inventory.items.find(i=>i.id===id)?.roll,roll);
 assert.equal((await run({op:'retrieve',id})).error,undefined);
 const b=await store.createGuest(randomUUID()),d=await store.createCharacter(b.id,'Recv'+randomUUID().slice(0,8),'recv'+randomUUID().slice(0,8));
 const traded=await store.trade({accountId:a.id,id:c.id,offer:{items:[{id,qty:1}],gold:0},profile:context.profile},{accountId:b.id,id:d.id,offer:{items:[],gold:0},profile:context.profile},{tradeId:randomUUID()});
 assert.equal(traded.error,undefined);
 const final=await store.inventory(b.id,d.id);assert.deepEqual(final.inventory.items.find(i=>i.id===id)?.roll,roll);
 const malformed=await run({op:'pickup',loot:[{template:'field_sword',qty:1,roll:{...roll,affixes:[{id:'force',value:10000}]}}]});assert.ok(malformed.error);
 assert.equal((await store.inventory(a.id,c.id)).inventory.items.filter(i=>i.template==='field_sword').length,0);
 assert.ok((await store.integrity()).ok);
}
test('memory store: pickup retries commit one roll, storage and trade preserve it',async()=>{await exercise(new MemoryStore());});
test('PostgreSQL migration and round trip preserve rolls through transfer', {skip:!process.env.PG_TEST_URL},async()=>{
 const store=new PostgresStore(process.env.PG_TEST_URL!);try{await store.init();await exercise(store);}finally{await store.close();}
});
