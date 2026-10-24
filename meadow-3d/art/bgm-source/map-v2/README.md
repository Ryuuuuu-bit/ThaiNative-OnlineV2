# Approved map BGM, take 1

These 19 original Eleven Music v2.5 takes were approved in the map pilot and
remaining-map listening reviews on 2026-10-24. Each MP3 is the unmodified provider
output. `sources.json` records the approved bytes, prompts and loop edit points.
It contains no credentials. The existing boss theme remains in `../bgm_king.mp3`.

Rebuild from the repository root with `node meadow-3d/tools/pack-bgm.mjs`.
The packer verifies source hashes, blends a one-bar tail/head overlap, applies a
4 ms boundary fade and normalizes the finished loop to -22 LUFS / -3 dBTP.
Both hashed Opus and AAC files are decoded and checked for wrap discontinuities,
loudness and true peak before the runtime manifest is written.

The 20-bar loop body and one-bar overlap use the requested tempo grid. Edit points
were selected from three early-bar candidates by matching harmony and energy.
The requested tempo is composition metadata, not an independently verified beat
transcription. Musical phrasing and playback on headphones/speakers still need
human listening; waveform continuity alone does not establish musical quality.

`MusicSelection` maps every current map to its own track. Normal map changes use
the existing three-second crossfade and reset the old map's boss-release timer.
Saved audio settings, music ducking, deferred streaming and the boss theme keep
their existing behavior.
