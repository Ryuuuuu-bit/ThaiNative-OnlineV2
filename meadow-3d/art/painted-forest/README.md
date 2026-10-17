# Mist Forest painted art

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
