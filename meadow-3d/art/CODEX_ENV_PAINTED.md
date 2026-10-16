# Codex task: make the meadow environment match the painted hero (meadow-3d)

Read first: `meadow-3d/README.md`, `meadow-3d/src/scene.ts`, `meadow-3d/src/main.ts`, `meadow-3d/src/painted-hero.ts`, `meadow-3d/art/painted-hero/PROMPTS.md` (for the art direction wording that produced Aerin).

Problem: Aerin is delicate ink-and-gouache painted art, but the meadow around him is flat-shaded low-poly 3D (sphere-cluster trees, plain blobs, bright saturated grass, hard lighting). The world must read as the same storybook illustration as the character, in the manner of Tree of Savior: hand-painted 2D props standing in a softly lit 3D ground, muted painterly colours, soft shadows.

## 1. Painted environment set (built-in imagegen, transparent, same painterly style as the hero)

Save sources under `meadow-3d/art/painted-env/` and append the prompts to a new `PROMPTS.md` there. Every asset: ink-and-gouache storybook style with thin ink lines and soft watercolour shading, same slightly elevated orthographic game view as the hero (about 20° down), consistent light from the upper-left, genuine transparent alpha, no ground plane, no cast shadow, no text. Group small items on one 2×3 sheet per file where sensible (the packer extracts connected figures like `pack-painted.py` does).

- Trees: 3 broadleaf variants (round canopy, tall, leaning) + 1 flowering tree, each about 700 px tall on a 1024 canvas; trunks grounded, canopy painted with layered leaf clusters, not blobs.
- Bushes and ferns: 4 variants. Flower clumps: 4 variants (white, yellow, lavender, pink). Tall grass tufts: 3 variants with soft alpha edges.
- Rocks: 3 mossy boulders + 1 cluster. Fallen log, tree stump.
- Camp: canvas tent, campfire (unlit painted base; the game adds the flame VFX), wooden bench, signpost with blank board, wooden fence pieces (post, 2-post span).
- Ruins: 2 broken stone pillars, a cracked stone arch, a mossy stone circle base plate (flat, top-down).
- Pond edge: 3 painted reed/lily clumps; a plank bridge painted from the fixed camera angle (top-down-ish) so it can be laid on the water as a flat decal.
- Ground tiles (opaque, seamless, 1024×1024, top-down, painted, muted): meadow grass (replace `public/assets/meadow-grass.png` — desaturate toward soft olive/sage, add subtle painted variation), worn dirt path, grass-to-path transition brush (transparent alpha mask), pond water base (painted ripples, no reflections baked), stone/ruin floor.

## 2. Packing

Add `tools/pack-env.py`: extract each figure, trim, record the ground anchor (lowest opaque row, horizontal centre of the bottom 15 % of the figure), downscale to a shared world scale (hero = 204 px ≈ 1.8 world units, so 1 world unit ≈ 113 px at source scale; downsample sources ×0.5 for the runtime atlases), and pack into a few 2048×2048 atlases under `public/assets/env-painted/` with a JSON manifest (`name`, atlas, uv rect, pixel size, anchor). Keep HD previews out of the runtime bundle.

## 3. Scene integration (`src/scene.ts` and friends)

- Replace the procedural sphere trees, bushes, flowers, rocks, camp pieces and ruins with camera-facing painted billboards (same `Sprite`/alpha-test/depthWrite approach as `painted-hero.ts`, anchored at the ground point, with a soft elliptical contact shadow). Keep collision radii equivalent to the old props.
- Ground: use the new painted tiles with the transition brush along the paths (a second decal layer or vertex-painted mask), `MeshLambert`/`MeshStandard` with roughness 1, slight painted detail overlay. Pond: painted water base plus a very gentle animated ripple shader (low amplitude), painted reed clumps on the rim, plank bridge decal.
- Lighting and grade to match the hero: warm hemisphere + a soft directional key from the upper-left with PCF soft shadows (radius 3–4) cast by the billboards' shadow proxies (a simple upright plane with the billboard alpha as the shadow caster is acceptable), exposure tuned so Aerin's ivory sleeves stay ivory (not blown out), colour grade with a slight warm lift in the shadows and gently reduced saturation in the greens, soft vignette, no bloom on scenery (keep bloom only for skill VFX). Fog colour matched to the sky horizon.
- Keep the HQ/LOW toggle; LOW disables shadows and the ripple shader.
- Slimes: keep them as 3D for now but re-tint to a softer pink with a painted-looking matcap/toon ramp so they do not look plastic next to the painted props (a dedicated painted slime sprite set is a separate task).

## 4. Verification

`npm run check:meadow`, `npm run test:meadow`, `npm run build:meadow`; browser screenshots at 1280×720 of the camp, the ruins, the pond with the bridge and a tree-dense corner, saved as `.codex-run/env-camp.jpg`, `env-ruins.jpg`, `env-pond.jpg`, `env-trees.jpg`. Confirm the frame rate on HQ is not lower than before (report numbers). Do not touch `server/`.

Reply with the list of new/changed files, the manifest summary (asset count, atlas count, sizes) and anything that still clashes visually with the hero.
