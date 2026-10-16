# Codex task: server-authoritative combat over WebSocket (stats plan step 2)

Read first: `meadow-3d/src/sim.ts` (pure fixed-step game: `createGame`, `step`, `action`, `moveTo`, `setAuto`, `revive`, events), `meadow-3d/src/main.ts` (render loop, input, HUD, how events drive VFX/sound), `meadow-3d/src/web/game-session.ts` (load/restore/autosave), `meadow-3d/src/keys.ts`, `shared/` (data, `deriveStats`, `computeDamage`, README), `server/src/app.ts`, `server/src/index.ts`, `server/src/session.ts`, `server/src/routes/characters.ts`, `server/src/store/*`, root `package.json`, `railway.json`.

Goal: the server owns the game state. The browser sends **intents** (move here, use skill X on target Y, toggle auto, drink potion, revive) and renders **snapshots + events** from the server. Damage, HP, EXP, level, gold, kills, potions and drops are decided only on the server with `shared/` (`deriveStats` + `computeDamage`), and saved from the server. After this task a player editing JavaScript in DevTools cannot change their gold, level or damage.

Gameplay must feel the same as today (movement, combo, Q/E/Shift/R/F/Tab, AUTO, King Slime pattern and phases, camp healing, revive). One process, one port, same Railway service.

## 1. Move the sim into `shared/`

- `meadow-3d/src/sim.ts` → `shared/src/game/sim.ts` (+ `monster-motion-data.ts` if the sim needs it, or move only timing constants). Keep it pure and deterministic: no `Math.random()` (use a seeded RNG carried in `Game`), no DOM, no `performance.now()`.
- Replace its hard-coded combat numbers with `shared/` data: player stats from `deriveStats(character)`, every hit through `computeDamage(attacker, defender, skill, ctx)`; monster HP/ATK/DEF/element/EXP/gold from `monsters.json`; skill SP/cooldowns/radius from `skills.json`; potion from `skills.json`. Combat events carry the `breakdown` so the client can show crits/elements later.
- Keep existing behaviour tests passing (port `meadow-3d/tests/combat.test.mjs`, `auto.test.mjs`, `monsters.test.mjs` to import from the shared sim; update numbers only where the shared data intentionally differs, and list each in the report).
- The client still imports the sim, but only for **prediction of its own movement** (see §4).

## 2. WebSocket server (`server/src/realtime/`)

- Library: `ws` (add to `server/package.json`). Mount on the existing HTTP server at path `/api/ws` (same origin, cookies come along). Upgrade handler authenticates with the `tn_session` cookie and the selected character; reject with 4401 if no session / no character.
- Query: `/api/ws?v=<client build id>&area=meadow-01`. If `v` differs from the server build id, send `{t:"reload"}` and close (forces stale tabs to refresh).
- **Rooms**: `Room` = one `Game` + the connected players in it, ticking at **20 Hz** (`setInterval` 50 ms, fixed-step `step(game, 0.05)`), keyed by area. Default: **one private room per character** (`room = area + ":" + characterId`) so gameplay is unchanged. Env `SHARED_ROOMS=1` puts everyone in one `meadow-01` room — the sim must already support N players (`players: Map<id, Player>`, enemies target the nearest player, loot to the player who dealt the most damage, King unlock counter per room). Ship with private rooms; shared rooms are verified by a test and a 2-tab manual check only.
- **Client → server** (JSON, ≤ 30 msgs/s per socket, drop and count anything above; schema-validated with zod):
  `{t:"hello"}` · `{t:"spawnReady"}` (character appears only after the client loaded the scene) · `{t:"move", x, z, seq}` (target point or joystick direction `{t:"steer", dx, dz, seq}`) · `{t:"act", a:"attack"|"spin"|"meteor"|"dash"|"potion", target?, seq}` · `{t:"auto", on}` · `{t:"target", id}` · `{t:"revive"}` · `{t:"ping", c}`.
  Don't resend identical consecutive `move`/`steer` (client side de-dup).
- **Server → client**:
  `{t:"welcome", you, build, tick, dataVersion}` · `{t:"snap", tick, ack, players:[…], enemies:[…], drops:[…], projectiles:[…]}` at 10 Hz (only fields the renderer needs: id, x, z, fx, fz, motion, motionTime, hp/maxHp, flags; `ack` = last processed `seq` of this client) · `{t:"ev", tick, list:[…]}` immediately for combat/loot/level/notice events (the same event shapes `main.ts` already consumes) · `{t:"pong", c, s}` · `{t:"reload"}` · `{t:"kick", reason}`.
- **Server-side validation**: speed cap (reject/clamp moves faster than move speed × 1.1), skill cooldown/SP/range checked by the sim not trusted from client, target must exist and be in range, potions count from server state.
- **Persistence**: the room saves each player's character (level, xp, gold, kills, potions, position, base stats) to the store every 30 s, on level up, King defeat, death, and on disconnect. `POST /api/characters/:id/progress` from the client is **removed** (return 410 Gone) — the server is now the only writer.
- **Lifecycle**: on disconnect keep the room 60 s for reconnect (same character resumes exactly), then save and dispose. One live socket per character: a new connection kicks the old (`{t:"kick", reason:"opened elsewhere"}`).
- Heartbeat: server pings every 15 s, drops sockets silent for 30 s.
- Metrics on `GET /api/admin/realtime` (only when `ADMIN_IDS` contains the account id): rooms, sockets, tick time p50/p95, messages in/out per second, rate-limit drops.

## 3. Shared data in the save

- Extend `tn2_characters` with `base_stats jsonb` (str/agi/vit/int/dex/luk, default the `defaultBuild`), `race text default 'human'`, `class text default 'novice_knight'`, `stat_points int default 0`, `data_version int`. Migration `sql/002_stats.sql`, idempotent. Existing characters get the default build.
- Level up grants 3 stat points (stored, not spent yet — the stat window is step 3). Derived stats are never stored (computed at load).

## 4. Client (`meadow-3d/src/net/`)

- `net/socket.ts`: connect, reconnect with backoff (0.5, 1, 2, 4, 8 s, max 30 s), show "กำลังเชื่อมต่อ…" / "การเชื่อมต่อขาด กำลังต่อใหม่" banners, median-of-5 ping shown next to FPS.
- `net/world.ts`: keeps the last two snapshots and renders **100 ms in the past** with interpolation for enemies, other players, drops and projectiles.
- **Own player**: client-side prediction of movement only (run the shared movement/collision code locally on input, tag with `seq`; on each snap re-apply un-acked inputs on top of the server position; snap if error > 1.5 units, otherwise smooth over 150 ms). Attacks/skills: play the swing animation immediately (feels instant), but damage numbers, HP changes, deaths, loot come only from server events.
- `main.ts` stops calling `step()` for game logic; it reads state from `world` and events from the socket. Keep all rendering, HUD, VFX, audio, AUTO button, hotkeys, touch controls, character select flow.
- AUTO runs **on the server** (`{t:"auto", on}`), so it keeps hunting while the tab is in the background; closing the tab still stops after the 60 s reconnect window.
- Remove client autosave (`attachAutosave`) and the progress POST; on `pagehide` just close the socket.
- Offline / server down: show an overlay "เซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง" with a retry button. (No offline single-player fallback.)

## 5. Tests

- Shared sim: determinism (same seed + same inputs → same state after 2,000 ticks), N-player room (2 players, enemies pick nearest, loot to top damage), King unlock per room.
- Server realtime (node:test, real HTTP server on an ephemeral port, `ws` client): unauthenticated upgrade → 4401; wrong build → reload; spawnReady gate; move speed clamp; attack out of range ignored; spamming 200 msgs/s gets rate-limited and stays connected; cooldown cannot be bypassed by sending `act` twice; kill → EXP/gold persisted in the store; disconnect + reconnect within 60 s resumes; second socket kicks first; `POST /progress` → 410.
- Client: prediction reconciliation unit test (inputs replayed after ack, snap threshold).
- Keep every existing suite green (`npm test`).

## 6. Verification

`npm test`, `npm run build`, `npm start` locally with memory store, then a browser run: guest → create character → play: walk, combo, Q, E, Shift dodge, R potion, F AUTO for 2 minutes in a background tab, King fight to victory, die once and revive, reload → level/gold restored from the server. Also try in DevTools: set gold / call the old progress endpoint / send a fake `act` with huge damage → nothing changes. Measure with 1 and with 20 simulated clients (`server/loadtest/ws.mjs`, private rooms): server tick p95 must stay < 10 ms on the dev machine; report CPU and bandwidth per client (target < 6 KB/s per client).

Screenshots `.codex-run/net-play.jpg`, `net-reconnect.jpg`; report `.codex-run/server-authority-report.json` (files, protocol summary, numbers that changed vs the old sim and why, load-test numbers, anything that feels different). Do not commit. Do not touch PNGs or the web pages' look. Production Railway env must not be touched.
