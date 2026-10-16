# Codex task: painted skill icons for the hotbar (meadow-3d)

Read first: `meadow-3d/src/main.ts` (HUD/hotbar markup and CSS in `src/style.css`), `meadow-3d/art/painted-hero/PROMPTS.md` (art direction wording), `meadow-3d/art/painted-env/PROMPTS.md`.

The hotbar currently uses simple glyphs. Replace them with hand-painted skill icons in the same ink-and-gouache storybook style as the rest of the game, so the HUD reads as part of the same illustration.

## Icons (built-in imagegen)

Generate one 2×3 sheet on a 1536×1024 transparent canvas, six equal 512×512 slots, each icon a rounded-square painted emblem (no frame — the HUD draws the frame), centred, with 24 px of empty margin inside the slot, consistent light from the upper-left, thin ink lines, soft watercolour shading, small highlight, readable at 56 px. No text, no numbers, no background scenery.

1. **โจมตี (J)** — Aerin's slim silver sword in a diagonal upward slash with a faint pale arc, teal and gold accents.
2. **ฟันพายุ (Q)** — a horizontal whirlwind ring of pale teal wind with the sword silhouette inside, a few leaves caught in it.
3. **ดาวตก (F)** — a falling meteor: orange-gold fireball with a short ember tail streaking down-left, small hot core.
4. **พุ่งหลบ (Space)** — a swift forward dash: a forest-teal cape streak and two motion lines, a tiny boot at the front.
5. **ยา (R)** — a round glass potion bottle with a cork, rose-pink liquid, a small gold label, a sparkle.
6. **ว่าง (spare)** — a generic locked/empty slot emblem: a faint teal leaf sigil, low contrast, for slots without a skill.

Also generate a matching **2×3 "cooldown overlay" variant is NOT needed**; the HUD will darken the icon with CSS.

## Packing

`tools/pack-icons.py`: extract each slot, trim and centre on 128×128 and 64×64 canvases with alpha, pack into `public/assets/ui-painted/skill-icons-v1.png` (a 6×1 strip for each size) plus `manifest.json` (name, index, size). Keep the HD source under `art/painted-ui/`. Append prompts to `art/painted-ui/PROMPTS.md`.

## HUD integration

- Hotbar buttons show the icon (CSS background-image from the strip, 2× asset for HiDPI), with the key label small in the corner, the Thai name below, MP cost badge, and the cooldown as a radial conic darkening over the icon plus the seconds number — keep the existing behaviour and layout size.
- Ready state: soft gold rim glow; disabled (not enough MP): desaturated; pressed: slight scale-down.
- Keep the touch controls using the same icons.

## Verification

`npm run check:meadow`, `npm run test:meadow`, `npm run build:meadow`; screenshots `.codex-run/ui-hotbar.jpg` (desktop 1280×720) and `.codex-run/ui-hotbar-mobile.jpg` (390×844). Report files changed and anything that reads poorly at small size.
