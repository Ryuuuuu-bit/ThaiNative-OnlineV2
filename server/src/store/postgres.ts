import{Pool,type PoolClient}from'pg';import{readFile}from'node:fs/promises';import{randomUUID}from'node:crypto';
import type{Account,Character,GoogleIdentity,Session,Store}from'./types.js';import{AppError,missing}from'../errors.js';import{clampProgress}from'./progress.js';
function row<T>(input:Record<string,unknown>|undefined):T|undefined{if(!input)return;return Object.fromEntries(Object.entries(input).filter(([,v])=>v!==null).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),v instanceof Date?v.toISOString():v])) as T;}
export class PostgresStore implements Store {
 readonly pool:Pool;constructor(connectionString:string){this.pool=new Pool({connectionString,max:10});}
 private async transaction<T>(run:(c:PoolClient)=>Promise<T>){const c=await this.pool.connect();try{await c.query('BEGIN');const out=await run(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');if((e as any).code==='23505'){if((e as any).constraint==='tn2_character_name_active')throw new AppError(409,'NAME_TAKEN','ชื่อนี้มีผู้ใช้แล้ว');throw new AppError(409,'CONFLICT','บัญชีนี้มีผู้ใช้แล้ว');}throw e;}finally{c.release();}}
 async init(){const sql=await readFile(new URL('../../sql/001_init.sql',import.meta.url),'utf8');await this.transaction(async c=>{await c.query("SELECT pg_advisory_xact_lock(hashtext('tn2_schema_v1'))");await c.query(sql);await c.query('DELETE FROM tn2_sessions WHERE expires_at <= now()');});}
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
 async createCharacter(accountId:string,name:string,nameKey:string){return this.transaction(async c=>{await c.query('SELECT id FROM tn2_accounts WHERE id=$1 FOR UPDATE',[accountId]);const count=await c.query('SELECT count(*)::int AS count FROM tn2_characters WHERE account_id=$1 AND deleted_at IS NULL',[accountId]);if(count.rows[0].count>=3)throw new AppError(409,'SLOTS_FULL','สร้างตัวละครได้สูงสุด 3 ตัว');return row<Character>((await c.query('INSERT INTO tn2_characters(id,account_id,name,name_key) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),accountId,name,nameKey])).rows[0])!;});}
 async deleteCharacter(accountId:string,id:string){await this.transaction(async c=>{const result=await c.query('UPDATE tn2_characters SET deleted_at=now() WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL RETURNING id',[id,accountId]);if(!result.rowCount)throw missing();await c.query('UPDATE tn2_sessions SET selected_character_id=NULL WHERE selected_character_id=$1',[id]);});}
 async progress(accountId:string,id:string,body:unknown){return this.transaction(async c=>{const previous=row<Character>((await c.query('SELECT * FROM tn2_characters WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE',[id,accountId])).rows[0]);if(!previous)throw missing();const p=clampProgress(previous,body);return row<Character>((await c.query('UPDATE tn2_characters SET level=$2,xp=$3,gold=$4,kills=$5,potions=$6,pos_x=$7,pos_z=$8,last_played_at=now() WHERE id=$1 RETURNING *',[id,p.level,p.xp,p.gold,p.kills,p.potions,p.posX??null,p.posZ??null])).rows[0])!;});}
}
