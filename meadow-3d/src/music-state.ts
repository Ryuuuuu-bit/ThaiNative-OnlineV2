import {MAP_IDS, type FieldMapId} from '@the-beginning-online/shared/maps';
export type MusicTrack = 'city' | FieldMapId | 'king';
export const MAP_MUSIC: Readonly<Record<string, MusicTrack>> = Object.fromEntries(
  MAP_IDS.map(id => [id, id === 'city_plaza' ? 'city' : id]));
export type MusicState = {
  mapId: string;
  dead: boolean;
  bossAlive: boolean;
  bossTargeted: boolean;
  bossBarActive: boolean;
  bossAggro: boolean;
};
export const MUSIC_CROSSFADE = 3;
export const MUSIC_RELEASE = 4;
export function musicDuckGain(dead: boolean, impact: boolean) {
  return (dead ? .3 : 1) * (impact ? Math.pow(10, -1.5 / 20) : 1);
}
/** Monotonic wall time keeps the release independent of simulation speed. */
export class MusicSelection {
  private wasFighting = false;
  private releaseAt = -Infinity;
  private mapId = '';
  select(state: MusicState, seconds: number): MusicTrack | null {
    if (state.mapId !== this.mapId) {
      this.mapId = state.mapId;
      this.wasFighting = false; this.releaseAt = -Infinity;
    }
    const theme = Object.hasOwn(MAP_MUSIC, state.mapId) ? MAP_MUSIC[state.mapId] : null;
    if (!theme || theme === 'city') return theme;
    const fighting = !state.dead && state.bossAlive &&
      (state.bossTargeted || state.bossBarActive || state.bossAggro);
    if (fighting) this.releaseAt = Infinity;
    else if (this.wasFighting) this.releaseAt = seconds + MUSIC_RELEASE;
    this.wasFighting = fighting;
    return fighting || seconds < this.releaseAt ? 'king' : theme;
  }
}
