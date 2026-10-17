# Job 2 art review requests

No `shared/game`, server, damage, cooldown, cast, collision, `visual`, or simulation `look` edits were made.

## Claude: reliable multi-hit contact identity

Frenzy Slash and Blade Cyclone resolve their rolls in one tick. Successful `hit` events have `skillId`, but `hitIndex` is undefined. `miss` has neither the skill ID nor hit ordinal. A client counter of successful hits cannot distinguish “first cut missed, second cut hit” from “first cut hit”. Lethal hits also stop subsequent rolls. Delaying those events without reliable ordinals would misrepresent contact timing and can show contact after the target's authoritative death.

Please stage hits like `whirlwindHits`, retaining the exact damage rolls and integer totals, or supply a cast identifier and ordinal on every hit/miss plus an agreed presentation policy for death. Planned zero-based contact frames are `[1,3,5]` and `[1,3,5,7]`; `contactOffset()` records the corresponding client timeline. No live stagger queue was enabled. Per-hit VFX and rising-pitch SFX remain unfinished; existing material/thock layers are retained.

## Claude: Leap Strike event timeline

The dash loop moves the player and hits targets immediately. `dashTrail` has endpoints but no skill ID, duration or end event. The data's `duration: .5` is currently the applied stun duration, not a half-second movement interval. Please confirm an explicit client-only presentation timeline or stage launch/landing events. The supplied leap curve is display-only; the production client retains the borrowed motion. Landing SFX and path/crack VFX are not enabled. The offline review can show the candidate sprite airborne, but this is not evidence of authoritative landing contact.

## Remaining visual review

- Shield Bash: NE/NW follow-through still becomes a sword thrust without its ward shield after two generation passes.
- Bulwark: the source has bright oversized shield haze crossing cell boundaries. Packed candidate is within budget but is not accepted.
- Quake Slam: recovery at the right edge is clipped, with inconsistent shield visibility at contact; remains borrowed.
- Rally Roar: contact is improved but the follow-through remains a thrust instead of sustained roar. VFX remains a blue crystalline ring; a further generated variant repaired the banner but damaged transparency, so it was rejected.
- Frenzy Slash: connected trails cross cell boundaries and produce cropped slivers in the packed candidate. Timing also needs the request above.
- Blood Rage: repaired clenched-fist pose is accepted for `OWN_ART`; full release readiness still depends on performance and integration results in the JSON report.
- Blade Cyclone: directional rows still do not show a full revolution, and trail fragments cross cells. Timing also needs the request above.
- Leap Strike: cross-row trail fragments remain after repair; timeline request above also blocks acceptance.
- Rally Roar SFX is an original synthesized horn/formant growl approximation, not a recorded warrior shout. Listening review is still needed for all new SFX.

All rejected source variants remain under `art/` for review. Only Blood Rage was added to `OWN_ART`. Do not remove any shared `visual` alias based solely on the existence of a packed candidate.
