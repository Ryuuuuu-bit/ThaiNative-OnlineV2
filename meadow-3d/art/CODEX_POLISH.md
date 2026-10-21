# Codex task: UX + art polish (Director review, 2026-10-17)

Run after CODEX_STABILITY_FIX and BGM are committed. Keep the painted ink-and-gouache look. All player-facing text is Thai live HTML (brand wordmark "THE BEGINNING ONLINE" may stay). Screenshots referenced are in `.codex-run/`.

## 1. HUD clean-up (hud-city.jpg, hud-meadow-target.jpg, hud-mobile.jpg)
1. Hide the "N FPS · ms" readout under the minimap for players; show it only with `?debug=1` or a settings toggle "แสดง FPS".
2. Minimap title on one line (ellipsis), tower world-label must not be clipped by the minimap panel. "ภาพ · อัตโนมัติ" button text must not clip (wider button or icon + tooltip).
3. Bottom panel is three rows tall and covers the play area. One row: 5 skill slots + ▲, then compact icon chips (โจมตี, หลบ, ยา, ออโต้, กลับเมือง, เก็บรอบตัว) with key letter in the corner and full text in a tooltip. Gold/weight/kills line stays above. The NPC talk prompt ("คุย · …") floats above the panel, never over the gold line.
4. Left buttons consistent: "สเตตัส C", "สกิล K", "กระเป๋า I" (same pattern, same width).
5. World labels: player name and monster nameplates ≥ 12 px on screen (scale with UI scale), readable backing. NPC labels: name only, shown within 10 m; the role ("ฟื้น HP/SP") only when hovered or in range to talk; labels never overlap the player sprite (stack upward / fade when the player stands in front).
6. Mobile 390×844: tracker collapsed by default to a small chip; target frame narrow under the character frame without overlapping the area banner; hotbar one row 5 + "เพิ่มเติม"; joystick never overlaps the menu button; ≥ 44 px targets. Max HUD coverage on mobile 35 % of the screen (measure and report).
7. English leftovers → Thai: EXP → ประสบการณ์, Lv. → ระดับ (nameplates "ระดับ 3"), Job Lv → ระดับอาชีพ, "BELONGINGS & EQUIPMENT" → "สัมภาระและอุปกรณ์", "AUTO เก็บของของฉัน" → "เก็บของอัตโนมัติ", any "Novice Knight" / "Novice" (removed job) → current job name (e.g. "นักดาบ"), "CHOOSE YOUR NEXT CHAPTER" → "เลือกตัวละคร". Grep the whole client for remaining English UI strings and list them in the report.

## 2. Shops (inv-merchant.jpg)
1. Item tiles show name + price under the icon. Buy tab shows the **buy** price only; sell price only in the sell tab.
2. Hide gear for jobs that are not available yet (reed_dagger, wood_staff, bamboo_bow) from both shops (keep them in data). Gear the current job cannot equip shows "อาชีพนี้ใช้ไม่ได้".
3. Storage keeper: label "คลังเก็บของ — เปิดเร็ว ๆ นี้" with a lock icon on the minimap instead of a working-looking NPC prompt.

## 3. Portal / character select (web-portal.jpg, web-characters.jpg)
1. The game now starts in the city. Portal hero: title "นครที่ถูกลืมเลือน" + subtitle "The Beginning Online", Thai tagline about the city in the mist; remove "JELLY MEADOW" / "A NEW CHAPTER IN THE MEADOW" / English tagline. New key art (built-in imagegen, same style as the current meadow key art): Aerin from behind on the south road looking at the misty clock-tower city, warm lanterns, cool fog; 1920×1080 WebP ≤ 350 KB + mobile crop. Keep the meadow art as the second feature card.
2. Feature cards and update-notes link: Thai, reflect current features (เมือง, นักดาบ 6 สกิล, ราชาวุ้น, กระเป๋า/ร้านค้า).

## 4. Art fixes
1. **NPC scale** (city-art-npcs.jpg): citizens are ~1.35× Aerin's height. In game: NPC height 1.05–1.15× Aerin, gate captain 1.2×, keep the shared foot baseline. Remove the stray marks under the merchant's and healer's feet (alpha clean-up of all 4 idle frames).
2. **Hero motions** (motions-sheet.jpg + swordsman-motions-report.json): regenerate Provoke SW so it is not a mirror-copy of SE; fix frames listed off-model (sword tips cut, incomplete boots). Same frame size/anchor; verify side by side with idle.
3. **Whirlwind** (owner decision taken by the director): split the two hits — hit 1 at the current time, hit 2 +0.25 s, same total damage (each hit = half of today's combined hit, rounding so the total is unchanged), so frames 3 and 6 each get a contact. Update sim tests.
4. **Camera**: default zoom so Aerin is ≈ 9–10 % of screen height on desktop 1440×900 (now ≈ 7 %); zoom range unchanged; mobile keeps its current framing if already larger.
5. City (city-art-ground.jpg): the player spawns on top of the Angel — move the spawn/respawn point 2 m south of the tower steps (server + client, no NPC overlap); the thin red lines across the cobblestone (path-edge trim) read like debug grid lines — soften to a worn stone kerb or remove.
6. Item icons: keep, but add a subtle paper-grain overlay/desaturation in the icon frame so they sit with the painted world (CSS only, no new art).

## Verify
`npm test`, `npm run build`. Headless desktop + mobile in city and meadow. Screenshots only: `.codex-run/polish-city.jpg`, `.codex-run/polish-meadow.jpg`, `.codex-run/polish-mobile.jpg`, `.codex-run/polish-portal.jpg`, `.codex-run/polish-npcs.jpg` (NPC + Aerin in game at spawn). Report `.codex-run/polish-report.json` (each item done/skipped, mobile HUD coverage %, remaining English strings). Do not commit. Never touch the Railway production environment.
