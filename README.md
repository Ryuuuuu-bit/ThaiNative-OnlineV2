# ThaiNative Online — นครที่ถูกลืมเลือน

A playable first-town prototype: a low-poly Thai wooden city under an overcast sky, with 900 floating paper lanterns and a 2D billboard player. Vite, vanilla JavaScript ES modules and **three@0.185.0**. No external models or paid assets required.

## Run

Requires Node.js 20.19+ or 22.12+ and a browser supporting WebGL 2.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Production build and local preview:

```sh
npm run build
npm run preview
```

Run simulation/layout checks with `npm test`. Google Fonts supplies Noto Sans Thai and Noto Serif Thai; offline mode uses the browser's Thai font fallback.

## Controls

| Input                            | Action                                               |
| -------------------------------- | ---------------------------------------------------- |
| WASD / arrow keys                | Camera-relative walking                              |
| Left click on ground             | Walk toward destination; stops at obstacles          |
| Q / E                            | Orbit camera                                         |
| Hold right mouse button and drag | Orbit camera                                         |
| Mouse wheel                      | Zoom, limited to 16–72 world units                   |
| คุณภาพ: High / Low               | Toggle GTAO, subtle tilt-shift and shadow resolution |
| วิธีเล่น ?                       | Show controls                                        |

Spawn is on the old pier. Walk close to the waiting elder to see his memory fragment. Cross the canal at either bridge. Houses, the well, props, water and the closed northern gate block movement. Click-to-move is direct steering with wall sliding, **not pathfinding**; choose intermediate destinations around obstacles.

## Extend

- Layout, districts, collider footprints, NPCs, lamps and exit metadata: `src/world/layout.js`.
- Replace procedural geometry by calling `registerAsset(assetId, placement => gltf.scene.clone())` in `src/world/assets.js` before builders run. Factories use ground-level local origin; placements and collision dimensions remain layout-owned.
- Replace the placeholder with `player.setSprite('/sprites/muay-thai-walk.png', { columns: 4, rows: 8, fps: 7 })`. Sheets use rows **S, SE, E, NE, N, NW, W, SW**, columns as frames, consistent padding and a bottom-center foot anchor. A transparent billboard displays approximately 3 world units tall; camera-relative row selection is already wired.
- Use `?debug` on a production preview (development exposes it automatically) for `window.__THAINATIVE__` diagnostics. Normal production pages do not expose these references.
- No character creation, introductory cutscene, combat, ghost AI or map transitions yet. Story hooks are intentionally placeholders.

See `docs/city-plan.md` for coordinates, story hooks, renderer design and the module map.
