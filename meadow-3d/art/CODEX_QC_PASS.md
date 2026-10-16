# Codex task: QC pass + small fixes (overnight)

Everything from today is on `main` (sound, job at creation, city greybox, inventory/shops, swordsman motions + combat feel). Do a full functional QC on a **local** build (memory store and a local Postgres), fix small bugs directly, and list anything that needs an owner decision. No new features, no balance number changes (only report them), no new art.

Read first: the CODEX_*.md specs in `meadow-3d/art/` from today and their `.codex-run/*-report.json` files (known limitations listed there).

## 1. Playthrough script (headless Chromium, local server)
1. Register → create character (name, job cards: only นักดาบ selectable) → enter world → spawns at the clock tower.
2. City: talk to Angel (tier-2 text), healer (heal + cooldown message), merchant/blacksmith (buy a red potion, buy a sword), closed gates (fog toast), no-combat notice when pressing skills.
3. South gate → meadow → kill jellies until a material + potion drop → pick up (manual and AUTO) → open bag (I) → equip the sword → ATK/damage change → use a potion from the bag (R) → sell commons at the merchant after walking back.
4. Level up: learn skills in K, use every skill 1–6 on the hotbar; each new motion plays (fall back to old pose only before load).
5. King Jelly at the far end of the meadow: spawn/unlock, fight to death or wipe, respawn at the clock tower.
6. Settings: sound sliders + M mute, combat-feel toggles, key remap, HQ/auto-quality; reload → all persisted.
7. Old-character paths: a legacy villager row → job picker before join; a pre-inventory character → opening ledger + starter items.
8. Mobile 390×844: same core path (touch walk, talk button, bag bottom sheet, hotbar "more").
Log every console error/warning, failed request, stuck state, overlapping/clipped Thai text, and wrong-map position.

## 2. Fix
- Fix bugs that are clearly bugs and small (≤ ~50 lines each). Re-run `npm test` and `npm run build` once after all fixes.
- Do not touch economy rules/prices, skill numbers, or art. Anything bigger goes to the report.

## 3. Report (Thai summary for the owner + JSON)
`.codex-run/qc-report.json` and `.codex-run/qc-summary-th.md` (short Thai list): what was tested, bugs fixed (file + one line each), open bugs (severity, repro steps), owner decisions needed (e.g. economy pace, plaza size, motion frames that look off), headless FPS numbers labelled "software WebGL – not representative". Screenshots: max 3, only of bugs that could not be fixed. Do not commit. Never touch the Railway production environment.
