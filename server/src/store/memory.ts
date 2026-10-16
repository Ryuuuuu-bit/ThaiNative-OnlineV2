import {loadGameData} from '@thainative/shared';
import{randomUUID}from'node:crypto';import type{Account,Character,GoogleIdentity,Session,Store}from'./types.js';import{AppError,missing}from'../errors.js';
const now=()=>new Date().toISOString();
export class MemoryStore implements Store {
 private accounts=new Map<string,Account>();private sessions=new Map<string,Session>();private chars=new Map<string,Character>();
 async init(){}async close(){}
 async createGuest(guestKeyHash:string){const a:Account={id:randomUUID(),kind:'guest',displayName:'Guest · '+randomUUID().slice(0,6),guestKeyHash,createdAt:now(),lastLoginAt:now()};this.accounts.set(a.id,a);return{...a};}
 async resumeGuest(hash:string){const a=[...this.accounts.values()].find(a=>a.kind==='guest'&&a.guestKeyHash===hash);if(a)a.lastLoginAt=now();return a?{...a}:undefined;}
 async account(id:string){const a=this.accounts.get(id);return a?{...a}:undefined;}
 async google(identity:GoogleIdentity,guestId?:string){const bound=[...this.accounts.values()].find(a=>a.googleSub===identity.sub),guest=guestId?this.accounts.get(guestId):undefined;
  if(guest?.kind==='guest'){if(bound&&bound.id!==guest.id)throw new AppError(409,'GOOGLE_ALREADY_LINKED','Google นี้ผูกกับบัญชีอื่นแล้ว กรุณาออกจาก Guest ก่อนเข้าสู่บัญชีนั้น');guest.kind='google';guest.googleSub=identity.sub;guest.displayName=identity.name;delete guest.guestKeyHash;guest.lastLoginAt=now();for(const[h,s]of this.sessions)if(s.accountId===guest.id)this.sessions.delete(h);return{...guest};}
  if(bound){bound.lastLoginAt=now();return{...bound};}const a:Account={id:randomUUID(),kind:'google',googleSub:identity.sub,displayName:identity.name,createdAt:now(),lastLoginAt:now()};this.accounts.set(a.id,a);return{...a};
 }
 async createSession(s:Session){this.sessions.set(s.tokenHash,{...s});}
 async session(hash:string){const s=this.sessions.get(hash);if(!s)return;if(Date.parse(s.expiresAt)<=Date.now()){this.sessions.delete(hash);return;}return{...s};}
 async revoke(hash:string){this.sessions.delete(hash);}
 async select(sessionId:string,characterId:string){const s=[...this.sessions.values()].find(s=>s.id===sessionId),c=this.chars.get(characterId);if(!s||!c||c.deletedAt||c.accountId!==s.accountId)throw missing();s.selectedCharacterId=characterId;c.lastPlayedAt=now();}
 async characters(accountId:string){return[...this.chars.values()].filter(c=>c.accountId===accountId&&!c.deletedAt).map(c=>({...c}));}
 async character(accountId:string,id:string){const c=this.chars.get(id);return c&&c.accountId===accountId&&!c.deletedAt?{...c}:undefined;}
 async createCharacter(accountId:string,name:string,nameKey:string){const active=[...this.chars.values()].filter(c=>!c.deletedAt);if(active.filter(c=>c.accountId===accountId).length>=3)throw new AppError(409,'SLOTS_FULL','สร้างตัวละครได้สูงสุด 3 ตัว');if(active.some(c=>c.nameKey===nameKey))throw new AppError(409,'NAME_TAKEN','ชื่อนี้มีผู้ใช้แล้ว');const defaults=loadGameData().stats.defaultBuild;const c:Character={baseStats:{...defaults.baseStats},race:defaults.race,classId:defaults.classId,statPoints:0,autoAllocate:true,autoAllocCursor:0,dataVersion:1,id:randomUUID(),accountId,name,nameKey,level:1,xp:0,gold:0,kills:0,potions:5,createdAt:now(),lastPlayedAt:now()};this.chars.set(c.id,c);return{...c};}
 async deleteCharacter(accountId:string,id:string){const c=this.chars.get(id);if(!c||c.accountId!==accountId||c.deletedAt)throw missing();c.deletedAt=now();for(const s of this.sessions.values())if(s.selectedCharacterId===id)delete s.selectedCharacterId;}
 async saveProgress(accountId:string,id:string,body:import('./types.js').Progress){const c=this.chars.get(id);if(!c||c.accountId!==accountId||c.deletedAt)throw missing();Object.assign(c,structuredClone(body),{lastPlayedAt:now()});return{...c};}
}
