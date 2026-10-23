import {rolledModifiers,refineModifiers,STARTER_CARD_TEXT,type GameData,type OwnedItem,type Modifier} from '@the-beginning-online/shared';
import {modifierLabel,modifierPercent,modifierNumber} from './card-text.ts';
export interface ItemStat {key:string;label:string;value:number;percent:boolean;lowerIsBetter:boolean}
type Template=GameData['items']['items'][number];
/** Item contributions, not player DPS: flat and percentage modifiers must remain separate. */
export function itemStats(t:Template,item:OwnedItem|undefined,data:GameData):ItemStat[]{
 const seen=new Set<string>();
 const modifiers:Modifier[]=[...(t.atk?[{kind:'flat' as const,stat:'atk' as const,value:t.atk}]:[]),...(t.matk?[{kind:'flat' as const,stat:'matk' as const,value:t.matk}]:[]),...t.modifiers,
  ...(item?[...rolledModifiers(item),...refineModifiers(item,t),...item.cards.flatMap(id=>{if(STARTER_CARD_TEXT[id]&&seen.has(id))return [];seen.add(id);return data.cards.cards.find(c=>c.id===id)?.modifiers??[];})]:[])];
 const rows=new Map<string,ItemStat>();
 for(const m of modifiers){
  if(!('value' in m)||typeof m.value!=='number')continue;
  const key=m.kind+':'+('stat' in m?m.stat:'target' in m?m.target:''),old=rows.get(key);
  if(old)old.value+=m.value;
  else rows.set(key,{key,label:modifierLabel(m)+(m.kind==='percent'?' (โบนัส %)':''),value:m.value,percent:modifierPercent(m),lowerIsBetter:'stat' in m&&m.stat==='castMul'});
 }
 return [...rows.values()];
}
export const itemStatValue=(row:ItemStat,value=row.value)=>modifierNumber(value,row.percent);
export function compareItemStats(mine:ItemStat[],theirs:ItemStat[]){
 const a=new Map(mine.map(r=>[r.key,r])),b=new Map(theirs.map(r=>[r.key,r]));
 return [...new Set([...a.keys(),...b.keys()])].map(key=>{
  const row=a.get(key)??{...b.get(key)!,value:0},delta=row.value-(b.get(key)?.value??0);
  return {...row,delta,improvement:Math.abs(delta)<1e-9?0:delta*(row.lowerIsBetter?-1:1)};
 });
}
