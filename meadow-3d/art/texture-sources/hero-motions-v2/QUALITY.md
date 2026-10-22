# Direction and contact corrections — 2026-10-22

Spin/death front rows keep their approved AutoSprite frames unchanged. The NE row now uses the existing `hero-painted/hero-<motion>-v1.png` back strip, centred on the same feet anchor; NW mirrors NE. These are the same original painted swordsman, not a new character or a generated reinterpretation. `pack-hero-motions-v2.py --select` preserves this choice when regenerating sources. A spin naturally shows the face midway through a full rotation; its starting and ending facing is the back.

Earth Break keeps 9 frames, 8 directions and contact index 6 at 0.40 seconds. `EARTH_RETIME` in `pack-hero-skills-v2.py` retimes the selected source poses: hold anticipation where a direction struck early, and advance the planted contact pose where a direction struck late. The NE/NW overhead arc is omitted at contact in favour of the grounded pose. Existing game VFX supplies the common ground impact; no damage, cast, sound or knock-up timing changed.

For boss moves sharing an attack strip, `bossAnticipation` gives slam a tall/narrow wind-up, charge a low/wide lean and spit an inflated silhouette. It uses the server's remaining windup and changes only the drawn body around its ground anchor. Existing distinct attack clips, dead bodies and non-bosses are untouched. These cues reuse the current sprite; they are not newly authored anatomical animations. Server collision, hit areas, warning rings and simulation remain unchanged.

## Job 2 combat readability — 2026-10-22

Frenzy keeps its first strike and idle. Its reverse cut reuses Blade Cyclone F3/F4 and its overhead finisher/recovery reuse Quake Slam F5/F6/F7, all from the approved eight-facing Job 2 character. Contacts stay F1/F3/F5 with unchanged server timing. Rear Leap Strike landing/recovery (NE/NW/N) reuse Quake Slam F6/F7. tools/repair-job2-combat-poses.py preserves the common (192,240) anchor and pads cell height to 268 instead of rescaling. poseRepair in skills-v2.json records the exact overrides of the original raw selection. Run the repair before packing after reselecting raw sources. A generated trial was rejected and is not included.

Shield Bash has a smaller, shorter foreground crest; its reduced flash/beam draw behind actors. Quake Slam moves the reduced flash/beam behind actors, reduces its foreground starbursts and lowers the closest foreground rock shards. Leap Strike also draws its reduced landing beam/flash/vertical cut behind the hero so the planted rear pose stays visible. Event mapping, damage, cast time and other skill effects are unchanged.
