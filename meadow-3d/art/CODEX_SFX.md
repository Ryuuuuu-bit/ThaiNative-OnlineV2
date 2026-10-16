# Codex task: sound effects + audio settings (meadow-3d)

Sources: `meadow-3d/art/sfx-source/picks.json` (chosen variation per sound) + `raw/*.mp3`, `sfx-sources.json` (durations). Read first: `meadow-3d/src/main.ts` (combat events, loot, level-up, King, UI), `src/skills-ui.ts`, `src/skill-art.ts`, `src/stats-window.ts`, `src/keys.ts`, existing audio code if any, `scripts/build-web.mjs`, `public/texture-manifest.json` (deferred-loading pattern from the load-perf task), `art/CODEX_LOAD_PERF.md`.

## 1. Pipeline (reproducible, `tools/pack-audio.mjs`)
- Trim leading/trailing silence, normalise loudness per category (UI ≈ −20 LUFS, combat ≈ −16, King ≈ −14, ambience ≈ −24), short fade-out to avoid clicks.
- Encode **Opus in WebM/OGG** (~48–64 kbps mono for SFX) with **AAC/M4A fallback** for Safari if Opus fails `canPlayType`.
- Pack into audio sprites: `sfx-core` (combat, UI, jellies, pickup, potion, levelup), `sfx-skills`, `sfx-king` (deferred, loaded with the King assets), `amb-meadow` separate loop file. JSON sprite map with offsets. Output `public/assets/audio/` with content hashes; original mp3 stay in `art/` only.
- `amb_meadow`: if `art/sfx-source/raw/amb_meadow_loop*.mp3` exists use that (new ~30 s take), otherwise keep the old file but crossfade-loop it. Make the loop seamless (crossfade the tail into the head ~1.5 s).

## 2. Runtime (`src/audio.ts`)
- Web Audio API; one AudioContext unlocked on first user gesture (click / key / touch); nothing plays before.
- Buses: master → sfx / music / ambience, each a GainNode. Settings persisted on the server with the hotbar/keys settings (fallback localStorage), default sfx 0.8, music 0.6, ambience 0.5, mute toggle.
- Variation so repeats don't sound robotic: random pitch ±4 % (UI ±0), gain ±1.5 dB; per-sound cooldown/voice limit (e.g. jelly_hit max 3 at once, 40 ms min gap); global max ~16 voices.
- Simple 3D: pan + distance attenuation from the hero for world sounds (monsters, King); UI sounds non-positional.
- Pause/lower when the tab is hidden; ambience fades in after playable.
- Loading: `sfx-core` deferred right after playable (not on the critical path; keep ≤ ~400 KB), `sfx-skills` after core, `sfx-king` with King assets. Missing sound = silent, never an error; failures go to `/api/boot-report` as `asset-deferred`.

## 3. Hook-up (event → sound)
combo hit 1/2/3 → combo1/2/3 · slash, whirlwind, dash_strike→dash, earth_break, provoke, endure, punch on skill use (impact timed with the hit frame, not the key press) · crit → crit layered on hit · dodge · hero hurt / death · วุ้นจิ๋ว hop (occasional, near hero only), hit, death · King roar (spawn + phase), slam · loot pickup · potion use · UI click (buttons), ui_open (C/K/settings windows open) · job_change at the Angel · levelup (base + job level).
Server events already exist for most of these; do not add gameplay logic — audio only reacts to existing client/sim events.

## 4. Settings UI
Small painted settings panel (reuse the key-remap settings panel if it exists, add a เสียง section): sliders เอฟเฟกต์ / เพลง / บรรยากาศ + ปิดเสียงทั้งหมด, live preview click. Thai labels as live HTML. Mobile friendly. Keyboard: `M` toggles mute (add to `keys.ts` + tests, guide dialog, README).

## 5. Verify
`npm test`, `npm run build`. Browser desktop + mobile 390×844: no audio before first gesture, every mapped event plays once (log a dev-only list `window.__sfxLog`), volume sliders and mute persist after reload, no console errors, loop has no audible gap, cold-load critical bytes unchanged (compare with load-perf numbers). Report `.codex-run/sfx-report.json`: files, sprite sizes (KB), event→sound table, anything unmapped or off. Do not commit. Never touch the Railway production environment.
