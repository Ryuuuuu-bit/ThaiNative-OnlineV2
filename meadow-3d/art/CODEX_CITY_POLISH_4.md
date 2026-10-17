# Codex task: city polish 4 — walls, gates and fill (นครที่ถูกลืมเลือน, 96 × 96 m)

Read first: `meadow-3d/art/CODEX_CITY_POLISH_3.md`, `meadow-3d/src/city-scene.ts`, `meadow-3d/src/city-paving.ts`, `shared/src/game/maps.ts` (CITY, CITY_BUILDINGS, CITY_HOUSES, CITY_PLANTERS, CITY_BENCHES, CITY_STALLS, GATE_CAPTAIN, CITY_RETURN, CITY_EAST_RETURN, GATES, `cityWalkable`), `shared/tests/layout.test.ts`, `meadow-3d/tests/city-scene.test.mjs`, and the 16:38 polish-3 shots in `.codex-run/` (`city-overview-hq.jpg`, `city-south-gate-hq.jpg`, `city-east-gate-hq.jpg`, `city-plaza-ring-hq.jpg`, `city-houses-hq.jpg`).

Polish 3 is approved and committed (55f5dfd). The paving, gabled houses, stalls and planter ring work. Claude has since made the planters, benches and stalls solid through the shared lists. Six items are still missing or weak. Coordinates below use `H = CITY.halfX + 1 = 49` (the wall line). The hero's walkable edge is `|x|, |z| < 47`, south is `+z` and east is `+x`.

1. **No wall-top walkway.** The walls are still a 1 m box with merlons on top, and the 2 m ledge only reads as a step (`city-south-gate-hq.jpg`, `city-houses-hq.jpg`). Turn each wall into a walkway:
   - Keep the inner face at `|c| = 48.5` and thicken the wall *outward* to about 2.2 m.
   - Add a stone deck at about 4.0 m, with an outer parapet (crenels and merlons, ~1.1 m) and a low inner lip or timber rail.
   - The deck meets the corner towers and gate towers through a doorway or step, and it crosses each gate over the gatehouse (see 4).
   - Add one stair flight per corner along the inner face, about 1.1 m wide and rising about 4 m over 6–7 m, with a stone stringer underneath. Place them on the north wall near NW (x −44→−37), the east wall near NE (z −44→−37), the south wall near SE (x 44→37) and the west wall near SW (z 44→37).
   - Everything here is visual only. No part of it may come inside `|c| = 47.3`, so it needs no collision.
2. **Guard posts are buried.** `[-6, H-.7]` and `[H-.7, -6]` sit inside the gate towers (now at ±4.5) and the wall, so neither shows in the gate shots. Move each post inside the walls and in clear view of the game camera:
   - South post: centre (−7, 44.5).
   - East post: centre (44.5, −7).
   - Each is about a 1.6 m booth with a small roof, and its eaves must fit inside a **1.8 × 1.8 m** footprint.
   - Both stay clear of the 6 m roads (keep the 0.4 m margin the layout test checks), of the gate triggers (1.5 m around (0, 47) and (47, 0)), of the return points (0, 44) and (44, 0), of the notice board (−4, 40), of the gate captain (5, 40) and of the lamp posts.
   - You may move them by up to 1 m if the view is better. Report the exact footprints as collision requests.
3. **Gate lanterns barely show.** The 0.42 × 0.65 glow planes at ±3.8 are lost against the towers. Hang a real lantern at both open gates, one on the plaza face of each gate tower (four in all):
   - An iron bracket reaches about 0.6 m out. The lantern has a frame, a cap and a `glow` core, with its bottom at 2.6 m or higher.
   - Add a soft warm halo that reads in daylight at the game camera. Use one instanced or `Points` halo for all four lanterns, not four sprites.
   - Add a warm pool of light on the paving under each lantern. The cheapest way is to add it in `city-paving.ts`.
   - Move the existing point lights at (−4, 45) and (45, −4) onto these lanterns, so that `realLights` stays 4.
4. **The portcullis reads as teeth.** The bars (`y 5.25–7.05`) stick out above the lintel (`5–6.2`). Make the lintel a proper gatehouse that is deeper and carries the walkway. The raised portcullis is hidden inside it, and only its row of iron spike tips shows below the soffit, across the 7 m opening between the towers. Keep the tips at 4.4 m or higher so that hero and NPC sprites never clip them. Put a groove in each tower face for the portcullis to run in. The north and west gates stay closed and misty.
5. **Pigeons read as grey dots** (the sphere pairs near the tower in `city-plaza-ring-hq.jpg`). Replace them with a small painted pigeon sheet in the NPC atlas style. It needs 2–3 poses and may include a peck frame.
   - Draw them as one camera-facing `InstancedMesh` of about 0.35 m, in 2–3 small flocks near the fountain, the tower steps and the market.
   - If the pigeons still don't read at the default camera, remove them.
   - In both cases delete `birdMat` and the `pigeon-kit`, because they cost a draw call per 16 m tile.
6. **The overview is sparse between the ring and the houses** (`city-overview-hq.jpg`: bare paving at radius 18–30 in every quarter). Add cheap fill in the `paint` material through `prop()`, so that it lands in the existing tile batches. Suggested set (adjust positions freely, but keep them clear of roads, NPC talk points, the spawn, the returns and the existing props):
   - **Wells:** stone ring, roof and bucket, solid circle r ≈ 1.1, at (−24, −27) and (27, 24).
   - **Hay or market carts:** solid box about 3.2 × 1.6, at (−26, 24) and (10, −22), with hay bales or sacks beside them.
   - **Barrel and crate clusters** against house side walls. Covering these by extending a house request box is fine.
   - **Laundry lines** from a house gable to a thin pole 4–5 m away, with cloth hanging no lower than 2.1 m. Poles are non-solid, like the lamp posts.
   - **Firewood stack** on the west side of the forge.
   - **Grass and moss washes** in the paving near the wall corners.

   Anything taller than about 0.5 m that the hero could walk through must be listed as solid.

Collision requests: keep every new solid in one exported array at the top of `city-scene.ts` (e.g. `CITY_ART_SOLIDS: {kind:'box'|'circle', x, z, w?, d?, r?, label}[]`) and draw the props from it, so Claude can move the list into `shared/maps` unchanged. Put the same list in your reply.

Performance: polish 3 measured **216 HQ draw calls on city-overview** (`city-polish-3-summary.json`), so there are only 4 calls of headroom. Put new geometry into the existing `paint` and `glow` batches, add at most two new materials (pigeon sheet, lantern halo), and use the calls freed by removing the sphere pigeons. If you are still over budget, merge rather than cut art.

Rules (unchanged): don't change `shared/`, `server/` or any collision. If a prop needs to be solid, list it with its footprint and I will add it to the layout. No baked text. Original designs only. The small jelly is "วุ้นจิ๋ว". Keep the 32 older Tripo assets. Don't touch the Railway production environment. Don't commit. Keep HQ ≥ 50 fps and LOW ≥ 30 fps with the 48-actor crowd benchmark, and keep city draw calls ≤ 220 on HQ.

Tests: extend `city-scene.test.mjs`:
- No portcullis vertex rises above the lintel top.
- No spike tip is lower than 4.4 m.
- Each guard post's bounds stay inside its listed footprint and clear of the gate towers, the roads and the trigger radius.
- There are 4 gate lanterns.
- The stairs and walkway stay outside `|c| = 47.3`.

Expose `guardPosts`, `gateLanterns`, `wallStairs` and `pigeons: 'sprites'|'removed'` in `snapshot()`.

Verification: `npm run check:meadow`, `npm test`, `npm run build`, then `python meadow-3d/tools/verify-city-polish.py` and `python meadow-3d/tools/walk-world-art.py --city-only`.
- Add two art-review stops, `city-wall-walk` (a corner with stairs) and `city-fill` (a quarter between the ring and the houses).
- Make the verify tool write `city-polish-4-report.json`.
- Screenshots go to `.codex-run/`: `city-overview-hq.jpg`, `city-south-gate-hq.jpg`, `city-east-gate-hq.jpg`, `city-plaza-ring-hq.jpg`, `city-houses-hq.jpg`, `city-wall-walk-hq.jpg`, `city-fill-hq.jpg`, plus LOW versions and the performance table.

Reply with the changed files and the `CITY_ART_SOLIDS` collision requests.
