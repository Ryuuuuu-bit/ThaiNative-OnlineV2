import {loadGameData} from '@thainative/shared';
import type{Character,Progress}from'./types.js';import{AppError}from'../errors.js';
export function characterName(input:unknown){
 if(typeof input!=='string')throw new AppError(400,'INVALID_NAME','กรุณากรอกชื่อตัวละคร');const name=input.normalize('NFC');
 if([...name].length<2||[...name].length>12||! /^[\p{Script=Latin}\p{Script=Thai}\p{Script=Inherited}0-9]+$/u.test(name)||! /^[\p{L}\p{M}\p{Nd}]+$/u.test(name)||!/[\p{L}\p{N}]/u.test(name[0]))throw new AppError(400,'INVALID_NAME','ชื่อยาว 2–12 ตัว ใช้อักษรไทย อังกฤษ และตัวเลข โดยไม่มีช่องว่าง');
 return{name,nameKey:name.toLocaleLowerCase('en-US')};
}

export function creationJob(input:unknown):string {
 const job=loadGameData().jobs.jobs.find(j=>j.id===input);
 if(!job?.available || job.tier!==1)throw new AppError(400,'INVALID_JOB','กรุณาเลือกอาชีพที่เปิดให้เล่น');
 return job.id;
}
export const needsJob=(c:Pick<Character,'jobId'>)=>c.jobId==='villager'||c.jobId==='needs_job';
