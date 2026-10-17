import{randomBytes,scrypt,timingSafeEqual,type ScryptOptions}from'node:crypto';import{AppError}from'./errors.js';
// scrypt N=2^15 r=8 p=1 (≈32 MiB, tens of ms): slow for attackers, affordable per login. Encoded so parameters can be raised later.
const N=32768,R=8,P=1,KEYLEN=32,MAXMEM=96*1024*1024;
const derive=(password:string,salt:Buffer,o:{N:number;r:number;p:number},keylen=KEYLEN)=>new Promise<Buffer>((resolve,reject)=>scrypt(password.normalize('NFKC'),salt,keylen,{...o,maxmem:MAXMEM} satisfies ScryptOptions,(e,key)=>e?reject(e):resolve(key)));
export async function hashPassword(password:string){const salt=randomBytes(16),key=await derive(password,salt,{N,r:R,p:P});return`scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;}
/** Always spends one KDF; with no stored hash it hashes against a dummy so unknown usernames take as long as wrong passwords. */
export async function verifyPassword(password:string,stored?:string){
 const parts=stored?.split('$');let o={N,r:R,p:P},salt=DUMMY_SALT,expected:Buffer|undefined;
 if(parts?.length===6&&parts[0]==='scrypt'){const[n,r,p]=parts.slice(1,4).map(Number);if([n,r,p].every(Number.isSafeInteger)&&n<=1<<17&&r<=16&&p<=4){o={N:n,r,p};salt=Buffer.from(parts[4],'base64url');expected=Buffer.from(parts[5],'base64url');}}
 const key=await derive(password,salt,o,expected?.length||KEYLEN);return!!expected&&expected.length===key.length&&timingSafeEqual(key,expected);
}
const DUMMY_SALT=randomBytes(16);

const RESERVED=/^(?:admin|administrator|root|system|sys|gm|gamemaster|mod|moderator|staff|support|help|official|owner|dev|developer|server|thainative|thai_native|guest|google|null|undefined|anonymous|everyone|player)(?:_?\d*)$/;
export function username(input:unknown){
 if(typeof input!=='string'||!/^[A-Za-z0-9_]{3,20}$/.test(input))throw new AppError(400,'INVALID_USERNAME','ชื่อผู้ใช้ต้องยาว 3–20 ตัว ใช้ได้เฉพาะ a–z, 0–9 และ _');
 const key=input.toLowerCase();if(RESERVED.test(key)||/^(?:admin|gm|mod|staff|thainative|system)_/.test(key))throw new AppError(400,'USERNAME_RESERVED','ชื่อผู้ใช้นี้สงวนไว้ กรุณาเลือกชื่ออื่น');
 return{username:input,usernameKey:key};
}
const COMMON=new Set(['password','password1','password123','12345678','123456789','1234567890','11111111','00000000','qwertyui','qwerty123','iloveyou','abcd1234','asdfghjk','88888888','99999999','12341234']);
export function newPassword(input:unknown,usernameKey?:string){
 if(typeof input!=='string'||[...input].length<8)throw new AppError(400,'WEAK_PASSWORD','รหัสผ่านต้องยาวอย่างน้อย 8 ตัว');
 if(input.length>128)throw new AppError(400,'WEAK_PASSWORD','รหัสผ่านยาวได้ไม่เกิน 128 ตัว');
 const lower=input.toLowerCase();if(COMMON.has(lower)||/^(.)\1+$/.test(input)||(usernameKey&&usernameKey.length>=4&&lower.includes(usernameKey)))throw new AppError(400,'WEAK_PASSWORD','รหัสผ่านนี้เดาง่ายเกินไป หรือมีชื่อผู้ใช้อยู่ด้วย');
 return input;
}
/** Login input: never echo why it's malformed (same generic error as a wrong password). */
export const passwordInput=(input:unknown)=>typeof input==='string'&&input.length>0&&input.length<=128?input:undefined;

export const LOGIN_FAILED=()=>new AppError(401,'LOGIN_FAILED','ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
/**
 * Failed-login backoff per key (username or IP). Nothing is recorded for success except a reset.
 * After `free` failures each further failure locks the key for base·2^k ms, capped at `max`; the counter decays after `window`.
 * Keys are normalised usernames whether or not the account exists, so lockouts do not reveal existence.
 */
export class Backoff {
 private map=new Map<string,{fails:number;lockedUntil:number;last:number}>();
 constructor(private free=5,private base=30000,private max=15*60000,private window=60*60000){}
 retryAfter(key:string,now=Date.now()){const e=this.map.get(key);if(!e)return 0;if(now-e.last>this.window){this.map.delete(key);return 0;}return Math.max(0,e.lockedUntil-now);}
 fail(key:string,now=Date.now()){let e=this.map.get(key);if(!e||now-e.last>this.window)e={fails:0,lockedUntil:0,last:now};e.fails++;e.last=now;if(e.fails>=this.free)e.lockedUntil=now+Math.min(this.max,this.base*2**(e.fails-this.free));this.map.set(key,e);if(this.map.size>50000)for(const[k,v]of this.map)if(now-v.last>this.window)this.map.delete(k);}
 reset(key:string){this.map.delete(key);}
}
export const lockedError=(ms:number)=>new AppError(429,'LOGIN_LOCKED',`ลองเข้าสู่ระบบผิดหลายครั้ง กรุณารอ ${Math.ceil(ms/60000)} นาทีแล้วลองใหม่`);
