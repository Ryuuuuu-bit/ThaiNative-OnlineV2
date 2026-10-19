# Swordsman SE review — local only

## Scope and provenance
Built-in ImageGen authored the new identity and complete motion rows. Sprite-gen2.44.0 (engine75166b1fe869) performed prepare, component extraction, alpha cleanup, shared row scaling, atlas composition, QA contact sheets/GIFs and inspect-motion. Existing game assets were not overwritten. No deployment.

## Idle — usable review candidate
4 frames,2fps. SE fixed camera. Stable planted stance, intact sword and coherent limbs. Body alpha height168px, same nominal standing height as shipped swordsman. Baseline212 in384x256 sprite-gen cell; preview adapter maps this to original pivot240. Review animation and anatomy before adopting.

## Walk — FAILED / experimental
Attempt01 (six poses): repeated leading leg, first sword clipped. Attempt02 (six poses plus coloured gait guide): same issue. Attempt03 (four poses): cleaner spacing and extraction but no convincing pair of opposite anatomical foot contacts. Independent vision review also rejected this cycle. Structural extraction/compose success does not certify motion. Do not ship this atlas as game-ready movement. Do not retime, mirror or duplicate drawings to conceal the failed gait.

## Automated report
Extraction:8 frames, no edge contact/chroma pixels, complete manifest. inspect-motion reports stride_verified=false and ground contact unknown; no valid foot-velocity measurement is claimed. Shared canvas/anchor alignment is a rendering reference, not evidence that feet do not slide.

## Preview
http://localhost:8899/ — original vs candidate, idle/walk, pause, frame stepping, zoom and actual game scale. Both columns share cycle phase for comparison; original walk source is the shipped RUN row. This is not a gameplay speed test.

## Next method
A manually keyed skeletal/cutout walk or an approved video-generation route is needed to obtain precise contact alternation. Retain this idle as the visual identity anchor. This review is not completion of the requested polished walk.
