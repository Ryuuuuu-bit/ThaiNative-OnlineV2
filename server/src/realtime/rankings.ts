import { canWearTitle, compareRankings, titleDefinition, type RankingBoard, type RankingCharacter } from '@the-beginning-online/shared';
import type { Store } from '../store/types.js';

/** One shared, bounded-frequency read. Only public character fields leave this service. */
export function createRankings(store:Store,live:()=>RankingCharacter[],now=Date.now) {
 let saved:RankingCharacter[]=[],updatedAt=0,task:Promise<void>|undefined;
 function rows(board:RankingBoard) {
  const all=new Map(saved.map(p=>[p.id,p]));
  // A deleted character must never be resurrected by its lingering socket.
  for(const p of live())if(all.has(p.id))all.set(p.id,p);
  return [...all.values()].filter(p=>board!=='hunt'||p.kills>0).sort((a,b)=>compareRankings(board,a,b));
 }
 function ranks(id:string) {
  const result:Partial<Record<RankingBoard,number>>={};
  for(const board of ['level','hunt'] as const){const index=rows(board).findIndex(p=>p.id===id);if(index>=0)result[board]=index+1;}
  return result;
 }
 return {
  get ready(){return updatedAt>0;},
  invalidate(){updatedAt=0;},
  refresh(){
   if(task)return task;
   if(updatedAt&&now()-updatedAt<60000)return Promise.resolve();
   task=store.rankingCharacters().then(value=>{saved=value;updatedAt=now();}).finally(()=>{task=undefined;});
   return task;
  },
  ranks,
  board(board:RankingBoard,id:string){
   const list=rows(board),index=list.findIndex(p=>p.id===id);
   const places:Record<RankingBoard,Map<string,number>>={level:new Map(),hunt:new Map()};
   for(const kind of ['level','hunt'] as const)(kind===board?list:rows(kind)).forEach((p,i)=>places[kind].set(p.id,i+1));
   const entry=(p:RankingCharacter,i:number)=>{
    const title=titleDefinition(p.titleId);
    return {rank:i+1,id:p.id,name:p.name,jobId:p.jobId,level:p.level,kills:p.kills,
     titleId:title&&canWearTitle(title,p,{level:places.level.get(p.id),hunt:places.hunt.get(p.id)})?title.id:null};
   };
   return {t:'rankings',board,updatedAt,total:list.length,list:list.slice(0,100).map(entry),mine:index<0?null:entry(list[index],index)};
  },
 };
}
