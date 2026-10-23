# Remaining material and consumable artwork

This batch replaces the last 100 etched item symbols: 95 materials and five consumables, including all regional cores and the astral scrolls. Each item has its own original painting generated with the built-in `image_gen` tool and native alpha. Exact prompts and generation records are retained in `originals/*.receipt.json`; `plan.json` lists the requested subjects. No external artwork was supplied.

Run `python meadow-3d/tools/pack-material-art-v3.py` to publish the retained originals as 192×192 RGBA PNGs with at least eight pixels of padding. The manifest records shipping, source and receipt hashes. The generated registry is consumed by the existing `itemIconCell` helper, so inventory, trading, bestiary, collection and review pages use the same artwork.

The source crops use alpha ≥32 bounds with four source pixels of padding, followed by contain fitting. Fully opaque backgrounds, empty images, solid content touching source edges and output clipping are rejected. The contact sheet is rebuilt under ignored `qa/` for visual review.

Existing painted atlas artwork and the first artwork batch remain in use. No item IDs, stats, effects or drop rates change in this batch.
