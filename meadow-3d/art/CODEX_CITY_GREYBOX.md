# Codex task: city plaza greybox (นครที่ถูกลืมเลือน) + map transition to the meadow

Design doc: "นครที่ถูกลืมเลือน — ออกแบบเมือง (เขตแรก)" (owner approved). Goal of this round: a walkable **greybox** of the central plaza so the owner can judge size and layout. No new painted art (boxes/cylinders with flat muted colours are fine; reuse existing NPC sprites like the Angel; other NPCs = simple labelled placeholders). Server-authoritative rules from earlier tasks still apply.

Read first: `meadow-3d/src/{main,scene,assets}.ts`, `meadow-3d/src/net/*`, `shared/src/game/{sim,protocol}.ts`, `shared/data/{monsters,jobs}.json`, `server/src/realtime/index.ts`, `server/src/store/*`, `server/sql/*`, `meadow-3d/src/skills-ui.ts` (Angel dialog), `meadow-3d/src/audio-events.ts`.

## 1. Maps
- Introduce map ids: `city_plaza` (new) and `meadow` (existing). Character stores `map_id` + position (`server/sql/008_maps.sql`, idempotent; existing characters → `city_plaza` at spawn once).
- **city_plaza**: square ~60 × 60 m inside a wall, layout as in the doc map (north up):
  - Centre: clock tower (tall box + cylinder) = **spawn / respawn point**; Angel stands on its south steps (reuse existing Angel sprite + dialog: tier-2 at Job 40, "ยังไม่ถึงเวลา").
  - North: storage building + NPC คนเฝ้าคลัง (placeholder, dialog "เร็ว ๆ นี้").
  - West: forge + ช่างตีเหล็ก (placeholder "เร็ว ๆ นี้"). East: market stall + พ่อค้าเบ็ดเตล็ด (placeholder "เร็ว ๆ นี้").
  - South-west of the tower: fountain + **นักบวชหมอ**: talk → full HP/SP heal, 60 s per-character cooldown (server-validated, range check).
  - Cross-shaped main roads tower → each side; walk from tower to any building ≤ 10 s.
  - **4 gates** in the wall midpoints. Only **south gate** works: walking into its trigger → load `meadow`. North/East/West gates are closed (solid), approaching shows Thai toast "หมอกหนาเกินไป ยังผ่านไม่ได้".
  - No monsters, no combat in the city (skills/attacks disabled with a soft Thai notice; potions allowed).
  - Fog: light in the plaza, thicker towards/over the walls (Three.js fog or fog planes), so nothing beyond the wall is visible.
  - หัวหน้าทหารประตู placeholder NPC beside the south gate with a short Thai tip for new players.
- **meadow**: player arrives at a new entry point on the north edge (city side); a gate prop there leads back to `city_plaza` (arrive just inside the south gate). Monster density/level grows with distance from the entry. Move the King Jelly arena to the far end opposite the entry (keep King HP/timers/unlock rules unchanged). The old camp stays as a rest spot; the Angel moves out of the meadow to the city.
- Death anywhere → respawn at the clock tower.

## 2. Server / protocol
- Per-map rooms in the realtime server (`city_plaza` has no monster sim). Intent `{t:"travel", gate}` validated by position/range server-side; server moves the character, persists `map_id`/position, sends the new map snapshot. Load screen/fade on the client (reuse loading style, ≤ 1 s when assets cached).
- City assets must not add to the meadow's critical bytes; city greybox loads on its own (it's tiny).

## 3. Client
- Minimap/area name banner on arrival: "นครที่ถูกลืมเลือน · ลานกลางเมือง" and "ทุ่งวุ้นจิ๋ว".
- Ambience: in the city reuse the meadow loop at lower volume for now (city loop comes later); keep existing SFX hooks.
- Mobile 390×844 still works (touch walk, talk button near NPCs).

## 4. Tests & verify
Shared/server: travel only from inside gate range; closed gates rejected; heal cooldown; respawn goes to city; migration puts old characters in the city once; no combat in the city. `npm test`, `npm run build`. One headless smoke: spawn in city → walk to south gate → meadow loads → back to city, no console errors. Save 2 screenshots only: `.codex-run/city-greybox-top.jpg` (overview) and `.codex-run/city-greybox-ground.jpg` (player view at spawn). Report `.codex-run/city-greybox-report.json` (files, map sizes, walk times tower→each building, anything off). Do not commit. Never touch the Railway production environment.
