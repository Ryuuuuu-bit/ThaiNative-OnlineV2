import test from'node:test';import assert from'node:assert/strict';import type{Server}from'node:http';import{once}from'node:events';
import{createApp}from'../app.js';import{MemoryStore}from'../store/memory.js';import{PostgresStore}from'../store/postgres.js';import type{Store}from'../store/types.js';import{AppError}from'../errors.js';
import{Backoff,hashPassword,newPassword,username,verifyPassword}from'../password.js';

async function fixture(t:any,store:Store=new MemoryStore(),options:Record<string,unknown>={}){await store.init();const app=createApp({store,secret:'test-pepper',googleClientId:'test-client',verifyGoogle:async token=>{if(token!=='valid')throw new AppError(401,'GOOGLE_INVALID','Google ไม่ถูกต้อง');return{sub:'google-sub-auth',name:'ผู้ทดสอบ'};},...options});const server:Server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});const base=`http://127.0.0.1:${(server.address() as any).port}`;
 const call=async(path:string,method='GET',body?:unknown,cookie='',headers:Record<string,string>={})=>{const response=await fetch(base+path,{method,headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(cookie?{Cookie:cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text();let data:any;try{data=JSON.parse(text);}catch{data=text;}return{response,data,status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0]||''};};
 return{store,call};}
const PW='meadow-dawn-42';
const register=(call:any,name:string,cookie='',extra:Record<string,unknown>={})=>call('/api/register','POST',{username:name,password:PW,confirmPassword:PW,...extra},cookie);

test('password hashing: scrypt with per-user salt, verify, wrong password and malformed hashes fail closed',async()=>{
 const a=await hashPassword(PW),b=await hashPassword(PW);assert.match(a,/^scrypt\$32768\$8\$1\$[\w-]{22}\$[\w-]{43}$/);assert.notEqual(a,b);
 assert.equal(await verifyPassword(PW,a),true);assert.equal(await verifyPassword(PW+'x',a),false);assert.equal(await verifyPassword(PW,undefined),false);assert.equal(await verifyPassword(PW,'scrypt$9999999$8$1$aa$bb'),false);assert.equal(await verifyPassword(PW,'plain'),false);
});
test('username and password rules: 3–20 [A-Za-z0-9_], reserved names, 8+ chars, no obvious passwords',()=>{
 for(const bad of ['ab','a'.repeat(21),'มีไทย','with space','dash-name','',null,42])assert.throws(()=>username(bad),{code:'INVALID_USERNAME'},String(bad));
 for(const reserved of ['admin','Admin','ADMIN1','gm1','GameMaster','thainative','system_bot','mod_x','root','guest'])assert.throws(()=>username(reserved),{code:'USERNAME_RESERVED'},reserved);
 for(const reserved of ['Adm1n','a_d_m_i_n','GMhero','Staaaff'])assert.throws(()=>username(reserved),{code:'USERNAME_RESERVED'},reserved);
 for(const bad of ['Fuuuck','f_u_c_k','Sh1t','B1tch'])assert.throws(()=>username(bad),{code:'USERNAME_INAPPROPRIATE'},bad);
 assert.deepEqual(username('Aerin_01'),{username:'Aerin_01',usernameKey:'aerin_01'});assert.ok(username('gmailfan'));
 for(const bad of ['short','1234567','password','12345678','aaaaaaaaaa','xx-aerin_01-yy'])assert.throws(()=>newPassword(bad,'aerin_01'),{code:'WEAK_PASSWORD'},bad);
 assert.throws(()=>newPassword('x'.repeat(129)),{code:'WEAK_PASSWORD'});assert.equal(newPassword(PW,'aerin_01'),PW);
});
test('backoff locks after the free attempts, doubles, caps, and decays',()=>{const b=new Backoff(3,1000,4000,60000),k='u:x';let now=0;for(let i=0;i<2;i++)b.fail(k,now);assert.equal(b.retryAfter(k,now),0);b.fail(k,now);assert.equal(b.retryAfter(k,now),1000);b.fail(k,now);assert.equal(b.retryAfter(k,now),2000);for(let i=0;i<5;i++)b.fail(k,now);assert.equal(b.retryAfter(k,now),4000);now=61000+4000;assert.equal(b.retryAfter(k,now),0);b.reset(k);assert.equal(b.retryAfter(k,0),0);});

test('register → me (uid, no secrets) → logout → login → wrong password is generic → unknown user is the same error',async t=>{const{call}=await fixture(t);
 const r=await register(call,'Aerin_01');assert.equal(r.status,201);assert.match(r.data.account.uid,/^[1-9]\d{8}$/);assert.equal(r.data.account.kind,'password');assert.equal(r.data.account.username,'Aerin_01');
 for(const secret of ['passwordHash','usernameKey','guestKeyHash','googleSub'])assert.equal(r.data.account[secret],undefined,secret);assert.doesNotMatch(JSON.stringify(r.data),/scrypt|meadow-dawn/);
 const me=await call('/api/me','GET',undefined,r.cookie);assert.equal(me.data.account.uid,r.data.account.uid);assert.equal(me.data.account.passwordHash,undefined);
 assert.equal((await call('/api/logout','POST',{},r.cookie)).status,200);assert.equal((await call('/api/me','GET',undefined,r.cookie)).status,401);
 const login=await call('/api/login','POST',{username:'AERIN_01',password:PW});assert.equal(login.status,200);assert.equal(login.data.account.uid,r.data.account.uid);assert.notEqual(login.cookie,r.cookie);assert.equal((await call('/api/me','GET',undefined,login.cookie)).status,200);
 const wrong=await call('/api/login','POST',{username:'Aerin_01',password:'not-the-password'}),unknown=await call('/api/login','POST',{username:'nobody_here',password:PW}),malformed=await call('/api/login','POST',{username:'<x>',password:PW});
 for(const res of [wrong,unknown,malformed]){assert.equal(res.status,401);assert.equal(res.data.error.code,'LOGIN_FAILED');assert.equal(res.data.error.message,wrong.data.error.message);assert.equal(res.cookie,'');}
});
test('register validation: confirm mismatch, taken (case-insensitive), reserved, weak; signed-in non-guest must log out first',async t=>{const{call}=await fixture(t);
 assert.equal((await call('/api/register','POST',{username:'Bram',password:PW,confirmPassword:PW+'!'})).data.error.code,'PASSWORD_MISMATCH');
 assert.equal((await call('/api/register','POST',{username:'Bram',password:'1234',confirmPassword:'1234'})).data.error.code,'WEAK_PASSWORD');
 assert.equal((await register(call,'Admin')).data.error.code,'USERNAME_RESERVED');
 assert.equal((await register(call,'f_u_c_k')).data.error.code,'USERNAME_INAPPROPRIATE');
 assert.equal((await register(call,'Adm1n')).data.error.code,'USERNAME_RESERVED');
 const a=await register(call,'Bram');assert.equal(a.status,201);const taken=await register(call,'bRAM');assert.equal(taken.status,409);assert.equal(taken.data.error.code,'USERNAME_TAKEN');
 const again=await register(call,'Bram_two',a.cookie);assert.equal(again.status,409);assert.equal(again.data.error.code,'ALREADY_SIGNED_IN');
});
test('legacy usernames can still log in after registration policy tightens',async t=>{
 const{call,store}=await fixture(t);
 const existing=await store.registerPassword({username:'Sh1t',usernameKey:'sh1t',passwordHash:await hashPassword(PW)});
 const login=await call('/api/login','POST',{username:'SH1T',password:PW});
 assert.equal(login.status,200);assert.equal(login.data.account.id,existing.id);
});
test('guest → username/password link keeps the account, uid, characters and selection; old guest key and sessions die',async t=>{const{call}=await fixture(t);
 const g=await call('/api/guest','POST',{});const c=await call('/api/characters','POST',{jobId:'swordsman',name:'ลิงก์01'},g.cookie);await call(`/api/characters/${c.data.character.id}/select`,'POST',{},g.cookie);
 assert.equal((await register(call,'f_u_c_k',g.cookie)).data.error.code,'USERNAME_INAPPROPRIATE');
 const unchanged=await call('/api/me','GET',undefined,g.cookie);assert.equal(unchanged.data.account.kind,'guest');assert.equal(unchanged.data.selectedCharacterId,c.data.character.id);
 const linked=await register(call,'Linker',g.cookie);assert.equal(linked.status,201);assert.equal(linked.data.linked,true);assert.equal(linked.data.account.id,g.data.account.id);assert.equal(linked.data.account.uid,g.data.account.uid);assert.equal(linked.data.account.kind,'password');
 assert.equal((await call('/api/me','GET',undefined,g.cookie)).status,401,'guest session revoked');assert.equal((await call('/api/guest/resume','POST',{guestKey:g.data.guestKey})).status,401,'guest key retired');
 const me=await call('/api/me','GET',undefined,linked.cookie);assert.equal(me.data.selectedCharacterId,c.data.character.id);
 const login=await call('/api/login','POST',{username:'linker',password:PW});assert.equal((await call('/api/characters','GET',undefined,login.cookie)).data.characters[0].name,'ลิงก์01');
 const g2=await call('/api/guest','POST',{}),fresh=await register(call,'Separate',g2.cookie,{linkGuest:false});assert.equal(fresh.status,201);assert.notEqual(fresh.data.account.id,g2.data.account.id);assert.equal(fresh.data.linked,false);assert.equal((await call('/api/me','GET',undefined,g2.cookie)).status,401,'switching accounts rotates the session');assert.equal((await call('/api/guest/resume','POST',{guestKey:g2.data.guestKey})).status,200,'unlinked guest stays resumable');
});
test('per-username lockout returns 429 with Retry-After for real and unknown names alike, and other users are unaffected',async t=>{const{call}=await fixture(t);await register(call,'Locky');
 for(const name of ['Locky','ghost_user']){for(let i=0;i<5;i++)assert.equal((await call('/api/login','POST',{username:name,password:'wrong-password'})).status,401);const blocked=await call('/api/login','POST',{username:name,password:PW});assert.equal(blocked.status,429);assert.equal(blocked.data.error.code,'LOGIN_LOCKED');assert.ok(Number(blocked.response.headers.get('retry-after'))>0);}
 await register(call,'Other_user');assert.equal((await call('/api/login','POST',{username:'Other_user',password:PW})).status,200);
});
test('per-IP auth budget covers login, register and password endpoints',async t=>{const{call}=await fixture(t);const statuses=[];for(let i=0;i<21;i++)statuses.push((await call('/api/login','POST',{username:'u'+i+'_xx',password:'x'})).status);assert.equal(statuses.at(-1),429);});
test('change password: needs the current one, revokes other devices, keeps this one signed in',async t=>{const{call}=await fixture(t);const a=await register(call,'Changer'),other=await call('/api/login','POST',{username:'Changer',password:PW});
 assert.equal((await call('/api/password','POST',{currentPassword:'wrong-one',newPassword:'brand-new-pass',confirmPassword:'brand-new-pass'},a.cookie)).data.error.code,'PASSWORD_WRONG');
 assert.equal((await call('/api/password','POST',{currentPassword:PW,newPassword:'brand-new-pass',confirmPassword:'nope-nope-nope'},a.cookie)).data.error.code,'PASSWORD_MISMATCH');
 const changed=await call('/api/password','POST',{currentPassword:PW,newPassword:'brand-new-pass',confirmPassword:'brand-new-pass'},a.cookie);assert.equal(changed.status,200);assert.ok(changed.cookie);
 assert.equal((await call('/api/me','GET',undefined,other.cookie)).status,401);assert.equal((await call('/api/me','GET',undefined,a.cookie)).status,401);assert.equal((await call('/api/me','GET',undefined,changed.cookie)).status,200);
 assert.equal((await call('/api/login','POST',{username:'Changer',password:PW})).status,401);assert.equal((await call('/api/login','POST',{username:'Changer',password:'brand-new-pass'})).status,200);
 const g=await call('/api/guest','POST',{});assert.equal((await call('/api/password','POST',{currentPassword:'x',newPassword:'brand-new-pass',confirmPassword:'brand-new-pass'},g.cookie)).data.error.code,'NO_PASSWORD');assert.equal((await call('/api/password','POST',{})).status,401);
});
test('uids: guest, Google and password accounts each get a distinct 9-digit uid that survives guest→Google linking',async t=>{const{call}=await fixture(t);const g=await call('/api/guest','POST',{}),p=await register(call,'Uid_user');const linked=await call('/api/google','POST',{credential:'valid'},g.cookie);assert.equal(linked.data.account.uid,g.data.account.uid);const uids=[g.data.account.uid,p.data.account.uid];assert.equal(new Set(uids).size,2);for(const u of uids)assert.match(u,/^[1-9]\d{8}$/);});
test('memory store backfills a uid for legacy accounts once and never changes it',async()=>{const store=new MemoryStore();const a=await store.createGuest('h');const raw=(store as any).accounts.get(a.id);delete raw.uid;const first=(await store.account(a.id))!.uid;assert.match(first,/^\d{9}$/);assert.equal((await store.account(a.id))!.uid,first);});
test('cross-site login and register are rejected before touching credentials',async t=>{const{call}=await fixture(t);for(const path of ['/api/login','/api/register'])assert.equal((await call(path,'POST',{username:'x',password:'y'},'',{Origin:'https://evil.example'})).status,403);});
test('production refuses a short SESSION_SECRET',()=>{assert.throws(()=>createApp({store:new MemoryStore(),production:true,secret:'short'}),/32 characters/);assert.doesNotThrow(()=>createApp({store:new MemoryStore(),production:true,secret:'p'.repeat(32)}));});

// Real Postgres: set PG_TEST_URL to a throwaway database (never UAT/production).
test('PostgresStore: migration backfills immutable uids, password register/link/login/change',{skip:!process.env.PG_TEST_URL&&'PG_TEST_URL not set'},async t=>{
 const store=new PostgresStore(process.env.PG_TEST_URL!);t.after(()=>store.close());await store.init();const pool=store.pool,suffix=Date.now().toString(36);
 const legacy=await store.createGuest('legacy-'+suffix);await pool.query('ALTER TABLE tn2_accounts DISABLE TRIGGER tn2_accounts_uid_immutable');await pool.query('ALTER TABLE tn2_accounts ALTER COLUMN uid DROP NOT NULL');await pool.query('UPDATE tn2_accounts SET uid=NULL WHERE id=$1',[legacy.id]);await pool.query('ALTER TABLE tn2_accounts ENABLE TRIGGER tn2_accounts_uid_immutable');
 await store.init();const backfilled=(await store.account(legacy.id))!.uid;assert.match(backfilled,/^[1-9]\d{8}$/);await store.init();assert.equal((await store.account(legacy.id))!.uid,backfilled,'re-running the migration keeps uids');
 await assert.rejects(pool.query("UPDATE tn2_accounts SET uid='123456789' WHERE id=$1",[legacy.id]),/immutable/);
 const{call}=await fixture(t,store);const name='Pg_'+suffix;
 const g=await call('/api/guest','POST',{});const linked=await register(call,name,g.cookie);assert.equal(linked.status,201);assert.equal(linked.data.account.id,g.data.account.id);assert.equal(linked.data.account.uid,g.data.account.uid);assert.equal(linked.data.account.passwordHash,undefined);assert.equal((await call('/api/me','GET',undefined,g.cookie)).status,401);
 assert.equal((await register(call,name.toUpperCase())).data.error.code,'USERNAME_TAKEN');
 const racers=await Promise.all([register(call,'Race_'+suffix),register(call,'race_'+suffix.toUpperCase())]);assert.deepEqual(racers.map(r=>r.status).sort(),[201,409]);
 assert.equal((await call('/api/login','POST',{username:name,password:'wrong-password'})).data.error.code,'LOGIN_FAILED');const login=await call('/api/login','POST',{username:name.toLowerCase(),password:PW});assert.equal(login.status,200);
 const changed=await call('/api/password','POST',{currentPassword:PW,newPassword:'brand-new-pass',confirmPassword:'brand-new-pass'},login.cookie);assert.equal(changed.status,200);assert.equal((await call('/api/me','GET',undefined,linked.cookie)).status,401);assert.equal((await call('/api/login','POST',{username:name,password:'brand-new-pass'})).status,200);
 const stored=(await pool.query('SELECT password_hash,username_key FROM tn2_accounts WHERE id=$1',[g.data.account.id])).rows[0];assert.match(stored.password_hash,/^scrypt\$/);assert.equal(stored.username_key,name.toLowerCase());
});
