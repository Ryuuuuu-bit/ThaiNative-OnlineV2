import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MemoryStore } from '../store/memory.js';
import { PostgresStore } from '../store/postgres.js';
import { createRankings } from '../realtime/rankings.js';
import type { RankingCharacter } from '@the-beginning-online/shared';

test('rankings include offline characters, merge live progress, omit private data and keep stable ties',async()=>{
 const store=new MemoryStore(),a=await store.createGuest(randomUUID());
 const first=await store.createCharacter(a.id,'RankA','ranka'),second=await store.createCharacter(a.id,'RankB','rankb');
 await store.saveProgress(a.id,first.id,{...first,level:10,xp:5,kills:100});
 const live:RankingCharacter[]=[{id:second.id,name:second.name,jobId:'swordsman',level:20,xp:0,kills:2}];
 const rankings=createRankings(store,()=>live);await rankings.refresh();
 const level=rankings.board('level',second.id);assert.equal(level.list[0].id,second.id);assert.equal(level.mine!.rank,1);
 assert.equal(rankings.board('hunt',second.id).list[0].id,first.id);
 assert.doesNotMatch(JSON.stringify(level),/accountId|baseStats|password|titleRecords|unlockedTitles/);
 await store.deleteCharacter(a.id,second.id);rankings.invalidate();await rankings.refresh();assert.equal(rankings.board('level',second.id).mine,null);
 assert.equal(rankings.board('level',first.id).list.length,1);
});
test('ranking refreshes coalesce, preserve the last board on DB failure, and zero kills grant no hunt rank',async()=>{
 const store=new MemoryStore(),a=await store.createGuest(randomUUID()),c=await store.createCharacter(a.id,'Ranks','ranks');
 const original=store.rankingCharacters.bind(store);let reads=0,fail=false;
 store.rankingCharacters=async()=>{reads++;if(fail)throw Error('DB unavailable');return original();};
 const rankings=createRankings(store,()=>[]);await Promise.all(Array.from({length:20},()=>rankings.refresh()));assert.equal(reads,1);
 assert.equal(rankings.board('hunt',c.id).total,0);const before=rankings.board('level',c.id);
 fail=true;rankings.invalidate();await assert.rejects(rankings.refresh(),/DB unavailable/);
 assert.deepEqual(rankings.board('level',c.id).list,before.list);
});
test('Postgres titles survive migration, pool restart, and soft delete removes rankings',
 {skip:!process.env.PG_TEST_URL&&'PG_TEST_URL not set'},async t=>{
 let store=new PostgresStore(process.env.PG_TEST_URL!);t.after(()=>store.close());await store.init();
 const a=await store.createGuest(randomUUID()),name='T'+randomUUID().replaceAll('-','').slice(0,9),c=await store.createCharacter(a.id,name,name.toLowerCase());
 await store.saveProgress(a.id,c.id,{...c,titleId:'boss_king',unlockedTitles:['rookie','boss_king'],titleRecords:{bosses:{king_jelly:1}}});
 await store.init();await store.close();store=new PostgresStore(process.env.PG_TEST_URL!);
 const saved=(await store.character(a.id,c.id))!;assert.equal(saved.titleId,'boss_king');assert.equal(saved.titleRecords!.bosses.king_jelly,1);
 assert.ok((await store.rankingCharacters()).some(p=>p.id===c.id));
 await store.deleteCharacter(a.id,c.id);assert.ok(!(await store.rankingCharacters()).some(p=>p.id===c.id));
});
