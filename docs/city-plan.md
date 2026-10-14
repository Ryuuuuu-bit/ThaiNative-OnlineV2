# นครที่ถูกลืมเลือน / The Forgotten City

First town of ThaiNative Online. World footprint approximately **160 × 160 units**, ground coordinates `x` east/right, `z` south/down. Playable boundary ±78 (minus player radius); north is negative z. Player sprite height: 3 units. World origin: middle of the east–west stone avenue.

## Story and visual direction

ภูผา, a young man from a coastal village, is swallowed by a black whirlpool and wakes on a worn wooden pier. The sky has no sun or moon. Hundreds of paper lanterns hang almost motionless over a city whose inhabitants have lost their memories. The abandoned temple's midnight bell takes another memory. ผู้กลืนนาม keeps those memories in hidden ดวงประทีปวิญญาณ guarded by ghosts.

Quiet, melancholic, beautiful-eerie; no gore. Grey-blue ground, fog and overcast gradient sky surround faded timber, old stone paving and restrained amber/red lantern accents. No modern vehicles, electric poles, modern retail branding or neon. The directional light is only a soft overcast shadow source, not a visible sun.

## Districts

| ID     | Thai / English                      | x bounds | z bounds | Landmarks                                                                                          |
| ------ | ----------------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------- |
| temple | วัดร้าง / Abandoned Temple          | −78…−30  | −78…−18  | Tiered temple (−51,−57), bell tower (−68,−31), spirit house (−60,−27)                              |
| soi    | ตรอกเรือนไม้ / Wooden House Quarter | −30…30   | −78…−18  | Six raised wooden houses at x ±15, z −65/−52/−27; sealed gate (0,−76)                              |
| gym    | ค่ายมวยเก่า / Old Muay Thai Camp    | 30…78    | −78…−18  | Open wooden sala (51,−56), ground-level rope ring, suspended punching bags, general store (50,−25) |
| plaza  | ลานบ่อน้ำ / Well Square             | −78…78   | −18…23   | Weathered stone well (0,−11), benches, bare trees                                                  |
| market | ตลาดยามค่ำ / Lantern Market         | −78…−8   | 23…78    | Six empty stalls: x −64/−51/−38 at z 23/39, handcart, faded cloth banner                           |
| canal  | ท่าเรือเก่า / Old Pier              | −8…78    | 23…78    | Spawn pier (42,44), two wooden bridges, canal walks, sampans                                       |

Bounds are half-open: shared edges belong to the district on their south/east side. District names come from this same data for both minimap and entry banner. Market bounds also cover the western canal bank; water collision is independent of district names.

## Roads and water

- East–west main avenue: center (0,0), 156 × 12.
- North–south roads: centers (−26,−9) and (26,−9), 9 × 134.
- Northern house lane: center (0,−40), 145 × 7.
- Market lane: center (0,31), 150 × 8; southern lane (0,65), 150 × 7.
- Gate approach: center (0,−60), 9 × 40.
- Pier approach: center (42,37), 5 × 15, old timber planks.
- Canal: center (0,52), 156 × 12; water extends z 46…58.
- Bridges: centers (−26,52), (26,52), each 10 × 16. Walkable, with rope railings.
- Pier: center (42,44), 13 × 7; **spawn (42,44)**. It is a dead end extending only to z 47.5, not a third canal crossing.
- Canal boardwalks: centers z 43.8/60.2, 154 × 2.4. Boats: (52,52), (65,54).

Stone roads use instanced individual pavers with seeded color variations. Intersections share a world-aligned grid to prevent duplicate coplanar pavers. Wood is weathered, with visible plank gaps. Water blocks movement independently of its shallow visual surface.

## Landmarks and hooks

| Hook          | Name                | Position (x,z) | Purpose                                                                              |
| ------------- | ------------------- | -------------- | ------------------------------------------------------------------------------------ |
| entrance-sign | นครที่ถูกลืมเลือน   | (47,36)        | Rotting plank sign; Thai text baked into CanvasTexture after font loading            |
| waiting-elder | ชายชราผู้รอคอย      | (38,43)        | Waiting on the pier without remembering whom                                         |
| monk          | พระชรา              | (−45,−24)      | Warns about the midnight bell                                                        |
| trainer       | ครูมวย              | (48,−37)       | Muay Thai class hook                                                                 |
| vendor        | แม่ค้าผู้ลืมชื่อ    | (−46,32)       | Vendor who forgot her name                                                           |
| child         | เด็กน้อย            | (6,−6)         | Child who forgot his mother's face                                                   |
| bell-tower    | หอระฆัง             | (−68,−31)      | Visible bronze bell in an old timber tower; midnight event hook, not an active timer |
| north-gate    | ทางออก — ยังไม่เปิด | (0,−76)        | Closed future-map exit                                                               |

NPCs have small procedural debug figures and golden ground rings, with metadata in `userData.hook`. Nearby Thai dialogue fragments appear within 5 units. They are static markers, not full NPC sprites or quest logic.

## Spirit lamps and future destinations

| Lamp ID     | Position  | Guardian hook |
| ----------- | --------- | ------------- |
| lamp-temple | (−70,−69) | ghost-temple  |
| lamp-soi    | (8,−61)   | ghost-soi     |
| lamp-market | (−71,42)  | ghost-market  |
| lamp-canal  | (67,69)   | ghost-canal   |

Faint pale-green orbs mark hidden-memory locations. Their guardians and memory collection are metadata only. Future exit target IDs: `pa-takhian` (ป่าตะเคียน / Nang Tani), `ghost-market` (ตลาดผี / Krasue), `abandoned-house` (บ้านร้าง / Phi Pop), `mist-marsh` (บึงหมอก / Pret). Gate remains locked.

## Top-down coordinate map

```text
                                 NORTH −z
       x=−80           −30         0          30              80
 z=−80 +------------------------- G --------------------------+
       |  o L1           H    |   : L2|    H        OLD GYM   |
   −57 |     TEMPLE       H   |   :   |    H      [rope ring] |
       |                      |   :   |                     |
   −40 |======================+=======+=====================|
       |  B      S   M        |       |           T          |
   −27 |                      H       H       GENERAL STORE |
   −18 |----------------------+-------+---------------------|
   −11 |             benches     W  C        benches        |
     0 |======================+=======+=====================|
    14 |   o      benches     |       |           o         |
    23 | [stalls]              |       |                    |
    31 |=======V==============+=======+========sign========|
    39 | [stalls]  cart        |       |        :            |
    44 | L3     boardwalk-----|-------|----E---P*-----------|
    46 |~~~~~~~~~~~~~~~~~~~~~~|~~~~~~~|~~~~~~~:~~~~~~~~~~~~~|
    52 |~~~~~ CANAL ~~~~~~~~ BR1 ~~~ BR2 ~~~~~ boats ~~~~~~~|
    58 |~~~~~~~~~~~~~~~~~~~~~~|~~~~~~~|~~~~~~~~~~~~~~~~~~~~~|
    60 |------------------ boardwalk -----------------------|
    65 |====================================================|
    69 |                                               L4   |
 z= 80 +----------------------------------------------------+
                                 SOUTH +z

 = stone road     | crossing road/bridge     : approach
 H wooden house   W well     B bell tower    S spirit house
 M old monk       T trainer  V vendor        C child
 E waiting elder  P* pier spawn (42,44)      G locked gate
 o bare tree      L1…L4 spirit lamp hooks
```

Schematic only: the source coordinates in the tables and `layout.js` are authoritative.

## Collision and navigation

Circle player radius .55; AABB/polygon collision in a pure simulation module. Substeps prevent tunnelling; penetration projection gives sliding. Solid house/temple footprints, prop footprints, tree trunks, gym posts and the boundary block walking. Open gym sala/ring is accessible. Water colliders leave only bridge gaps; a separate collider blocks the far end of the pier. Click destinations outside the world or in a collider are rejected. Direct click steering stops if blocked; there is no A* routing around buildings. The collision API can be replaced by Rapier or recast-navigation later.

## Renderer and controls

Perspective camera 42° FOV, fixed 50° downward pitch, yaw controlled by Q/E or right-drag, bounded wheel distance 16…72, exponential smooth follow. WASD/arrow movement rotates with yaw; left click raycasts onto the horizontal ground plane. Placeholder player uses a 2D CanvasTexture sheet and Sprite, ~3 units tall, with 8 camera-relative directions in row order S, SE, E, NE, N, NW, W, SW; columns are animation frames.

ACES filmic tone mapping → world RenderPass → GTAOPass → sprite recomposite with opaque world depth → subtle horizontal/vertical tilt-shift ShaderPass → OutputPass. Sprite layer 1 is excluded from GTAO normals and redrawn after AO so background AO does not darken sprites. Transparent mist and sky are excluded from the normal pass too. Low quality disables GTAO, the sprite recomposite and tilt-shift, sets pixel ratio to 1, and reduces shadow maps from 2048 to 1024. The normal RenderPass retains sprite occlusion in Low.

900 seeded paper lanterns, heights 4…25, batched into three InstancedMeshes (body/rims/tail). Sway is tiny and slow. Five local amber PointLights accent the pier, market, temple, gym and well; emissive lanterns provide the rest without bloom. Ground mist is a lightweight drifting set of alpha planes. Water has subtle boat bobbing. Repeated road stones use InstancedMesh; common box/cylinder geometry and materials are cached.

## Module architecture and asset replacement

```text
src/main.js                  assembly, resize, lifecycle, diagnostic seam
src/core/renderer.js         WebGL, tone mapping, shadows
src/core/postfx.js           AO exclusion, sprite composite, tilt shift, output
src/core/camera.js           orbit, bounded zoom, smooth follow
src/core/input.js            keyboard, pointer, ground ray
src/core/loop.js             requestAnimationFrame, capped delta time
src/world/layout.js          district/road/prop/NPC/lamp/exit data
src/world/assets.js          registerAsset / assetOrFallback factories
src/world/builders/
  shared.js                  cached primitives, roofs, CanvasTexture signs
  sky.js terrain.js roads.js buildings.js props.js water.js
  vegetation.js lanterns.js mist.js sign.js
src/entities/player.js       simulation position, billboard, destination marker
src/entities/sprite-sheet.js  texture UVs, 8-direction lookup, placeholder atlas
src/systems/collision.js     replaceable circle vs AABB/polygon solver
src/ui/hud.js                title card, Thai banner/dialogue, quality, FPS
src/ui/minimap.js            layout-derived map and player/camera marker
src/ui/style.css             responsive HTML overlay
tests/world.test.js          collision, direction lookup, layout invariants
```

Each world builder enters through `assetOrFallback`; all placements carry stable asset IDs. Register glTF scene factories before constructing the world. Coordinates/collisions stay data-owned. For paper lantern models, register `paper-lantern`; batch replacement can instead use `lantern-field`. `mist` and `sky` are environment hooks. A `SpriteSheet.load`/`player.setSprite` seam accepts actual fighter art later without importing prototype concept sheets from `output/`.

## Deferred work

- TODO: character creation and a skippable introductory story/cutscene. Do not implement these in the first-town prototype.
- Muay Thai animation atlases, separate idle/walk/die state assets and production pixel cleanup.
- Ghost guardians, collection quests, memory inventory, midnight bell/sound and Name-Eater narrative.
- Future map loading/exit transitions, pathfinding, model assets, LODs and profiling on real target GPUs.
