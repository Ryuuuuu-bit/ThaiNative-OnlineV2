# Completed — The Forgotten City: first town prototype

All requested first-town implementation work is complete. Production build and checks passed before this completion marker was created. Commit message: **The Forgotten City: first town prototype**. No push requested or performed. No files under `output/` were changed. The temporary verification HTTP server was stopped; no development server was left running.

## Delivered

- Replaced the former contemporary-town theme with **นครที่ถูกลืมเลือน / The Forgotten City**, retaining the data-driven module structure, coordinate system and principal road/district arrangement.
- Approximately 160 × 160 world; old pier spawn (42,44), Thai entrance sign, wooden houses, abandoned tiered temple and bell tower, general store with hanging lanterns, accessible old-style boxing sala/ring and hanging bags, stone well, spirit house/offerings, empty market stalls, handcart, clay jars, faded banner, bare trees/banana plants, canal walks, bridges and sampans.
- Grey gradient overcast sky without sun/moon, grey-blue fog and ground mist, 900 instanced warm paper lanterns at heights 4–25 with barely perceptible motion, five local amber point lights, soft overcast shadows.
- Five metadata-backed NPC/debug markers and nearby Thai dialogue fragments; four pale-green spirit lamp hooks with ghost guardian IDs; sealed northern gate and future-map hook IDs.
- Perspective 50° pitched follow camera, Q/E/right-drag orbit, bounded wheel zoom, camera-relative WASD/arrows, click-to-move, obstacle sliding and water boundaries.
- Replaceable standalone circle-vs-AABB/polygon collision solver; bottom-anchored ~3-unit billboard player; camera-relative 8-direction SpriteSheet adapter ready for real fighter animation atlases.
- ACES filmic tone mapping, GTAOPass with sprite exclusion and post-AO depth-aware sprite composite, subtle two-pass tilt-shift, OutputPass. High/Low changes AO/tilt-shift, shadow resolution and rendering pixel ratio.
- Thai HTML/CSS HUD, layout-derived minimap/player marker, district entry banner, coordinates and actual wall-clock FPS, quality toggle, collapsible controls, nearby NPC prompt and fading on-load title card.
- Asset-ID factory hooks in every world builder; repeated stones/lanterns instanced and common primitive geometry/materials cached.
- Rewritten city plan, README, lockfile and `.codex-run/` ignore rule. Character creation and skippable story intro remain documented TODOs as requested.

## File list

```text
.gitignore
README.md
index.html
package.json
package-lock.json
docs/city-plan.md
docs/CODEX_DONE.md
src/main.js
src/core/renderer.js
src/core/postfx.js
src/core/camera.js
src/core/input.js
src/core/loop.js
src/world/layout.js
src/world/assets.js
src/world/builders/shared.js
src/world/builders/sky.js
src/world/builders/terrain.js
src/world/builders/roads.js
src/world/builders/buildings.js
src/world/builders/props.js
src/world/builders/water.js
src/world/builders/vegetation.js
src/world/builders/lanterns.js
src/world/builders/mist.js
src/world/builders/sign.js
src/entities/player.js
src/entities/sprite-sheet.js
src/systems/collision.js
src/ui/hud.js
src/ui/minimap.js
src/ui/style.css
tests/world.test.js
```

## Validation

- `npm install`: completed; audit reported 0 vulnerabilities.
- `npm test`: **6/6 passed**. Covers wall tunnelling/sliding, polygon penetration, exact-edge winding, bounds/corner contact, camera-relative 8-direction lookup and story/layout invariants.
- `npm run build`: **passed**, Vite 7.3.7, Three.js pinned to **0.185.0**. Final JS bundle ~623.91 kB / 162.36 kB gzip.
- Browser smoke test against the final production build: **passed** in headless Chrome with software WebGL. Checked readiness, 900 lanterns, WASD movement, Q orbit, right-drag orbit, wheel zoom, actual ground pointer click/movement, High/Low toggle both ways, help visibility, district banners, 1440×1000 and 390×844 layouts, spawn clearance, both bridge openings, water blockage and the pier's blocked far end. **No page errors or console errors.** Remote Google Fonts CSS was replaced with an empty stylesheet during the deterministic offline-font check.
- Visually inspected spawn, plaza, temple and narrow viewport captures. Fixed intersecting paver z-fighting found during inspection. Verification scripts/screenshots are in ignored `.codex-run/qa/`; they are local audit artifacts, not runtime dependencies or committed assets.
- Code formatted with Prettier; whitespace validation clean. No character art from `output/` was copied into the game.

## Known limitations

- This is a procedural prototype, not final environment art. Player/NPCs are placeholders; real Muay Thai sprite atlases and glTF buildings are not shipped.
- Click-to-move steers directly with sliding and stops when blocked; it does not compute a path around obstacles. Ground-ray picking does not perform rooftop-aware occlusion picking.
- Lamp guardians, quest progress, the Name-Eater, a functional midnight bell, sound and future-map travel are hook data only.
- Tilt-shift is a restrained screen-space approximation, not physical lens depth of field. Transparent effects have intentionally simplified depth behavior.
- High mode adds several full-scene passes. Headless software rendering verifies functionality, **not target-device performance**; no hardware FPS guarantee is claimed. Low mode is available for less capable devices.
- Vite reports the standard >500 kB chunk advisory because Three.js/postprocessing is bundled into one entry. This is not a build failure; split/cache engine code when preparing distribution.
- Thai webfonts require network access; offline browser/OS fallback can change sign and HUD letter metrics.
- Small viewports have a responsive HUD but movement is desktop keyboard/mouse; touch joystick support is not implemented.

## Suggested next steps

1. Review the procedural town and district scale in a normal GPU-backed browser with `npm run dev`.
2. Supply production 8-direction fighter atlases with consistent frame dimensions, padding and bottom-center foot anchors; wire distinct animation states through the existing sprite adapter.
3. Register final Thai timber/temple/prop glTF factories by asset ID, keeping the layout-owned collider footprints accurate.
4. Add route finding/navmesh, memory quests and ghost guardians before enabling the northern map exits.
5. Profile High/Low modes on target hardware, then add LODs, frustum-aware detail and engine bundle splitting where measurements justify them.
6. Implement character creation and the skippable black-whirlpool intro separately, as documented in the plan.
