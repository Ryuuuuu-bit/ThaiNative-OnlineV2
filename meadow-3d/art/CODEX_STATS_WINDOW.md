# Codex task: SP regen fix + stat window (stats plan step 3)

Do this after CODEX_LOGO_LOADING.md, in the same working tree. Read `shared/src/derive.ts`, `shared/data/stats.json`, `shared/data/classes.json`, `shared/src/game/sim.ts`, `server/src/realtime/index.ts`, `server/src/store/*`, `meadow-3d/src/main.ts`, `meadow-3d/src/keys.ts`, `meadow-3d/play.html`, `meadow-3d/src/style.css`.

## 1. SP regeneration (action-game pacing)

The RO-style per-5-second regen (`maxSp*0.01 + INT/6` per 5 s ≈ 0.27 SP/s at Lv 1) makes Q/E usable about once a minute; the old demo regenerated 4 SP/s. Move the regen numbers into `stats.json` and change the formula to per-second:

- `spRegenPerSec = 2.5 + INT × 0.08 + maxSp × 0.004` (Lv 1 default build ≈ 3.1 SP/s → whirlwind every ~6.5 s, meteor every ~10 s when spamming)
- `hpRegenPerSec = 0.5 + VIT × 0.1 + maxHp × 0.002` out of combat only (no damage dealt/taken for 5 s); in combat 20 % of that. Camp healing unchanged.
- Sitting is not in the game yet; drop the "sitting ×2" rule from the code for now (keep it as a data field).
- Update goldens/simulator; report the new SP-limited rotation numbers.

## 2. Auto-allocation until a player spends points

Characters that have unspent points and have never opened the stat window get them spent automatically on level-up using `classes.json` preset weights (novice_knight: STR 4 · AGI 2 · VIT 3 · DEX 2 · INT 1 · LUK 1 per 13 points, round-robin by weight, respecting raise costs). Once a player spends a point manually, `autoAllocate` turns off for that character (stored flag). Existing characters are migrated by auto-spending their unspent points.

## 3. Stat window (C)

- Key **C** (add to `keys.ts`; also a small "สเตตัส" button on the HUD near the portrait and on touch). Same painted panel style as the HUD.
- Left: the six base stats with current value, `+` button (disabled when not affordable; tooltip shows the cost), and the bonus from race/equipment in a muted `+n`. Top: unspent points and Base Lv.
- Right: derived stats computed live by `deriveStats` (ATK, MATK, DEF hard/soft, MDEF hard/soft, HIT, FLEE, CRIT, ASPD, cast time, HP, SP, HP/SP regen, move speed, weight) — preview the change before confirming: pressing `+` updates a pending allocation shown in gold, with **ยืนยัน** and **ยกเลิก** buttons.
- Toggle "จัดสรรอัตโนมัติ" (auto-allocate on/off).
- Reset button visible only when `statResetFree` is true (UAT): returns all spent points.
- Thai labels with English abbreviations (พลัง STR, ว่องไว AGI, อึด VIT, ปัญญา INT, แม่นยำ DEX, โชค LUK).

## 4. Server authority

- New WS intents `{t:"stats", add:{str?,agi?,vit?,int?,dex?,luk?}, seq}`, `{t:"statsReset"}`, `{t:"autoAlloc", on}`; validated on the server (cost table, available points, max 99, reset only when allowed), applied to the live `Player`, persisted immediately, and answered with `{t:"ev", list:[{type:"stats", base, points, derived}]}`. The client never computes the authoritative result; the preview uses the shared `deriveStats` only for display.
- Level-up event includes the new point total; HUD shows "+3 แต้มสเตตัส" with a subtle pulse on the C button.

## 5. Tests and verification

Shared: new regen formula numbers, auto-allocation spends exactly the available budget by weights, preview equals server result. Server: invalid stat requests rejected (over budget, over 99, negative, reset when disabled), stats persist across reconnect, auto-allocate turns off after a manual spend. Browser: level up twice, open C, spend points, confirm ATK rises and damage numbers rise, reload and verify. Mobile 390×844 layout. Screenshots `.codex-run/stats-window.jpg`, `stats-window-mobile.jpg`; report `.codex-run/stats-window-report.json` (files, SP before/after, damage at Lv 1/5/10 with auto-allocation, anything off). `npm test`, `npm run build`. No commit.

## 6. Loading reliability check

The owner reported that sometimes the game page does not come up on UAT and they have to start again. While here: reproduce opening `play.html` cold, after a redeploy (stale build id → reload), after a server restart, and with a stale/missing selected character. Make every failure path end in a clear Thai message with a working retry/redirect (never a blank or stuck screen). Log client boot errors to the server (`POST /api/boot-report`, rate-limited, no personal data) and print them in the Railway logs. List each case and its result in the report.
