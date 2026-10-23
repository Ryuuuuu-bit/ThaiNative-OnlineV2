import type { AudioEngine } from './audio';
/** Material layer under the shared weapon thock, by monster species (RO / ToS style). */
const JOB2_SOUNDS=new Set(['shield_bash','bulwark','quake_slam','rally_roar','frenzy_slash','blood_rage','blade_cyclone','leap_strike']);
const MATERIAL: Record<string, string> = { slime: 'mat_jelly', king: 'mat_jelly', wolf: 'mat_fur', stump: 'mat_wood', warden: 'mat_wood', shroom: 'mat_shroom', wisp: 'mat_wisp' };
/** Consume authoritative events only, never predicted key presses. */
export function playEventAudio(sound: AudioEngine, e: any, you: string, boss?: { x: number; z: number }, species?: (id: number) => string) {
  const real=e.learnedSkill??e.skillId;
  const id=JOB2_SOUNDS.has(real)?real:e.visual??e.skillId;
  const local = e.playerId === you;
    const play = (id: string) => sound.play(id, e, 'sfx', !!e.playerId && !local);
  if (['hit', 'hurt', 'skillImpact', 'slam'].includes(e.type)) sound.duckMusic(Number.isFinite(e.x) ? e : undefined);
  switch (e.type) {
    case 'slash': play('combo' + ((e.combo ?? 0) + 1)); break;
    case 'skill':
      if(JOB2_SOUNDS.has(id)){if(id!=='quake_slam'&&id!=='frenzy_slash')play(id);break;}
      // Earth Break has a cast; its impact event is emitted when damage resolves.
      if (['slash', 'whirlwind', 'provoke', 'endure'].includes(e.skillId)) play(e.skillId);
      if (e.skillId === 'dash_strike') play('dash');
      break;
    case 'skillImpact': if (id === 'earth_break'||id==='quake_slam') play(id); if (id === 'leap_strike') play('leap_strike_land'); break;
    case 'hit': if(e.reflect)play('reflect');if(real==='frenzy_slash')play('frenzy_slash');if(real==='blade_cyclone')play('blade_cyclone_tick'); if (!e.boss) { play('hit_thock'); play(MATERIAL[species?.(e.id) ?? 'slime'] ?? 'mat_jelly'); } if (e.crit) play('crit'); break;
    case 'kill': if (!e.boss) play('jelly_death'); break;
    case 'dash': case 'evade': play('dodge'); break;
    case 'miss': if (e.defender === 'player') play('dodge'); break;
    case 'hurt': if(local&&e.guarded)play('guard_block');play('hurt'); break;
    case 'death': if (local) play('death'); break;
    case 'heal': play('potion'); break;
    case 'pickup': if (local) sound.play('pickup'); break;
    case 'level': case 'jobLevel': if (local) sound.play('levelup'); break;
    case 'boss': sound.play('king_roar', boss || { x: 1, z: -10 }); break;
    case 'phase2': play('king_roar'); break;
    case 'slam': play('king_slam'); break;
  }
}
