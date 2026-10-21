# Codex task: HUD redesign + QOL (owner approved every item, 2026-10-17 02:52)

Run after the QC pass is committed. Keep the painted ink-and-gouache panel style; all player-facing text in **Thai** as live HTML (not baked into images). Do not change gameplay numbers, economy, or art assets except tiny UI icons.

Read first: `meadow-3d/play.html`, `src/{main,style,skills-ui,skills,inventory-ui,inventory,stats-window,audio-settings-ui,keys,combat-feel}.ts/.css`, `src/net/world.ts`, `shared/src/game/{protocol,sim,maps}.ts`, `.codex-run/qc-report.json` (known UI bugs).

## 1. Fix what is hard to read now
1. Remove the old big "JELLY MEADOW" title + subtitle. One area banner only (fades in on map change, then gone).
2. Control-hint strip across the middle of the screen: show only the first time (first 2 sessions, dismiss button "เข้าใจแล้ว"), afterwards available from the ? button.
3. Thai everywhere: ZENY → "ทอง", "0 defeated" → "ปราบแล้ว 0", minimap title → Thai area name, "EXPLORER'S JOURNAL" → "บันทึกการเดินทาง", hide "SINGLE PLAYER", HQ → "ภาพ" (keep auto-quality label "อัตโนมัติ").
4. Readability: min font 13 px desktop / 12 px mobile, translucent dark backing behind HUD text, contrast ≥ 4.5:1 on both the bright city and the meadow.
5. Remove the The Beginning Online logo + "Painted hero · Combat preview" + "คู่ตัวละคร" block from the bottom-left in game (keep a small menu button that opens ตัวละคร/ตั้งค่า/ออกจากเกม).

## 2. New HUD layout
- **Top-left** character frame: portrait, name, Lv / Job Lv, HP/SP bars with numbers, EXP and Job EXP thin bars; buff/debuff icons row underneath with remaining-time ring (endure, potion effects, overweight, etc.).
- **Top-centre target frame**: appears when a monster is targeted/attacked — name, level, element, race, HP bar with %, King gets a wide boss bar with phase marker. Clears 4 s after leaving combat.
- **Top-right minimap**: Thai area name, player arrow, NPC dots with icons, gate markers, King marker when spawned. **Click an NPC/gate on the minimap → auto-walk there** (client pathing on the walkable grid; any movement key cancels).
- **Right-middle quest/journal tracker**: larger text, translucent panel, collapsible.
- **Bottom-centre hotbar**: 5 main slots visible; a small ▲ toggle reveals the 6–0 extra bar; empty slots hidden unless dragging a skill/item; cooldown seconds printed on the icon; SP-cost tint when not enough SP. Gold + bag weight (e.g. "1,250 ทอง · 34/1200") compact next to the hotbar.
- **Bottom-right**: loot/notice toasts stack (max 4), fade after 4 s.

## 3. QOL features
- **Click NPC to talk**: clicking an NPC anywhere on screen walks to it and opens the dialog on arrival.
- **Return to city (H)**: 5 s cast with progress bar, cancelled by taking damage or moving; teleports to the clock tower (server-validated, 60 s cooldown, not usable during the King fight).
- **Damage numbers**: clearer font, white = normal, yellow larger = crit, grey "พลาด" = miss, green = heal; stack offsets so they don't overlap; numbers from other sources smaller.
- **Pick up all nearby** (key: Z, mobile button): picks up own/free drops within 4 m.
- **UI scale** setting 90 / 100 / 110 / 120 % (persisted on the server with other settings).
- **Remember window positions** of bag, stats, skills (drag by the title bar; persisted per account; reset button in settings).
- Keys: add H and Z to `keys.ts` (remappable) + tests, guide dialog, README.

## 4. Mobile 390×844
Same layout scaled: character frame compact, target frame narrow, minimap smaller tap-to-expand, hotbar 5 + more, toasts above hotbar, all touch targets ≥ 44 px.

## 5. Verify
`npm test`, `npm run build`. One headless run desktop + mobile in city and meadow (with a targeted monster). Screenshots only: `.codex-run/hud-city.jpg`, `.codex-run/hud-meadow-target.jpg`, `.codex-run/hud-mobile.jpg`. Report `.codex-run/hud-qol-report.json` (files, what changed, contrast checks, anything off). Do not commit. Never touch the Railway production environment.
