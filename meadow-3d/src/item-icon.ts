import {loadGameData} from '@thainative/shared';
const templates=loadGameData().items.items;
/** Atlas cell for an item template: atlas v1 holds items 0–24; the forest materials occupy the first row of v2. */
export function itemIconCell(template:string){
 const n=templates.findIndex(t=>t.id===template),page=n>=25?1:0,k=Math.max(0,n-page*25);
 return {v2:!!page,position:`${(k%5)*25}% ${Math.floor(k/5)*25}%`};
}
