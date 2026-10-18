/** Presentation timing follows authoritative skill events, including instant skills. */
export const JOB2_MOTIONS = {
 guardian:['shield_bash','bulwark','quake_slam','rally_roar'],
 berserker:['frenzy_slash','blood_rage','blade_cyclone','leap_strike'],
} as const;
export const SKILL_MOTIONS = ['slash','whirlwind','dash_strike','earth_break','provoke','endure',...JOB2_MOTIONS.guardian,...JOB2_MOTIONS.berserker] as const;
export type SkillMotion = typeof SKILL_MOTIONS[number];
export const SKILL_FRAMES:Record<SkillMotion,number>={slash:6,whirlwind:8,dash_strike:5,earth_break:9,provoke:5,endure:5,shield_bash:6,bulwark:5,quake_slam:9,rally_roar:5,frenzy_slash:8,blood_rage:5,blade_cyclone:8,leap_strike:6};
export const SKILL_DURATION:Record<SkillMotion,number>={slash:.5,whirlwind:.6,dash_strike:.5,earth_break:.64,provoke:.5,endure:.5,shield_bash:.5,bulwark:.5,quake_slam:.74,rally_roar:.5,frenzy_slash:.5,blood_rage:.5,blade_cyclone:.6,leap_strike:.6};
export const CONTACT_FRAME:Record<SkillMotion,number>={slash:2,whirlwind:2,dash_strike:1,earth_break:6,provoke:2,endure:3,shield_bash:2,bulwark:3,quake_slam:6,rally_roar:2,frenzy_slash:1,blood_rage:3,blade_cyclone:1,leap_strike:4};
// Seconds from the skill event to its impact: a cast (earth_break, quake_slam) or a leap's airborne time (leap_strike, sim landing.delay).
export const CAST_SECONDS:Partial<Record<SkillMotion,number>>={earth_break:.4,quake_slam:.5,leap_strike:.4};
export const BORROWED_MOTION:Partial<Record<SkillMotion,SkillMotion>>={shield_bash:'slash',bulwark:'endure',quake_slam:'earth_break',rally_roar:'provoke',frenzy_slash:'slash',blood_rage:'endure',blade_cyclone:'whirlwind',leap_strike:'dash_strike'};
export const MULTI_CONTACTS={frenzy_slash:[1,3,5],blade_cyclone:[1,3,5,7]} as const;
export function contactOffset(id:keyof typeof MULTI_CONTACTS,index:number){return (MULTI_CONTACTS[id][index]-CONTACT_FRAME[id])*SKILL_DURATION[id]/(SKILL_FRAMES[id]-CONTACT_FRAME[id]);}
export function isSkillMotion(id:string):id is SkillMotion{return (SKILL_MOTIONS as readonly string[]).includes(id);}
export function skillFrame(id:SkillMotion,elapsed:number){
 const cast=CAST_SECONDS[id];
 if(cast)return elapsed<cast?Math.min(CONTACT_FRAME[id]-1,Math.floor(Math.max(0,elapsed)/cast*CONTACT_FRAME[id])):Math.min(SKILL_FRAMES[id]-1,CONTACT_FRAME[id]+Math.floor((elapsed-cast)/.08));
 // Zero-cast skills already resolve in the start event. Begin on contact;
 // anticipation exists in the atlas but must never delay authoritative feedback.
 if(id==='whirlwind')return Math.min(7,2+Math.floor(Math.max(0,elapsed)/(.25/3)));
 if(['endure','bulwark','blood_rage'].includes(id))return elapsed<.12?3:3+Math.floor((elapsed-.12)/.12)%2;
 return Math.min(SKILL_FRAMES[id]-1,CONTACT_FRAME[id]+Math.floor(Math.max(0,elapsed)/SKILL_DURATION[id]*(SKILL_FRAMES[id]-CONTACT_FRAME[id])));
}
export function earthHeight(elapsed:number){return elapsed<.1||elapsed>=.4?0:Math.sin((elapsed-.1)/.3*Math.PI)*1.15;}
export function leapHeight(elapsed:number){const air=CAST_SECONDS.leap_strike!;return elapsed<=0||elapsed>=air?0:Math.sin(elapsed/air*Math.PI);}

/** Skills whose own VFX and SFX are live: events keep their real id. Job 2 icons, VFX and SFX shipped before their hero motions. */
export const OWN_ART: ReadonlySet<string> = new Set(['slash','whirlwind','dash_strike','earth_break','provoke','endure',...JOB2_MOTIONS.guardian,...JOB2_MOTIONS.berserker]);
/** Job 2 hero motion sheets that passed review. Until a motion is listed here it is never requested and the hero plays BORROWED_MOTION. */
export const MOTION_READY: ReadonlySet<string> = new Set<string>(['shield_bash','bulwark','quake_slam','rally_roar','frenzy_slash','blood_rage','blade_cyclone','leap_strike']);
export function preferOwnArt<T extends {skillId?:string;visual?:string;learnedSkill?:string}>(event:T):T {
 return event.visual && !OWN_ART.has(event.skillId ?? '')
  ? {...event,learnedSkill:event.skillId,skillId:event.visual} : event;
}
