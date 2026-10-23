/** Symmetric level gap prevents both trivial farming and carried power leveling.
 * Cards, materials and gold keep their own drop rules. */
export function monsterExpMultiplier(playerLevel:number,monsterLevel:number){
 const gap=Math.abs(playerLevel-monsterLevel);
 return gap<=5?1:gap===6?.7:gap===7?.5:gap===8?.3:gap===9?.15:gap===10?.05:0;
}
export interface MonsterRewardSource {
 level:number;
 ownerLevel:number;
 recipients:{id:string;level:number}[];
}
export const CONFLUENCE_ACCESS_QUEST='worldcore_invitation';
export function canEnterConfluence(p:{level:number;quests?:{done:Record<string,number>}}){return p.level>=100&&p.quests?.done[CONFLUENCE_ACCESS_QUEST]!==undefined;}
