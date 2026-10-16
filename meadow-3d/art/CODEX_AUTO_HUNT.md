# Codex task: AUTO (auto-hunt) button for meadow-3d

Read first: `meadow-3d/src/sim.ts`, `meadow-3d/src/main.ts`, `meadow-3d/play.html`, `meadow-3d/src/style.css`, `meadow-3d/README.md` (controls section).

Add an RO-style auto-hunt toggle so mobile players (and lazy desktop players) can farm without steering. Keep all current manual controls unchanged; AUTO is a layer on top of the existing sim commands, implemented in the sim (`src/sim.ts`, pure logic, testable) with the HUD only toggling it.

## Behaviour (`sim.ts`, fixed step)

State: `p.auto:boolean`, `p.autoState:'seek'|'fight'|'retreat'|'idle'`, decision tick every 0.2 s.

- **Target**: the living King if the boss encounter is active, else the nearest living small jelly within 14 units of the player (prefer the current `target` if still alive). No target → walk slowly towards the meadow centre / last known spawn area and wait (`idle`, play idle motion), re-check each tick.
- **Seek**: move toward the target using the existing click-to-move path (`moveTo`) until within attack reach (`1.8` small / `2.3` boss, same constants as the combo), then **fight**.
- **Fight**: hold the basic combo (same as J). Use **ฟันพายุ (Q)** when ≥2 living enemies are within 2.6 units and MP ≥ 20; use **ดาวตก (F)** on the King (or when ≥3 enemies cluster) when MP ≥ 30 and off cooldown. **พุ่งหลบ (Space)**: when a red ground telegraph (boss slam/sweep/charge/spit) will cover the player's position, dodge away from its centre 0.15 s before impact if the dodge is off cooldown; also dodge once when the King starts a charge aimed at the player. Face the target.
- **Potion (R)** when HP < 45 % and potions > 0 and off cooldown.
- **Retreat**: when HP < 25 % and no potions, path back to the camp heal point, wait until HP ≥ 90 %, then resume seek. If an enemy follows into camp, keep fighting there.
- **Interrupts**: any manual move input (WASD/arrows/joystick/click on ground) or Esc turns AUTO off immediately; manual skill presses while AUTO is on are allowed and do not turn it off. Death turns AUTO off; it stays off after revive.
- Keep the existing "attack a clicked jelly" behaviour; clicking a jelly while AUTO is on just changes the preferred target.

## HUD (`play.html`, `main.ts`, `style.css`)

- New hotbar button after ยา: key **T**, label **AUTO**, same painted button frame. Use the spare leaf sigil icon (index 5 in `ui-painted/skill-icons-v1.png`) with a small ⟳ glyph overlay drawn in CSS; when active: gold rim glow pulsing slowly (2 s), label "AUTO ON"; a small status text under the location header: "ออโต้: กำลังหาเป้าหมาย / กำลังสู้ / กลับแคมป์".
- Touch: the same button in the touch skill cluster. Tapping the joystick turns it off (manual input rule).
- Notices: "ออโต้ เปิด · แตะจอยหรือกด WASD เพื่อหยุด" on enable, "ออโต้ ปิด" on disable.
- Add T to the guide dialog and README controls.

## Verification

Tests in `tests/combat.test.mjs` (or a new `auto.test.mjs`) for: target choice (nearest, prefers boss), seek→fight transition at reach, Q only with ≥2 enemies and MP, potion threshold, retreat at low HP with no potions and resume at 90 %, dodge out of a telegraph, manual move cancels AUTO, death cancels AUTO. `npm run check:meadow`, `npm test`, `npm run build`. Browser smoke: enable AUTO from a fresh character, let it kill 6 jellies and start the King fight, take `.codex-run/auto-hunt.jpg` (desktop) and `auto-hunt-mobile.jpg` (390×844) and write `.codex-run/auto-hunt-report.json` (what it did, kills per minute, any stuck cases). Do not touch `server/` or any PNG. Do not commit.

Reply with files changed and anything that still gets stuck.
