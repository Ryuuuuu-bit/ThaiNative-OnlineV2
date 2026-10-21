import {loadGameData} from '@the-beginning-online/shared';
const templates=new Map(loadGameData().items.items.map(t=>[t.id,t]));
/** Stable atlas order. New templates reuse their declared icon, never their catalog index. */
const atlasIcons=["training_sword", "leaf_sword", "crystal_sword", "reed_dagger", "wood_staff", "bamboo_bow", "traveler_clothes", "leaf_armour", "royal_armour", "wood_shield", "leaf_cloak", "trail_boots", "jade_ring", "sky_amulet", "red_small", "red_medium", "blue_potion", "speed_potion", "jelly_slime", "leaf_seed", "king_crystal", "weapon_stone", "armour_stone", "card_jelly_pink", "card_king_jelly", "mist_spore", "wolf_fur", "wisp_tear", "mist_wood", "warden_heart", "stone_spore", "relic_fang", "rune_shard", "ancient_vine", "temple_seal", "ore_slime", "crag_fur", "amber_dust", "crag_root", "titan_core", "card_mist_warden", "card_relic_warden", "card_crag_titan"];
export function itemIconCell(template:string){
 const icon=templates.get(template)?.icon??template;
 const index=atlasIcons.indexOf(icon),n=index<0?0:index,page=n>=25?1:0,k=n-page*25;
 return {v2:!!page,position:`${(k%5)*25}% ${Math.floor(k/5)*25}%`};
}
