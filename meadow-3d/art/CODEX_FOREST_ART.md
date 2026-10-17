# Codex task: ป่าหมอก (Mist Forest) art pass — scene, 5 monsters, item icons v2

Read first: `meadow-3d/README.md`, `meadow-3d/art/CODEX_MONSTERS_SLIME.md` (the monster pipeline you built), `meadow-3d/art/CODEX_ENV_PAINTED.md`, `meadow-3d/art/CODEX_CITY_ART.md`, `meadow-3d/tools/pack-monsters.py`, `meadow-3d/tools/pack-env.py`, `meadow-3d/tools/pack-icons.py`, `meadow-3d/src/forest-scene.ts`, `meadow-3d/src/painted-monster.ts`, `meadow-3d/src/monster-animation.ts`, `meadow-3d/src/main.ts` (search `PLACEHOLDER`), `shared/src/game/maps.ts` (FOREST_*), `shared/data/monsters.json` (the 5 new entries).

The gameplay logic for map 2 is finished and live: east gate of the city → ป่าหมอก (40 × 32 m, Lv 6–15), four monsters, a field boss, five materials. Right now the forest is a greybox (cone trees, flat pool) and the monsters are tinted spheres. Replace them with painted art in the same ink-and-gouache storybook style as the meadow, city and Aerin. **Do not change `shared/` or `server/`**, and do not move anything: positions and collision come from `shared/src/game/maps.ts`.

Hard rules (unchanged): no text baked into any image (all Thai text is live HTML or the existing `label()` canvas); original designs only, no references to other games; the small jelly is "วุ้นจิ๋ว" and nothing else; keep the 32 older Tripo assets; ElevenLabs is not used for images.

## Part A — forest environment (`src/forest-scene.ts`)

Keep the exported `buildForest(scene, loader)` and its return shape (`root`, `setQuality`, `snapshot`, `update`). Same slightly elevated orthographic camera and upper-left light as the meadow.

Mood: an old, cool, quiet forest — mossy blue-green floor, grey-violet mist, dark teal pines and gnarled broadleaf trees, small warm accents (lanterns, campfire, glowing spores). Darker and cooler than the meadow but still readable; the hero and monsters must pop.

- Ground: painted forest-floor tile set (moss, damp soil, leaf litter, root-crossed dirt path), tileable, plus a transition/path brush like the meadow. The path runs from the west gate (x −19.4, z 0) east along z≈0 to x≈13, then bends to the warden clearing at (13, 6).
- Trees: one painted billboard/prop per entry in `FOREST_TREES`, at exactly that x/z, with a trunk footprint matching its radius `r` (the collision circle). Use 3–4 tree designs (old pine, twisted oak with hanging moss, dead silver tree, one giant hollow trunk) and vary scale/flip. Contact shadows like the meadow props.
- Forest edge: a dense painted treeline outside the walkable rectangle (|x| > 20, |z| > 16), with the opening on the west for the gate. Replace the instanced cones.
- Mist pool (ellipse centre (5, −8), radii 4 × 2.6, blocked in collision): still dark water, a soft painted shore ring with alpha falloff, lily pads, reeds, low mist hugging the surface. Reuse the meadow ripple shader at very low amplitude.
- West gate: a mossy stone arch / old torii-like wooden frame in the city's ruin style, framing the way back to the city; keep the existing `label('← นครที่ถูกลืมเลือน')`.
- Camp at `FOREST_CAMP` (−15, 4): bedroll, log seats, campfire (keep the animated flame + point light), a lantern post. Keep the existing camp label.
- Warden clearing at `FOREST_ARENA` (13, 6): a ring of standing stones / roots around a mossy circle about 3.4 m radius. Keep it open; nothing inside the circle.
- Scatter: mushrooms, ferns, fallen logs, rocks, glowing spore clusters, a few hanging lanterns — only where `walkable(x, z, .3, 'forest')` is true or as non-blocking ground decals. Do not add new collision.
- Mist: soft painted fog cards drifting slowly at knee height (replace my gradient sheets); `setQuality(false)` hides them. The scene fog stays `T.Fog('#9fb0a8', 16, 46)` in `main.ts` — tune the colour only if it clashes.
- City side: in `src/city-scene.ts`, the east gate (x 28, z 0) is now open. Remove its fog curtain / closed look so it reads like the south gate, and add a small painted signpost (no text in the image).

Budget: same as the meadow (texture atlas, KTX2 where the meadow uses it, ≤ 60 draw calls for props via instancing/atlasing). Run `pack-env.py` (or a `pack-forest.py` variant) so assets land in `public/assets/env-forest/`.

## Part B — monsters, 4 directions each (`tools/pack-monsters.py`)

Each regular monster uses the same sheet layout as `slime-<DIR>-v1.png`: 2 rows × 6 slots of 256×256, transparent, bottom anchor at about y = 240, constant scale. TOP ROW 1–3 idle, 4–6 move ("hop" motion: walk/run/float cycle). BOTTOM ROW 1–3 attack (readable wind-up, strike, recoil), 4–6 death (final frame is the hold frame). Turnaround seed first (SE, SW, NE, NW; back views have no face).

1. **เห็ดหมอก `mist_shroom`** (Lv 6, melee, slow): a waddling mushroom about 0.7× hero height, pale lilac cap with soft spots that leak little mist puffs, stubby root feet, sleepy eyes under the cap. Attack: rears back and headbutts with the cap, releasing a spore puff. Death: cap droops, collapses into a pile of spores.
2. **หมาป่าเงา `shade_wolf`** (Lv 9, fast melee lunge): a lean wolf made of smoky dark blue-grey fur whose tail and paws fade into shadow wisps, pale glowing eyes. About hero height at the shoulder-ish length, low silhouette. Move: lope cycle. Attack: crouch, lunge bite, land. Death: dissolves into drifting smoke.
3. **ภูตตะเกียง `lantern_wisp`** (Lv 11, ranged caster, keeps away): a small floating spirit holding (or being) a paper lantern with a warm amber flame, cloth tatters trailing below, no legs; hovers about 0.5 m off the ground (keep the bottom anchor at the hover point's ground shadow). Attack: lantern flares, flame gathers, throws a bolt forward. Death: flame gutters out, lantern drifts down empty.
   - Also paint the bolt: a small amber fireball sprite (1 row × 4 frames, 128×128) for `attack: "bolt"` projectiles. Today `main.ts` renders every projectile with `makePaintedDroplet`; use the new sprite when the projectile owner is a wisp (`projectile.attack === 'bolt'`).
4. **ตอไม้เฝ้าป่า `stump_guard`** (Lv 13, tanky melee): a squat living tree stump about 1.2× hero height, bark armour, moss beard, two thick root arms, a single glowing knot-hole eye. Move: heavy shuffle on roots. Attack: overhead root slam. Death: topples, splits, sprouts a small green shoot on the hold frame.

**ผู้เฝ้าป่าหมอก `mist_warden` (boss, Lv 15, 6000 HP)** — uses the King's AI and therefore the King's motion names. Same 512×512 slot layout as the King (`warden-base`, `warden-attacks`, `warden-special` per direction, 2 rows × 6), about 2.5× hero height. Design: an ancient forest guardian — a tall stag-like figure whose body is a hollow trunk wrapped in moss and mist, antlers of branches hung with small lanterns, a mask-like bark face with pale eyes, long root arms. Motions, mapped to the King set: idle, move (stalking stride), hit, stun (antler lanterns flicker, slumps), roar (raises arms, mist bursts), slam (both root arms smash the ground), sweep (spinning antler swipe), charge (head-down antler ram), spit (exhales a cone of mist with small spores), summon (mist shrooms sprout from its roots), transform (phase 2: lanterns blaze, cracks of light open in the bark), death (kneels, antlers fall, collapses into a mossy mound with one lantern still lit — hold frame). Phase 2 is a tint/glow overlay like the King's, not a second set; no `expressionOverlay` is required for the warden.

Packing: extend `pack-monsters.py` and `manifest.json` with species `shroom`, `wolf`, `wisp`, `stump` (384×256 cells, motions idle/hop/attack/death) and `warden` (768×512 cells, the 12 King motions). Contact sheets and a clipping report as before.

## Part C — engine hookup (client only)

- `src/monster-animation.ts`: widen `MonsterSpecies` and add the new species to `MONSTER_MOTIONS` (frame counts/durations from your manifest; keep the slime/king durations untouched — the sim times attacks with them). Note the sim calls `duration(e, motion)` with the slime table for regular monsters and the king table for bosses, so keep regular attack totals ≥ the `windup` in `monsters.json` (shroom 0.6 s, wolf 0.4 s, wisp 0.7 s, stump 0.8 s).
- `src/painted-monster.ts`: choose species by `dataId` (`mist_shroom`→shroom, `shade_wolf`→wolf, `lantern_wisp`→wisp, `stump_guard`→stump, `mist_warden`→warden; everything else unchanged). Per-species size scale (shroom ≈ .72, wolf ≈ .85, wisp ≈ .7, stump ≈ 1, warden like the King). Hue shift only for jellies.
- `src/main.ts`: the `PLACEHOLDER` table becomes the fallback used only while a species' textures are missing (keep it for robustness). Hit particles: use a colour per species instead of the jelly colours.
- Contact shadows and click-hit sampling must work for the new sprites exactly like the slime.

## Part D — item icons atlas v2

`public/assets/items/items-v2.webp`: a 5 × 5 atlas in exactly the style, size and framing of `items-v1.webp` (run it through `pack-icons.py`). Slots in order (index 25 = slot 0):
0 `mist_spore` สปอร์หมอก — a pinch of glowing lilac spores in a tiny cloth pouch;
1 `wolf_fur` ขนหมาป่าเงา — a tuft of smoky blue-grey fur fading into wisps;
2 `wisp_tear` น้ำตาภูตตะเกียง — an amber teardrop crystal with a flame inside;
3 `mist_wood` ไม้หมอก — a mossy branch segment with pale bark;
4 `warden_heart` หัวใจผู้เฝ้าป่า — a carved heartwood core with a lantern-light glow (rare: give it the rare-item sparkle treatment used by `king_crystal`).
Remaining 20 slots stay transparent for future items. The CSS (`.item-icon-v2` in `src/inventory.css`) and `inventory-ui.ts` already read this file; once it exists the rarity orb fallback is hidden behind it — check that the orb no longer peeks out around the icon, and remove the gradient layer if it does.

## Verification

`npm run check:meadow`, `npm test`, `npm run build`. Browser smoke test: city → east gate → forest; fight each of the four monsters (the wisp must fire visible amber bolts that stop at trees); get 12 kills to call the warden, see slam / sweep / charge / spit / summon (spawns mist shrooms) and phase 2; kill it and open the bag to see the five new icons. Screenshots to `.codex-run/forest-overview.jpg`, `forest-gate-city.jpg`, `forest-shroom-wolf.jpg`, `forest-wisp-bolt.jpg`, `forest-stump.jpg`, `forest-warden.jpg`, `forest-warden-phase2.jpg`, `forest-icons.jpg`. Report FPS HQ/LOW vs the meadow.

Reply with the new/changed files, the manifest summary and anything that still looks off. Do not commit; I'll review and commit.
