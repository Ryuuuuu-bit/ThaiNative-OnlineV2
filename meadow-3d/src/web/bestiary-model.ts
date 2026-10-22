import monsters from '../../../shared/data/monsters.json' with {type:'json'};
import items from '../../../shared/data/items.json' with {type:'json'};
import elements from '../../../shared/data/elements.json' with {type:'json'};
import {LAYOUTS,FIELD_BOSS,THORN_NEST,MAP_INFO,type FieldMapId} from '@the-beginning-online/shared/maps';
export type MonsterRecord=typeof monsters.monsters[number];
export const FIELDS:FieldMapId[]=["meadow","forest","ruins","canyon","grove","summit","temple","himmapan","desert","frost","yokai","dragon","volcano","fae","ocean","astral","abyss","confluence"];
export const MONSTERS=[...monsters.monsters].filter(m=>monsterMaps(m.id).length).sort((a,b)=>a.level-b.level||a.id.localeCompare(b.id));
export const elementName=(id:string)=>(elements.names as Record<string,string>)[id]??id;
export const itemName=(id:string)=>items.items.find(i=>i.id===id)?.nameTh??(id.startsWith('card_')?'การ์ด'+(MONSTERS.find(m=>m.id===id.slice(5))?.nameTh??id.slice(5)):id);
export function monsterMaps(id:string){return FIELDS.filter(map=>LAYOUTS[map].spawns.some(s=>s.dataId===id)||FIELD_BOSS[map]?.dataId===id||FIELD_BOSS[map]?.minion===id||(map==='forest'&&id===THORN_NEST.dataId));}
export const mapLabel=(id:string)=>MAP_INFO[id as FieldMapId]?.name??id;
export const respawnMinutes=(id:string)=>[...FIELDS.map(map=>FIELD_BOSS[map]),THORN_NEST].find(b=>b?.dataId===id)?.respawnMinutes;
export const dropPercent=(rate:number)=>`${Number((rate*100).toFixed(4)).toLocaleString('en-US',{maximumFractionDigits:4})}%`;
export function filterMonsters(q='',map='all',type='all',sort='level'){
 const term=q.normalize('NFC').trim().toLocaleLowerCase('th');
 return MONSTERS.filter(m=>(map==='all'||monsterMaps(m.id).includes(map as FieldMapId))&&(type==='all'||(type==='boss'?m.boss:!m.boss))&&(!term||[m.nameTh,m.id,elementName(m.element),...monsterMaps(m.id).map(mapLabel),...m.drops.map(d=>itemName(d.item))].some(v=>v.toLocaleLowerCase('th').includes(term)))).sort((a,b)=>sort==='name'?a.nameTh.localeCompare(b.nameTh,'th'):sort==='hp'?b.hp-a.hp:a.level-b.level||a.id.localeCompare(b.id));
}
