import {CITY_SPAWN} from '@thainative/shared/maps';
import {applyInventory,starterInventory,economyData,checkRequest,alertIntegrity,type Inventory,type LedgerEntry,type EconomyContext,type EconomyResult} from './economy.js';
import type {InventoryOp} from '@thainative/shared';
import {creationJob,needsJob,migrateMap} from './progress.js';
import {loadGameData,newJob,normalizeJob} from '@thainative/shared';
import{randomUUID}from'node:crypto';import type{Account,Character,GoogleIdentity,Session,Store}from'./types.js';import{AppError,missing}from'../errors.js';
const now=()=>new Date().toISOString();
export class MemoryStore implements Store {
 private leases=new Map<string,string>();
 async health(){}
 async pruneRequests(){for(const[k,r]of this.requests)if(Date.now()-r.at>86400000)this.requests.delete(k);}
 async claimLease(id:string,owner:string){this.leases.set(id,owner);}
 async renewLease(id:string,owner:string){return this.leases.get(id)===owner;}
 async releaseLease(id:string,owner:string){if(this.leases.get(id)===owner)this.leases.delete(id);}
 private ui=new Map<string,import('@thainative/shared').UISettings>();
 async uiSettings(id:string):Promise<import('@thainative/shared').UISettings>{return structuredClone(this.ui.get(id)??{scale:100,windows:{},keys:{returnCity:'KeyH',pickupAll:'KeyZ'}});}
 async saveUISettings(id:string,settings:import('@thainative/shared').UISettings){this.ui.set(id,structuredClone(settings));}

 private accounts=new Map<string,Account>();private sessions=new Map<string,Session>();private chars=new Map<string,Character>();
 private inventories=new Map<string,Inventory>();
 private requests=new Map<string,{at:number;result:EconomyResult}>();
 private ledger:{character:string;entry:LedgerEntry}[]=[];
 async init(){}async close(){}
 private econCharacter(accountId:string,id:string) {const c=this.chars.get(id);if(!c||c.accountId!==accountId||c.deletedAt)throw missing();if(!this.inventories.has(id)){const inv=starterInventory(c.potions,randomUUID);this.inventories.set(id,inv);this.ledger.push({character:id,entry:{kind:'admin',qty:0,goldDelta:c.gold}},...inv.items.map(i=>({character:id,entry:{kind:'admin',template:i.template,itemId:i.id,qty:i.qty,goldDelta:0}})));}return c;}
 async inventory(accountId:string,id:string):Promise<EconomyResult> {const c=this.econCharacter(accountId,id);return structuredClone({inventory:this.inventories.get(id)!,gold:c.gold});}
 async inventoryOp(accountId:string,id:string,req:string,op:InventoryOp,context:EconomyContext):Promise<EconomyResult> {
  checkRequest(req);if(context.leaseOwner&&this.leases.get(id)!==context.leaseOwner)throw Error('Lease lost');const c=this.econCharacter(accountId,id),key=id+':'+req,previous=this.requests.get(key);
  if(previous&&Date.now()-previous.at<86400000)return {...structuredClone(previous.result),duplicate:true};
  let result:EconomyResult;
  try{const out=applyInventory({gold:c.gold,inventory:this.inventories.get(id)!},op,context.profile,economyData,randomUUID);this.inventories.set(id,out.state.inventory);c.gold=out.state.gold;if(context.bossLoot)c.bossReadyAt=Date.now()+600000;this.ledger.push(...out.ledger.map(entry=>({character:id,entry})));result={...out.state,effect:out.effect};}
  catch(e){result={inventory:this.inventories.get(id)!,gold:c.gold,error:(e as Error).message};}
  this.requests.set(key,{at:Date.now(),result:structuredClone(result)});
  for(const[k,r]of this.requests)if(Date.now()-r.at>86400000)this.requests.delete(k);
  return structuredClone(result);
 }
 async integrity(){const issues:string[]=[],seen=new Set<string>();for(const[id,inv]of this.inventories){const c=this.chars.get(id)!;if(c.gold!==this.ledger.filter(l=>l.character===id).reduce((n,l)=>n+l.entry.goldDelta,0))issues.push(id+': gold != ledger');for(const i of inv.items){if(i.qty<=0)issues.push(id+': negative stack');if(!i.id.startsWith('stack:')){if(seen.has(i.id))issues.push('duplicate '+i.id);seen.add(i.id);}}}return alertIntegrity(issues);}

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
 async characters(accountId:string){return[...this.chars.values()].filter(c=>c.accountId===accountId&&!c.deletedAt).map(c=>{if((c.jobsVersion??0)<3){Object.assign(c,normalizeJob(c));c.classId=c.jobId!;c.jobsVersion=3;}return structuredClone(migrateMap(c));});}
 async character(accountId:string,id:string){const c=this.chars.get(id);if(c&&c.accountId===accountId&&!c.deletedAt){if((c.jobsVersion??0)<3){Object.assign(c,normalizeJob(c));c.classId=c.jobId!;c.jobsVersion=3;}return structuredClone(migrateMap(c));}return undefined;}
 async createCharacter(accountId:string,name:string,nameKey:string,jobId="swordsman"){creationJob(jobId);const active=[...this.chars.values()].filter(c=>!c.deletedAt);if(active.filter(c=>c.accountId===accountId).length>=3)throw new AppError(409,'SLOTS_FULL','สร้างตัวละครได้สูงสุด 3 ตัว');if(active.some(c=>c.nameKey===nameKey))throw new AppError(409,'NAME_TAKEN','ชื่อนี้มีผู้ใช้แล้ว');const defaults=loadGameData().stats.defaultBuild;const c:Character={mapId:"city_plaza",posX:CITY_SPAWN.x,posZ:CITY_SPAWN.z,healerReadyAt:0,baseStats:{...defaults.baseStats},race:defaults.race,classId:jobId,...newJob(jobId),jobsVersion:3,statPoints:0,autoAllocate:true,autoAllocCursor:0,dataVersion:1,id:randomUUID(),accountId,name,nameKey,level:1,xp:0,gold:0,kills:0,potions:5,createdAt:now(),lastPlayedAt:now()};this.chars.set(c.id,c);return{...c};}
 async chooseJob(accountId:string,id:string,jobId:string){creationJob(jobId);const c=this.chars.get(id);if(!c||c.accountId!==accountId||c.deletedAt)throw missing();if(!needsJob(c))throw new AppError(409,'JOB_ALREADY_CHOSEN','เลือกอาชีพแล้ว');Object.assign(c,newJob(jobId),{classId:jobId,jobsVersion:3});return structuredClone(migrateMap(c));}
 async deleteCharacter(accountId:string,id:string){const c=this.chars.get(id);if(!c||c.accountId!==accountId||c.deletedAt)throw missing();c.deletedAt=now();for(const s of this.sessions.values())if(s.selectedCharacterId===id)delete s.selectedCharacterId;}
 async saveProgress(accountId:string,id:string,body:import('./types.js').Progress,leaseOwner?:string){if(leaseOwner&&this.leases.get(id)!==leaseOwner)throw Error('Lease lost');const c=this.chars.get(id);if(!c||c.accountId!==accountId||c.deletedAt)throw missing();const {gold,potions,...progress}=structuredClone(body);Object.assign(c,progress,this.inventories.has(id)?{}:{gold,potions},{lastPlayedAt:now()});return{...c};}
}
