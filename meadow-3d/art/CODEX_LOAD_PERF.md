# Codex task: cut cold load time (meadow-3d)

Context: `.codex-run/brand-loading-report.json` measured **39 MB cold download, 36.5 s to playable on Fast 4G**. The owner reports the game "sometimes doesn't come up". Goal: **≤ 10 MB before playable, ≤ 10 s to playable on Fast 4G (DevTools preset), warm reload ≤ 3 s**, with no visible loss of the painted look.

Read first: `meadow-3d/src/main.ts` (LoadingManager, texture/atlas loading), `src/boot.ts`, `play.html`, `scripts/build-web.mjs`, `server/src/app.ts` (static serving), `public/assets/**` (list every file > 200 KB with size and where it is used), `art/*/PROMPTS.md`.

## 1. Measure first
Write `.codex-run/perf-before.json`: every request on cold `play.html` (URL, bytes, type, when requested relative to playable), grouped: scripts / hero atlases / monster atlases / King / environment / UI / audio / brand. Top 15 by size.

## 2. Textures
- Convert painted atlases to **KTX2 (Basis UASTC for hero/monster sprites where edges matter, ETC1S for environment/background)** using `toktx` or `basisu` (install as a dev tool, script `tools/pack-ktx2.mjs`, reproducible). Load with three's `KTX2Loader` (transcoder files served from `public/basis/`, versioned).
- Fallback: if KTX2 is unsupported or transcoder fails, load a **WebP** (quality 82–88) version; keep original PNGs only in `art/` sources, not shipped.
- Check atlas dimensions: nothing above 2048 unless it really needs it; power-of-two where KTX2 needs it; mipmaps only for world textures (not UI/sprites if they look soft).
- Visual check: side-by-side screenshots before/after for hero, วุ้นจิ๋ว, King, camp, pond, trees (`.codex-run/perf-compare-*.jpg`). If any looks visibly worse (banding, blurry ink lines), raise quality for that asset and note it.

## 3. Load order (only what the first screen needs)
- **Critical** (blocks playable): hero idle/walk/attack, jelly sprites for the starting area, ground/environment near spawn, HUD icons.
- **Deferred** (loads in background after playable, low priority): King atlases + King audio (load when the King unlock counter reaches ~60 % or the player is within range of the arena; if not ready when the King spawns, show a short "ราชาวุ้นกำลังมา…" delay instead of a broken sprite), rarely used motions (death, cast variants), far environment props, all music/sfx except UI click.
- Loading-screen progress bar must count only critical assets (update the weights) so it reaches 100 % honestly.

## 4. Caching & transport
- All hashed/versioned assets: `Cache-Control: public, max-age=31536000, immutable`. HTML: `no-cache`. JSON data: short cache + ETag.
- Enable gzip/brotli for JS/CSS/JSON/HTML in Express (`compression`) — not for already-compressed images.
- `<link rel="preload">` for the 2–3 largest critical textures; `modulepreload` for the main chunk.
- JS: check bundle size; split three.js examples/loaders that are not needed before playable.

## 5. Reliability (ties to "game doesn't come up")
- Every asset fetch: timeout 20 s, 2 retries with backoff, then the existing Thai retry screen naming nothing technical.
- A failed **deferred** asset must never block play; log it via `/api/boot-report` (code `asset-deferred`).

## 6. Verify
`npm test`, `npm run build`. Browser, DevTools "Fast 4G", cache disabled, desktop 1440×900 and mobile 390×844: cold load to playable, warm reload, full King fight (King assets arrive in time), slow-3G sanity run (must still finish, with the slow note). Report `.codex-run/load-perf-report.json`: bytes before/after (total and critical), time-to-playable before/after (cold Fast 4G, warm), per-asset table, quality notes, files changed, anything off. Screenshots as above. Do not change gameplay or server game logic. Do not commit.
