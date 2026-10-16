# Swordsman painted art

Generated with the built-in imagegen tool for this task. Original PNGs are retained here; runtime uses hashed KTX2/WebP variants. No files in `art/sfx-source/` were used or changed.

## Angel NPC — angel-v1.png
Single original full-body winged guide, facing southeast, friendly open-hand gesture; ivory/sage traveling robes, brown hair, brass clasp. Fine warm-brown ink and soft gouache. Transparent background, clear feet and padding. No text, halo, or real-faith religious symbols. Sized to512×768 for runtime; UASTC and alpha-preserving WebP88.

## Skill icon atlas — skills-v1.png
Exactly12 icons,4 columns×3 rows, no text: punch, slash, whirlwind, dash thrust; cracked earth, provoke roar, Endure heart/shield, sword mastery; iron body, sword rhythm, fighter basics, first aid. Dark forest-green backgrounds, old-brass edging, painted pigment and warm ink. Runtime256×192,64px cells, WebP88. Last cell is retained from the original task art but unused after the follow-up removes first aid.

## VFX atlas — skills-vfx-v1.png
Exactly6 effects,3 columns×2 rows with padding and transparent background: ivory sword crescent, jade dash streak, ochre ground cracks/debris; amber roar ring, upright golden protective aura, teal whirlwind. No character, text, UI, or scene. Runtime768×512,256px cells, UASTC/WebP88, no mipmaps, deferred.

Repack with `node meadow-3d/tools/pack-skill-art.mjs`; it reads these source PNGs on subsequent runs. Hero attack/spin/dodge/cast poses are reused; the existing cast pose gains a short visual leap for earth break, and dash strike leaves translucent hero afterimages. New hero sprite strips were unnecessary.
