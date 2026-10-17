import {CITY_SPAWN} from '@thainative/shared/maps';
import {loadGameData,characterNameError} from '@thainative/shared';
import type{Character,Progress}from'./types.js';import{AppError}from'../errors.js';
export function characterName(input:unknown){
 const policy=characterNameError(input);if(policy)throw new AppError(400,'INVALID_NAME',policy);
 const name=(input as string).normalize('NFC');
 return{name,nameKey:name.toLocaleLowerCase('en-US')};
}

export function creationJob(input:unknown):string {
 const job=loadGameData().jobs.jobs.find(j=>j.id===input);
 if(!job?.available || job.tier!==1)throw new AppError(400,'INVALID_JOB','กรุณาเลือกอาชีพที่เปิดให้เล่น');
 return job.id;
}
export const needsJob=(c:Pick<Character,'jobId'>)=>c.jobId==='villager'||c.jobId==='needs_job';

export function migrateMap(c: Character) {if(!c.mapId){c.mapId='city_plaza';c.posX=CITY_SPAWN.x;c.posZ=CITY_SPAWN.z;}return c;}
