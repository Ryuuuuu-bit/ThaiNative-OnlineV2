# Items v3 — built-in image generation

Generated with the built-in `image_gen` tool, one call per icon, with
`transparent_background: true` for materials; revised card panels are opaque.
The PNGs are the unmodified generated sources.
No API/CLI fallback was used.

## Material prompt set

Use case: stylized-concept. Paint one `{id}` game inventory icon: `{subject}`.
Hand-painted ink-and-gouache matching existing fantasy inventory icons shown
earlier, fine dark outlines, upper-left light, compact simple readable silhouette
at 64 pixels. Centered on genuinely transparent background with generous 12%
margins. No text, no frame, no parchment background. Only the requested object.

| id | subject |
|---|---|
| stone_spore | a small heap of grey-green mushroom spores crusted with stone flecks |
| relic_fang | one curved pale wolf fang with an old bronze ring and faint rune scratches |
| rune_shard | a broken stone shard with a carved rune glowing soft teal |
| ancient_vine | a coil of thick old vine with a few tiny stone-grey leaves |
| temple_seal | a round jade-and-bronze temple seal, ornate rim, faint gold glow, rare boss trophy |
| ore_slime | a jelly blob, amber-brown with glinting ore specks |
| crag_fur | a tuft of coarse grey-brown wolf pelt dusted with rock powder |
| amber_dust | a small cloth pouch spilling glowing amber dust |
| crag_root | a gnarled root gripping a chunk of rock |
| titan_core | a heavy stone heart with molten amber cracks, a rare boss trophy |

The first stone_spore call used this equivalent wording:

> Create one game inventory icon: stone_spore, a small heap of grey-green mushroom
> spores crusted with stone flecks. Hand-painted ink-and-gouache storybook RPG,
> fine dark ink outlines, muted organic colours, upper-left light. Compact readable
> silhouette intended to be downsampled to a 64px cell, centered with 12% clear
> margin, no text, no frame, genuinely transparent background. Match the painted
> fantasy inventory icons shown in conversation; do not include their parchment
> background. Save generated output.

## Revised boss card prompt set

Built-in image_gen, one call per panel, opaque background, using
`warden-reference.png` as the actual creature reference. The three card PNGs
are now generated portrait panels, not generated frames.

Shared prompt: stylized-concept inventory portrait, ink-and-gouache, upper-left
light, bold silhouette readable at 40 px, centered 3:4 portrait filling the
panel. Preserve the warden's elongated ivory stag skull, branch antlers,
hanging amber lanterns and bark anatomy. Opaque edge-to-edge panel; no frame,
no border, no purple, no text. Insert into the existing exact gold card frame.

- `card_mist_warden`: natural olive moss, grey-brown bark, ivory face.
  Three-quarter full figure leaning left, arms down, pale swirling fog across
  lower body. Misty light sage-green panel with soft fog swirls.
- `card_relic_warden`: warm sepia wood and cream skull, as sepia(.3).
  Frontal symmetrical waist-up portrait, upright head, hands gathered below
  a large softly glowing teal chest rune. Dark weathered teal/jade stone panel
  with faint carved rune glyphs.
- `card_crag_titan`: stonier, heavier, earthy amber-brown with broad rock-plated
  shoulders. Close three-quarter bust facing right, lowered head, huge angular
  shoulders across lower half. Amber/rust rock panel with glowing cracks.

## References and rebuild

- `warden-reference.png`: first idle cell of `warden-idle-v1-7c5387913e.webp`.
- `approved-slots-0-14.png`: exact decoded first fifteen cells before this
  revision, including all ten approved material/trophy icons.
- `forest-original.png`: original decoded forest row, also checked separately.
- `python meadow-3d/tools/pack_items_v3.py` rebuilds from any working directory.
- Cards reuse the 64 px `card_king_jelly` cell directly from items-v1. Only the
  interior polygon in the packing tool is replaced with the generated panel.
  Frame, position, size, parchment surround and existing top-edge contact stay
  exact. The tool asserts all RGBA channels outside the polygon match v1.
- Lossless exact WebP preserves all approved pixels. Slots 18-24 have alpha 0.
- The packer writes the labelled preview, individual cells, size/clipping
  report, and five-card 40 px / 64 px comparison to `.codex-run/`.
- Edge-contact warnings are retained honestly for the original forest cells
  and the inherited king-card template.
