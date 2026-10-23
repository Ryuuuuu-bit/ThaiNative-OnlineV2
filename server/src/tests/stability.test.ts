import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {PostgresStore} from '../store/postgres.js';
import {MemoryStore} from '../store/memory.js';
import {createApp} from '../app.js';
import {createGame,spawn,step,revive,loadGameData,inventoryWeight,inventorySlots,deriveStats,rollDrops} from '@the-beginning-online/shared';

test('stability 2: pool errors are handled with bounded connect and idle timeouts',async()=>{
 const store=new PostgresStore('postgresql://localhost:1/test');assert.equal(store.pool.options.connectionTimeoutMillis,5000);assert.equal(store.pool.options.idleTimeoutMillis,30000);assert.doesNotThrow(()=>store.pool.emit('error',Error('idle disconnect')));await store.close();
});
test('stability 5: unknown inventory template is skipped instead of crashing',()=>{const inv:any={items:[{template:'unknown',location:'bag',qty:1}]};assert.equal(inventoryWeight(inv,loadGameData()),0);assert.equal(inventorySlots(inv,loadGameData()),0);const data=loadGameData();assert.doesNotThrow(()=>deriveStats({...data.stats.defaultBuild,equipment:['unknown']},data));const monster={...data.monsters.monsters[0],drops:[{item:'unknown',rate:1,min:1,max:1}]};assert.deepEqual(rollDrops(monster,()=>0,data),[]);});
test('stability 7: King resets abandoned damage and respawns after ten minutes',()=>{
 const g=createGame(1);g.enemies=[];const king=spawn(g,0,0,true);king.hp=1;king.damageBy={missing:99};king.engaged=true;step(g,.05);assert.equal(king.hp,king.maxHp);assert.deepEqual(king.damageBy,{});king.dead=true;king.rewarded=true;king.respawn=600;step(g,.05);assert.equal(king.dead,true);king.respawn=.01;step(g,.05);assert.equal(king.dead,false);assert.equal(king.hp,king.maxHp);
});
test('stability 7: boss loot cooldown persists through character reload',async()=>{const store=new MemoryStore(),a=await store.createGuest('boss'),c=await store.createCharacter(a.id,'BossHero','bosshero');const until=Date.now()+600000;await store.saveProgress(a.id,c.id,{...c,bossReadyAt:until});assert.equal((await store.character(a.id,c.id))!.bossReadyAt,until);});
test('stability 8: revive waits five simulation seconds and preserves EXP',()=>{const g=createGame(1);g.p.dead=true;g.p.reviveRemaining=5;g.p.xp=23;revive(g);assert.equal(g.p.dead,true);for(let i=0;i<101;i++)step(g,.05);revive(g);assert.equal(g.p.dead,false);assert.equal(g.p.xp,23);});
test('stability 9: drops despawn at sixty seconds and owner lock stays ten',()=>{const g=createGame(1);g.drops=[{id:999,x:100,z:100,gold:0,xp:0,time:59.99,ownerId:'gone'}];step(g,.05);assert.equal(g.drops.length,0);assert.equal(g.data.economy.lootOwnershipSeconds,10);});
test('stability 10: inventory persistence writes only changed rows including refine and cards',async()=>{
 const store=new PostgresStore('postgresql://localhost:1/test'),queries:{sql:string;args:any[]}[]=[];const initial:any={version:1,autoPickup:true,items:[{id:'a',template:'training_sword',qty:1,location:'bag',slot:null,refine:0,cards:[],bound:false,source:'test'}]};(store as any).loadInventory=async()=>structuredClone(initial);const c:any={query:async(sql:string,args:any[])=>{queries.push({sql,args});return{rows:[]};}};await(store as any).writeInventory(c,'hero',initial);assert.equal(queries.filter(q=>q.sql.includes('INSERT')||q.sql.includes('DELETE')).length,0);const changed=structuredClone(initial);changed.items[0].refine=15;changed.items[0].cards=['card'];await(store as any).writeInventory(c,'hero',changed);const upsert=queries.find(q=>q.sql.includes('INSERT'))!;assert.match(upsert.sql,/refine=EXCLUDED.refine,cards=EXCLUDED.cards/);assert.equal(upsert.args[5],15);await store.close();
});
test('stability 16: Google linking runs no global migration statements',async()=>{
 const store=new PostgresStore('postgresql://localhost:1/test'),queries:string[]=[];const guest={id:'guest',kind:'guest',display_name:'Guest'};const c:any={query:async(sql:string)=>{queries.push(sql);if(sql.includes('SELECT * FROM tn2_accounts WHERE id='))return{rows:[guest]};if(sql.includes("SET kind='google'"))return{rows:[{...guest,kind:'google'}]};return{rows:[]};}};(store as any).transaction=async(fn:any)=>fn(c);await store.google({sub:'google',name:'User'},'guest');assert.ok(queries.some(q=>q.includes('DELETE FROM tn2_sessions')));assert.equal(queries.some(q=>q.includes('ALTER TABLE')||q.includes('UPDATE tn2_characters')),false);await store.close();
});
test('stability 17: production refuses startup without session secret',()=>{assert.throws(()=>createApp({store:new MemoryStore(),production:true}),/SESSION_SECRET/);});
test('stability 18: health rejects failed DB, stale ticks and queries over one second',async t=>{
 const store=new MemoryStore();let healthy=true;const server=createApp({store,realtimeHealthy:()=>healthy}).listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});const health=()=>fetch(`http://127.0.0.1:${(server.address() as any).port}/healthz`);assert.equal((await health()).status,200);healthy=false;assert.equal((await health()).status,503);healthy=true;store.health=async()=>{throw Error('DB down');};assert.equal((await health()).status,503);store.health=()=>new Promise(()=>{});const begin=Date.now();assert.equal((await health()).status,503);assert.ok(Date.now()-begin<1100);
});

test('stability 1: fatal handlers save then close once and exit nonzero',async()=>{
 const {EventEmitter}=await import('node:events'),{installShutdown}=await import('../shutdown.js');const runtime:any=new EventEmitter(),events:string[]=[];let release!:()=>void;const gate=new Promise<void>(r=>release=r);runtime.exit=(code:number)=>events.push('exit:'+code);installShutdown(runtime,async()=>{events.push('save');await gate;events.push('store.close');},()=>{});runtime.emit('unhandledRejection',Error('DB'));runtime.emit('uncaughtException',Error('fatal'));assert.deepEqual(events,['save']);release();await new Promise(r=>setTimeout(r,0));assert.deepEqual(events,['save','store.close','exit:1']);
});
