# Codex task: 13 new item icons (ruins + canyon loot, boss cards)

Read first: `meadow-3d/art/CODEX_FOREST_ART.md` Part D (how items-v2 was made), `meadow-3d/tools/pack_forest_icons.py`, `meadow-3d/tools/pack-icons.py`, `meadow-3d/src/item-icon.ts`, `meadow-3d/tests/shop-item-icons.test.mjs`, `meadow-3d/art/painted-items/PROMPTS.md`.

These items are live on UAT but borrow other items' icons (`icon` field in `shared/data/items.json`). Give each its own painted icon in the free slots of `public/assets/items/items-v2.webp`.

## Style

Exactly the look of `items-v1.webp` and the five forest icons already in `items-v2.webp`: hand-painted ink-and-gouache, same 64 px framing and object scale, same outline weight, light from the upper-left, soft drop shadow only where the existing icons have one, fully transparent background, no text, no frame (except the cards). Use the built-in image generation, then pack.

## Slots (keep the existing five cells byte-identical)

`items-v2` slot 0–4 stay as they are. New icons go in slot order 5–17 (atlas index 30–42):

| slot | id | Thai name | what to paint |
|---|---|---|---|
| 5 | stone_spore | สปอร์ศิลา | a small heap of grey-green mushroom spores crusted with stone flecks (cousin of mist_spore, but stony) |
| 6 | relic_fang | เขี้ยวหมาป่าซากนคร | one curved pale wolf fang with an old bronze ring and faint rune scratches |
| 7 | rune_shard | เศษอักขระเรือง | a broken stone shard with a carved rune glowing soft teal |
| 8 | ancient_vine | เถาวัลย์โบราณ | a coil of thick old vine with a few tiny stone-grey leaves |
| 9 | temple_seal | ตราผนึกวิหาร | boss trophy (rare): a round jade-and-bronze temple seal, ornate rim, faint gold glow |
| 10 | ore_slime | เมือกแร่ผา | a jelly blob like jelly_slime but amber-brown with glinting ore specks |
| 11 | crag_fur | ขนหมาป่าสันผา | a tuft of coarse grey-brown wolf pelt dusted with rock powder |
| 12 | amber_dust | ผงอำพัน | a small cloth pouch spilling glowing amber dust |
| 13 | crag_root | รากผาหิน | a gnarled root gripping a chunk of rock |
| 14 | titan_core | แกนศิลาอสูร | boss trophy (rare): a heavy stone heart with molten amber cracks |
| 15 | card_mist_warden | การ์ดผู้เฝ้าป่าหมอก | a monster card in the exact layout of card_jelly_pink / card_king_jelly (same frame, border colour, proportions) with the Mist Warden inside |
| 16 | card_relic_warden | การ์ดผู้เฝ้าวิหารโบราณ | same card layout, the Relic Warden (ruins boss) inside |
| 17 | card_crag_titan | การ์ดอสูรยอดผา | same card layout, the Crag Titan (canyon boss) inside |

For the three boss cards, take the portraits from the bosses' current painted sprites (`public/assets/monsters-painted/…`, see `meadow-3d/src/monster-animation.ts` for which species each boss uses) so they read as the same creatures.

Slots 18–24 stay exactly transparent (alpha 0) for future items; set `reservedTransparentSlots` to 7.

## Wiring

- `shared/data/items.json`: set each of the 13 items' `icon` to its own id (they currently borrow `mist_spore`, `wolf_fur`, `wisp_tear`, `mist_wood`, `king_crystal`, `jelly_slime`, `warden_heart`, `card_king_jelly`).
- `meadow-3d/src/item-icon.ts`: append the 13 ids to `atlasIcons` in slot order, so `atlasIcons.indexOf(id) === 25 + slot`.
- `public/assets/items/items-v2.json`: add the 13 frames (`index`, `slot`, `x`, `y`, `w`, `h`), like the existing five.
- Extend the packing tool (a new `tools/pack_items_v3.py` or an extension of `pack_forest_icons.py`) so the whole atlas can be rebuilt; it must keep slots 0–4 pixel-identical and assert slots 18–24 are alpha 0.
- Add a test (`meadow-3d/tests/`) that every item template's `icon` has a frame in items-v1 or items-v2 and that `itemIconCell(id)` points at that frame.

## Done when

- `npm run check:meadow`, `npm test`, `npm run build` pass.
- A labelled preview `.codex-run/items-v3-preview.jpg` (all 18 icons on the dark panel colour with their ids) and one in-game screenshot of the bag showing several new items, `.codex-run/items-v3-bag.jpg`.
- Report `.codex-run/items-v3-report.json`: per icon file size and any clipping at the cell edge.

Work only in this worktree. Do not commit. Never touch Railway.
