import type { GameData, Quest } from '@the-beginning-online/shared';
import { FIELD_HABITATS, FIELD_BOSS, LAYOUTS, MAP_ENTRY, THORN_NEST, gateRoute, type MapId } from '@the-beginning-online/shared/maps';
import { TOWN_NPCS } from './city-2d-locations.ts';

export interface QuestDestination { map: MapId; x: number; z: number; kind: string; name: string }

/** Use the live spawn/drop data, so quest directions follow map and loot changes. */
export function questDestination(data: GameData, quest: Quest, progress: number[], from: MapId, player: {x:number;z:number;level:number}): QuestDestination | undefined {
 const objective = quest.objectives.find((o,i)=>progress[i]<o.count);
 if (!objective || objective.kind==='store') {
  const npc=TOWN_NPCS.find(n=>n.kind===(objective?'storage':quest.giver));
  if (npc) return {...npc,map:'city_plaza'};
  return;
 }
 const ids = new Set(objective.kind==='kill'?objective.monsters:data.monsters.monsters.filter(m=>m.drops.some(d=>d.item===objective.item)).map(m=>m.id));
 const candidates: {point:QuestDestination;cost:number}[]=[];
 for (const [id,habitats] of Object.entries(FIELD_HABITATS)) {
  const map=id as MapId, steps=gateRoute(from,map,player.level);
  if (map!==from&&!steps.length) continue;
  const origin=map===from?player:MAP_ENTRY[map];
  const add=(p:{x:number;z:number},kind:string,name:string)=>candidates.push({point:{...p,map,kind,name},cost:steps.length*10000+Math.hypot(p.x-origin.x,p.z-origin.z)});
  for (const spawn of LAYOUTS[map].spawns) if (ids.has(spawn.dataId)) {
   const habitat=habitats.find(h=>h.dataId===spawn.dataId),monster=data.monsters.monsters.find(m=>m.id===spawn.dataId);
   add(spawn,'hunt',habitat?.name??monster?.nameTh??objective.label);
  }
  const boss=FIELD_BOSS[map as keyof typeof FIELD_BOSS];
  if (boss&&ids.has(boss.dataId)) add(boss,'boss',data.monsters.monsters.find(m=>m.id===boss.dataId)!.nameTh);
  if (map==='forest'&&ids.has(THORN_NEST.dataId)) add(THORN_NEST,'boss','ลานแม่รังหนาม');
 }
 return candidates.sort((a,b)=>a.cost-b.cost)[0]?.point;
}
