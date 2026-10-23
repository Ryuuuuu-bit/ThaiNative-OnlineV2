import { biomeWalkable, BIOME_IDS, type BiomeMapId, himmapanWalkable, cityWalkable, forestWalkable, meadowWalkable, ruinsWalkable, canyonWalkable, groveWalkable, summitWalkable, templeWalkable, LAYOUTS, inWater, FIELD_BOSS, type MapId } from "./maps.js";
export interface Vec {
	mapId?: MapId;
	x: number;
	z: number;
}
/** Meadow landmarks (kept under their old names for the client and tests). */
export const CAMP = LAYOUTS.meadow.camps[0],
	ARENA = { x: FIELD_BOSS.meadow!.x, z: FIELD_BOSS.meadow!.z };
export const OBSTACLES = LAYOUTS.meadow.obstacles;
export function water(x: number, z: number) {
	return inWater(LAYOUTS.meadow.water, x, z);
}
export function walkable(x: number, z: number, r = 0.3, mapId: MapId = "meadow") {
	if((BIOME_IDS as readonly string[]).includes(mapId))return biomeWalkable(mapId as BiomeMapId,x,z,r);
	if (mapId === "city_plaza") return cityWalkable(x, z, r);
	if (mapId === "forest") return forestWalkable(x, z, r);
 if(mapId==="ruins")return ruinsWalkable(x,z,r);
 if(mapId==="canyon")return canyonWalkable(x,z,r);
 if(mapId==="grove")return groveWalkable(x,z,r);
 if(mapId==="himmapan")return himmapanWalkable(x,z,r);
 if(mapId==="temple")return templeWalkable(x,z,r);
 if(mapId==="summit")return summitWalkable(x,z,r);
	return meadowWalkable(x, z, r);
}
export function moveSliding(e: Vec & {statuses?:{id:string}[]}, x: number, z: number) {
 if(e.statuses?.some(s=>s.id==='root'))return;
	if (walkable(e.x + x, e.z, 0.3, e.mapId)) e.x += x;
	if (walkable(e.x, e.z + z, 0.3, e.mapId)) e.z += z;
}
