# Codex task: stability + bug fixes (Director review, 2026-10-17)

Run after the city art pass is committed. Fix every item below, add a regression test for each server item, no balance/price/art changes except where stated. Verify line numbers yourself (they are from a snapshot taken at 03:40).

## P0 — server must never crash or freeze
1. `server/src/realtime/index.ts` ~:840 heartbeat `void store.session(...).then(...)` has no `.catch` → add one. Add `process.on('unhandledRejection'|'uncaughtException')` in `server/src/index.ts`: log, save all online players, then exit cleanly.
2. `server/src/store/postgres.ts:9` → `pool.on('error', …)` (log only), `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 30000`.
3. Room freeze: tick loop `if(room.economyBusy)continue;` (~:784) stops the whole room sim and intents are dropped after their seq was acked (~:377/394). Remove the room-level `continue`. Track busy **per player**; while a player's economy op is pending, still apply movement/steer/attack; queue (not drop) travel/revive/returnCity/use until the op settles, then apply in order. Test: steer{0,0} sent during a pickup stops the hero.
4. Socket leak on close during join (~:620-758): attach the `close` listener right after upgrade; after the last await re-check `ws.readyState` and roll back `pending`/room entries. Test: close mid-join → no live peer, room deleted.
5. Per-room try/catch around `step`/`snapshot`; on error log + quarantine the room (save players, send them `kick` "เซิร์ฟเวอร์ขัดข้อง กรุณาเข้าใหม่"). Missing item template must not throw (`shared/src/inventory.ts:71` `find(...)!` → skip + log).
6. Shutdown: `closing` flag so close-handler saves don't run after `store.close()`.

## P1 — gameplay / economy correctness
7. King Jelly (sim.ts ~:1522, ~:863):
   - reset HP + `damageBy` when no player has engaged for 30 s or all engaged players died/left;
   - persisted per-character `boss_ready_at` (new migration `011_stability.sql`, idempotent), 10 min after a kill the player earned loot from; relog must not reset it; shared rooms: room respawn timer 10 min.
8. Revive: 5 s revive delay with Thai countdown on the death screen ("ฟื้นที่หอนาฬิกาใน 5…"). No EXP penalty for now (note in report).
9. Drops: despawn after 60 s (owner lock 10 s unchanged); when a pickup fails for bag full/overweight, do **not** retry automatically — show toast "กระเป๋าเต็ม" / "น้ำหนักเกิน" once per drop; manual Z retries. Check capacity in memory before opening a DB transaction.
10. `writeInventory` (postgres.ts ~:47-55): write only changed stacks/items instead of delete+reinsert all; upsert must also update `refine` and `cards`.
11. Snapshots (~:121): send inventory only via `inv` messages on change, not every snapshot. Snapshots of *other* players must not include gold/xp/skills/hotbar/statPoints.
12. Room cleanup scan (~:797): use `live.has(characterIdFromKey)` instead of scanning all peers.
13. Cache ui settings per peer (`sendStats` ~:329), invalidate on settings op.
14. Prune `tn2_requests` older than 24 h hourly (not only at boot).
15. Eviction race (~:785-791): keep a per-character save promise; joins await it before `store.character()`.
16. `google()` (postgres.ts ~:26): do not re-run `003_auto_allocation.sql` on account link — read 003 first; if it has UPDATEs, replace with the minimal per-account step.
17. Refuse to start in production without `SESSION_SECRET`. Per-IP limit: max 5 concurrent sockets, 20 upgrades/min, 10 guest accounts/hour.
18. `/healthz` → 200 only if DB `select 1` < 1 s and tick loop ran in the last 2 s; else 503.
19. One-character-one-session across instances: DB lease (`tn2_characters.online_lease_until` + node id, renewed by heartbeat) or a session-scoped advisory lock; second login kicks the old session ("เข้าสู่ระบบจากที่อื่น").

## P1 — client
20. `main.ts`: when `document.hidden`, skip creating damage numbers / slash / ring / spin / meteor / warning meshes; cap `numbers` at 40 (shift oldest) and remove the O(n²) filter inside `number()`.
21. `togglePause()` must not close the network overlay (offline/kicked/opened elsewhere) or the death overlay; give `offline` a Thai banner + reconnect countdown + retry button.
22. Death UI: show the death overlay from `hud()` whenever `p.dead` and no overlay is open (covers reload/reconnect while dead); revive button disabled while disconnected (toast "ยังไม่ได้เชื่อมต่อ").
23. Prune `statusLabels` together with enemies on removal / map change.
24. Create city/meadow `T.Fog` once; assign only on change (not every 100 ms).
25. Particles/rings: shared geometries + per-colour materials (or pooled InstancedMesh) — no new geometry per hit.
26. Quality: 3-state ภาพ: สูง / ต่ำ / อัตโนมัติ; AutoQuality only runs in อัตโนมัติ; manual choice persists.
27. `pageshow` with `e.persisted` → reload (socket is stopped on pagehide).
28. Key remap (skills-ui ~:172-181, hud-qol ~:23): allow Tab through, whitelist `Key[A-Z]|Digit\d|F\d+`, reject codes already bound (movement, I/C/K/M/H/Z/R/F, hotbar, pause) with a Thai message; server validates the same.
29. Modals block game input: if any `dialog[open]`/menu/NPC dialog is open, ignore movement/skill keys (Escape closes the top dialog first).
30. Inventory: clear `pending` on welcome/reconnect, keep the retry button after reopen; errors from hotbar potion/skills/heal go to the toast stack when the bag is closed. Sell preview uses `economy.sellMultiplier`. Clamp quantity inputs (1..owned / 1..999). Don't send `equip` for consumables dropped on the paperdoll.
31. `switchMap` failure: catch → overlay "โหลดพื้นที่ไม่สำเร็จ" + ลองใหม่, with backoff (no retry every snapshot).
32. Wheel zoom updates the camera only (no `renderer.setSize`). Add pinch-zoom on mobile.
33. Buff icons / job labels: diff before rebuild (tooltips must work); remove duplicate writes in skills-ui.
34. Nameplates use data levels; canvas label width measured from text (no clipping).
35. `localStorage` reads in hud-qol inside try/catch.
36. Logout from the menu asks "ออกจากเกม?" when in combat.

## Verify
`npm test` (expect >144 + new tests), `npm run build`. One headless run: farm 3 min with auto-hunt in a hidden tab then focus (DOM node count stable), full bag pickup (no DB churn: count `tn2_requests` rows), close socket mid-join, kill pg for 5 s (server stays up, players reconnect), King kill → relog → King not ready, steer stop during pickup. Report `.codex-run/stability-report.json` (each item: done/skipped + test name). No screenshots needed. Do not commit. Never touch the Railway production environment.
