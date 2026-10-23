export type ShadowOutfit='male'|'female';
const key='tn-shadow-outfit';
export function setShadowOutfit(outfit:ShadowOutfit|null){
 try{if(outfit)localStorage.setItem(key,outfit);else localStorage.removeItem(key);}catch{}
}
/** Remember an explicit preview choice before login/character redirects. */
export function shadowOutfit(search=location.search):ShadowOutfit|undefined{
 const requested=new URLSearchParams(search).get('shadow');
 if(requested==='off'){setShadowOutfit(null);return undefined;}
 if(requested==='male'||requested==='female'){setShadowOutfit(requested);return requested;}
 try{const saved=localStorage.getItem(key);if(saved==='male'||saved==='female')return saved;}catch{}
 return undefined;
}
