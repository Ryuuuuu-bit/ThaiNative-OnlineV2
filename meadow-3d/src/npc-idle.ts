/** Holds are in seconds: rest, prepare, occupational gesture, settle. */
export const NPC_IDLE_PROFILES = [
 {role:'storage',gesture:'ledger-and-keys',holds:[2.7,.55,1,.65]},
 {role:'forge',gesture:'shoulder-and-brow',holds:[3.8,.4,.8,.5]},
 {role:'market',gesture:'open-palm-welcome',holds:[1.9,.55,1.05,.6]},
 {role:'healer',gesture:'inspect-herbs',holds:[3.6,.9,1.3,.85]},
 {role:'captain',gesture:'watch-and-grip',holds:[2.4,1.15,.7,1.2]},
] as const;

export function npcIdleFrame(row:number,time:number,phase=0){
 const {holds}=NPC_IDLE_PROFILES[row]??NPC_IDLE_PROFILES[0];
 const duration=holds.reduce((sum,hold)=>sum+hold,0);
 let elapsed=Number.isFinite(time+phase)?((time+phase)%duration+duration)%duration:0;
 for(let frame=0;frame<holds.length;frame++){
  if(elapsed<holds[frame])return frame;
  elapsed-=holds[frame];
 }
 return 0;
}
