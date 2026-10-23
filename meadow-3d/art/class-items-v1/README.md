# Class equipment illustrations

208 original inventory illustrations for the class equipment expansion, including 7 Unique items. `catalog.json` is the fixed scope; `tasks.json` is the generation checklist. Each item receives an individual built-in `image_gen` call, with the existing painted equipment used as a style reference. No paid external generation service or API key is used.

## Art direction

Square hand-painted fantasy inventory art with thin dark edge accents, textured metal, cloth and leather, antique gold detail, restrained jewel colors, upper-left highlights, and a clear silhouette at 48px. Preserve the established Thai fantasy equipment style. Tiers change material, silhouette details and ornament, not merely hue. Shop gear has practical, symmetrical construction; rolled field gear has distinct carved embellishment and talismans. Each Unique has a bespoke design tied to its Mastery.

Output: 192×192 RGBA PNG, contain-fit within 176×176, at least 8px transparent margins. No labels, frames, scenery, characters or baked backgrounds. The full-resolution original and per-item generation receipt remain in `sources/`. `style-reference.jpg` contains existing first-party equipment only.

Run `python meadow-3d/tools/pack-class-item-art.py` after all sources and receipts exist. It validates transparency, unique output hashes, safe bounds and the full 208-item scope before writing the manifest, runtime registry and preview sheets. Inspect every preview sheet and representative icons in the item catalog and inventory.

Built-in image generation; source prompts are retained in each `.receipt.json`. Runtime references must use the packaged copies under `meadow-3d/public/assets/class-items-v1/`, never the generator's local storage paths.

## Review files

[Unique preview](uniques-preview.jpg) · [Sheet 1](preview-1.jpg) · [Sheet 2](preview-2.jpg) · [Sheet 3](preview-3.jpg) · [Sheet 4](preview-4.jpg) · [Sheet 5](preview-5.jpg) · [Sheet 6](preview-6.jpg) · [Sheet 7](preview-7.jpg)

[All 208 generation prompts](generation-prompts.json)
