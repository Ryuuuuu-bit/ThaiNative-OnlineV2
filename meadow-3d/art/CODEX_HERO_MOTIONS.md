# Codex task: dedicated painted motions for Aerin (meadow-3d)

Read first: `meadow-3d/README.md`, `meadow-3d/art/painted-hero/PROMPTS.md`, `meadow-3d/tools/pack-painted.py`, `meadow-3d/src/sprite-animation.ts`, `meadow-3d/src/painted-hero.ts`, `meadow-3d/src/sim.ts`, `meadow-3d/src/main.ts`.

The painted hero currently reuses the 6-frame sword attack art for whirlwind (Q), meteor (F) and the combo, uses the run art with a lean for dodge, and rotates the sprite for death. Replace those placeholders with dedicated hand-painted frames in all four existing directions (SE, SW, NE, NW), in exactly the same identity, costume, scale, linework and canvas method as the existing motion sheets. Do not change the existing idle/run/attack art.

## 1. Artwork (built-in imagegen, identity-preserve, same method as the motion sheets)

Use the same reference canvases and identity seeds (`seed-<DIR>.png`, `edit-canvas-<DIR>.png`) and the same sheet layout: EXACTLY 2 rows × 6 equal 256×256 slots on a 1536×512 transparent canvas, feet at about y=240 in the slot, identical character scale (about 204 px hair top to ground), genuine transparent alpha, no ground, shadows, VFX, labels or scenery, nothing cropped. One sheet per direction per file, saved under `meadow-3d/art/painted-hero/`:

### `skills-<DIR>-v1.png`
TOP ROW — WHIRLWIND SPIN, a full 360° turn, so the torso facing CHANGES across the row (this is intentional, unlike the other sheets):
1 guard matching the reference, facing <DIR>; 2 wind-up: knees bent, sword pulled back across the body, cape swinging; 3 torso rotated a quarter turn clockwise, blade held out horizontally at waist height, arm fully extended; 4 half turn: for SE/SW the BACK of the hair and cape face the viewer, for NE/NW the FACE is toward the viewer, blade still out; 5 three-quarter turn, blade trailing, cape fully flared; 6 recovery back to guard facing <DIR>, slightly crouched.
BOTTOM ROW — METEOR CAST (no VFX baked in): 1 guard; 2 sword point planted on the ground with the right hand, left hand rising; 3 left arm raised, palm open overhead, fingers spread, head tilted up; 4 left arm fully extended upward, chest open, cape billowing as if wind rises; 5 left arm snapped down and forward pointing toward screen-right (release); 6 recovery to guard.

### `react-<DIR>-v1.png`
TOP ROW — HIT REACTION then DODGE ROLL: 1 flinch: head snapped back, shoulders twisted, cape thrown forward; 2 stagger one step back, knees bent; 3 recovering to guard; 4 dodge start: deep crouch, cape wrapped; 5 tucked roll, body compact and low (sword kept in hand close to the body); 6 low landing lunge, one knee down, sword out behind.
BOTTOM ROW — DEATH: 1 stagger backward, free hand to chest; 2 knees buckle; 3 dropped to both knees, sword slipping from the hand; 4 falling sideways; 5 lying on the ground on the side, sword beside; 6 fully down and still (this last frame is the hold frame; body lies roughly horizontal along the ground, head toward screen-left for SE/NE and screen-right for SW/NW).

Quality bar before packing: 12 connected figures per sheet, consistent scale, face/hair/costume identical to the existing art, blades and boots never cut off, spin frames 3–5 must have clearly different silhouettes from each other, death frame 6 must be the lowest/widest pose. Regenerate a sheet if it fails. Append every prompt used to `PROMPTS.md`.

## 2. Packing

Extend `tools/pack-painted.py` (keep the existing idle/run/attack output byte-identical) to also pack:
- `public/assets/hero-painted/hero-spin-v1.png`, `hero-cast-v1.png`, `hero-hit-v1.png` (3 frames), `hero-dodge-v1.png` (3 frames), `hero-death-v1.png` — same 384×256 cells, same shared scale and torso anchor, 4 direction rows, 6 columns (hit/dodge use 3 columns each or share one 6-column atlas as `hero-react-v1.png`; document which).
- Death frames may need a wider cell: allow a 512×256 cell for that atlas only, and report it in `packing-report.json`.
- Extend the packing report with per-frame bounds and a check that death frame 6 has the lowest bounding-box top edge of its row. Produce preview contact sheets `preview-<motion>-<DIR>.png` as before.

## 3. Engine

- `src/sprite-animation.ts`: extend `Motion` to `'idle'|'run'|'attack'|'spin'|'cast'|'hit'|'dodge'|'death'`. `motionFor()` maps: dead → `death` (hold the last frame), hurt in its first ~0.3 s → `hit`, dash → `dodge`, attack with kind `spin` → `spin`, kind `meteor` → `cast`, other attack → `attack`, moving → `run`, else `idle`. Give each motion its own frame timing (spin 0.6 s over 6 frames, cast 0.8 s, hit 0.3 s over 3, dodge over the dash duration, death 0.9 s then hold frame 6). Update `atlasCell()` for the new atlases.
- `src/painted-hero.ts`: load the new atlases, remove the rotation-based death and the dodge lean, keep the hurt tint and invulnerability blink. Keep the fallback behaviour when a texture is missing.
- `character.html` / `src/character-preview.ts`: add the new motions to the viewer buttons.
- Update/add tests in `tests/animation.test.mjs` for the new motion mapping and frame timing.

## 4. Verification

Run `npm run check:meadow`, `npm run test:meadow`, `npm run build:meadow`. Then a browser smoke test on the dev server: trigger Q (spin), F (meteor), take a hit from a slime, dodge with Space, and die once; confirm the correct art plays for each and that nothing is cropped. Save screenshots to `.codex-run/motions-spin.jpg`, `motions-cast.jpg`, `motions-hit.jpg`, `motions-death.jpg`. Do not touch `server/`.

When finished, reply with: the list of new/changed files, the packing report summary (scale, warnings, contact checks), and anything that still looks off in the art.
