import {bake,type Sprite} from './city-2d-art';
import {loadCity2DScene,type CitySceneAsset} from './city-2d-scene';
import {TOWN_NPCS} from './city-2d-locations';
import {drawNpcSprite} from './city-npc-sprite';
import {loadCitySpriteTheme} from './city-sprite-theme';
import type {Facing,LayoutItem} from './city-layout-model';

export type CityLayoutAsset=CitySceneAsset&{image:Sprite;facings:Partial<Record<Facing,Sprite>>};
export type CityLayoutItem=LayoutItem;

export async function loadCityLayoutAssets(){
 const scene=await loadCity2DScene(true),theme=await loadCitySpriteTheme(),assets=new Map<string,CityLayoutAsset>(),items:CityLayoutItem[]=[],duplicates=new Map<string,number>();
 function place(asset:CityLayoutAsset,x:number,z:number){
   if(!assets.has(asset.id))assets.set(asset.id,asset);
   const base=`${asset.id}@${x},${z}`,count=duplicates.get(base)??0;duplicates.set(base,count+1);
   items.push({id:base+(count?`#${count+1}`:''),assetId:asset.id,x,z,scale:1,flip:false,facing:0});
 }
 for(const prop of scene.props)place({...prop.asset,image:prop.image,facings:theme.faces(prop.asset.id,prop.image)},prop.x,prop.z);
 for(const npc of TOWN_NPCS){
   const id=`npc:${npc.art}`,sprite=scene.npcSprites.get(npc.art);
   if(!sprite)throw Error('ไม่มีภาพ NPC '+npc.name);
   const image=bake(c=>drawNpcSprite(c,sprite,0,0,1,0));
   const facings=theme.faces(id,image),asset=assets.get(id)??{id,name:npc.name,category:'NPC' as const,image:facings[0],facings};
   place(asset,npc.x,npc.z);
 }
 return {ground:scene.ground,assets,items};
}
