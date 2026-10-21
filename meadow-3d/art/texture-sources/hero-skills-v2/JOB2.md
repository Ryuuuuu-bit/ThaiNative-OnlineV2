# Job 2 sprites v2 — 2026-10-22

Guardian and Berserker now use the same slim painted swordsman as the current walk: eight generated facings, rows SE SW NE NW S E N W. AutoSprite character, prompts, job IDs, fixed normalization transforms and source frame picks are recorded in `job2-v2-provenance.json`. Full normalized frames, contact sheets and review evidence remain in the local `output/job2-sprites-v2-20261022/` production folder.

The committed PNGs are the selected game frames, not 25-frame review strips. Each direction has one fixed scale based on its first-frame height of 168 px and a fixed feet anchor. Quake Slam needs a 384×268 cell, Rally Roar 384×263; other Job 2 cells remain 384×256. Runtime frame counts, contact indices, cast times, server damage and VFX are unchanged. Shield Bash has the body/forearm motion only so the existing shield VFX supplies the barrier.

`pack-hero-skills-v2.py` packs every source listed in `skills-v2.json` into the texture manifest. Its `--select` command still selects the six original swordsman skills and preserves the separately selected Job 2 entries.

<!-- shortcut: Frenzy Slash repeats one generated cut at contact indices 1/3/5; replace only its source sequence when a distinct three-cut combo is approved. -->
Frenzy Slash uses source frame 7 for each of its three contacts, separated by the same wind-up. The generator did not provide three distinct readable cuts. Blade Cyclone uses the rotating portion across all eight runtime frames. These choices keep current hit timing; they do not alter simulation or add delay to instant skills.

Validated before integration: 416 selected cells have visible alpha with clear borders, all 64 skill/direction cases render in GameCanvas2D. Remaining visual limits: some idle sword angles differ from the source stance, the cape obscures the rear forearm bash, and full network combat/lift transitions have not been playtested. Keep these limits in review when refining the next art pass.
