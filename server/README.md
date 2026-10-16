# ThaiNative web server

Express 5 + TypeScript, Node 22 or newer. One Node process serves the built portal, game and REST API. The old Colyseus skeleton is replaced; there is no multiplayer service in this build.

From the repository root:

```sh
npm ci
npm run build
npm start
```

The root server build explicitly includes dev dependencies so TypeScript compilation works even when the hosting build has `NODE_ENV=production`.

Default address: `http://127.0.0.1:8787`. Development uses two terminals: `npm run dev:server` and `npm run dev:meadow`; Vite proxies `/api` and `/healthz` to port 8787. `npm test` runs 21 meadow tests, the account/API tests and a five-page Vite build test. `npm run check:meadow` checks frontend types. `npm run test:server` uses MemoryStore and ephemeral HTTP ports with native fetch, without supertest or live Google credentials.

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

Boot runs `sql/001_init.sql` inside a transaction and migration advisory lock. It creates only `tn2_accounts`, `tn2_characters`, `tn2_sessions` and their indexes. Existing tables are untouched. Character slot allocation locks the account row; global active names use a unique partial index, so deleted names can be reused. Names are NFC-normalized, case insensitive for uniqueness, 2–12 Unicode code points, with Thai/Latin letters and digits. Surrounding or internal whitespace is rejected.

Cookies contain a random 32-byte opaque token, last 30 days, and are HttpOnly, SameSite=Lax, Path=/, Secure in production/HTTPS. Only SHA-256 hashes reach storage. Selected character is session-scoped. Guest recovery keys are returned once, hashed separately on the server, and saved by the client in localStorage. Logout removes the session but retains the local recovery key; returning to login offers the old Guest. Losing both the cookie and local recovery key loses access to an unlinked guest. Guest recovery from MemoryStore cannot survive server restarts. Linking Google keeps characters, invalidates guest recovery and earlier sessions, and issues a new session. Accounts bound to another Google subject cannot be silently merged.

The API accepts JSON and text/plain JSON beacons, limited to 16 kB. Auth creation/resume/Google requests share a 20-per-minute IP budget. Cross-origin browser writes are rejected. The app trusts one proxy hop for Railway; do not expose it behind an untrusted proxy chain.

Progress saves clamp level to 1–99 and at most +3 per save, XP to nonnegative integers up to previous+10,000 (absolute 1,000,000), gold to previous..previous+5,000, kills to previous..previous+100 and potions to 0–5. Level/gold/kills never decrease. Coordinates are bounded; the game only restores a walkable location. XP can decrease for level-up rollover; stale same-level saves cannot reduce XP. These are UAT sanity bounds, **not a server-authoritative combat or anti-cheat system**. Boss HP, summons, ground drops and transient combat state reset on re-entry; saved kills restore the boss unlock. Characters resume with full HP/MP derived from level. Autosave runs every 20 seconds while playing, on level-up/victory/death, and on hidden/pagehide via beacon. Requests in a live page are serialized.

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
| POST | `/api/characters/:id/progress` | Bounded progress update; JSON or text/plain. |
| GET | `/`, `/login.html`, `/characters.html`, `/play.html`, `/character.html` | Portal, login, character select, protected play boot, public atelier. |

HTML and versioned artwork use no-cache; hashed JS/CSS assets use one-year immutable caching. Missing API routes return JSON 404; other unknown GET paths fall back to the portal. `railway.json` builds web + server, starts Node, and retains `/healthz`. Terms, privacy and Discord links intentionally remain placeholders until the owner supplies those pages/URLs. No deployment or commit is performed by this task.
