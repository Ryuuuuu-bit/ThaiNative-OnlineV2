# Codex task: swordsman skill motions + combat feel polish (Aerin)

Today the 6 swordsman active skills reuse old hero poses (attack/spin/dodge/cast) plus painted VFX (see `.codex-run/swordsman-skills-report.json`). Goal: each skill gets its own painted Aerin motion in the same ink-and-gouache style, and hits feel weighty. Owner asked for this overnight; keep the look identical to the existing Aerin sprites (same proportions, palette, outfit, lighting direction, outline weight).

Read first: `meadow-3d/src/{painted-hero,sprite-animation,skill-art,main,assets}.ts`, `meadow-3d/art/*/PROMPTS.md` (hero motion prompts), `meadow-3d/tools/pack-*.mjs` / `tools/pack-ktx2.mjs`, `public/texture-manifest.json`, `shared/data/skills.json`, `art/CODEX_LOAD_PERF.md` (critical vs deferred loading).

## 1. New hero motions (built-in imagegen → existing atlas pipeline)
| skill | motion | frames (approx) | key frame |
|---|---|---|---|
| slash ฟันเฉือน | diagonal power cut, step-in | 6 | contact frame 3 |
| whirlwind ฟันพายุ | 360° spin with blade trail, 2 hits | 8 | hits on 3 and 6 |
| dash_strike พุ่งทะยาน | low lunge thrust, body stretched | 5 | thrust frame 2–3, afterimages |
| earth_break ตอกพสุธา | crouch → leap → overhead slam into ground | 9 | impact frame 7 (after the existing 0.4 s cast) |
| provoke คำรามท้าศึก | chest-out roar, sword planted | 5 | roar frame 3 |
| endure ใจเหล็ก | brace, sword vertical, golden glow | 5 | hold frame 4 loops while buff starts |
- All 8 directions only if the existing hero motions use 8; otherwise match what they use (mirror where they mirror).
- Same frame size/anchor as current hero sheets so the sprite does not jump. Transparent background, no baked shadows (runtime shadow stays).
- Write prompts to `art/hero-skills/PROMPTS.md`; source PNGs in `art/hero-skills/`; ship KTX2 + WebP via the existing packer; **deferred load** (not on the critical path), fall back to the old pose until loaded.
- Visual check against the current idle/walk/attack frames side by side; if a frame drifts off-model (face, hair, outfit colours), regenerate it. Note any frame you could not fix.

## 2. Hook-up & timing
- Each skill plays its own motion; damage/VFX/SFX fire on the key frame (sim already has hit timings — align animation to the sim, never the other way round; do not change damage numbers or cooldowns).
- earth_break: hero sprite actually rises and lands (vertical offset curve), shadow shrinks while airborne, dust ring + existing crack VFX on landing.
- dash_strike: 2–3 fading afterimages along the path.
- Movement locked during motions that already lock in the sim; cancel rules unchanged.

## 3. Combat feel (client-only, subtle, all toggleable in settings "ภาพสั่น/หยุดภาพ")
- Hit stop: 40 ms on normal hits by the player, 80 ms on crit, 120 ms on earth_break impact (freeze only the involved sprites + VFX, never the server clock).
- Camera shake: small on crit, medium on earth_break/King slam; respects reduced-motion (`prefers-reduced-motion`) and the setting.
- Hit flash on monsters (white tint 60 ms) and a tiny knockback nudge for vุ้นจิ๋ว (visual only).
- Combo 1→2→3 basic attack: make sure each step shows a distinct frame and the 3rd hit feels heavier (bigger arc VFX already exists — scale it).

## 4. Performance guard (owner worried about lag on the web)
- Measure before/after on desktop 1440×900 and mobile 390×844 emulation in the meadow with 12+ monsters and spamming skills: FPS (median and 1 % low), draw calls, texture memory. Must not regress more than 5 %.
- Add an automatic quality step-down if FPS < 45 for 3 s on desktop / < 28 on mobile: lower pixel ratio, fewer particles, cheaper shadows; never below the current "low" look. Show it in the HQ panel as "อัตโนมัติ".
- Cap simultaneous VFX particles; other players' VFX (future multiplayer) use a lighter variant flag.

## 5. Verify
`npm test`, `npm run build`. One headless run that triggers each skill once and logs key-frame vs hit-event time (should be within 1 frame). Screenshots, only these: `.codex-run/motions-sheet.jpg` (contact sheet of all new frames next to the old idle frame) and `.codex-run/motions-earth-break.jpg` (mid-air frame in game). Report `.codex-run/swordsman-motions-report.json` (frames per motion, atlas sizes KB, deferred bytes, FPS before/after, auto-quality thresholds, anything off-model). Do not commit. Never touch the Railway production environment.
