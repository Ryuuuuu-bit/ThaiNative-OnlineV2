# Jelly Meadow — painted hero combat preview

A server-authoritative Three.js meadow, private per character by default. A small meadow contains 10 respawning slimes, a camp that restores HP, and a ราชาวุ้น unlocked after 6 defeats. The Express web shell now serves accounts, character selection and saved progress alongside the game.

From the repository root:

```sh
npm run dev:meadow
npm run test:meadow
npm run build:meadow
```

For the account API, also run `npm run dev:server`. Open the local URL printed by Vite, normally http://127.0.0.1:5173/. The portal is `/`; the selected-character game is `/play.html`. Visit `/character.html` for a separate animation viewer with motion/direction selection, pause and baseline guides. All five pages are included in the production build at `meadow-3d/dist/`.

## Controls

- WASD / arrows or ground click: move. Hold LMB / Space (legacy J) for the basic combo.
- Main bar **1 2 3 4 5**, extra bar **6 7 8 9 0**. Default swordsman: slash, whirlwind, dash strike, earth break, Endure; extra6 Provoke. Villager slot1: punch (learn it with the initial point in K).
- Shift: dodge. R: potion. F (legacy T): AUTO. Tab: next target. C: stats. K: skills. Escape: pause/menu; the server world continues.
- Q/E are free for remapping. In K, learn with `+`, review current→next numbers, then confirm/cancel. Drag a learned active skill into a slot, or tap a skill then tap a slot. Right-click a slot to clear. Key settings and hotbar are saved on the server; reserved movement/menu keys and duplicates are rejected. Restore default keys with the reset button.
- Mobile: joystick, five main skill buttons, More for6–0, separate attack/dodge/potion/AUTO controls. Text-heavy panels stop local controls, not the authoritative world.
- Talk to the painted Angel near camp at Job Lv10 to become a swordsman. Other branches are locked. Punch converts to fighter_basics at its learned level (ATK+1 and HP+1%/Lv); it leaves the active list/bar. Basic attack, dodge and potion remain innate controls, not learnable villager skills.


## Implementation

`src/sim.ts` owns fixed-step gameplay outside the renderer. `src/painted-hero.ts` displays the hand-painted hero on a camera-facing sprite with depth occlusion, an anchored baseline and a ground shadow. `src/sprite-animation.ts` selects four screen-relative directions and idle/run/attack/skill/reaction frames. `src/actors.ts` retains the earlier articulated 3D hero as a loading/error fallback and a minimal missing-texture jelly silhouette. `src/scene.ts` defines the painted meadow, instanced billboard vegetation, pond, bridge, camp and ruins. `src/main.ts` connects rendering, HUD, inputs and visual effects. `src/audio.ts` synthesizes original background notes, ambience and combat sounds with Web Audio.

The current hero is original AI-generated painted sprite artwork, with thin ink lines, teal cloth, ivory sleeves and gold embroidery. The built-in imagegen tool produced a turnaround, whole motion sheets and a corrected SE run strip. All source files and exact prompts are preserved under `art/painted-hero/`; the game uses separately packed `public/assets/hero-painted/*-v1.png` files. Each direction has one idle drawing with slight runtime breathing, six run frames and six sword-attack frames. The three-hit combo replays the sword sequence. Dedicated painted spin, meteor cast, three-frame hit, three-frame dodge, and six-frame death sequences cover all four directions. Death holds its final frame after 0.9 seconds; the revive overlay waits 1.5 seconds so the fall is visible. Hurt tint and invulnerability blink remain. Missing motion textures fall back to idle, with the 3D actor retained when no idle texture is available.

`tools/prepare-painted.py` stages references using the sprite-pipeline canvas helper. `tools/pack-painted.py` extracts connected figures, uses a shared scale and torso anchor, preserves transparent alpha, and packs rectangular 384x256 cells so extended swords are not cut off. The runtime atlases total about 1.6 MB; higher-resolution preview atlases load only on the animation viewer. The packing report records frame bounds, source order and opposite foot contacts in frames 1 and 4 for all four directions. The plugin's strip normalizer was also run into `normalizer-audit-SE`; the final packer uses smooth resampling and additional lateral space for painted art. The preview-sheet helper produces the contact sheets for visual inspection.

Dedicated hit and dodge use separate three-column atlases, while spin/cast/death use six columns. Death cells are 512×256; other motion cells are 384×256. New source canvases use one uniform scale to fit long sword/cape sweeps; the packing report records their one-time conversion to legacy source coordinates so all runtime motions match the existing hero size.

The environment now uses 35 original built-in-imagegen painted props: four tree variants, bushes, ferns, flowers, grasses, mossy rocks/log/stump, camp pieces, ruins, reeds and a bridge. Sources and every prompt are under `art/painted-env/`. `tools/pack-env.py` isolates connected figures, records ground anchors from the bottom 15% of opaque pixels, normalizes physical source sizes at 113 pixels/world unit, and downsamples ×0.5 into one 2048×2048 runtime atlas (about 1.65 MB). `public/assets/env-painted/manifest.json` records all sizes, UVs, anchors and five 1024×1024 surface maps; the replacement meadow grass also remains at the original public path. HD sources and the environment contact preview stay outside `public/`.

Large props use alpha-tested, depth-writing Sprites sharing an atlas texture, with alpha-mapped shadow proxies. Smaller foliage uses camera-facing instanced quads at the same fixed camera angle. Contact shadows share one instanced draw. The generated transition brush blends dirt into the ground; the pond has a painted water map with a 0.0015 UV ripple amplitude. LOW disables ripple motion and directional shadows. The simulation retains the original obstacle radii and water/bridge walkability. Jellies use painted billboard motion atlases with per-instance hue shifts. Warm lighting, a mild desaturation grade and a soft vignette match the painted art; skill effects remain additive. UI fonts are Noto Sans Thai and Cormorant Garamond via Google Fonts, with system fallbacks. Vite ignores art/assets in its file watcher to avoid Windows EBUSY errors during large image writes; refresh after repacking textures.


## Limits

Single-player only. Accounts and selected-character progress persist in the configured server store; MemoryStore is temporary, while Postgres survives process restarts. Parties, MMO combat, trading and PvP are not included. Art is a playable 2.5D prototype, not a reproduction of the reference game's production quality. The generated sprite frames still have some pose, facial and costume drift; the run cadence and direction transitions need further animation polish. Four directions are provided, not eight. Audio is synthesized demo audio. Browser performance depends on GPU/device; HQ/LOW and zoom are available.

## Verification

`npm run check:meadow`, `npm run test:meadow` (21 tests), and `npm run build:meadow` pass. The build retains Vite's warning about the large Three.js game chunk.

Before environment work started, the hero browser pass verified Q/spin, F/cast, Space/dodge, an actual slime hit, a normal gameplay death, frame-six hold, revival, all new viewer motions/directions, and missing-texture fallback. The required `.codex-run/motions-{spin,cast,hit,death}.jpg` screenshots and browser diagnostics are saved. Original idle/run/attack atlas SHA-256 hashes remained unchanged. Packing found no clipping/slot warnings, opposite run contact feet in all four directions, and lowest/widest final death poses in all four directions.

After environment integration, browser checks visited camp, ruins, pond/bridge, and a tree-dense corner at 1280×720, verified HQ/LOW shadow and ripple states, checked spin art, and captured a 390×844 view. No console, shader, page, or HTTP errors were recorded. `.codex-run/env-{camp,ruins,pond,trees}.jpg` contains the required views. The environment manifest tests check atlas bounds/overlap, UVs, physical size conversion, anchors and surface-map dimensions.

Comparable HQ samples on headless Chrome with SwiftShader at 1280×720 (120 rAF intervals after a 3-second warm-up) measured **6.86 FPS before → 13.53 FPS after**, with **929 → 339 draw calls** and **365,698 → 79,216 triangles** at the starting camera. These are software-renderer measurements, not physical-device/GPU benchmarks. Raw numbers are in `.codex-run/env-baseline.json` and `env-after.json`.

Small generated face/costume/sword-length differences remain between hero frames. The environment is intentionally static painted art; simple flame/skill geometry remains a style difference. All environmental source figures are isolated without crossing/cropped atlas bounds. No server files were changed.

## Painted jellies and King encounter

The original leaf-sprout species is named วุ้นจิ๋ว; the mint and sky elites are วุ้นเขียว and วุ้นฟ้า. `src/painted-monster.ts` shares atlas textures but keeps frame, hue, hit-flash and phase uniforms independent per actor. Its alpha-aware picking ignores transparent padding. Ground shadows stay anchored; hop/leap height comes from the drawings. `src/monster-animation.ts` selects four velocity-derived directions and timed frames from generated `src/monster-motion-data.ts`. A missing motion falls back to idle, and a missing species texture uses one minimal unlit silhouette.

After six defeats, ราชาวุ้น cycles slam, sweep, charge, spit and summon. Ground warnings precede damage. Slam gives a 1.25-second stun window with 25% extra damage received. Spit launches three painted projectiles; summon creates three jellies. At half HP, ราชาวุ้นกริ้ว transforms for 1.6 seconds, then runs its pattern 30% faster with shorter recovery. Phase two uses the same frames, a deeper magenta hue, warm crown glow and a generated angry facial overlay; back views remain faceless. Small enemies drop loot after their 0.75-second death; the King waits for its 1.8-second death. Final puddles hold and then fade. Summons do not respawn; repeated casts cap living summons at nine. Camp healing, potions, defeat recovery and the original unlock rule remain.

Artwork and exact prompts are under `art/painted-monsters/`. `tools/prepare-monsters.py` normalizes source canvases; `tools/pack-monsters.py` extracts connected figure groups, preserves detached crowns and minions, packs fixed bottom-centre anchors, produces glow masks and facial placement metadata, and generates 64 contact sheets. `tools/painted_components.py` shares the extraction helper. Run preparation before packing when replacing generated source sheets. Canonical small sheets are 1536×512; King sheets are 3072×1024. The runtime manifest contains four small-jelly motions in 384×256 cells and twelve King motions in 768×512 cells: sixteen atlases, 192 directional frames, twelve crown masks and one small phase-two facial overlay. No second full phase-two set is shipped. See `art/painted-monsters/packing-report.json` for bounds and clipping checks.

The pond uses a new versioned `public/assets/env-painted/tile-water-v2.png`, recoloured to muted slate blue-green. A feathered dirt-texture shore blends into grass, and the water itself fades at the rim. The original 0.0015 UV ripple amplitude remains; LOW uses the same soft edge without animated ripples. Water has no emissive or bloom pass. Three additional reed clumps sit at the bank. All pre-existing hero and environment PNGs are preserved.

The added monster tests cover telegraph/lunge timing, attack cycling, slam stun, three-projectile volleys, three-minion casts, phase transitions, faster timing, death/loot order, non-respawning summons, frame selection and manifest geometry. Some hand-painted mass, breathing amplitude, crown and facial placement variation remains across extreme poses; four-direction transitions are intentionally discrete.

The final monster pass completed `check:meadow`, all 21 tests and `build:meadow`. A normal-input browser run defeated six jellies, exercised all five King attacks, observed exactly one phase transition and a three-minion cast, then reached victory after the six-frame King death hold. It recorded no browser errors. Separate checks verified missing-image silhouettes and HQ/LOW pond states. The five requested screenshots, raw browser snapshots, packing diagnostics, preservation hashes and complete file inventory are in `.codex-run/monsters-report.json` and its referenced artifacts.

Comparable initial-camera HQ SwiftShader samples measured **13.72 → 14.59 FPS**, **339 → 192 draw calls**, and **79,216 → 7,640 triangles** (1280×720, 120 rAF intervals after a three-second warm-up). This is a software-renderer comparison with ten small jellies, not a physical GPU benchmark. All 269 pre-existing hero/environment PNG hashes matched; the water v2 file is additional. No server files were changed. Vite still reports its existing large game-chunk warning.

## Painted skill icons

The five active hotbar buttons share a generated ink-and-gouache icon strip on desktop and touch. The sixth leaf sigil is used by the AUTO hunt toggle with a CSS rotation glyph. Source art and the exact built-in imagegen prompt are in `art/painted-ui/`; `tools/pack-icons.py` trims each of the six 512px source slots and proportionally centres the artwork on transparent 128px and 64px cells. Runtime files are `public/assets/ui-painted/skill-icons-v1.png` (768×128), `skill-icons-64-v1.png` (384×64), and `manifest.json`. The HUD uses the 128px strip for crisp HiDPI display at 52px on desktop and 40px on mobile.

CSS darkens only the icon with a conic cooldown wedge, while a numeric timer stays readable above it. A soft gold rim means ready; unavailable MP/potions desaturate the icon, and pressing scales the button down. Key labels, Thai names, potion count and MP badges remain visible; the existing 63×64 desktop and 46×57 mobile button dimensions are retained. The spare sigil is deliberately quiet. The dash boot and individual wind leaves become secondary details at mobile size, but their main silhouettes remain distinct.

## Web portal and saved characters

`npm run build` compiles the Express server and five-page web build; `npm start` serves both on port 8787 (or `PORT`). See `server/README.md` for environment variables, routes, guest recovery, Google authorised origins and persistence choices. The new portal painting and exact prompt are in `art/painted-web/`; only two JPEG versions ship under `public/assets/web/`. No existing public PNGs are modified. The shared `mountPreview` API in `src/character-preview.ts` drives both character creation and the public atelier; atelier controls live in `src/character-atelier.ts`.

Guest sessions can be recovered with the browser’s locally stored recovery key. Linking Google keeps the characters. Three slots per account, globally unique names and deletion confirmation are enforced by the API. The play page restores level, XP, gold, defeats, potions and a valid position before opening the welcome screen. A small corner toast reports server saves. Boss/combat state restarts on re-entry, while saved defeats retain the unlock. Production Google sign-in needs the owner’s OAuth client ID/origins; memory mode is explicitly temporary.

## AUTO hunt verification

AUTO makes strategic decisions every 0.2 seconds; defensive telegraph checks run at the fixed simulation step to hit the 0.15-second dodge window. A bounded grid route avoids rocks and water while manual ground clicks retain direct steering. Retreat holds within the camp healing zone, attacks followers in reach, and resumes at 90% HP. The leaf sigil uses the existing strip; no PNGs or server source changed.

Typecheck, all 44 tests (31 sim/assets, 12 server, one web build) and the full production build passed. A fresh-character browser run with only one AUTO click earned six defeats and started the King slam in about 14 simulation seconds (25.5 kills/minute to engagement; about 16.3 per wall minute under SwiftShader). This is a short smoke rate, not a sustained farming benchmark. Keyboard/joystick cancellation and manual skill coexistence passed. Desktop and 390×844 screenshots were visually reviewed; no stuck cases or runtime errors were observed. Evidence and choices are in `.codex-run/auto-hunt-report.json`; screenshots are `auto-hunt.jpg` and `auto-hunt-mobile.jpg`. The existing large-chunk build warning remains.

## WASD-friendly hotkeys verification

Bindings now live in `src/keys.ts`, imported by the input controller and `tests/keys.test.mjs`. Primary button hints are SPACE / Q / E / SHIFT / R / F; J and T remain aliases. E casts meteor, and Space attacks. Tab cycles the current distance ordering of living enemies and prevents browser focus movement during active play. Touch keeps the Thai labels and hides keyboard hints on coarse pointers.

A ground click walks immediately. After a stationary 180ms hold, an already selected in-range target can be attacked; dragging more than 6px keeps ground steering. Holding on a painted jelly selects it first, approaches and repeats the combo. Release/cancel, pause, help, blur and death clear the held pointer.

The final typecheck, all 48 tests (35 meadow, 12 server, one web build) and full build passed. The normal-input browser pass verified WASD, both Shift keys, held LMB/Space/J, E meteor, F/T AUTO, twelve Tab presses with exact event-time distance ordering and focus retention, single ground clicks, ground holds/drags, attack release, and a real touch-context joystick interrupt. `.codex-run/hotkeys.jpg` was visually inspected, and results were appended under `hotkeys` in `.codex-run/auto-hunt-report.json`. No runtime errors or stuck cases appeared. No server source or PNGs changed and no commit was made.

A final route regression also covers a jelly standing in the narrow gap between enemy collision clearance and AUTO route clearance beside a rock. AUTO uses a valid melee approach point in that case, avoiding a possible wait outside attack reach.

## Authoritative rooms

Combat moved to `shared/src/game/sim.ts`; the old client sim file exports only presentation constants/types. The browser predicts movement, renders100ms interpolation and immediate swing poses, and sends intents to `/api/ws`. HP, damage, kills, loot, level, XP, gold, potions, AUTO and saves come from the server. No progress POST/beacon remains. Packet/build mismatches request a reload; reconnect preserves a room for60s. Use the normal build/start commands; Vite's development proxy also supports WebSockets.

AUTO continues in background tabs. The pause/help/victory overlays cannot freeze a server world; Escape stops local movement/AUTO. A room that has already defeated the King retains that encounter through reload within60s. The optional SHARED_ROOMS=1 mode displays other painted heroes and shares nearest-player enemy targeting, top-damage loot and one King unlock counter. It is off by default.

See `server/README.md` for persistence, protocol, metrics, retention and local load testing. The runtime data change report, browser evidence and 1/20-client measurements are in `.codex-run/server-authority-report.json`, with `net-play.jpg` and `net-reconnect.jpg`. Artwork PNGs and page markup are unchanged. No Railway environment or deployment was touched.

Authoritative integration passes86 tests, frontend typecheck and the full build. At nominal variance versus the starter jelly, combo damage is now15/15/27 (was16/16/28), spin33 (38), physical-fire meteor51 (58), defaultHP126 (120), defaultSP68.64 (80), potion72 (65), and SP recovery~0.27/s (4/s). Pools keep floats internally; HUD HP uses ceilings and spendable SP uses floors. The King’s four nominal attack strengths are preserved through data coefficients; player hit/crit/variance rolls are now real. These changes come from the pushed stats data, except the explicitly documented King pattern calibration. All changes, level curves and gameplay differences are catalogued in the report.

## Jobs and swordsman skills

`shared/data/jobs.json` is the job tree and independent Job EXP curve. Each Job level, including1, grants one point:10/50/70 per tier. Unspent points carry through changes; learned skills remain except punch's passive conversion. Villager requires10900 Job EXP to reach10 (about606 pink-jelly equivalents). The initial2180 curve took only3.7minutes under AUTO; the final5× curve averages about14.5minutes over five seeded20Hz runs with immediate punch upgrades. Manual play and downtime vary. Monsters grant rounded75% base EXP as Job EXP. Tier2 requires Job40 but remains unavailable pending its NPC quest. Names for the other tier2 stubs are provisional because the supplied brief names only guardian/berserker.

SQL004 migrates old novice_knight characters to swordsman; SQL005 applies the owner follow-up once. Legacy swordsmen retain whirlwind1/earth_break1 and receive the initial-level point difference, cap50 unspent, fighter_basics0. Only exact old default hotbars are replaced; custom mappings survive. Removed first_aid/survival ranks are refunded if present in a partial earlier save. JSON skill/hotbar changes are saved immediately by WebSocket intents, never client progress POSTs.

For **local UAT only**, start the local server with `UAT_JOB_EXP_MULTIPLIER=1000`; it accelerates earned kill Job EXP without granting arbitrary client state. Production (`NODE_ENV=production` or Railway environment) forces the multiplier to1. Never use a production service for these tests. The flag is off by default. `npm test`, `npm run build`, `npm run sim:balance` cover the shared/server/client contracts.

Whirlwind was tuned from2×70% to2×110% atLv1, still2×135% atLv10: neutral weapon element and per-hit defence made the literal draft default take102s against the retuned King. The final abstract balance model measures about87.5s for Lv1 swordsman with only whirlwind1/earth_break1; King HP1500 is unchanged. The model reports offensive TTK and survival separately; it does not reproduce movement, potions, scripted boss windows or skill CC.

Original painted Angel,12-cell64px icon atlas and6-cell VFX sources/prompts are under `art/skills/`; repack with `node meadow-3d/tools/pack-skill-art.mjs`. Runtime uses hashed KTX2/WebP and deferred VFX. Existing cast/dodge/attack poses plus a visual leap and afterimages cover the new skills. Historical sections below describe earlier milestones and their old controls/assets.

### Sound settings

Press **M** (or the music-note button) to toggle mute. Open **K ? ??????????? / ?????** for live effects, music and ambience sliders. Settings save per character on the server with localStorage fallback. Audio unlocks on the first click, key or touch; sprites download after playable, with King sounds alongside King artwork. No music track is currently supplied; the music bus and its preview are ready for one.

Run `npm run pack:audio` to rebuild hashed Opus/AAC sprites from `art/sfx-source/picks.json`. The ambience uses `amb_meadow_loop.mp3` with a 1.5-second circular crossfade; `amb_meadow_loop_b.mp3` is a source-only spare. In development, `window.__sfxLog` records actual SFX playback (up to 256 entries).

Inventory: **I** opens กระเป๋า (equipment tab, weight, consumables and materials). **R** uses the best owned red potion. Visit พ่อค้าเบ็ดเตล็ด (east city market) or ช่างตีเหล็ก (west) to buy/sell. Loot belongs to top damage for 10 seconds; AUTO only collects your drops and can be disabled in the bag. At 50% weight regeneration stops; at 90% attacks stop.
Economy: schema `server/sql/009_items.sql` applies on local server initialization; each inventory request requires a UUID and commits inventory, gold, ledger and its cached response atomically. Requests deduplicate for 24 hours. Authenticated configured admins can POST `/api/admin/economy/integrity`; a daily server check logs `ECONOMY_ALERT` on mismatch. Run migrations only against an explicitly chosen development database.

### หน้าจอและความสะดวก
H กลับเมือง: ร่าย 5 วินาที ยกเลิกเมื่อเดินหรือรับความเสียหาย พัก 60 วินาที ใช้ไม่ได้ระหว่างสู้ราชาวุ้น
Z เก็บของของฉันหรือของอิสระในระยะ 4 เมตร (มือถือแตะ เก็บรอบตัว)
คลิกชาวเมืองเพื่อเดินไปคุย คลิกสัญลักษณ์ชาวเมืองหรือประตูบนแผนที่ย่อเพื่อเดินตามเส้นทาง กดปุ่มเดินเพื่อยกเลิก
เมนู → ตั้งค่า: ขนาด UI 90/100/110/120%, เปลี่ยนปุ่ม H/Z และคืนตำแหน่งหน้าต่าง ลากหัวหน้าต่างกระเป๋า สเตตัส และสกิลเพื่อบันทึกตำแหน่งต่อบัญชี
