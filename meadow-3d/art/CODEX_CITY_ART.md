# Codex task: paint the city plaza (นครที่ถูกลืมเลือน) — replace the greybox

Owner asked (03:20) to dress the whole city with art. Layout/collision/NPC positions from the greybox (`src/city-scene.ts`, `shared/src/game/maps.ts`) stay exactly as they are; this is an art pass only. Design doc: "นครที่ถูกลืมเลือน — ออกแบบเมือง (เขตแรก)".

## Look
- Western fantasy town that is still **thriving but wrapped in fog** with a hidden secret. Same hand-painted ink-and-gouache look as the meadow, Aerin and the Angel (match their palette, outline weight, light direction).
- Cream stone walls, deep-green and brick-red roof tiles, timber-frame houses, banners with a city crest (original design — a stylised clock + mist swirl, no real-world symbols), warm lantern light against cool blue-grey fog.
- The clock tower is the landmark: tall, readable from anywhere in the plaza; hands stopped; small stair landing on the south side where the Angel stands; faint mist seeping from a crack at its base.

## What to make (built-in imagegen → existing texture pipeline, KTX2 + WebP)
1. Painted textures/trim sheets for: cobblestone plaza ground (+ worn path variant), stone wall, timber-frame wall, roof tiles ×2 colours, wooden doors/windows, tower clock face.
2. Rebuild the greybox meshes with these materials (simple low-poly shapes, painted textures doing the detail): clock tower, storage hall (north), forge with chimney + glow (west), market stall with awnings + crates (east), fountain with water (SW), 4 gates in the wall (south open with a portcullis raised; N/E/W shut with fog behind), city wall with walkway, 4–6 filler houses behind the buildings.
3. Props (painted billboards or tiny meshes, instanced): lanterns on posts (emissive at dusk), banners, barrels, crates, flower boxes, benches, notice board near the south gate, a few trees in planters, hanging signs (Thai text as live HTML labels only when interacting — no baked Thai text in textures).
4. NPC sprites for the 5 placeholders (storage keeper, blacksmith, merchant, healer-priest, gate captain): 2D painted, same style/scale as Aerin, idle 4–6 frames, front-facing (they don't walk). Angel unchanged.
5. Fog: layered fog cards/volume thicker at and beyond the walls; light drifting mist particles in the plaza (cheap, capped, auto-quality aware).
6. Lighting: soft late-afternoon key light, warm lantern points (max 4 real lights; the rest baked/emissive), subtle vignette.

## Budget / performance (owner worried about lag)
- City critical download ≤ 3 MB (KTX2) — load city art when entering the city; meadow art not preloaded while in the city (fix the "unused meadow preload" warning from QC).
- Draw calls in the city ≤ 150, triangles ≤ 150k; instanced props; texture atlases. LOW quality: no mist particles, half-res fog.
- Keep the auto-quality step-down working.

## Also fix (from tonight's review)
- Area-name banner overlaps the target frame at the top centre — move the banner lower or fade it before a target frame appears.

## Verify
`npm test`, `npm run build`. One headless run (city + walk to each NPC + south gate). Screenshots only: `.codex-run/city-art-overview.jpg`, `.codex-run/city-art-ground.jpg` (player view at spawn), `.codex-run/city-art-npcs.jpg` (contact sheet of the 5 NPC sprites next to Aerin). Report `.codex-run/city-art-report.json` (assets, sizes KB, draw calls/triangles, anything off-style). Prompts in `art/city/PROMPTS.md`. Do not commit. Never touch the Railway production environment.
