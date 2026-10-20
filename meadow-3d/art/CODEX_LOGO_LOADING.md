# Codex task: game logo + loading screen (meadow-3d web)

Read first: `meadow-3d/index.html`, `login.html`, `characters.html`, `play.html`, `src/web.css`, `src/style.css`, `src/main.ts` (asset LoadingManager + welcome overlay), `src/net/socket.ts` (connect states), `art/painted-web/PROMPTS.md`, `art/painted-hero/PROMPTS.md`, `public/assets/web/meadow-dawn-1600-v1.jpg` (the portal key visual — the logo must sit well on it).

Art direction (unchanged): ink-and-gouache storybook, thin ink lines, soft watercolour, muted teal `#182b28` / sage / ivory / antique gold `#d6bc88`. Fonts: Cormorant Garamond + Noto Sans Thai.

## 1. Logo (built-in imagegen)

Game name: **The Beginning Online**, Thai line **ไทยเนทีฟ ออนไลน์**.

Generate **three** logo directions as transparent PNGs (2048×1024 canvas, logo centred with margin), then pick the best for the site and keep the other two for review:

- **A · Painted crest** — the word "The Beginning Online" in an elegant hand-inked serif with a gilded edge, a small kranok (กนก) flame flourish curling from the T, a thin ivory banner underneath with "ONLINE" in spaced small caps, a tiny leaf-sprout jelly peeking over the banner end (our original วุ้นจิ๋ว, not any existing mascot).
- **B · Temple-gate emblem** — a pointed Thai arch (ซุ้มประตู) silhouette in antique gold line-work framing a crossed sword and lotus, the wordmark below it.
- **C · Calligraphic** — brush-calligraphy "The Beginning Online" with gold leaf flecks, a fine lotus-petal underline, "ONLINE" small.

Rules: original art only (no real temple logos, no other game's logo style copied), legible at 160 px wide, no photo textures, no drop shadows baked in, true transparent background. The Thai line ไทยเนทีฟ ออนไลน์ is set as **live text** in HTML (Noto Sans Thai) under the logo, not baked into the image, because image generators misspell Thai.

Pack (`tools/pack-logo.py` or a Node script):
- `public/assets/brand/logo-v1.png` (1200 px wide, trimmed) + `logo-v1@2x.png` (2400) + `logo-v1-512.webp`
- `logo-mark-v1.png` — the emblem part alone, square 512, for favicon/app icon
- `favicon.ico` (16/32/48), `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, a minimal `site.webmanifest` (name, short_name "The Beginning Online", theme `#182b28`, background `#182b28`)
- `og-image-v2.jpg` 1200×630: key visual + logo, for link previews; add `og:` / `twitter:` meta tags to all pages
- sources and exact prompts under `art/painted-brand/` (+ `PROMPTS.md`), the two unused directions saved as `logo-option-b.png` / `logo-option-c.png` for the owner to compare.

Placement: replace the text "THE BEGINNING ONLINE" header brand on portal/login/characters with the logo (height 40 px desktop / 32 px mobile, links to `/`); the portal hero uses the large logo instead of the "JELLY MEADOW" text title (keep JELLY MEADOW as the map name line below it). In-game HUD brand corner uses the mark + small "The Beginning Online" text.

## 2. Loading screen (`play.html`)

A full-screen loading screen shown from page load until the game is truly playable, replacing the current welcome overlay's "กำลังเตรียมทุ่งหญ้า…" line.

Visual: a dedicated painted illustration (built-in imagegen, 1920×1080, also export 1280 and 768 widths as JPEG q80): Aerin seen from behind at dusk on a hill path, a far floating city/temple silhouette (นครที่ถูกลืมเลือน) under a sky of lantern lights and faint spirit wisps — mysterious but warm, leaving the lower third calm for the UI. Logo top-centre. Thai lore line under it that rotates every 5 s from `public/loading-tips.json` (write 12: 6 gameplay tips using the current keys — Space/LMB โจมตี, Q, E, Shift หลบ, R, F ออโต้, Tab — and 6 short lore lines about the meadow, the jellies, and the forgotten city; original text, no real-world religious claims).

Progress (real, not fake):
- Stages with weights: page scripts 10 % → textures via the existing `LoadingManager` (hero, monsters, environment atlases, UI icons) 60 % → `GET /api/me` + character 10 % → WebSocket `welcome` 10 % → first `snap` rendered 10 %.
- Bar: thin gold line with a glowing head, percentage + current stage in Thai (กำลังโหลดภาพวาด… / กำลังเชื่อมต่อเซิร์ฟเวอร์… / กำลังเข้าสู่ทุ่งหญ้า…). Never goes backwards; if a stage takes > 8 s show a small "การเชื่อมต่อช้า กำลังพยายามต่อ…" note; on failure show the retry button already used by the offline overlay.
- When 100 %: fade the loading screen out over 600 ms into the existing welcome card ("เริ่มการผจญภัย →"), or straight into play when coming back from a reconnect.
- The loading illustration and logo are the only things requested before the bar can draw: inline a tiny (≤ 2 KB) blurred placeholder of the illustration as a data URI so something painted shows in the first frame; preload the 1280 JPEG with `<link rel="preload" as="image" imagesrcset=…>`.
- Audio stays off until the player clicks start (browser autoplay rules).
- Mobile 390×844 portrait: illustration cropped to the hero, logo smaller, bar above the safe area.
- Respect `prefers-reduced-motion` (no wisps animation, no bar glow pulse).

Optional light motion: 6–10 CSS-animated spirit-wisp dots drifting upward, and the gold bar head glow; no heavy video.

Also show a short version (logo + bar, no illustration) on `characters.html` while it fetches the character list, so every page has a branded first frame.

## Verification

`npm test`, `npm run build`. Browser: throttle network to "Fast 4G" in DevTools and record the loading flow; screenshots `.codex-run/brand-logo-options.jpg` (A/B/C side by side on the key visual and on plain teal), `brand-portal.jpg`, `brand-header.jpg`, `loading-desktop.jpg` (mid-progress), `loading-mobile.jpg`, `loading-slow.jpg` (slow-connection note visible). Report `.codex-run/brand-loading-report.json` with files, which logo was chosen and why, first-paint and time-to-playable on Fast 4G, and total bytes added. Do not change gameplay or server behaviour. Do not commit.
