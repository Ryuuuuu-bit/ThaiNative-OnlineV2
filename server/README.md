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
| `DATABASE_URL` | Absent: temporary MemoryStore (local only). Present: `pg` PostgresStore. **Required in production/any Railway environment**: startup refuses MemoryStore there unless `ALLOW_MEMORY_STORE=1`. |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth **Web application** client ID. Absent: sign-in page explains that Google is unavailable; Guest still works. No client secret is needed for GIS ID-token verification. |
| `SESSION_SECRET` | Stable pepper mixed into session/recovery-key hashes. **Required in production/any Railway environment and at least 32 characters** (startup refuses otherwise); optional locally. Changing it invalidates existing session cookies and guest recovery keys. |
| `STATIC_DIR` | `meadow-3d/dist`, relative to the Node process working directory. |
| `NODE_ENV` | Set to `production` in hosting; session cookies are also Secure whenever the trusted proxy reports HTTPS. |
| `RAILWAY_GIT_COMMIT_SHA` | First eight characters become the build ID. Otherwise `VITE_BUILD_ID`, then the UTC build date. |

Configuration is read from process environment. The old skeleton `.env.*` files are not automatically loaded. No production environment was read or modified while implementing this task.

## Persistence and sessions

Boot runs `sql/001_init.sql` and `sql/002_stats.sql` inside a transaction and migration advisory lock. It creates only `tn2_accounts`, `tn2_characters`, `tn2_sessions` and their indexes. Unrelated legacy tables are untouched. Character slot allocation locks the account row; global active names use a unique partial index, so deleted names can be reused. Names are NFC-normalized, case insensitive for uniqueness, 2–12 Unicode code points, with Thai/Latin letters and digits. Surrounding or internal whitespace is rejected.

Cookies contain a random 32-byte opaque token, last 30 days, and are HttpOnly, SameSite=Lax, Path=/, Secure in production/HTTPS. Only SHA-256 hashes reach storage. Selected character is session-scoped. Guest recovery keys are returned once, hashed separately on the server, and saved by the client in localStorage. Logout removes the session but retains the local recovery key; returning to login offers the old Guest. Losing both the cookie and local recovery key loses access to an unlinked guest. Guest recovery from MemoryStore cannot survive server restarts. Linking Google keeps characters, invalidates guest recovery and earlier sessions, and issues a new session. Accounts bound to another Google subject cannot be silently merged.

Username/password accounts (`sql/015_accounts_password_uid.sql`): `POST /api/register {username,password,confirmPassword,linkGuest?}`, `POST /api/login {username,password}`, `POST /api/password {currentPassword,newPassword,confirmPassword}`. Usernames are 3–20 `[A-Za-z0-9_]`, unique case-insensitively (`username_key`), with reserved staff/system names refused. Passwords are 8–128 characters, hashed with scrypt (N=2^15, r=8, p=1, 16-byte per-user salt, constant-time compare); the plaintext is never logged or returned. A signed-in guest who registers becomes that account (characters and UID kept, guest key and old sessions revoked) unless `linkGuest:false`. Wrong username and wrong password return the same `LOGIN_FAILED`; unknown names still run the KDF. Failed logins back off per username (5 free, then 30 s doubling to 15 min, existing or not) and per IP (20 free); register is capped at 30/hour/IP. Lockout counters are per process. Changing the password signs out every other device.

Every account has a `uid`: 9 random digits, separate from the internal UUID and never derived from email/Google. The migration backfills existing rows, sets a unique index and a trigger that refuses any change once set. `/api/me` returns `uid`; the login, character and in-game menu screens show it with a copy button.

The API accepts JSON and text/plain JSON beacons, limited to 16 kB. Auth creation/resume/Google/login/register/password requests share a 20-per-minute IP budget. Cross-origin browser writes are rejected. The app trusts one proxy hop for Railway; do not expose it behind an untrusted proxy chain.

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

## Jobs and skills

Migrations004/005 add independent Job EXP, levels, points, learned-skill JSON and ten hotbar slots with server-saved keys.005 is the owner follow-up and uses a version marker for one-time grants; old novice characters become swordsmen, existing learned skills stay, custom hotbars stay, and only old default layouts become1–5/6–0. SkillUp, hotbar and jobChange WebSocket intents validate and save immediately. Job changes require the Angel's server-side range and level gate.

For isolated local UAT only, `UAT_JOB_EXP_MULTIPLIER=1000` accelerates earned kill Job EXP. It defaults to1; production or any Railway environment forces1. The flag does not grant skills, points, level or position from the client. Verification uses a local temporary PostgreSQL instance; never run these tests against production.


## Titles and rankings

Migration `017_titles.sql` adds per-character cosmetic title selection, permanent earned title IDs,
and server-recorded boss kills. Existing level/kill milestones unlock on joining; historical boss
kills are unknown and start counting after this feature is installed. Titles grant no combat stats.
The in-game menu opens the title book and server rankings; equipped titles appear above player
names and in chat. Titles save through the same lease-fenced room queue as progress.

WebSocket intents: `titles`, `titleEquip {id: string|null}`, `rankings {board: "level"|"hunt"}`.
All are strict objects. The server checks ownership/eligibility; clients cannot submit progress or
unlocks. The PvP catalogue (duel, red-player hunts, sin/merit and legendary titles) is visible with
its requirements but explicitly unavailable, including when a saved ID claims ownership.
No duel/PK rules or rewards are enabled by this feature.

Leaderboards expose up to 100 public character rows and the caller's own rank, include active
saved characters offline, merge live progression, and refresh saved data at most once a minute
(joining invalidates the saved cache). Level ties use XP then stable character ID; hunt ties use
level, XP then ID. Characters with no kills have no hunt rank. Temporary Top 1/3/10 titles are
rechecked on title requests, gameplay progress, and the minute refresh. A failed database read
retains the previous board. Power/refinement/PvP leaderboards await their gameplay systems.

Tests cover server selection, failed saves, reconnect, public snapshots/chat, rank revocation,
PvP rejection, and isolated PostgreSQL migration/persistence (`PG_TEST_URL` must point to a
throwaway local database).
