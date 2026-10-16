import type{Character,Progress}from'./types.js';import{AppError}from'../errors.js';
export function characterName(input:unknown){
 if(typeof input!=='string')throw new AppError(400,'INVALID_NAME','กรุณากรอกชื่อตัวละคร');const name=input.normalize('NFC');
 if([...name].length<2||[...name].length>12||! /^[\p{Script=Latin}\p{Script=Thai}\p{Script=Inherited}0-9]+$/u.test(name)||! /^[\p{L}\p{M}\p{Nd}]+$/u.test(name)||!/[\p{L}\p{N}]/u.test(name[0]))throw new AppError(400,'INVALID_NAME','ชื่อยาว 2–12 ตัว ใช้อักษรไทย อังกฤษ และตัวเลข โดยไม่มีช่องว่าง');
 return{name,nameKey:name.toLocaleLowerCase('en-US')};
}
export function clampProgress(previous:Character,input:unknown):Progress{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new AppError(400,'INVALID_PROGRESS','ข้อมูลการบันทึกไม่ถูกต้อง');const b=input as Record<string,unknown>;
 const integer=(key:string,old:number,min:number,max:number)=>typeof b[key]==='number'&&Number.isFinite(b[key])?Math.min(max,Math.max(min,Math.floor(b[key] as number))):old;
 const position=(key:string,old:number|undefined,min:number,max:number)=>typeof b[key]==='number'&&Number.isFinite(b[key])?Math.min(max,Math.max(min,b[key] as number)):old;
 const level=integer('level',previous.level,previous.level,Math.min(99,previous.level+3));
 const requestedXp=integer('xp',previous.xp,0,Math.min(1000000,previous.xp+10000));
 // An older beacon cannot roll back earned XP in the same level. Rollover is valid on level-up.
 const xp=level>previous.level?requestedXp:Math.max(previous.xp,requestedXp);
 return{level,xp,gold:integer('gold',previous.gold,previous.gold,Math.min(2147483647,previous.gold+5000)),kills:integer('kills',previous.kills,previous.kills,Math.min(2147483647,previous.kills+100)),potions:integer('potions',previous.potions,0,5),posX:position('posX',previous.posX,-16.6,16.6),posZ:position('posZ',previous.posZ,-13.6,13.6)};
}
