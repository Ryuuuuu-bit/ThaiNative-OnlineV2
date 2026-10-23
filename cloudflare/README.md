# Cloudflare Containers preview

This runs the existing Node.js 22 / Express / WebSocket server and PostgreSQL
store. `wrangler.jsonc` targets **the-beginning-online-preview** only. It has no
custom domain or production route. Railway configuration remains in place.

All traffic goes to one named container, preserving the existing room, party and
trade ownership. Do not add load balancing or more instances without implementing
cross-process coordination. PostgreSQL holds durable data; container disk is
ephemeral. The 15-minute idle timeout exceeds the server's disconnected-room
retention window. An open WebSocket keeps the Durable Object active.

## Prerequisites

- Cloudflare Workers Paid and an authenticated account with Containers access.
- Docker-compatible Linux image builder, locally or in Workers Builds.
- A **separate PostgreSQL test database**, with its own credentials. Starting the
  server runs migrations and writes game data. Never use the player database for
  this preview or for `PG_TEST_URL`.
- A public database endpoint reachable from Cloudflare, with TLS and certificate
  verification as required by the database provider. A `*.railway.internal` URL
  cannot be used outside Railway. Keep existing TLS validation enabled.

The preview URL is public; use only synthetic test accounts and data. Add access
controls if the environment must be private.

## Install and validate

Run from the repository root:

```powershell
npm ci
npm --prefix server ci --include=dev
npm --prefix cloudflare ci
npm test
npm run build
npm --prefix cloudflare run check
```

The root tests include proxy tests using the real application and WebSocket
server. Set `PG_TEST_URL` to a disposable database to also run PostgreSQL tests.
Run server tests serially when sharing one test database: some migration tests
temporarily change constraints and triggers.

```powershell
# Set PG_TEST_URL through a local secret mechanism, not a checked-in file.
node server/node_modules/tsx/dist/cli.mjs --test --test-concurrency=1 server/src/tests/*.test.ts
npm run test:cloudflare
```

Without Docker, the following checks **only Worker packaging**, not the image:

```powershell
npm --prefix cloudflare run check -- --containers-rollout=none
```

## Configure preview secrets and deploy

Set these secrets on the preview Worker using the dashboard or interactive
`wrangler secret put --config cloudflare/wrangler.jsonc <NAME>`:

- `DATABASE_URL`: isolated test database, never the Railway player database.
- `SESSION_SECRET`: a new random secret of at least 32 characters for preview.

Optional existing settings are `GOOGLE_CLIENT_ID`, `ADMIN_IDS`, `SHARED_ROOMS` and
`UAT_JOB_EXP_MULTIPLIER`. Only these named settings are passed to Node. Google
login also requires the preview origin in the OAuth client's authorized origins.

Before building a release, set `containers[0].image_vars.VITE_BUILD_ID` in
`wrangler.jsonc` to the tested source commit. The Dockerfile forwards this build
argument through the existing build script; frontend and backend share it through
`build.json`. `PUBLIC_SITE_URL` can also be supplied as a non-secret build argument.
Never put credentials in image variables or Docker build arguments.

```powershell
npm --prefix cloudflare run deploy
```

For a machine without Docker, use **Workers Builds** on the separate preview
Worker. Use the repository root as its build root, install with
`npm --prefix cloudflare ci`, and deploy with
`npm --prefix cloudflare run deploy`. A full deploy builds the image; a version
upload alone does not. Deploy a reviewed, committed source revision. Do not use a
production Worker's non-production branch command to deploy this preview.

After provisioning finishes, set `CF_PREVIEW_URL` to the returned
`https://the-beginning-online-preview.<account>.workers.dev` URL and
`CF_EXPECTED_BUILD` to the tested build ID, then run:

```powershell
npm --prefix cloudflare run smoke
```

This creates synthetic accounts and a character, verifies built assets, password
login, Secure cookies, HTTP/WebSocket origin rejection, snapshots, reconnect and
server authority. It refuses arbitrary production URLs. Also test the real game
in a browser, including Google login if enabled, trading between two accounts,
server restart with saved inventory, and latency from Thailand.

## Gate before switching real traffic

Do not switch a domain, disable Railway, or attach the player database until the
Linux image, remote PostgreSQL connection, smoke checks and browser checks pass.
Keep a current database backup and verify restoration. Arrange a maintenance
window and stop the old game process before the new one takes player traffic;
the server keeps live rooms and social state in process memory.

Review/rotate credentials stored in Railway according to its security notice.
Changing `SESSION_SECRET` invalidates existing sessions and guest recovery keys;
plan guest account recovery before a production rotation. Reuse neither player
cookies nor production secrets for this preview.

References: [Containers deployment](https://developers.cloudflare.com/containers/guides/deploy/),
[Container lifecycle](https://developers.cloudflare.com/containers/concepts/architecture/),
[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/),
[Railway security notice](https://blog.railway.com/p/security-disclosure-wednesday-october-21st).
