export interface Account {id:string;kind:'guest'|'google';googleSub?:string;displayName:string;createdAt:string;lastLoginAt:string;guestKeyHash?:string}
export interface Session {id:string;accountId:string;tokenHash:string;expiresAt:string;createdAt:string;userAgent:string;selectedCharacterId?:string}
export interface Character {id:string;accountId:string;name:string;nameKey:string;level:number;xp:number;gold:number;kills:number;potions:number;posX?:number;posZ?:number;createdAt:string;lastPlayedAt:string;deletedAt?:string}
export type Progress=Pick<Character,'level'|'xp'|'gold'|'kills'|'potions'|'posX'|'posZ'>;
export interface GoogleIdentity {sub:string;name:string}
export interface Store {
 init():Promise<void>;close():Promise<void>;
 createGuest(guestKeyHash:string):Promise<Account>;resumeGuest(hash:string):Promise<Account|undefined>;google(identity:GoogleIdentity,guestId?:string):Promise<Account>;account(id:string):Promise<Account|undefined>;
 createSession(session:Session):Promise<void>;session(hash:string):Promise<Session|undefined>;revoke(hash:string):Promise<void>;select(sessionId:string,characterId:string):Promise<void>;
 characters(accountId:string):Promise<Character[]>;character(accountId:string,id:string):Promise<Character|undefined>;createCharacter(accountId:string,name:string,nameKey:string):Promise<Character>;deleteCharacter(accountId:string,id:string):Promise<void>;progress(accountId:string,id:string,body:unknown):Promise<Character>;
}
export const publicAccount=({guestKeyHash,googleSub,...safe}:Account)=>safe;
