/** Presentation timing follows authoritative skill events, including instant skills. */
export const SKILL_MOTIONS = ['slash','whirlwind','dash_strike','earth_break','provoke','endure'] as const;
export type SkillMotion = typeof SKILL_MOTIONS[number];
export const SKILL_FRAMES:Record<SkillMotion,number>={slash:6,whirlwind:8,dash_strike:5,earth_break:9,provoke:5,endure:5};
export const SKILL_DURATION:Record<SkillMotion,number>={slash:.5,whirlwind:.6,dash_strike:.5,earth_break:.64,provoke:.5,endure:.5};
export const CONTACT_FRAME:Record<SkillMotion,number>={slash:2,whirlwind:2,dash_strike:1,earth_break:6,provoke:2,endure:3};
export function isSkillMotion(id:string):id is SkillMotion{return (SKILL_MOTIONS as readonly string[]).includes(id);}
export function skillFrame(id:SkillMotion,elapsed:number){
 if(id==='earth_break')return elapsed<.4?Math.min(5,Math.floor(Math.max(0,elapsed)/.4*6)):Math.min(8,6+Math.floor((elapsed-.4)/.08));
 // Zero-cast skills already resolve in the start event. Begin on contact;
 // anticipation exists in the atlas but must never delay authoritative feedback.
 if(id==='whirlwind')return Math.min(7,2+Math.floor(Math.max(0,elapsed)/(.25/3)));
 if(id==='endure')return elapsed<.12?3:3+Math.floor((elapsed-.12)/.12)%2;
 return Math.min(SKILL_FRAMES[id]-1,CONTACT_FRAME[id]+Math.floor(Math.max(0,elapsed)/SKILL_DURATION[id]*(SKILL_FRAMES[id]-CONTACT_FRAME[id])));
}
export function earthHeight(elapsed:number){return elapsed<.1||elapsed>=.4?0:Math.sin((elapsed-.1)/.3*Math.PI)*1.15;}
