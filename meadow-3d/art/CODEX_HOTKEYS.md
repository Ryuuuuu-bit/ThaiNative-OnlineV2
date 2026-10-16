# Codex task: WASD-friendly hotkeys (meadow-3d)

Do this right after CODEX_AUTO_HUNT.md, on top of it. Read `meadow-3d/src/main.ts` (input handling), `meadow-3d/play.html` (hotbar `<kbd>` labels), `meadow-3d/src/style.css`, the guide dialog text and `meadow-3d/README.md` controls.

Goal: the left hand stays on WASD, the right hand on the mouse.

| Action | New primary | Also accepted (legacy) |
|---|---|---|
| โจมตี (basic combo) | **hold left mouse button** anywhere (if the cursor is over a jelly, that becomes the target first, then attack) **or Space** | J |
| ฟันพายุ | **Q** | – |
| ดาวตก | **E** | F is NOT accepted any more (F becomes AUTO) |
| พุ่งหลบ | **Shift** (left or right) | – (Space is now attack) |
| ยา | **R** | – |
| AUTO | **F** | T |
| next target | **Tab** (cycles living enemies by distance; focus-trap so the browser does not move focus) | – |

Rules:
- Click-to-move on the ground must still work with a single click; holding the button for > 0.18 s or dragging while over the ground continues to be "walk here" (not attack), holding over a jelly or with a current target in reach is attack. Keep "click a jelly → walk to it and attack" as before.
- Space no longer dodges; dodge-on-Shift must not trigger the browser's sticky keys dialog (preventDefault; only on keydown).
- Update every `<kbd>` label in `play.html` (desktop hotbar), the touch cluster (unchanged labels, touch has no keys), the guide dialog `<dl>`, the welcome notice text, the `.keys` footer line and README. Key labels on the buttons must match the primary key exactly: SPACE / Q / E / SHIFT / R / F.
- Centralise the bindings in one `KEYS` map in `main.ts` (action → list of `KeyboardEvent.code` values) so later remapping is one place; tests: a `tests/keys.test.mjs` that imports the map (export it from a small `src/keys.ts`) and asserts no code is bound to two actions and every action has ≥1 binding.
- `npm run check:meadow`, `npm test`, `npm run build`; browser check that W/A/S/D + Shift dodge + hold-LMB attack + Tab target cycling work; screenshot `.codex-run/hotkeys.jpg` showing the hotbar with the new labels; append the result to `.codex-run/auto-hunt-report.json` under `hotkeys`. Do not commit.
