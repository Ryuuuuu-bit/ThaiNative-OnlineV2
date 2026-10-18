export type MusicTrack = 'city' | 'meadow' | 'forest' | 'king';
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
  select(state: MusicState, seconds: number): MusicTrack | null {
    if (!['meadow','forest','ruins','canyon'].includes(state.mapId)) {
      this.wasFighting = false; this.releaseAt = -Infinity;
      return state.mapId === 'city_plaza' ? 'city' : null;
    }
    const fighting = !state.dead && state.bossAlive &&
      (state.bossTargeted || state.bossBarActive || state.bossAggro);
    if (fighting) this.releaseAt = Infinity;
    else if (this.wasFighting) this.releaseAt = seconds + MUSIC_RELEASE;
    this.wasFighting = fighting;
    return fighting || seconds < this.releaseAt ? 'king' : ['forest','ruins','canyon'].includes(state.mapId) ? 'forest' : 'meadow';
  }
}
