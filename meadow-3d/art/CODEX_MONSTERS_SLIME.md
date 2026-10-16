# Codex task: painted slime monster, King Slime boss kit, pond water fix (meadow-3d)

Read first: `meadow-3d/README.md`, `meadow-3d/art/painted-hero/PROMPTS.md`, `meadow-3d/art/painted-env/PROMPTS.md`, `meadow-3d/tools/pack-painted.py`, `meadow-3d/tools/pack-env.py`, `meadow-3d/src/actors.ts`, `meadow-3d/src/sim.ts`, `meadow-3d/src/scene.ts`, `meadow-3d/src/main.ts`, `meadow-3d/src/painted-hero.ts`, `meadow-3d/src/sprite-animation.ts`.

The 3D slimes are now the only non-painted thing in the meadow. Replace them with painted sprites in the same ink-and-gouache storybook style, turn the King into a real boss with a full motion kit and two phases, and fix the pond water. Do not change the hero or environment art.

## Part A — "วุ้นจิ๋ว" (small jelly slime), 4 directions

Original design (not Poring; do not use that name anywhere): a soft translucent pink jelly blob, teardrop-round, slightly glossy, two small dark eyes with a highlight, tiny mouth, pale cheek blush, a single tiny leaf sprout on top, no limbs. Compact, about 60 % of the hero's height. Same painterly linework and soft watercolour shading as Aerin, same slightly elevated orthographic view, light from the upper-left, transparent alpha, no ground, no shadow, no VFX, no text.

Make a turnaround seed first (2×2 cells like the hero: SE, SW, NE, NW; the back views show the leaf sprout from behind and no face). Then one `slime-<DIR>-v1.png` sheet per direction: EXACTLY 2 rows × 6 equal 256×256 slots, transparent, feet/bottom at about y=240 in the slot, constant scale.
- TOP ROW: 1–3 IDLE breathing (squash down, neutral, stretch up — subtle); 4–6 HOP cycle (crouch squash, airborne stretched up with bottom lifted, landing splat wider than tall).
- BOTTOM ROW: 1–3 ATTACK (lean back wind-up, lunge forward with a wobble, recoil); 4–6 DEATH (deflate, spread into a puddle, flattened puddle with the eyes closed as X — the final frame is the hold frame).

Variants without new art: the game tints the same sprite for a "วุ้นเขียว" (mint green) and "วุ้นฟ้า" (sky blue) elite using a hue shift in the material; add that material option.

## Part B — "ราชาวุ้น" (King Slime) boss kit, 4 directions, two phases

Design: the same jelly species but 2.5× the hero's height, a small tarnished gold crown with a red gem tilted on top, a tiny ragged royal cape stuck on its back, a bigger confident grin, faint lighter blotches inside the jelly. Phase 2 ("ราชาวุ้นกริ้ว"): deeper magenta tint, crown glowing, angry brows, eyes narrowed — produce phase 2 as a recolour/overlay pass of the same frames (hue + glow mask), not a second full set.

Canvas: because it is large, use 512×512 slots (2 rows × 6 columns on a 3072×1024 transparent canvas) and keep the anchor at the bottom centre. Sheets per direction:
- `king-base-<DIR>-v1.png`: TOP ROW idle 1–3 (slow breathing), move 4–6 (heavy hop: crouch, airborne, big landing splat). BOTTOM ROW hit 1–2 (jiggle flinch), stun 3–4 (eyes spiral, body sagging), roar/cast 5–6 (rears up tall, mouth open, crown tilting).
- `king-attacks-<DIR>-v1.png`: TOP ROW body slam (1 crouch wind-up, 2 leap high, 3 impact flattened wide, 4 rebound), tail/sweep spin (5 twist wind-up, 6 wide horizontal smear turn). BOTTOM ROW charge/ram (1 lean back, 2 stretched forward mid-charge, 3 skid stop), spit volley (4 inflate cheeks, 5 spit forward with small jelly blobs leaving the mouth, 6 recover).
- `king-special-<DIR>-v1.png`: TOP ROW summon minions (1 shiver, 2 bulge, 3 three small jellies popping out of the body, 4 settle); phase-2 transformation (5 swelling with cracks of light, 6 fully enraged pose). BOTTOM ROW death (1 stagger, 2 crown falling off, 3 deflating, 4 collapsing sideways, 5 puddle spreading, 6 final flattened puddle with the crown resting beside it — hold frame).

That gives the boss 13 motions: idle, move, hit, stun, roar, slam, sweep, charge, spit, summon, transform, death, plus the phase-2 tint. Every attack must have a readable wind-up frame.

## Part C — packing

Add `tools/pack-monsters.py` reusing the connected-component extraction and bottom-centre anchor from `pack-painted.py`; pack `public/assets/monsters-painted/slime-<motion>-v1.png` (384×256 cells, 4 direction rows) and `king-<motion>-v1.png` (768×512 cells). Write `manifest.json` with frames, durations and anchors; produce contact-sheet previews; report any clipping.

## Part D — engine

- New `src/painted-monster.ts`: billboard sprite actor like `painted-hero.ts` with a per-instance tint/hue option, contact shadow, direction from velocity (4 screen-relative directions), motion state machine driven by the sim.
- `src/sim.ts` / `src/actors.ts`: slimes use the painted actor (idle, hop while moving, attack telegraph → lunge, death puddle then fade). King Slime boss: HP bar at the top of the screen with the name, attack pattern cycling slam / sweep / charge / spit / summon with the existing red ground-telegraph circles, stun window after a slam, phase 2 at 50 % HP with the tint change, the transformation motion and faster pattern, summon spawns 3 small slimes, death motion then loot. Keep the existing unlock rule (after 6 defeats) and the camp/revive flow.
- Hit flash: brief white tint on the sprite; small jelly-droplet particles on hit and death.
- Remove the 3D slime code path once the sprites load (keep a minimal fallback for a missing texture).

## Part E — pond water

Replace the flat teal with a painted look: `tile-water` recoloured to a muted blue-green matching the palette of the grass and ruins (less saturation, slightly darker), soft painted edge band (sandy/muddy shore ring with a transparent alpha falloff) so the water does not end in a hard oval, the gentle ripple shader kept at low amplitude, and 2–3 more reed/lily clumps around the rim. Also check the water does not bloom.

## Verification

`npm run check:meadow`, `npm run test:meadow` (add tests for slime/king state machines and the pack manifest), `npm run build:meadow`. Browser smoke test: kill a slime, trigger each King attack at least once, reach phase 2, kill the King. Screenshots to `.codex-run/monsters-slime.jpg`, `monsters-king-slam.jpg`, `monsters-king-phase2.jpg`, `monsters-king-death.jpg`, `env-pond-v2.jpg`. Report FPS as before. Do not touch `server/`.

Reply with the list of new/changed files, the manifest summary and anything that still looks off.
