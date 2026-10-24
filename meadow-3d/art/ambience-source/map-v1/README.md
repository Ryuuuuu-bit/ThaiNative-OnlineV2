# Approved map ambience, take 1

`sources.json` maps all 19 game maps to approved original audio bytes. Eighteen
MP3 takes come from the map ambience review; the meadow reuses the previously
approved soft SFX WAV. Source files are unchanged and verified by SHA256.

Rebuild with `node meadow-3d/tools/pack-ambience.mjs`. The packer makes a 1.5 s
circular head/tail overlap, removes DC/infrasonic drift below 30 Hz, balances
the finished loop near -30 LUFS, and applies a 50 ms codec-boundary fade after
normalization. Peaks target -6 dBTP, with up to 0.2 dB of codec tolerance.
Both Opus and AAC are decoded and checked for loudness, peaks and wrap
discontinuity before `public/assets/audio/ambience.json` is written.

The runtime uses the existing `MusicPlayer` with its own ambience manifest and
bus. Both layers use the same map IDs, but ambience follows the location while
BGM can switch to the boss theme. Each layer crossfades for 3 seconds and
retires the previous stream. No legacy meadow ambience buffer runs underneath.
Downloads remain deferred until the game is playable and audio is unlocked.

The ambience slider and saved settings remain the controls for the new layer.
All maps share the same mastering target; city ambience no longer needs the
extra attenuation formerly used for the shared meadow sound. Default music
and ambience gains match the approved listening-review setup.

Signal and browser checks do not replace human listening on headphones and
speakers. Original sources are retained for later balance or loop edits.
