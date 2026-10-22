/** Stable network IDs; display names and geometry live in world/map data. */
export const EXPLORATION_IDS=[] as const;
export const BIOME_IDS=["desert","frost","yokai","dragon","volcano","fae","ocean","astral","abyss","confluence",...EXPLORATION_IDS] as const;
export type BiomeMapId=typeof BIOME_IDS[number];
export const MAP_IDS=['city_plaza','meadow','forest','ruins','canyon','grove','summit','temple','himmapan',...BIOME_IDS] as const;
export type ExplorationMapId=typeof EXPLORATION_IDS[number];
export type MapId=typeof MAP_IDS[number];
export type FieldMapId=Exclude<MapId,'city_plaza'>;
export type HuntingMapId=Exclude<FieldMapId,ExplorationMapId>;
