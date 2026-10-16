import {CITY_SPAWN} from '@thainative/shared/maps';
import {applyInventory,starterInventory,economyData,checkRequest,alertIntegrity,type Inventory,type EconomyContext,type EconomyResult} from './economy.js';
import type {InventoryOp} from '@thainative/shared';
import {newJob} from '@thainative/shared';
import {creationJob,needsJob} from './progress.js';
import{Pool,type PoolClient}from'pg';import{readFile}from'node:fs/promises';import{randomUUID}from'node:crypto';
import type{Account,Character,GoogleIdentity,Session,Store}from'./types.js';import{AppError,missing}from'../errors.js';
function row<T>(input:Record<string,unknown>|undefined):T|undefined{if(!input)return;return Object.fromEntries(Object.entries(input).filter(([,v])=>v!==null).map(([k,v])=>[k==='class'?'classId':k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),v instanceof Date?v.toISOString():['xp','job_exp','healer_ready_at','boss_ready_at'].includes(k)&&typeof v==='string'?Number(v):v])) as T;}
export class PostgresStore implements Store {
 readonly pool:Pool;constructor(connectionString:string){this.pool=new Pool({connectionString,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});this.pool.on("error",error=>console.error("Postgres pool error",error));}
 async health(){const query={text:'SELECT 1',query_timeout:950};await this.pool.query(query);}
 async pruneRequests(){await this.pool.query("DELETE FROM tn2_requests WHERE time < now() - interval '24 hours'");}
 async claimLease(id:string,owner:string){await this.pool.query("UPDATE tn2_characters SET online_node_id=$2,online_lease_until=now()+interval '45 seconds' WHERE id=$1",[id,owner]);}
 async renewLease(id:string,owner:string){return !!(await this.pool.query("UPDATE tn2_characters SET online_lease_until=now()+interval '45 seconds' WHERE id=$1 AND online_node_id=$2 AND online_lease_until>now() RETURNING id",[id,owner])).rowCount;}
 async releaseLease(id:string,owner:string){await this.pool.query('UPDATE tn2_characters SET online_node_id=NULL,online_lease_until=NULL WHERE id=$1 AND online_node_id=$2',[id,owner]);}
 private async transaction<T>(run:(c:PoolClient)=>Promise<T>){const c=await this.pool.connect();try{await c.query('BEGIN');const out=await run(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');if((e as any).code==='23505'){if((e as any).constraint==='tn2_character_name_active')throw new AppError(409,'NAME_TAKEN','ชื่อนี้มีผู้ใช้แล้ว');throw new AppError(409,'CONFLICT','บัญชีนี้มีผู้ใช้แล้ว');}throw e;}finally{c.release();}}
 async init(){const sql=await readFile(new URL('../../sql/001_init.sql',import.meta.url),'utf8');await this.transaction(async c=>{await c.query("SELECT pg_advisory_xact_lock(hashtext('tn2_schema_v1'))");await c.query(sql);await c.query(await readFile(new URL('../../sql/002_stats.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/003_auto_allocation.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/004_jobs.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/005_skills_followup.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/006_audio_settings.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/007_no_villager.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/008_maps.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/009_items.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/010_hud_qol.sql',import.meta.url),'utf8'));await c.query(await readFile(new URL('../../sql/011_stability.sql',import.meta.url),'utf8'));for(const legacy of (await c.query('SELECT id,account_id FROM tn2_characters WHERE inventory_version=0 AND deleted_at IS NULL')).rows)await this.lockEconomy(c,legacy.account_id,legacy.id);await c.query("DELETE FROM tn2_requests WHERE time < now() - interval '24 hours'");await c.query('DELETE FROM tn2_sessions WHERE expires_at <= now()');});}
 async uiSettings(id:string):Promise<import('@thainative/shared').UISettings>{return (await this.pool.query('SELECT ui_settings FROM tn2_accounts WHERE id=$1',[id])).rows[0]?.ui_settings??{scale:100,windows:{},keys:{returnCity:'KeyH',pickupAll:'KeyZ'}};}
 async saveUISettings(id:string,settings:import('@thainative/shared').UISettings){await this.pool.query('UPDATE tn2_accounts SET ui_settings=$2 WHERE id=$1',[id,JSON.stringify(settings)]);}
 async close(){await this.pool.end();}
 async createGuest(hash:string){return row<Account>((await this.pool.query('INSERT INTO tn2_accounts(id,kind,display_name,guest_key_hash) VALUES($1,\'guest\',$2,$3) RETURNING *',[randomUUID(),'Guest · '+randomUUID().slice(0,6),hash])).rows[0])!;}
 async resumeGuest(hash:string){return row<Account>((await this.pool.query("UPDATE tn2_accounts SET last_login_at=now() WHERE guest_key_hash=$1 AND kind='guest' RETURNING *",[hash])).rows[0]);}
 async account(id:string){return row<Account>((await this.pool.query('SELECT * FROM tn2_accounts WHERE id=$1',[id])).rows[0]);}
 async google(identity:GoogleIdentity,guestId?:string){return this.transaction(async c=>{
  // Serialize links/find-or-create for the same Google subject across processes.
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['tn2_google:'+identity.sub]);
  const bound=row<Account>((await c.query('SELECT * FROM tn2_accounts WHERE google_sub=$1',[identity.sub])).rows[0]);
  const guest=guestId?row<Account>((await c.query('SELECT * FROM tn2_accounts WHERE id=$1 FOR UPDATE',[guestId])).rows[0]):undefined;
  if(guest?.kind==='guest'){
   if(bound&&bound.id!==guest.id)throw new AppError(409,'GOOGLE_ALREADY_LINKED','Google นี้ผูกกับบัญชีอื่นแล้ว กรุณาออกจาก Guest ก่อนเข้าสู่บัญชีนั้น');
   const a=row<Account>((await c.query("UPDATE tn2_accounts SET kind='google',google_sub=$2,display_name=$3,guest_key_hash=NULL,last_login_at=now() WHERE id=$1 RETURNING *",[guest.id,identity.sub,identity.name])).rows[0])!;
   await c.query('DELETE FROM tn2_sessions WHERE account_id=$1',[a.id]);return a;
  }
  if(bound)return row<Account>((await c.query('UPDATE tn2_accounts SET last_login_at=now() WHERE id=$1 RETURNING *',[bound.id])).rows[0])!;
  return row<Account>((await c.query("INSERT INTO tn2_accounts(id,kind,google_sub,display_name) VALUES($1,'google',$2,$3) RETURNING *",[randomUUID(),identity.sub,identity.name])).rows[0])!;
 });}
 async createSession(s:Session){await this.pool.query('INSERT INTO tn2_sessions(id,account_id,token_hash,expires_at,created_at,user_agent,selected_character_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[s.id,s.accountId,s.tokenHash,s.expiresAt,s.createdAt,s.userAgent,s.selectedCharacterId||null]);}
 async session(hash:string){return row<Session>((await this.pool.query('SELECT * FROM tn2_sessions WHERE token_hash=$1 AND expires_at>now()',[hash])).rows[0]);}
 async revoke(hash:string){await this.pool.query('DELETE FROM tn2_sessions WHERE token_hash=$1',[hash]);}
 async select(sessionId:string,characterId:string){await this.transaction(async c=>{const result=await c.query('UPDATE tn2_sessions s SET selected_character_id=c.id FROM tn2_characters c WHERE s.id=$1 AND c.id=$2 AND c.account_id=s.account_id AND c.deleted_at IS NULL RETURNING c.id',[sessionId,characterId]);if(!result.rowCount)throw missing();await c.query('UPDATE tn2_characters SET last_played_at=now() WHERE id=$1',[characterId]);});}
 async characters(accountId:string){return(await this.pool.query('SELECT * FROM tn2_characters WHERE account_id=$1 AND deleted_at IS NULL ORDER BY created_at',[accountId])).rows.map(r=>row<Character>(r)!);}
 async character(accountId:string,id:string){return row<Character>((await this.pool.query('SELECT * FROM tn2_characters WHERE account_id=$1 AND id=$2 AND deleted_at IS NULL',[accountId,id])).rows[0]);}
 async createCharacter(accountId:string,name:string,nameKey:string,jobId="swordsman"){creationJob(jobId);const job=newJob(jobId);return this.transaction(async c=>{await c.query('SELECT id FROM tn2_accounts WHERE id=$1 FOR UPDATE',[accountId]);const count=await c.query('SELECT count(*)::int AS count FROM tn2_characters WHERE account_id=$1 AND deleted_at IS NULL',[accountId]);if(count.rows[0].count>=3)throw new AppError(409,'SLOTS_FULL','สร้างตัวละครได้สูงสุด 3 ตัว');return row<Character>((await c.query('INSERT INTO tn2_characters(id,account_id,name,name_key,job_id,"class",skills,hotbar,jobs_version,pos_x,pos_z) VALUES($1,$2,$3,$4,$5,$5,$6,$7,3,$8,$9) RETURNING *',[randomUUID(),accountId,name,nameKey,jobId,JSON.stringify(job.skills),JSON.stringify(job.hotbar),CITY_SPAWN.x,CITY_SPAWN.z])).rows[0])!;});}
 async chooseJob(accountId:string,id:string,jobId:string){creationJob(jobId);const job=newJob(jobId);return this.transaction(async c=>{const previous=row<Character>((await c.query('SELECT * FROM tn2_characters WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE',[id,accountId])).rows[0]);if(!previous)throw missing();if(!needsJob(previous))throw new AppError(409,'JOB_ALREADY_CHOSEN','เลือกอาชีพแล้ว');return row<Character>((await c.query('UPDATE tn2_characters SET job_id=$2,"class"=$2,job_level=1,job_exp=0,skill_points=1,skills=$3,hotbar=$4,jobs_version=3 WHERE id=$1 RETURNING *',[id,jobId,JSON.stringify(job.skills),JSON.stringify(job.hotbar)])).rows[0])!;});}
 async deleteCharacter(accountId:string,id:string){await this.transaction(async c=>{const result=await c.query('UPDATE tn2_characters SET deleted_at=now() WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL RETURNING id',[id,accountId]);if(!result.rowCount)throw missing();await c.query('UPDATE tn2_sessions SET selected_character_id=NULL WHERE selected_character_id=$1',[id]);});}
 async saveProgress(accountId:string,id:string,body:import('./types.js').Progress,leaseOwner?:string){return this.transaction(async c=>{const previous=row<Character>((await c.query('SELECT * FROM tn2_characters WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE',[id,accountId])).rows[0]);if(!previous)throw missing();if(leaseOwner){const lease=(await c.query('SELECT online_node_id,online_lease_until>now() AS valid FROM tn2_characters WHERE id=$1',[id])).rows[0];if(lease?.online_node_id!==leaseOwner||!lease.valid)throw Error('Lease lost');}const p=body;return row<Character>((await c.query('UPDATE tn2_characters SET level=$2,xp=$3,gold=CASE WHEN inventory_version=0 THEN $4 ELSE gold END,kills=$5,potions=CASE WHEN inventory_version=0 THEN $6 ELSE potions END,pos_x=$7,pos_z=$8,base_stats=$9,race=$10,"class"=$11,stat_points=$12,data_version=$13,auto_allocate=$14,auto_alloc_cursor=$15,job_id=$16,job_level=$17,job_exp=$18,skill_points=$19,skills=$20,hotbar=$21,jobs_version=$22,audio_settings=$23,map_id=$24,healer_ready_at=$25,auto_seconds=$26,return_ready_at=$27,boss_ready_at=$28,last_played_at=now() WHERE id=$1 RETURNING *',[id,p.level,p.xp,p.gold,p.kills,p.potions,p.posX??null,p.posZ??null,JSON.stringify(p.baseStats),p.race,p.classId,p.statPoints,p.dataVersion,p.autoAllocate??true,p.autoAllocCursor??0,p.jobId??previous.jobId,p.jobLevel??previous.jobLevel,p.jobExp??previous.jobExp,p.skillPoints??previous.skillPoints,JSON.stringify(p.skills??previous.skills),JSON.stringify(p.hotbar??previous.hotbar),p.jobsVersion??previous.jobsVersion??1,JSON.stringify(p.audioSettings??previous.audioSettings??null),p.mapId??previous.mapId??"city_plaza",p.healerReadyAt??previous.healerReadyAt??0,p.autoSeconds??previous.autoSeconds??0,p.returnReadyAt??previous.returnReadyAt??0,p.bossReadyAt??previous.bossReadyAt??0])).rows[0])!;});}

 private async loadInventory(c:PoolClient,id:string):Promise<Inventory> {
  const items=(await c.query('SELECT * FROM tn2_items WHERE character_id=$1 FOR UPDATE',[id])).rows.map(i=>({id:i.id,template:i.template,qty:1,location:i.location,slot:i.slot,refine:i.refine,cards:i.cards,bound:i.bound,source:i.source}));
  const stacks=(await c.query('SELECT * FROM tn2_item_stacks WHERE character_id=$1 FOR UPDATE',[id])).rows.map(i=>({id:'stack:'+i.template,template:i.template,qty:i.qty,location:i.location,slot:null,refine:0,cards:[],bound:false,source:i.source}));
  const settings=(await c.query('SELECT auto_pickup FROM tn2_characters WHERE id=$1',[id])).rows[0];return {version:1,items:[...items,...stacks],autoPickup:settings.auto_pickup};
 }
 private async writeInventory(c:PoolClient,id:string,inv:Inventory) {
  const before=await this.loadInventory(c,id);
  const key=(i:Inventory['items'][number])=>economyData.items.items.find(t=>t.id===i.template)?.stackable?i.template+':'+i.location:i.id;
  const old=new Map(before.items.map(i=>[key(i),i]));
  // Free only changed equipment slots first (the slot uniqueness index is immediate).
  for(const i of before.items.filter(i=>i.location==='equip')){const next=inv.items.find(n=>n.id===i.id);if(!next||next.location!==i.location||next.slot!==i.slot)await c.query("UPDATE tn2_items SET location='bag',slot=NULL WHERE id=$1 AND character_id=$2",[i.id,id]);}
  for(const i of before.items)if(!inv.items.some(n=>key(n)===key(i))){
   if(economyData.items.items.find(t=>t.id===i.template)?.stackable)await c.query('DELETE FROM tn2_item_stacks WHERE character_id=$1 AND template=$2 AND location=$3',[id,i.template,i.location]);
   else await c.query('DELETE FROM tn2_items WHERE character_id=$1 AND id=$2',[id,i.id]);
  }
  for(const i of inv.items){
   if(JSON.stringify(old.get(key(i)))===JSON.stringify(i))continue;
   if(economyData.items.items.find(t=>t.id===i.template)?.stackable){await c.query('INSERT INTO tn2_item_stacks(character_id,template,qty,location,source) VALUES($1,$2,$3,$4,$5) ON CONFLICT(character_id,template,location) DO UPDATE SET qty=EXCLUDED.qty,location=EXCLUDED.location,source=EXCLUDED.source',[id,i.template,i.qty,i.location,i.source]);continue;}
   await c.query('INSERT INTO tn2_items(id,template,character_id,location,slot,refine,cards,bound,source,slot_index) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL) ON CONFLICT(id) DO UPDATE SET location=EXCLUDED.location,slot=EXCLUDED.slot,refine=EXCLUDED.refine,cards=EXCLUDED.cards,bound=EXCLUDED.bound,source=EXCLUDED.source WHERE tn2_items.character_id=EXCLUDED.character_id',[i.id,i.template,id,i.location,i.slot,i.refine,JSON.stringify(i.cards),i.bound,i.source]);
  }
  await c.query('UPDATE tn2_characters SET inventory_version=1,auto_pickup=$2 WHERE id=$1',[id,inv.autoPickup]);
 }
 private async lockEconomy(c:PoolClient,accountId:string,id:string) {
  const character=(await c.query('SELECT * FROM tn2_characters WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE',[id,accountId])).rows[0];if(!character)throw missing();
  if(!character.inventory_version){const inv=starterInventory(character.potions,randomUUID);await this.writeInventory(c,id,inv);const req=randomUUID();await c.query("INSERT INTO tn2_ledger(kind,character_id,qty,gold_delta,request_id) VALUES('admin',$1,0,$2,$3)",[id,character.gold,req]);for(const i of inv.items)await c.query("INSERT INTO tn2_ledger(kind,character_id,item_id,template,qty,gold_delta,request_id) VALUES('admin',$1,$2,$3,$4,0,$5)",[id,i.id,i.template,i.qty,req]);}
  return character;
 }
 async inventory(accountId:string,id:string):Promise<EconomyResult> {return this.transaction(async c=>{const character=await this.lockEconomy(c,accountId,id);return {inventory:await this.loadInventory(c,id),gold:character.gold};});}
 async inventoryOp(accountId:string,id:string,req:string,op:InventoryOp,context:EconomyContext):Promise<EconomyResult> {
  checkRequest(req);return this.transaction(async c=>{
   const character=await this.lockEconomy(c,accountId,id);
   if(context.leaseOwner&&(character.online_node_id!==context.leaseOwner||new Date(character.online_lease_until).getTime()<=Date.now()))throw Error('Lease lost');
   const cached=(await c.query("SELECT result FROM tn2_requests WHERE character_id=$1 AND req=$2 AND time>now()-interval '24 hours'",[id,req])).rows[0];if(cached)return {...cached.result,duplicate:true};
   const inv=await this.loadInventory(c,id);let result:EconomyResult;
   let out:ReturnType<typeof applyInventory>|undefined;
   try{out=applyInventory({gold:character.gold,inventory:inv},op,context.profile,economyData,randomUUID);}catch(e){result={inventory:inv,gold:character.gold,error:(e as Error).message};}
   if(out){if(context.bossLoot)await c.query('UPDATE tn2_characters SET boss_ready_at=$2 WHERE id=$1',[id,Date.now()+600000]);await this.writeInventory(c,id,out.state.inventory);await c.query('UPDATE tn2_characters SET gold=$2 WHERE id=$1',[id,out.state.gold]);for(const l of out.ledger)await c.query('INSERT INTO tn2_ledger(kind,character_id,item_id,template,qty,gold_delta,room,tick,request_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[l.kind,id,l.itemId??null,l.template??null,l.qty,l.goldDelta,context.room??null,context.tick??null,req]);result={...out.state,effect:out.effect};}
   await c.query('INSERT INTO tn2_requests(character_id,req,result) VALUES($1,$2,$3) ON CONFLICT(character_id,req) DO UPDATE SET result=EXCLUDED.result,time=now()',[id,req,JSON.stringify(result!)]);return result!;
  });
 }
 async integrity(){return this.transaction(async c=>{
  await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const issues:string[]=[];
  const mismatch=(await c.query('SELECT c.id FROM tn2_characters c LEFT JOIN tn2_ledger l ON l.character_id=c.id WHERE c.inventory_version=1 GROUP BY c.id HAVING c.gold<>COALESCE(sum(l.gold_delta),0)')).rows;
  issues.push(...mismatch.map(r=>r.id+': gold != ledger'));
  const stacks=(await c.query('SELECT character_id FROM tn2_item_stacks WHERE qty<=0')).rows;issues.push(...stacks.map(r=>r.character_id+': negative stack'));
  const dup=(await c.query('SELECT id FROM tn2_items GROUP BY id HAVING count(*)>1')).rows;issues.push(...dup.map(r=>'duplicate '+r.id));return alertIntegrity(issues);
 });}
}
