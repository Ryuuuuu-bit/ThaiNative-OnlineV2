import plan from '../../../maps/biome-plan.json' with {type:'json'};
import {loadGameData,huntList} from '@the-beginning-online/shared';
import {GATE_LINKS,gateRoute,MAP_INFO,type MapId,type FieldMapId} from '@the-beginning-online/shared/maps';
export const REGIONS=plan.biomes.filter(b=>b.status==='playable');
export const WORLD_MAX_LEVEL=plan.playableMaxLevel;
export const worldData=loadGameData();
export const regionMonsters=(id:string)=>{
 const region=REGIONS.find(r=>r.id===id);
 return region?huntList(region.mapId as FieldMapId,worldData):[];
};
const naturalMonsters=new Set(REGIONS.flatMap(r=>regionMonsters(r.id).map(m=>m.id)));
export const dropOwners=(item:string)=>worldData.monsters.monsters.filter(m=>naturalMonsters.has(m.id)&&m.drops.some(d=>d.item===item));
export const regionDrops=(id:string)=>{
 const ids=new Set(regionMonsters(id).flatMap(m=>worldData.monsters.monsters.find(t=>t.id===m.id)?.drops.map(d=>d.item)??[]));
 return worldData.items.items.filter(i=>ids.has(i.id));
};
export function regionsForLevel(min:number,max:number){return REGIONS.filter(r=>r.levels[0]<=max&&r.levels[1]>=min);}
export function cityRoute(id:string){
 const region=REGIONS.find(r=>r.id===id);if(!region)return [];
 return ['นครที่ถูกลืมเลือน',...gateRoute('city_plaza',region.mapId as MapId).map(s=>MAP_INFO[GATE_LINKS[s.map][s.gate]].name)];
}
