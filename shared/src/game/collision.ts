import { cityWalkable, forestWalkable, meadowWalkable, LAYOUTS, inWater, FIELD_BOSS, type MapId } from "./maps.js";
export interface Vec {
	mapId?: MapId;
	x: number;
	z: number;
}
/** Meadow landmarks (kept under their old names for the client and tests). */
export const CAMP = LAYOUTS.meadow.camps[0],
	ARENA = { x: FIELD_BOSS.meadow.x, z: FIELD_BOSS.meadow.z };
export const OBSTACLES = LAYOUTS.meadow.obstacles;
export function water(x: number, z: number) {
	return inWater(LAYOUTS.meadow.water, x, z);
}
export function walkable(x: number, z: number, r = 0.3, mapId: MapId = "meadow") {
	if (mapId === "city_plaza") return cityWalkable(x, z, r);
	if (mapId === "forest") return forestWalkable(x, z, r);
	return meadowWalkable(x, z, r);
}
export function moveSliding(e: Vec, x: number, z: number) {
	if (walkable(e.x + x, e.z, 0.3, e.mapId)) e.x += x;
	if (walkable(e.x, e.z + z, 0.3, e.mapId)) e.z += z;
}
