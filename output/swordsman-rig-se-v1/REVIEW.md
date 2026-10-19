# Authored 2D swordsman rig โ€” local preview

http://localhost:8900/

Source: ../swordsman-se-v2/run/frames/idle/frame-0.png (copied as rig-source.png). The texture is sampled through separate source polygons for thigh, shin, boot, torso and sword; no generated walking frames are used. The same boot artwork is reused for both legs; right/far leg is slightly darkened. Source-image clipping and rigid cutout transforms are authored game-animation code, not a claim of sprite-gen motion generation.

Gait:9 authored keys;0.95-second cycle;60% stance and40% swing; R is half a cycle after L. Two-bone IK solves the knees with fixed38px upper/lower segment lengths. Constant-speed root travel cancels the stance foot's backward movement.A single168/182 display scale keeps the new body at the original nominal height.32 export poses are sampled from exactly the runtime solver.

Validation: node --test rig.test.mjs passes4 tests:1000-pose bone lengths, opposite-leg contacts, no double-airborne pose and stationary world foot anchor throughout declared stance, loop closure. Atlas validation checks all32 cells remain inside384x256 bounds and the opposite contact cells differ. This validates the mathematical foot anchor, not anatomical heel/toe biomechanics or production cloth quality.

Controls: idle/walk, pause, speed, zoom, background, bone overlay, texture on/off, per-frame scrub/step. The travel panel demonstrates foot anchoring; root position resets every3 cycles. Comparisons share cycle phase, so the original6-frame RUN is retimed for visual comparison only. Actual game-size thumbnails use28 pixels/metre.

Limitations: isolated SE cutout prototype, not a finished painted animation. Seams and rigid cloth are still visible at high zoom. No game runtime assets, gameplay speed, server data or deployment were changed. Bone motion is editable in rig.mjs / exported JSON. Generated atlas is a plain cutout render; it has not been imported into sprite-gen or the game.

Files: rig.mjs, rig.test.mjs, preview.mjs, index.html, swordsman-rig-SE-32.png, swordsman-rig-SE.json, rig-contact.png, export-validation.json.

AutoSprite setup: global MCP entry added with codex mcp add autosprite --url https://www.autosprite.io/api/mcp; CLI reported Successfully logged in. Server config enabled and auth_status=o_auth. Tools are not hot-loaded into the already-running chat. get_account has not been called; restart Codex to expose the tool. No generation/upload/credit usage was initiated.
