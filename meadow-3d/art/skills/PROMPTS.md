# Swordsman painted art

## Job 2 icons — skills-job2-v1.png (built-in imagegen, 2026-10-17)

Original ink-and-gouache, warm fine ink, upper-left lighting, dark painted backgrounds and old-brass edging, readable at 40px. Exactly 4 columns by 3 rows, padded equal cells. First six slate-teal, last six oxblood. Row-major: jade ward-shield driving forward with rim impact star; upright ward-shield and jade dome; shield and sword hitting ground with concentric cracks; raised sword with steel-blue/gold banner shockwave; brass helm crest over jade shield; shield reflecting a returning light arrow; three crimson claw slash arcs; dark iron clenched gauntlet with red flame and embers; spinning crimson blade ring; diving blade and ground crack; smouldering crimson eye in broken iron ring; sword dripping red light into a stylized heart. Cells 4,5,10,11 use passive circular ring edging. No text, numbers, religious symbols, gore, watermark or external UI frames. Original designs only.

`pack-job2-icons.py` copies the original first-job runtime raster without alteration into the upper 256×192 region of `skills-v2.png` and packs the new cells below it. The high-resolution original remains untouched.

## Job 2 VFX — skills-vfx-job2-v1.png

Built-in imagegen: original ink-and-gouache 4×3 transparent effect sheet, generous cell margins, no character, text, ground shadow, grid or UI. Row-major: jade crest impact; upright jade ward dome with brass; concentric quake rings and flagstones; steel-blue/gold banner shockwave; crimson claw arcs; upright red rage aura; crimson blade cyclone ring; crimson dive streak and landing crack; four golden stun stars; small jade crest spark; ember ground puff; jade return spark. Runtime 1024×768.

Correction source `skills-vfx-job2-v2.png`: preserve designs and palette; shrink each effect to 70% within its cell, restore clipped extremities, at least 15% transparent margins on all sides, no adjacent overlap. Runtime v1 is a uniform atlas resize of this correction. The rally effect still reads more as a blue crystalline ring than a banner and needs further art direction.

Generated with the built-in imagegen tool for this task. Original PNGs are retained here; runtime uses hashed KTX2/WebP variants. No files in `art/sfx-source/` were used or changed.

## Angel NPC — angel-v1.png
Single original full-body winged guide, facing southeast, friendly open-hand gesture; ivory/sage traveling robes, brown hair, brass clasp. Fine warm-brown ink and soft gouache. Transparent background, clear feet and padding. No text, halo, or real-faith religious symbols. Sized to512×768 for runtime; UASTC and alpha-preserving WebP88.

## Skill icon atlas — skills-v1.png
Exactly12 icons,4 columns×3 rows, no text: punch, slash, whirlwind, dash thrust; cracked earth, provoke roar, Endure heart/shield, sword mastery; iron body, sword rhythm, fighter basics, first aid. Dark forest-green backgrounds, old-brass edging, painted pigment and warm ink. Runtime256×192,64px cells, WebP88. Last cell is retained from the original task art but unused after the follow-up removes first aid.

## VFX atlas — skills-vfx-v1.png
Exactly6 effects,3 columns×2 rows with padding and transparent background: ivory sword crescent, jade dash streak, ochre ground cracks/debris; amber roar ring, upright golden protective aura, teal whirlwind. No character, text, UI, or scene. Runtime768×512,256px cells, UASTC/WebP88, no mipmaps, deferred.

Repack with `node meadow-3d/tools/pack-skill-art.mjs`; it reads these source PNGs on subsequent runs. Hero attack/spin/dodge/cast poses are reused; the existing cast pose gains a short visual leap for earth break, and dash strike leaves translucent hero afterimages. New hero sprite strips were unnecessary.
