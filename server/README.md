# ThaiNative web server

Express 5 + TypeScript, Node 22 or newer. One Node process serves the built portal, game and REST API. The same HTTP server hosts authenticated WebSockets and the shared authoritative sim; default rooms are private per character.

From the repository root:

```sh
npm ci
npm run build
npm start
```

The root server build explicitly includes dev dependencies so TypeScript compilation works even when the hosting build has `NODE_ENV=production`.

Default address: `http://127.0.0.1:8787`. Development uses two terminals: `npm run dev:server` and `npm run dev:meadow`; Vite proxies HTTP/WebSocket `/api` and HTTP `/healthz` to port 8787. `npm test` runs meadow, shared sim/stats, account/WebSocket and five-page build tests. `npm run check:meadow` checks frontend types. `npm run test:server` uses MemoryStore and ephemeral HTTP ports with native fetch, without supertest or live Google credentials.

## Environment

| Variable | Default / use |
| --- | --- |
| `PORT` | `8787`; Railway supplies its own port. |
| `DATABASE_URL` | Absent: temporary MemoryStore. Present: `pg` PostgresStore. Use a Railway Postgres connection URL for persistent UAT accounts/progress. |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth **Web application** client ID. Absent: sign-in page explains that Google is unavailable; Guest still works. No client secret is needed for GIS ID-token verification. |
| `SESSION_SECRET` | Optional stable pepper mixed into session/recovery-key hashes. Set a long random value for hosted use. Changing it invalidates existing session cookies and guest recovery keys. |
| `STATIC_DIR` | `meadow-3d/dist`, relative to the Node process working directory. |
| `NODE_ENV` | Set to `production` in hosting; session cookies are also Secure whenever the trusted proxy reports HTTPS. |
| `RAILWAY_GIT_COMMIT_SHA` | First eight characters become the build ID. Otherwise `VITE_BUILD_ID`, then the UTC build date. |

Configuration is read from process environment. The old skeleton `.env.*` files are not automatically loaded. No production environment was read or modified while implementing this task.

## Persistence and sessions

Boot runs `sql/001_init.sql` and `sql/002_stats.sql` inside a transaction and migration advisory lock. It creates only `tn2_accounts`, `tn2_characters`, `tn2_sessions` and their indexes. Unrelated legacy tables are untouched. Character slot allocation locks the account row; global active names use a unique partial index, so deleted names can be reused. Names are NFC-normalized, case insensitive for uniqueness, 2–12 Unicode code points, with Thai/Latin letters and digits. Surrounding or internal whitespace is rejected.

Cookies contain a random 32-byte opaque token, last 30 days, and are HttpOnly, SameSite=Lax, Path=/, Secure in production/HTTPS. Only SHA-256 hashes reach storage. Selected character is session-scoped. Guest recovery keys are returned once, hashed separately on the server, and saved by the client in localStorage. Logout removes the session but retains the local recovery key; returning to login offers the old Guest. Losing both the cookie and local recovery key loses access to an unlinked guest. Guest recovery from MemoryStore cannot survive server restarts. Linking Google keeps characters, invalidates guest recovery and earlier sessions, and issues a new session. Accounts bound to another Google subject cannot be silently merged.

The API accepts JSON and text/plain JSON beacons, limited to 16 kB. Auth creation/resume/Google requests share a 20-per-minute IP budget. Cross-origin browser writes are rejected. The app trusts one proxy hop for Railway; do not expose it behind an untrusted proxy chain.

Only the room calls `Store.saveProgress`; the old progress POST returns **410 Gone** after ownership checks. The server saves every 30 seconds, on level-up/King defeat/death and disconnect, with serialized per-room write queues. No client beacon or progress body can write level, gold, damage or stats. A reconnect within 60 seconds resumes the retained room exactly (time, AUTO, enemies and loot continue); after expiry a new room restores saved progression/position and full derived HP/SP. MemoryStore remains temporary across process restarts.

`sql/002_stats.sql` is applied idempotently after 001 under the same advisory lock. It adds base_stats, race, class, stat_points and data_version with defaults/backfill for existing characters. XP becomes bigint because the requested level-99 EXP table exceeds int32; the adapter converts it back to a JS number. Derived combat stats never enter the database. Level-ups grant three unspent stat points.

## Realtime protocol and operations

`/api/ws?v=<build>&area=meadow-01` authenticates the same HttpOnly cookie and selected character. Missing auth/selection closes4401; stale builds receive reload and close4400. Cross-origin upgrades close4403. The ready gate excludes a new character until spawnReady. A replacement connection kicks the old one with opened elsewhere. Revoked/switched sessions are checked at each heartbeat.

Client intents are strict Zod objects (4kB max frames): hello, spawnReady, move(x,z,seq), steer(dx,dz,seq), act(a,target?,seq), auto(on), target(id), revive, ping(c). Unknown damage/gold fields are rejected. Movement is normalized and applied only with the server's fixed elapsed time and collision map; no position/time/damage authority is accepted. Skill range/SP/cooldown/potions are checked on the server. Above30 messages/second are dropped and counted; the socket stays connected. Slow consumers over128kB queued output are disconnected.

Server messages are welcome(you,build,tick,dataVersion), snap(tick,ack,players,enemies,drops,projectiles plus room flags/time), ev(tick,list), pong(c,s), reload and kick(reason). Snapshots run at10Hz, with permessage-deflate negotiated for browser bandwidth; actual uncompressed JSON is substantially larger. Combat events retain breakdown, element and owning playerId. Only approved render fields reach snapshots, never authoritative profile/stat objects or RNG state.

Room simulation uses 50ms fixed steps with a bounded catch-up accumulator (five steps maximum per timer callback), avoiding Windows interval drift. No rendering clock or client time changes game time. Enemies select the closest living player; top actual damage wins each drop, and the six-kill King counter belongs to the room. Reviving one player does not reset another player's shared fight.

Set **SHARED_ROOMS=1** only for the optional shared meadow; absent/0 gives `meadow-01:<characterId>`. Set **ADMIN_IDS** to comma-separated account UUIDs to permit GET /api/admin/realtime: room/socket counts, tick p50/p95 milliseconds, message rates, invalid messages and rate-limit drops. Other callers receive403. There is no public administrative mutation API. Heartbeats ping15s and terminate sockets silent30s. Disconnected AUTO keeps running during the60s retention window, then the player is saved/removed.

The client predicts only normalized movement/collision. It reconciles acknowledgements, jumps beyond1.5 units of error and smooths smaller corrections over150ms. Enemies/other heroes/drops/projectiles interpolate100ms behind the latest server timeline. Immediate swings are cosmetic; all combat outcomes arrive from the server. Backoff is0.5/1/2/4/8…30s; offline/kicked states offer retry. Menus cannot freeze a server-owned world; Escape stops AUTO and movement, while background AUTO continues. Re-entering an already running private room retains its encounter until expiry.

Run `node server/loadtest/ws.mjs --seconds 15` after building for1/20 real WebSocket clients in private rooms; `--clients N` selects one count. It starts an isolated ephemeral MemoryStore service and reports CPU (one-core percentage, including in-process simulated clients), tick times, raw JSON and compressed socket-wire bytes/client/second. It exits nonzero at tick p95>=10ms or compressed bandwidth>=6000B/s. It never connects to Railway or changes production environment.

## Google setup still needed for a hosted login

1. Create a Google OAuth Web application client and configure its consent screen/test users for the UAT audience.
2. Add the exact authorised JavaScript origins: `http://localhost:8787`, `http://127.0.0.1:8787`, `http://localhost:5173`, `http://127.0.0.1:5173` as needed locally, and the actual HTTPS Railway/custom-domain origin. GIS uses a JavaScript credential callback here, not a redirect URI flow.
3. Set `GOOGLE_CLIENT_ID` on the server. The client loads GIS only on login.html when config enables it, renders a Thai button, and never calls One Tap. Blocked GIS leaves the Guest option usable. Google ID tokens are verified by google-auth-library with the configured audience.

References: [Google button rendering](https://developers.google.com/identity/gsi/web/guides/display-button), [Google ID-token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Express 5 routing](https://expressjs.com/en/guide/migrating-5/).

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Plain `ok` health check. |
| GET | `/api/config` | Google client ID or null; build ID. |
| POST | `/api/guest` | New guest/session; existing session is retained. |
| POST | `/api/guest/resume` | Recover guest from local recovery key. |
| POST | `/api/google` | Verify ID token; sign in or link current Guest. |
| GET | `/api/me` | Account + selected character; 401 otherwise. |
| POST | `/api/logout` | Revoke session and clear cookie. |
| GET, POST | `/api/characters` | List / create up to three characters. |
| GET, DELETE | `/api/characters/:id` | Own character progress / soft delete. |
| POST | `/api/characters/:id/select` | Select owned active character. |
| POST | `/api/characters/:id/progress` | 410 Gone; only server rooms save progress. |
| GET | `/api/admin/realtime` | ADMIN_IDS-authorised realtime metrics. |
| WS | `/api/ws` | Authenticated intents and snapshots/events. |
| GET | `/`, `/login.html`, `/characters.html`, `/play.html`, `/character.html` | Portal, login, character select, protected play boot, public atelier. |

HTML and versioned artwork use no-cache; hashed JS/CSS assets use one-year immutable caching. Missing API routes return JSON 404; other unknown GET paths fall back to the portal. `railway.json` builds web + server, starts Node, and retains `/healthz`. Terms, privacy and Discord links intentionally remain placeholders until the owner supplies those pages/URLs. No deployment or commit is performed by this task.

## Authority verification

All86 tests pass (35 meadow,18 server/API/realtime,one web build,32 shared). Typecheck and the complete production build pass. A normal-input browser account created a character, used all controls, hunted for120s in a background tab, won the King encounter, reconnected, rejected DevTools/obsolete-POST/fake-damage tampering, died, revived and reloaded saved progression. A separate browser check verified the reconnect banner, offline retry overlay and rejoin; two separate accounts verified shared-room other-player movement. Isolated Postgres checks verified legacy backfill, idempotent migrations, server saves and30-billion XP across pool restart.

Fifteen-second measured windows after warmup:1 client tickp95 **0.30ms**, **2.12KB/s** combined compressed traffic;20 private clients tickp95 **1.38ms**, **2.18KB/s/client**, process CPU **5.73% of one core** (including simulated clients). Raw JSON is also recorded (~42KB/s/client); permessage-deflate is material to the bandwidth result. These were AUTO hunting clients with protocol heartbeat and no steady manual input. Full evidence, CPU units and timing/number changes are in `.codex-run/server-authority-report.json`. Screenshots were visually inspected. The normal large Three.js chunk warning remains. No commit, PNG/page markup edit, production environment change or deployment was made.
