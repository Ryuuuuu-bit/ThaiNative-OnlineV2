# Codex task: background music (BGM)

Sources (ElevenLabs Music, instrumental, already downloaded): `meadow-3d/art/bgm-source/bgm_city.mp3` (120 s, misty fantasy town), `bgm_meadow.mp3` (120 s, bright meadow), `bgm_king.mp3` (90 s, boss fight). Use the existing audio pipeline from CODEX_SFX (`tools/pack-audio.mjs`, `src/audio.ts` music bus, settings UI).

1. Pack each track to Opus (.ogg, ~96 kbps stereo) + AAC (.m4a) fallback into `public/assets/audio/`, hashed names like the SFX. Make loops seamless: find a loop point near the end, ~1.5 s crossfade tail into the start (or trim to bar-aligned loop); verify no click at the seam.
2. Runtime (`src/audio.ts`): music bus plays one looping track; 1.5 s crossfades between tracks.
   - `city_plaza` → city theme; `meadow` → meadow theme; King engaged (target/boss bar active or boss aggro on the player) → King theme, back to meadow theme 4 s after the fight ends/King dies/player dies.
   - Death screen: music ducks to 30 %.
   - SFX ducking: music −3 dB for 250 ms on hits/skill impacts (gentle, capped).
3. Loading: BGM never on the critical path — stream with `HTMLAudioElement`/media element source or fetch after the world is ready; start only after the first user gesture (autoplay policy). If the file fails, play nothing silently (log once).
4. Settings: music slider default 0.6 (existing users keep their saved value), M mute still mutes all; tab hidden → pause music, resume on focus.
5. Tests for track selection by map/boss state. `npm test`, `npm run build`. Report `.codex-run/bgm-report.json` (file sizes KB, loop points, crossfade timing, bytes on critical path = 0). Do not commit. Never touch the Railway production environment. Do not delete or commit `amb-meadow-728368513026.ogg` / `amb-meadow-ace2b6387670.m4a`.
