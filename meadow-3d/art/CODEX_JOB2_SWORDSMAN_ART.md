# Codex task: Swordsman Job 2 art — Guardian ผู้พิทักษ์ and Berserker นักดาบคลั่ง (icons, hero motions, VFX, SFX)

Job 2 shipped in 6273507 with borrowed Swordsman art. Each new skill points at a first-job look through `visual` in `shared/data/skills.json`, and `meadow-3d/src/main.ts:46` swaps `skillId` for `visual` on every event:

| Job 2 skill | borrows | | Job 2 skill | borrows |
|---|---|---|---|---|
| shield_bash กระแทกโล่ | slash | | frenzy_slash ฟันคลั่ง | slash |
| bulwark ป้อมปราการ | endure | | blood_rage โลหิตเดือด | endure |
| quake_slam ทุบแผ่นดินไหว | earth_break | | blade_cyclone พายุใบมีด | whirlwind |
| rally_roar คำรามรวมพล | provoke | | leap_strike กระโจนฟัน | dash_strike |

The `icon` field also reuses cells of the 12-cell skill atlas. Goal: every Job 2 skill gets its own icon, every active skill gets its own Aerin motion, VFX and sound, and the Guardian/Berserker buffs and stun are visible in the world. Keep the look identical to the existing Aerin sprites and the swordsman skill art (ink-and-gouache, same proportions, palette, outfit, light from the upper-left, outline weight).

Read first: `art/CODEX_SWORDSMAN_SKILLS.md`, `art/CODEX_SWORDSMAN_MOTIONS.md`, `art/CODEX_SKILL_ICONS.md`, `art/CODEX_SFX.md`, `art/skills/PROMPTS.md`, `art/hero-skills/PROMPTS.md`, `art/hero-skills/packing-report.json`, `shared/data/skills.json` (the 12 `guardian` / `berserker` entries), `shared/src/schema.ts` (`icon`), `shared/src/game/sim.ts` (`look` at ~849, multi-hit at ~964, guard/reflect at ~690, rage at ~880), `meadow-3d/src/{main,skill-motions,painted-hero,skill-art,audio-events,skills-ui,hud-qol,assets}.ts`, `src/skills.css`, `src/skill-art.css`, `tools/pack-skill-art.mjs`, `tools/pack-hero-skills.py`, `tools/pack-audio.mjs`, `tests/skill-motions.test.mjs`.

## Art direction for the two branches
- **Guardian** — steady and heavy. Steel-blue and jade accents with old brass. Aerin has no shield in her idle/walk sheets, so the Guardian skills use a **summoned jade ward-shield**: a translucent round shield of pale jade light with a brass rim that forms on her left forearm at the start of the motion and fades at the end. Don't change the idle/walk/attack sheets or her outfit.
- **Berserker** — fast and reckless. Crimson and ember-orange accents, dark iron, motion smears. Her blade trails crimson, not white. Keep it storybook, with no blood spray or gore: rage reads as heat haze, embers and a red glow.
- No text, numbers, real-faith symbols or UI frames in any art. Original designs only.

## 1. Skill icons (built-in imagegen)
Make one 12-icon sheet in the style of `art/skills/skills-v1.png` (dark painted background, old-brass edging, painted pigment and warm ink, readable at 40 px). Lay it out as 4 columns × 3 rows with padding. Guardian icons sit on a slate-teal background, Berserker icons on a dark oxblood one, so the two job lines read apart in the skill book. The passive icons (cells 16, 17, 22, 23) use the same ring-style edging as the existing passives (sword mastery, iron body, sword rhythm).

| cell | skill | emblem |
|---|---|---|
| 12 | shield_bash | jade ward-shield driving forward, impact star at its rim |
| 13 | bulwark | ward-shield planted upright, a dome of jade light behind it |
| 14 | quake_slam | shield and sword striking the ground, concentric cracks |
| 15 | rally_roar | raised sword, steel-blue and gold banner-shaped shockwave |
| 16 | guardian_spirit (passive) | brass helm crest over a jade shield, calm glow |
| 17 | retribution (passive) | shield with a returning arrow of light bouncing off it |
| 18 | frenzy_slash | three crimson claw-like slash arcs |
| 19 | blood_rage | clenched gauntlet wreathed in red flame and embers |
| 20 | blade_cyclone | crimson ring of blades spinning, ember sparks |
| 21 | leap_strike | blade diving downward from an arc, ground crack below |
| 22 | berserk_soul (passive) | smouldering crimson eye inside a broken iron ring |
| 23 | bloodlust (passive) | a sword whose edge drips glowing red light into a small heart shape (stylised, not gore) |

Packing: build **one larger atlas**, not a second sheet, so the hotbar and skill book keep a single background image.
- New source `art/skills/skills-job2-v1.png` (your 4 × 3 sheet). New atlas `art/skills/skills-v2.png`: **4 columns × 6 rows, 64 px cells, 256 × 384 runtime.** Rows 0–2 are copied pixel-for-pixel from `skills-v1.png`; rows 3–5 are the new cells 12–23.
- `tools/pack-skill-art.mjs`: pack `skills-v2` (WebP q88, plus KTX2 only if v1 has it) and keep `skills-v1` packed until the switch is verified, then drop it from the pack list. The budget is ≤ 60 KB WebP.
- Switch the runtime to v2:
  - `main.ts:73` loads `skills-v2.png`.
  - `skill-art.css` fallback URL points at the v2 hash.
  - `skills.css` `.job-icon`: `background-size: 400% 600%` and `background-position: calc(var(--ix) * 100% / 3) calc(var(--iy) * 100% / 5)`.
  - Check the mobile overrides in `skills.css` (~327, ~348, ~560) and the hotbar `#job-hotbar` / `#skill-slots` grid. Icons must stay crisp and centred at 48 px desktop and the mobile size, and the grid layout must not change.
- Narrow `shared/` exception for this task only: in `shared/src/schema.ts` raise `icon` to `.max(23)`, and set the 12 Job 2 `icon` values in `skills.json` to 12–23 in the order above. Don't touch any other field in `shared/` (and leave `visual` alone, see §5).
- Append the prompts to `art/skills/PROMPTS.md`.

## 2. Hero skill motions (built-in imagegen → `tools/pack-hero-skills.py`)
Use the same frame layout as the six existing `hero-skill-<id>-v1` sheets:
- 384 × 256 cells, baseline 240 and the same anchor, so the sprite never jumps when switching from idle.
- 4 directions SE / SW / NE / NW, with the same rows and mirroring as the existing sheets.
- Packed width ≤ 2048, transparent background, no baked shadow.
- Sources go to `art/hero-skills/<id>-source-vN.png` with prompts in `art/hero-skills/PROMPTS.md`. Outputs go to `art/hero-skills/hero-skill-<id>-v1.png` and `-packed.png`, then KTX2 + WebP through `prepare-textures.py`. Add each motion to `packing-report.json`.

| skill | frames | contact / key frame | motion | timing source |
|---|---|---|---|---|
| shield_bash | 6 | 2 | ward-shield forms, short step, forearm shield punch, recoil | instant (cast 0) |
| bulwark | 5 | 3, then 3–4 loop | plant feet, shield up and sword low behind it, dome flares | instant buff, 10 s status `guard` |
| quake_slam | 9 | 6 | sword and shield raised overhead, stomp, both slam the ground (grounded, **no leap**, so it reads apart from earth_break) | cast 0.5 s, impact on `skillImpact` |
| rally_roar | 5 | 2 | sword raised high, chest out, roar, cape snaps | instant |
| frenzy_slash | 8 | 1, 3, 5 | three fast alternating cuts, forward lean, crimson smears | instant, 3 hits in one tick |
| blood_rage | 5 | 3, then 3–4 loop | hunch, fist clenched, head up, red flare bursts outward | instant buff, 12 s status `rage` |
| blade_cyclone | 8 | 1, 3, 5, 7 | low spinning cyclone with sword held out, 4 hits per spin | instant, 4 hits in one tick |
| leap_strike | 6 | 4 | crouch, leap along the dash path, airborne overhead, downward cut on landing, recover | `dash` effect 0.5 s, `dashTrail` event |

- Register each one in `skill-motions.ts`: add it to `SKILL_MOTIONS`, `SKILL_FRAMES`, `SKILL_DURATION` and `CONTACT_FRAME`.
  - Generalise the `earth_break` special case in `skillFrame` into a per-skill cast table (`earth_break .4`, `quake_slam .5`). quake_slam has a 0.5 s cast, so don't reuse the 0.4 constant.
  - Generalise the endure hold loop to bulwark and blood_rage.
  - Add a `leapHeight(elapsed)` curve for leap_strike (peak ≈ 1.0 m at the middle of the 0.5 s dash, 0 at landing). Shrink the shadow while airborne, the same way earth_break does.
  - Extend the `main.ts` contact logging (`pendingContacts`) so `quake_slam` is measured on `skillImpact`, like earth_break.
- **Multi-hit presentation.** The sim resolves frenzy_slash (3) and blade_cyclone (4) as several `hit` events in the same tick. Spread the presentation on the client only: delay each damage number, hit flash, hit VFX and hit SFX to its contact frame (hit *n* → contact *n*), and never touch the sim or the server clock. If this can't be done cleanly, write it up as a request for Claude to stage the hits in the sim the way whirlwind does (`whirlwindHits`). Don't change `shared/game` yourself.
- **Loading.** Load the 8 sheets deferred and **per job**. The Guardian sheets are requested only when the local hero or a visible remote hero is a Guardian, and the same for Berserker. Until a sheet is loaded, fall back to the borrowed motion. Keep the existing "release inactive skill GPU storage" behaviour in `painted-hero.ts` working for the new sheets.
- Put the new frames side by side with idle/walk/attack and the existing skill sheets. If the face, hair, outfit colours or scale drift, regenerate that frame. The ward-shield and the crimson trails are the only additions to her look.

## 3. VFX (`skill-art.ts`)
Make a new atlas `art/skills/skills-vfx-job2-v1.png` in the same style as `skills-vfx-v1`: **4 × 3 cells of 256 px, 1024 × 768 runtime**, transparent background, padding, no character, no text.

| cell | effect | use |
|---|---|---|
| 0 | jade shield-crest impact burst | shield_bash on target, size ≈ 2.4 |
| 1 | jade ward dome (upright) | bulwark aura |
| 2 | quake rings + shattered flagstones (ground) | quake_slam on `skillImpact`, sized to radius 3.2 |
| 3 | steel-blue/gold banner shockwave ring (ground) | rally_roar, sized to radius 8 |
| 4 | three crimson claw arcs | frenzy_slash, one per hit at the target |
| 5 | red rage flame aura (upright) | blood_rage aura |
| 6 | crimson blade-cyclone ring (ground) | blade_cyclone, radius 3 |
| 7 | crimson dive streak + landing crack | leap_strike on `dashTrail` (streak along the path, crack at `toX/toZ`) |
| 8 | stun stars (small ring of 3–4 gold stars) | stunned monsters, see below |
| 9 | small jade crest spark | guard absorbs a hit (`hurt` on a hero with `guard`) |
| 10 | ember motes ground puff | blood_rage start (HP cost) |
| 11 | jade return spark | retribution reflect (`hit` with `reflect:true`) at the monster |

- `painted()` hard-codes the 3 × 2 UV layout. Give it an atlas argument (`{map, cols, rows}`) so both atlases share the code path and the particle caps (32 HQ / 16 LOW, the lighter variant for other players).
- **Status auras.** Generalise the endure aura, which follows its owner while the status lasts, into `aura: statusId`. Use it for `guard` (bulwark, jade dome, cell 1) and `rage` (blood_rage, red flame, cell 5). While `rage` is active, also give the hero sprite a slight warm tint (about `#ffd2c8` multiply). The tint is client-only and must clear the moment the status ends.
- **Visible stun on monsters.** Draw cell 8 above each monster that has a `stun` status: a slowly rotating star ring at head height (use `e.boss ? 4 : 2.1`, like the status tags), with all stunned monsters in **one instanced draw**. Keep the text status tag but drop its `✧` glyph when the stars are shown. Also use the stars for the shield_bash stun on players in PVP.
- **HUD buffs.** In `hud-qol.ts`, add `guard: 'ป้อมปราการ'` and `rage: 'โลหิตเดือด'` to the buff names, use the matching skill-icon cell instead of the `✦` glyph, and use their real durations (guard 10 s, rage 12 s) in the `--remaining` ring instead of the `endure ? 8 : 60` fallback.
- Pack with `pack-skill-art.mjs` (UASTC/WebP 88, no mipmaps, deferred, ≤ 300 KB WebP). Load it with the Job 2 motions, only once someone with a Job 2 job is around.

## 4. SFX (`audio-events.ts`, `tools/pack-audio.mjs`)
Source sounds by the rules in `CODEX_SFX.md`: licensed sources recorded in `sfx-sources.json` and `picks.json`, or synthesised in `art/sfx-source/synth` the way `synth-hit-sfx.mjs` does it. Add the new ids to the `skills` set and loudness table in `pack-audio.mjs` (combat ≈ −16 LUFS) and pack them into the `sfx-skills` sprite. Total added size ≤ 120 KB.

| id | when | character |
|---|---|---|
| shield_bash | `skill` | hollow metallic shield thud plus a short jade chime |
| bulwark | `skill` | deep resonant ward hum rising, a soft glassy shimmer |
| quake_slam | `skillImpact` | heavy stone boom, debris rattle, low rumble tail |
| rally_roar | `skill` | warrior shout under a brass horn swell (not the provoke voice) |
| frenzy_slash | each staggered hit | quick crimson whoosh-cut, slight pitch rise per hit |
| blood_rage | `skill` | heartbeat thump, a hot flare whoosh, a low growl |
| blade_cyclone | `skill`, plus a light tick per staggered hit | sustained spinning blade whir |
| leap_strike | `skill` launch, plus a landing cut on `dashTrail` end | jump whoosh, then an impact slash |
| guard_block | `hurt` while `guard` is active (local hero only, 0.3 s cooldown) | short shield clang |
| reflect | `hit` with `reflect:true` | small bright ping |

- The `skill` case in `playEventAudio` keys on the first-job ids today. Key it on the real id first, then fall back to `visual`, so a skill without its own sound still plays the borrowed one.
- Keep the hit thock and material layers (`hit_thock` + `MATERIAL`) under the new hit sounds. Voice limits and pitch variation follow the existing rules.

## 5. Retiring the `visual` aliases
Make the client prefer the real art per skill, so each alias stops mattering as soon as that skill's art lands.
- `main.ts:46`: swap `skillId` for `visual` **only if the skill has no own art**. Use a registry exported from `skill-motions.ts` (e.g. `OWN_ART = new Set([...])`) that you fill skill by skill as each one passes review.
- `skill-art.ts` and `audio-events.ts` key on the real id first and fall back to `visual`.
- Don't edit `visual` in `skills.json`, and don't edit the sim's `look` mapping (`sim.ts` ~849, which also picks `p.attack` / `attackKind`). Once a skill's art is reviewed, Claude removes its `visual` and moves the sim timing to an explicit per-skill value.
- In the report, list for each skill whether it is ready for that removal.

## 6. Performance budgets
- Hero motions: ≤ 360 KB WebP and ≤ 360 KB KTX2 per motion. That is ≤ 1.5 MB per job for each format, all deferred and per job. Nothing new goes on the critical path. `prepare-textures.py` must keep the critical set unchanged; show the before/after critical bytes.
- Icons ≤ 60 KB. Job 2 VFX atlas ≤ 300 KB. SFX ≤ 120 KB added.
- At most 2 new materials in the scene: the VFX atlas and the stun-star instanced mesh. The hero sprite reuses its existing material.
- Measure in the meadow with 12+ monsters while spamming all 8 skills (4 per job, two runs), on desktop 1440 × 900 and mobile 390 × 844. Record FPS median and 1 % low, draw calls and texture memory. Regression must be ≤ 5 % against the same run with the borrowed art. Keep HQ ≥ 50 fps and LOW ≥ 30 fps with the 48-actor crowd benchmark.

## 7. Tests and verify
- **Tests.**
  - `tests/skill-motions.test.mjs` covers every new id: frame always < frame count, contact frame at t=0 for zero-cast skills, and the quake_slam cast table (frame ≤ pre-impact until 0.5 s, impact at contact).
  - A `leapHeight` test: 0 at both ends, ≤ 1.1 m peak.
  - Icon cells are unique per skill and within 0–23.
  - The alias swap happens only for skills missing from `OWN_ART`.
  - Multi-hit stagger offsets match the contact frames.
- **Commands.** `npm run check:meadow`, `npm test`, `npm run build`.
- **Headless contact check.** Use a dev/UAT-only fast job flag (never in production) to reach Guardian and Berserker. Trigger each of the 8 skills once and log the key frame against the hit-event time. Every hit, including each staggered hit, must land within 1 frame.
- **Art review.** In `art-review.html` / `src/art-review.ts`, add a `job2` stop set that shows the hero playing each new motion in all 4 directions, with the VFX on and a stunned monster. Have `tools/verify-world-art.py` capture it.
- **Screenshots** (`.codex-run/`, only these):
  - `job2-icons.jpg`: the skill book for both jobs, plus the hotbar at desktop and at 390 × 844.
  - `job2-motions-sheet.jpg`: a contact sheet of all new frames next to the old idle frame.
  - `job2-guardian.jpg`: bulwark dome, a quake_slam impact, and a stunned monster with stars.
  - `job2-berserker.jpg`: rage aura with tint, a blade_cyclone mid-spin, and a leap_strike mid-air.
  - `job2-mobile.jpg`.
- **Report** `.codex-run/job2-art-report.json`:
  - files changed
  - frames per motion and atlas KB (WebP/KTX2)
  - deferred and critical bytes before/after
  - FPS / draw-call table
  - contact-timing log
  - SFX sizes
  - per-skill readiness to drop `visual`
  - anything off-model or still borrowed

Rules (unchanged): don't change `server/`, and don't touch `shared/` beyond the `icon` exception in §1. Don't change damage numbers, cooldowns, cast times or collision. The small jelly is "วุ้นจิ๋ว". Don't touch the Railway production environment. Don't commit.
