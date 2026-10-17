import type{Me}from'./session';
/** What the portal hero offers: guest/login actions when signed out, the account's own way back into the game when signed in. */
export function heroView(me:Me|null){
 if(!me)return{session:'out' as const};
 const playing=!!me.selectedCharacterId;
 return{session:'in' as const,name:me.account.displayName,uid:me.account.uid,kind:me.account.kind,guest:me.account.kind==='guest',
  continueHref:playing?'/play.html':'/characters.html',continueLabel:playing?'เข้าเกมต่อ':'เลือกตัวละคร',showCharacters:playing};
}
