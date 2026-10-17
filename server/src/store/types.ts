import type {EconomyStore as importEconomyStore} from './economy.js';
import type {Stat,JobProgress} from '@thainative/shared';
export interface Account {id:string;kind:'guest'|'google';googleSub?:string;displayName:string;createdAt:string;lastLoginAt:string;guestKeyHash?:string}
export interface Session {id:string;accountId:string;tokenHash:string;expiresAt:string;createdAt:string;userAgent:string;selectedCharacterId?:string}
export interface Character extends Partial<JobProgress> {bossCooldowns?:Record<string,number>;quests?:import('@thainative/shared').QuestState;bossReadyAt?:number;autoSeconds?:number;mapId?:import("@thainative/shared").MapId;healerReadyAt?:number;returnReadyAt?:number;audioSettings?:import("@thainative/shared").AudioSettings;autoPotion?:import("@thainative/shared").AutoPotion;jobsVersion?:number;autoAllocate?:boolean;autoAllocCursor?:number;baseStats:Record<Stat,number>;race:string;classId:string;statPoints:number;dataVersion:number;id:string;accountId:string;name:string;nameKey:string;level:number;xp:number;gold:number;kills:number;potions:number;posX?:number;posZ?:number;createdAt:string;lastPlayedAt:string;deletedAt?:string}
export type Progress=Pick<Character,'level'|'xp'|'gold'|'kills'|'potions'|'posX'|'posZ'|'baseStats'|'race'|'classId'|'statPoints'|'dataVersion'|'autoAllocate'|'autoAllocCursor'|'jobId'|'jobLevel'|'jobExp'|'skillPoints'|'skills'|'hotbar'|'jobsVersion'|'audioSettings'|'autoPotion'|'mapId'|'healerReadyAt'|'autoSeconds'|'returnReadyAt'|'bossReadyAt'|'quests'|'bossCooldowns'>;
export interface GoogleIdentity {sub:string;name:string}
export interface Store extends importEconomyStore {
 health():Promise<void>;
 pruneRequests():Promise<void>;
 claimLease(id:string,owner:string):Promise<void>;
 renewLease(id:string,owner:string):Promise<boolean>;
 releaseLease(id:string,owner:string):Promise<void>;
 uiSettings(accountId:string):Promise<import('@thainative/shared').UISettings>;
 saveUISettings(accountId:string,settings:import('@thainative/shared').UISettings):Promise<void>;
 init():Promise<void>;close():Promise<void>;
 createGuest(guestKeyHash:string):Promise<Account>;resumeGuest(hash:string):Promise<Account|undefined>;google(identity:GoogleIdentity,guestId?:string):Promise<Account>;account(id:string):Promise<Account|undefined>;
 createSession(session:Session):Promise<void>;session(hash:string):Promise<Session|undefined>;revoke(hash:string):Promise<void>;select(sessionId:string,characterId:string):Promise<void>;
 characters(accountId:string):Promise<Character[]>;character(accountId:string,id:string):Promise<Character|undefined>;createCharacter(accountId:string,name:string,nameKey:string,jobId?:string):Promise<Character>;chooseJob(accountId:string,id:string,jobId:string):Promise<Character>;deleteCharacter(accountId:string,id:string):Promise<void>;saveProgress(accountId:string,id:string,body:Progress,leaseOwner?:string):Promise<Character>;
}
export const publicAccount=({guestKeyHash,googleSub,...safe}:Account)=>safe;
