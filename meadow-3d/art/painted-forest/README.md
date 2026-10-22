# Mist Forest painted art

Historical source archive. These monster sheets are retired from shipping because
the retained records do not establish the complete source/provider chain. This is
not a finding of infringement. Current monster replacements and their receipts live
in `../monster-origin-rebuild-v1/`; regenerate their staging output with
`python meadow-3d/tools/pack-original-monsters.py` from the repository root.
The environment and item artwork described below are outside that monster audit.

Original built-in imagegen sources and exact requests are retained in `PROMPTS.json`
and `REAR_PROMPTS.json`.
Five turnaround seeds precede the 28 directional motion sheets. Rear-only v2
sources correct the Warden and wolf back views. Left-facing rows are mirrored
within each cell at packing time, so frame ordering and attack timing stay fixed.
The generated
sources are kept separately from normalized `*-v1.png` sources and contact proofs.
All Thai labels remain live HTML or the existing scene label canvas.

Regenerate from the saved artwork, from the repository root:

```powershell
python -X utf8 meadow-3d/tools/pack-forest.py
python -X utf8 meadow-3d/tools/pack-monsters.py --forest
python -X utf8 meadow-3d/tools/pack-icons.py --forest
python -X utf8 meadow-3d/tools/pack-forest-textures.py
```

After re-packing monsters only, `pack-forest-textures.py --monsters` re-encodes just
the 28 monster atlases and removes their superseded hashed files.

Generated poses often overrun their nominal 6×2 squares, so the packer cuts each
sheet along the cheapest seams through the transparent gaps between poses rather
than on the fixed grid (a grid crop sliced the wolf's muzzle and tail and kept
slivers of neighbouring poses). `seamAlphaCut` in the packing report records how
much paint each seam crossed; faint full-sheet grid lines are cleared first. The
rear Warden special sheet has only five top-row poses, so `LAYOUTS` in
`pack_forest_monsters.py` maps it explicitly and summon holds its sprouted pose.
Review every species, direction and frame through the shipping textures at
`/tools/monster-review.html?motion=hop&species=wolf` on the Vite dev server.

The forest-only switches preserve older jelly/King art, timings and manifests.
PNG encoder inputs stay under `art/texture-sources/`; shipping assets use the
existing content-versioned UASTC KTX2/WebP loader. Monster alpha masks have exactly
the same dimensions as their GPU textures for transparent-pixel picking. Sprite
textures have no mipmaps. Ground tiles have mipmaps. The path brush stays a CPU
WebP source so it can be stamped into the scene's alpha mask.

- Environment: 18 props, one 2048×2048 atlas, four 512×512 surface tiles, a path
  transition brush, a mist card, and a small separately packed city signpost.
- Monsters: shroom/wolf/wisp/stump, four motions each in 384×256 logical cells;
  Warden, twelve King-compatible motions in 768×512 cells. Four directions,
  28 new motion atlases, 336 directional frames. Warden phase two uses shader glow
  over the same art, with no expression patch or second frame set.
- Projectile: four 128×128 amber flame frames in a 512×128 strip.
  Warden spit reuses the painted mist card for its clouds and small spores.
- Items: five 64×64 icons in the first row of a 320×320 atlas. Twenty reserved
  cells retain exact zero alpha. The older item atlas is untouched.

Packing reports and contact proofs are beside the sources. Verification logs,
browser snapshots, screenshots, performance measurements and the changed-file
inventory are under the repository's `.codex-run/forest-*` paths.

The simulation's regular attack remains 0.85 seconds. Forest wind-ups are retained
in the per-species timing table; longer painted recoils can finish during idle.
Death or a new action immediately takes precedence over this cosmetic recovery.
The King and small-jelly durations are unchanged.
