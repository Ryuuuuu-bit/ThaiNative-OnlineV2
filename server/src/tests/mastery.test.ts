import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MemoryStore} from '../store/memory.js';
import {PostgresStore} from '../store/postgres.js';
import {newJob} from '@the-beginning-online/shared';

test('MemoryStore migrates legacy Mastery once and preserves skills, budget, hotbar and inventory',async()=>{
 const store=new MemoryStore(),a=await store.createGuest('mastery-legacy'),c=await store.createCharacter(a.id,'MasteryHero','masteryhero');
 const fixture=(store as any).chars.get(c.id);
 delete fixture.masteries;delete fixture.masteryVersion;
 fixture.skills={...fixture.skills,slash:8};fixture.skillPoints=7;fixture.hotbar[0]={key:'KeyZ',skill:'slash'};
 const before=structuredClone(fixture),inv=await store.inventory(a.id,c.id);
 const migrated=(await store.character(a.id,c.id))!;
 assert.equal(migrated.masteries!.Swordsman,75);assert.equal(migrated.masteryVersion,1);
 for(const key of ['skills','skillPoints','hotbar','baseStats','classId','xp','gold'] as const)assert.deepEqual(migrated[key],before[key]);
 assert.deepEqual(await store.inventory(a.id,c.id),inv);
 migrated.masteries!.Mage=37;
 migrated.masteryExp!.Mage=19;
 await store.saveProgress(a.id,c.id,{...migrated});
 migrated.masteries!.Mage=0;
 const again=(await store.characters(a.id))[0];assert.equal(again.masteries!.Mage,37);
 assert.equal(again.masteryExp!.Mage,19);
 await store.saveProgress(a.id,c.id,{...again,masteries:undefined,masteryExp:undefined,masteryVersion:undefined});
 assert.deepEqual((await store.character(a.id,c.id))!.masteries,again.masteries);
 assert.equal((await store.character(a.id,c.id))!.masteryExp!.Mage,19);
 const beforeRejected=await store.character(a.id,c.id);
 assert.equal(again.skillPoints,7);assert.equal(again.masteries!.Swordsman,75);
 await assert.rejects(store.saveProgress(a.id,c.id,{...again,masteryVersion:2 as any}),/version/);
 await assert.rejects(store.saveProgress(a.id,c.id,{...again,masteries:{...again.masteries!,Mage:101}}),{name:'ZodError'});
 assert.deepEqual(await store.character(a.id,c.id),beforeRejected);
});

test('PostgresStore migration backfills from the same catalog once inside the schema transaction',async()=>{
 const store=new PostgresStore('postgresql://localhost:1/test'),queries:{sql:string;args:any[]}[]=[];
 let version=0;
 const client:any={query:async(sql:string,args:any[]=[])=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT id,skills,masteries,mastery_exp,mastery_version'))return{rows:version?[]:[{id:'legacy',skills:{slash:8},masteries:null,mastery_version:0}]};
  if(sql.startsWith('UPDATE tn2_characters SET masteries='))version=args[2];
  return{rows:[]};
 }};
 (store as any).transaction=async(run:any)=>run(client);
 try{
  await store.init();await store.init();
  const updates=queries.filter(q=>q.sql.startsWith('UPDATE tn2_characters SET masteries='));
  assert.equal(updates.length,1);assert.equal(updates[0].args[0],'legacy');
  assert.equal(JSON.parse(updates[0].args[1]).Swordsman,75);assert.equal(updates[0].args[2],1);
  assert(queries.findIndex(q=>q.sql.includes('ADD COLUMN IF NOT EXISTS mastery_version'))<queries.indexOf(updates[0]));
  assert.match(queries.find(q=>q.sql.startsWith('SELECT id,skills,masteries,mastery_exp,mastery_version'))!.sql,/FOR UPDATE/);
 }finally{await store.close();}
});

test('PostgresStore saves Mastery under the existing row/lease transaction and preserves omitted state',async()=>{
 const store=new PostgresStore('postgresql://localhost:1/test'),queries:{sql:string;args:any[]}[]=[];
 const job=newJob();job.masteries.Mage=43;job.masteryExp.Mage=27;
 const previous:any={id:'hero',...job,mastery_version:1,level:1,xp:0,gold:0,kills:0,potions:5,baseStats:{},race:'manussa',classId:'swordsman',statPoints:0,dataVersion:1};
 const client:any={query:async(sql:string,args:any[]=[])=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT * FROM tn2_characters'))return{rows:[previous]};
  if(sql.startsWith('SELECT online_node_id'))return{rows:[{online_node_id:'lease',valid:true}]};
  if(sql.startsWith('UPDATE tn2_characters SET level='))return{rows:[{...previous,masteries:JSON.parse(args[31]),mastery_version:args[32],mastery_exp:JSON.parse(args[33])}]};
  return{rows:[]};
 }};
 (store as any).transaction=async(run:any)=>run(client);
 try{
  const {masteries,masteryVersion,masteryExp,...olderBody}=previous;
  const saved=await store.saveProgress('owner','hero',{...olderBody,masteries:undefined,masteryExp:undefined,masteryVersion:undefined},'lease');
  assert.equal(saved.masteries!.Mage,43);assert.equal(saved.masteryVersion,1);
  const update=queries.find(q=>q.sql.startsWith('UPDATE tn2_characters SET level='))!;
  assert.match(update.sql,/masteries=\$32,mastery_version=\$33/);
  assert.equal(JSON.parse(update.args[31]).Mage,43);assert.equal(update.args[32],1);
  assert.equal(JSON.parse(update.args[33]).Mage,27);assert.equal(saved.masteryExp!.Mage,27);
  const writes=queries.filter(q=>q.sql.startsWith('UPDATE')).length;
  await assert.rejects(store.saveProgress('owner','hero',{...olderBody,masteryVersion:2},'lease'),/version/);
  assert.equal(queries.filter(q=>q.sql.startsWith('UPDATE')).length,writes);
 }finally{await store.close();}
});

test('PostgreSQL Mastery migration, save and pool restart preserve character progress',
 {skip:!process.env.PG_TEST_URL&&'PG_TEST_URL not set'},async()=>{
 let store=new PostgresStore(process.env.PG_TEST_URL!);
 try{
  await store.init();const tag=randomUUID().replaceAll('-','').slice(0,10),a=await store.createGuest('mastery-'+tag),c=await store.createCharacter(a.id,'M'+tag,('m'+tag).toLowerCase(),'swordsman','female');
  await store.pool.query('UPDATE tn2_characters SET skills=$2,skill_points=7,masteries=NULL,mastery_version=0 WHERE id=$1',[c.id,JSON.stringify({...c.skills,slash:8})]);
  const before=(await store.character(a.id,c.id))!,inv=await store.inventory(a.id,c.id);
  await store.init();let migrated=(await store.character(a.id,c.id))!;
  assert.equal(migrated.masteries!.Swordsman,75);assert.equal(migrated.masteryVersion,1);
  for(const key of ['skills','skillPoints','hotbar','baseStats','classId','xp','gold'] as const)assert.deepEqual(migrated[key],before[key]);
  migrated.masteries!.Healer=31;migrated.masteryExp!.Healer=41;await store.saveProgress(a.id,c.id,{...migrated});
  await store.close();store=new PostgresStore(process.env.PG_TEST_URL!);await store.init();
  migrated=(await store.character(a.id,c.id))!;assert.equal(migrated.masteries!.Healer,31);assert.equal(migrated.skillPoints,7);
  assert.equal(migrated.masteryExp!.Healer,41);assert.equal(migrated.gender,'female');
  assert.deepEqual(await store.inventory(a.id,c.id),inv);
 }finally{await store.close();}
});
