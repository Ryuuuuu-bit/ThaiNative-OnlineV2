import { cityWalkable, type MapId } from "./maps.js";
export interface Vec {
 mapId?: MapId;
	x: number;
	z: number;
}
export const CAMP = { x: -7, z: 8 },
	ARENA = { x: 1, z: 10 };
export const OBSTACLES = [
	{ x: -11, z: -6, r: 1.1 },
	{ x: -8, z: -10, r: 1 },
	{ x: 8, z: -9, r: 1 },
	{ x: -12, z: 5, r: 1 },
	{ x: 10, z: 8, r: 1 },
	{ x: 5, z: 10, r: 0.8 },
	{ x: -5, z: -2, r: 0.7 },
	{ x: 5, z: 3, r: 0.6 },
];
export function water(x: number, z: number) {
	return ((x - 11) / 3.1) ** 2 + ((z + 1) / 4.2) ** 2 < 1 && Math.abs(z) > 0.8;
}
export function walkable(x: number, z: number, r = 0.3, mapId: MapId = "meadow") {
 if(mapId === "city_plaza") return cityWalkable(x,z,r);
	return (
		x > -17 + r &&
		x < 17 - r &&
		z > -14 + r &&
		z < 14 - r &&
		!water(x, z) &&
		!OBSTACLES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + r)
	);
}
export function moveSliding(e: Vec, x: number, z: number) {
	if (walkable(e.x + x, e.z, .3, e.mapId)) e.x += x;
	if (walkable(e.x, e.z + z, .3, e.mapId)) e.z += z;
}
