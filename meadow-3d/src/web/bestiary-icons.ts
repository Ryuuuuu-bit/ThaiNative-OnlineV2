import {itemIconCell} from '../item-icon';
import items from '../../../shared/data/items.json' with {type:'json'};
const paths:Record<string,string>={
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 hp:'<path d="M12 21S3 15 3 8.5C3 3 10 2 12 7c2-5 9-4 9 1.5C21 15 12 21 12 21Z"/><path d="M6 12h3l2-4 2 8 2-4h3"/>',
 atk:'<path d="m5 19 3-3m-4-4 8 8M8 16l10-12 3-1-1 4L8 16ZM3 21l2-2"/>',
 matk:'<path d="m4 21 10-12m-3-4 2-3 2 3 4 1-3 3 1 4-4-2-3 2 1-4-3-3Z"/>',
 def:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="M12 6v11m-4-7h8"/>',
 mdef:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m12 7 3 5-3 5-3-5Z"/>',
 hit:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/>',
 exp:'<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
 job:'<path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15"/>',
 map:'<path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3Zm6-3v17m6-14v17"/>',
 crown:'<path d="m3 6 5 5 4-8 4 8 5-5-2 13H5Z"/><path d="M6 16h12"/>',
 gold:'<ellipse cx="12" cy="7" rx="8" ry="4"/><path d="M4 7v10c0 5 16 5 16 0V7M4 12c0 5 16 5 16 0"/><path d="M12 5v4"/>',
 loot:'<path d="M3 10h18v11H3ZM3 10V6l3-3h12l3 3v4ZM10 9h4v6h-4Z"/><path d="M6 4v6m12-6v6"/>',
 card:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="m12 6 3 5-3 5-3-5ZM8 19h8"/>',
 water:'<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0C19 10 12 2 12 2Z"/><path d="M9 15c0 2 1 3 3 3"/>',
 earth:'<path d="m12 2 9 10-9 10-9-10Z"/><path d="m3 12 9 3 9-3M12 2v13"/>',
 wind:'<path d="M3 8h12c6 0 5-7 1-5M3 12h15c5 0 5 7 1 7M3 16h7c5 0 5 6 1 5"/>',
 fire:'<path d="M13 2c2 7-5 8-2 13 2-1 3-3 4-5 8 9 0 15-6 11C0 16 9 10 9 6c3 1 3 3 3 3Z"/>',
 dark:'<path d="M16 3a9 9 0 1 0 5 14A9 9 0 0 1 16 3Z"/><path d="m18 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z"/>',
 ghost:'<path d="M5 21V9a7 7 0 0 1 14 0v12l-4-3-3 3-3-3Z"/><path d="M9 9v3m6-3v3"/>',
 neutral:'<path d="m12 3 9 9-9 9-9-9Z"/><circle cx="12" cy="12" r="3"/>',
 arrow:'<path d="M5 19 19 5M6 5h13v13"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 reset:'<path d="M4 10a8 8 0 1 1 1 8M4 3v7h7"/>',
};
export const hudIcon=(name:string)=>`<svg class="be-icon be-icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.neutral}</svg>`;
export function lootIcon(id:string){
 if(!items.items.some(t=>t.id===id))return `<span class="be-loot-icon is-etched">${hudIcon(id.startsWith('card_')?'card':'loot')}</span>`;
 const c=itemIconCell(id);
 return `<span class="be-loot-icon be-atlas-item${c.v2?' be-atlas-v2':''}" style="background-position:${c.position}" aria-hidden="true"></span>`;
}
