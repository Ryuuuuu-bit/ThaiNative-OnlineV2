# Codex task: world scale art pass — bigger maps, scene detail, lighting & shadow, true-to-hero scale

Read first: `shared/src/game/maps.ts` (the new layouts — **the single source of truth**), `meadow-3d/src/scene.ts` (meadow), `meadow-3d/src/city-scene.ts`, `meadow-3d/src/forest-scene.ts`, `meadow-3d/src/main.ts` (lights, fog, camera, `SUN_OFFSET`, minimap), `meadow-3d/art/CODEX_ENV_PAINTED.md`, `meadow-3d/art/CODEX_CITY_ART.md`, `meadow-3d/art/CODEX_FOREST_ART.md`, `meadow-3d/tools/pack-env.py`.

## What changed (logic, already done by Claude)

The three maps are now about 3× larger in each direction to hold MMO-sized crowds:

| map | before | now | layout data |
|---|---|---|---|
| นครที่ถูกลืมเลือน (city) | 58 × 58 m | **96 × 96 m** | `CITY`, `CITY_BUILDINGS`, `CITY_HOUSES`, `CITY_FOUNTAIN`, `CITY_TOWER`, `HEALER`, `GATE_CAPTAIN`, `GATES.city_plaza` |
| ทุ่งวุ้นจิ๋ว (meadow, Lv 1–5) | 34 × 28 m | **100 × 84 m** | `LAYOUTS.meadow` (paths, 3 ponds, 76 trees/boulders, 3 camps, King arena, 42 spawns) |
| ป่าหมอก (forest, Lv 6–15) | 40 × 32 m | **120 × 96 m** | `LAYOUTS.forest` (paths, 3 pools, 120 trees with `kind` pine/oak/dead/hollow, 2 camps, warden arena, 54 spawns) |

Collision, spawns, camps, gates, the minimap and auto-hunt already read these layouts. The meadow scene already places its painted props from them (a quick, functional pass), the minimap draws them, and the sun's 54 m shadow frustum now follows the camera. Field bosses now appear every 30 minutes. **Do not change `shared/` or `server/`, and do not move any collision feature** — if a composition needs an obstacle moved or added, list it in your reply and I will change the layout.

## Scale bible (reference: Aerin, 1.8 m)

Every prop must read correctly next to the hero. Check each existing asset's `worldSize` against this and fix scale in the manifests / placement, not by squashing art:
- human door 2.1–2.3 m, house storey 2.8–3.2 m, city wall 5 m, gate towers 6.5 m, clock tower ~13 m
- bench seat 0.45 m, table 0.75 m, fence 1.0–1.2 m, lantern post 2.4–2.8 m, signpost 1.8 m, crate 0.8 m, barrel 1.0 m
- grass tufts 0.2–0.5 m, flowers 0.2–0.4 m, ferns/bushes 0.6–1.2 m, reeds 1.0–1.4 m
- meadow trees 5–8 m (canopy 4–6 m wide), forest pines 8–12 m, old oaks 7–10 m, the hollow trunk ~4 m diameter; boulders 0.8–1.8 m
- tent 2.2 m, campfire 0.5 m, stone circle matches the arena radius (3.4 m)
- monsters: วุ้นจิ๋ว ≈ 0.6 × hero, ราชาวุ้น ≈ 2.5 × hero (unchanged)
Make a scale line-up sheet `.codex-run/scale-lineup.jpg` (hero next to one of every prop type, in-engine) before and after.

## Per map

**Meadow (scene.ts)** — keep the functional placement but make it composed, not uniform:
- Zones with identity: north entry meadow (soft, flowers, the arch from the city), central crossroads with the long E–W road, the east lake (bridge at `bridgeZ`), the western pond with reeds, the southern King arena (ruined stone circle with pillars, a little higher-contrast and more dramatic), three camps each with a slightly different kit.
- Landmarks visible from far away so players can orient on a 100 m map: one old giant tree, a ruined watchtower, a windmill or standing stones — place on open ground away from paths and tell me their footprint so I add collision.
- Path edges: worn verge, scattered stones, path-side flowers; ground variation patches (clover, dry grass, mud) as large painted decals breaking the tiling.
- Border: replace the even treeline with a layered forest edge + distant painted hills/backdrop cards so the map does not end in a hard line.

**City (city-scene.ts)** — rebuild the plaza at 96 × 96 m from the layout data:
- Ground shader: replace the hard-coded `vMapUv*60.-30.` with the city size; cobble scale must stay true (≈ 0.25 m stones next to the hero). Main roads N–S and E–W 6 m wide to the four gates (`GATES.city_plaza`), plaza rings around the clock tower.
- Walls at `±(CITY.halfX + 1)`, towers either side of each gate; south and east gates open (they lead to the meadow and the forest), north and west closed and misty.
- Buildings from `CITY_BUILDINGS` (storage, forge, market) and `CITY_HOUSES` (12 solid houses) — vary roofs, add signboards (no baked text), awnings, chimneys with smoke on the forge, window glow at dusk.
- Fountain at `CITY_FOUNTAIN`, healer at `HEALER`, gate captain at `GATE_CAPTAIN`, angel at `jobs.json` angel; scatter lamp posts along roads every ~12 m, market stalls and crates near the market, planter trees, benches, banners — instanced.
- Edge fog banks / horizon cards sized to the new walls.

**Forest (forest-scene.ts)** — your forest art pass was laid out on the old 40 × 32 m greybox. Re-place it on `LAYOUTS.forest`: one painted tree per `FOREST_TREES` entry using its `kind` (pine / oak / dead / hollow) with the trunk matching `r`; pools from `LAYOUTS.forest.water`; paths, both camps and the warden clearing from the layout. Keep the mist and lantern mood; add light shafts through the canopy on HQ.

## Lighting & shadow (all maps, main.ts + scenes)

- A per-map light rig: city late afternoon (warm key, cool fill), meadow bright day, forest cool dim with warm accents. Tune the hemisphere + directional colours/intensities per map in `switchMap`, keeping the same camera.
- Shadows: the sun already follows the camera; tune `shadow.camera` bounds to the visible area (zoom range 12–27.5 m tall) and use texel-snapped movement to stop shimmering. Painted props keep their shadow proxies; make sure tall trees and buildings cast long readable shadows on HQ and soft contact blobs on LOW.
- Local lights: campfires, lanterns, forge, window glow — at most 4 real point lights near the camera at a time (pick nearest), everything else as emissive/additive sprites.
- Colour grading: gentle per-map tone (no bloom blowouts on water or the angel).

## Performance (required, the maps are ~9× the area)

- Chunk every instanced batch (grass, flowers, bushes, props, city instanced props) into ~16 m tiles so frustum culling skips off-screen tiles; one draw per asset per visible tile is fine.
- Keep HQ ≥ 50 fps and LOW ≥ 30 fps on the same machine as before in a crowded area; report draw calls, triangles, instance counts and FPS for each map in HQ/LOW.
- LOW mode: halve ground-cover density, no mist cards, no light shafts, contact shadows only.

## Rules (unchanged)

No text baked into images (Thai text stays live HTML / `label()`); original designs only, no references to other games; the small jelly is "วุ้นจิ๋ว"; keep the 32 older Tripo assets; don't touch `shared/`, `server/` or the Railway production environment; don't commit.

## Verification

`npm run check:meadow`, `npm test`, `npm run build`. Browser: walk city → south gate → whole meadow (all camps, lake bridge, King arena) → back → east gate → whole forest. Screenshots to `.codex-run/`: `scale-lineup.jpg`, `city-overview.jpg` (overview zoom), `city-market.jpg`, `city-south-gate.jpg`, `meadow-entry.jpg`, `meadow-lake.jpg`, `meadow-arena.jpg`, `meadow-camp.jpg`, `forest-entry.jpg`, `forest-pool.jpg`, `forest-warden.jpg`, each map HQ and LOW. Reply with changed files, the performance table and any collision changes you want.
