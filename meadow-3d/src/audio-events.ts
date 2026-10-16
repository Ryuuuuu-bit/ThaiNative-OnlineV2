import type { AudioEngine } from './audio';
/** Consume authoritative events only, never predicted key presses. */
export function playEventAudio(sound: AudioEngine, e: any, you: string, boss?: { x: number; z: number }) {
  const local = e.playerId === you;
  const play = (id: string) => sound.play(id, e);
  switch (e.type) {
    case 'slash': play('combo' + ((e.combo ?? 0) + 1)); break;
    case 'skill':
      // Earth Break has a cast; its impact event is emitted when damage resolves.
      if (['slash', 'whirlwind', 'provoke', 'endure'].includes(e.skillId)) play(e.skillId);
      if (e.skillId === 'dash_strike') play('dash');
      break;
    case 'skillImpact': if (e.skillId === 'earth_break') play('earth_break'); break;
    case 'hit': if (!e.boss) play('jelly_hit'); if (e.crit) play('crit'); break;
    case 'kill': if (!e.boss) play('jelly_death'); break;
    case 'dash': case 'evade': play('dodge'); break;
    case 'miss': if (e.defender === 'player') play('dodge'); break;
    case 'hurt': play('hurt'); break;
    case 'death': if (local) play('death'); break;
    case 'heal': play('potion'); break;
    case 'pickup': if (local) sound.play('pickup'); break;
    case 'level': case 'jobLevel': if (local) sound.play('levelup'); break;
    case 'boss': sound.play('king_roar', boss || { x: 1, z: -10 }); break;
    case 'phase2': play('king_roar'); break;
    case 'slam': play('king_slam'); break;
  }
}
