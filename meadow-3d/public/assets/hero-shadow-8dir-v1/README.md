# Shadow assassin preview

Four approved looks: male/female, sword with shield/bow; female wears shorts. Every clip has eight independently authored facings in SE, SW, NE, NW, S, E, N, W order. Idle/walk/attack/cast use 16 frames per direction; hit/dodge use four, death eight. Manifest contains frame dimensions, timing and per-direction foot/body calibration. Hashed WebP atlases contain 2,560 frames total; only the selected gender is preloaded in combat.

Source artwork: approved AutoSprite directional sheets for the first four motions; OpenAI imagegen for the 512 reaction frames. Source hashes and original sheet IDs are retained in validation.json. Authored source and normalization evidence are retained in the project workspace under output/shadow-clipping-repair-20261023 and output/shadow-reactions-20261023. Mechanical packing preserves complete silhouettes with transparent gutters; no procedural limb warping.

This is an opt-in local appearance preview, not persisted character equipment or a networked fashion system. The server still owns equipment, skills, health, damage and rewards. Other players keep their established appearance. Unauthored weapon families fall back to their existing art. Four-frame reactions are intended for short 0.22–0.30 second playback.
