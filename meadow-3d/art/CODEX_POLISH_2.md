# Codex task: polish follow-up (Director review of polish-*.jpg)

Small fixes only; same rules (Thai live HTML, no balance changes, do not commit, never touch Railway production).

1. Meadow nameplates are cluttered (polish-meadow.jpg): every monster shows "ชื่อ · ระดับ N" and they overlap each other, the player name and damage numbers. Show a monster nameplate only for: the current target, the hovered monster, and monsters within 5 m of the player (max 4 at once, nearest first). Others show nothing (the target frame already has full info). Fade in/out 150 ms. Nameplates sit above damage numbers' spawn height; damage numbers and "พลาด/หลบ" use separate vertical lanes so they never overlap a nameplate or each other.
2. City spawn still overlaps the Angel's sprite (polish-city.jpg): place the spawn/respawn point ≥ 3 m south of the Angel on the open plaza, facing south; verify sprite bounds don't overlap any NPC at spawn on desktop and mobile.
3. Mobile (polish-mobile.jpg):
   - the gold/weight line is partly under the ☰ menu button — move the line above the hotbar, right-aligned, or move the menu button above the joystick;
   - the area banner overlaps the tracker chip and the Angel's label is clipped by the tracker — banner centred under the character frame, max width = screen − 32 px, and world labels drawn under HUD panels must be hidden instead of clipped.
4. Camera: desktop framing reported 11 % (target 9–10 %); nudge to 10 %.

Verify: npm test, npm run build, headless desktop + mobile. Replace `.codex-run/polish-city.jpg`, `polish-meadow.jpg` (with ≥ 8 monsters on screen and a fight), `polish-mobile.jpg`. Append results to `.codex-run/polish-report.json` under `followUp`.
