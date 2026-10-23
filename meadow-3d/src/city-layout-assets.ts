import {bake,type Sprite} from './city-2d-art';
import {CITY_LAYOUT} from '@the-beginning-online/shared/maps';
import {loadCity2DScene,type CitySceneAsset} from './city-2d-scene';
import {TOWN_NPCS} from './city-2d-locations';
import {drawNpcSprite} from './city-npc-sprite';
import {loadCitySpriteTheme} from './city-sprite-theme';
import type {Facing,LayoutItem} from './city-layout-model';

export type CityLayoutAsset=CitySceneAsset&{image:Sprite;facings:Partial<Record<Facing,Sprite>>};
export type CityLayoutItem=LayoutItem;

export async function loadCityLayoutAssets(){
 const scene=await loadCity2DScene(true),theme=await loadCitySpriteTheme(),assets=new Map<string,CityLayoutAsset>();
 function register(asset:CityLayoutAsset){
   if(!assets.has(asset.id))assets.set(asset.id,asset);
 }
 for(const prop of scene.props)register({...prop.asset,image:prop.image,facings:theme.faces(prop.asset.id,prop.image)});
 for(const npc of TOWN_NPCS){
   const id=`npc:${npc.art}`,sprite=scene.npcSprites.get(npc.art);
   if(!sprite)throw Error('ไม่มีภาพ NPC '+npc.name);
   const image=bake(c=>drawNpcSprite(c,sprite,0,0,1,0));
   const facings=theme.faces(id,image),asset=assets.get(id)??{id,name:npc.name,category:'NPC' as const,image:facings[0],facings};
   register(asset);
 }
 return {ground:scene.ground,assets,items:structuredClone(CITY_LAYOUT.items)};
}
