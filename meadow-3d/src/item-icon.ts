import {loadGameData,STARTER_CARD_TEXT} from '@the-beginning-online/shared';
import {PAINTED_ITEM_ART} from './item-art-data.ts';
import {MATERIAL_ITEM_ART} from './material-art-data.ts';
import {CLASS_ITEM_ART} from './class-item-art-data.ts';
const starterMaterials=["desert_sun_scroll","himmapan_01_material","himmapan_jade_turtle_material","himmapan_03_material","himmapan_blossom_deer_material","himmapan_golden_macaque_material","himmapan_06_material","himmapan_azure_garuda_material","himmapan_08_material","lotus_party_dew","naga_cleansing_incense","greek_reed","greek_windfeather","greek_jadescale","greek_labyrinth_bronze","jelly_slime", "lotus_fibre", "dew_shell", "tide_core", "tea_spore_leaf", "dewdrop_dust", "pine_spine", "living_clay", "glaze_shard", "charmed_lid", "clear_gravel", "ore_scale", "magnet_claw", "mist_spore", "root_tusk", "shadow_fang", "mist_silk", "thorn_nest_heart"];
const data=loadGameData(),templates=new Map(data.items.items.map(t=>[t.id,t]));
const cardSlots=new Map(data.cards.cards.map(c=>[c.id,c.slot]));
export const CARD_SLOT_NAMES: Record<string, string> = { weapon: 'อาวุธ', armour: 'เกราะ', shield: 'โล่', garment: 'ผ้าคลุม', footgear: 'รองเท้า', accessory: 'เครื่องประดับ' };
/** Stable atlas order for legacy fallbacks; dedicated artwork resolves by exact item ID. */
const atlasIcons=["training_sword", "leaf_sword", "crystal_sword", "reed_dagger", "wood_staff", "bamboo_bow", "traveler_clothes", "leaf_armour", "royal_armour", "wood_shield", "leaf_cloak", "trail_boots", "jade_ring", "sky_amulet", "red_small", "red_medium", "blue_potion", "speed_potion", "jelly_slime", "leaf_seed", "king_crystal", "weapon_stone", "armour_stone", "card_jelly_pink", "card_king_jelly", "mist_spore", "wolf_fur", "wisp_tear", "mist_wood", "warden_heart", "stone_spore", "relic_fang", "rune_shard", "ancient_vine", "temple_seal", "ore_slime", "crag_fur", "amber_dust", "crag_root", "titan_core", "card_mist_warden", "card_relic_warden", "card_crag_titan"];
export function itemIconCell(template:string){
 const icon=templates.get(template)?.icon??template;
 const classArt=CLASS_ITEM_ART[template]??CLASS_ITEM_ART[icon];
 if(classArt)return {v2:false,position:'center',image:`/assets/class-items-v1/${classArt}`};
 const material=MATERIAL_ITEM_ART[template]??MATERIAL_ITEM_ART[icon];
 if(material)return {v2:false,position:'center',image:`/assets/item-art-v3/${material}`};
 const painted=PAINTED_ITEM_ART[template]??PAINTED_ITEM_ART[icon];
 if(painted)return {v2:false,position:'center',image:`/assets/item-art-v2/${painted}`};
 if(icon.startsWith('astral_')&&icon.endsWith('_scroll'))return {v2:false,position:'center',image:`/assets/starter-loot/${icon}.svg`};
 if(icon.startsWith('field_')||icon.startsWith('unique_')||icon.endsWith('_material')||icon in STARTER_CARD_TEXT||starterMaterials.includes(icon))return {v2:false,position:'center',image:`/assets/starter-loot/${icon}.svg`};
 const index=atlasIcons.indexOf(icon),n=index<0?0:index,page=n>=25?1:0,k=n-page*25;
 return {v2:!!page,position:`${(k%5)*25}% ${Math.floor(k/5)*25}%`};
}
export function itemIcon(t: { id: string }) {
	const icon = document.createElement('span');
	icon.className = 'item-icon';
	const cell = itemIconCell(t.id);
	if (cell.v2) icon.classList.add('item-icon-v2');
	icon.style.backgroundPosition = cell.position;
	if (cell.image) { icon.style.backgroundImage = `url(${cell.image})`; icon.style.backgroundSize = 'contain'; }
	const slot = cardSlots.get(t.id);
	if (slot) {
		const badge = document.createElement('span');
		badge.className = 'card-slot-badge';
		badge.dataset.cardSlot = slot;
		badge.setAttribute('role', 'img');
		badge.setAttribute('aria-label', `ใส่การ์ดใน: ${CARD_SLOT_NAMES[slot]}`);
		icon.title = `ใส่การ์ดใน: ${CARD_SLOT_NAMES[slot]}`;
		icon.append(badge);
	}
	return icon;
}
