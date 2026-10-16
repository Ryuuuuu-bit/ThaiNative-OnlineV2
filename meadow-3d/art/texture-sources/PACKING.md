# Painted texture shipping pack

Original PNG atlases are retained here. Shipping assets use content-hashed KTX2 and WebP files. No images were repainted.

Run `node meadow-3d/tools/install-ktx2.mjs` on Windows x64 to extract the pinned official Khronos KTX-Software 4.4.2 encoder into `.codex-run/ktx-tools/`; it verifies SHA-256 and never launches the installer. Other platforms can install the same Khronos version and set `TOKTX` to `toktx`. Python 3 with Pillow is needed for alpha-preserving resize and WebP packing.

Run `node meadow-3d/tools/pack-ktx2.mjs`. UASTC quality 3 / RDO 0.5 / Zstd 18 preserves character ink edges. Environment ETC1S uses quality 255 / effort 4; only surface tiles have mipmaps. Encoding uses one thread for reproducibility. Sources are downscaled proportionally to at most 2048 with dimensions divisible by four (WebGL2 block requirement). `--lower_left_maps_to_s0t0` matches the existing Three TextureLoader UV convention. Fallback WebP quality is 88 for character/UI art and 86 for environment. WebP alpha is exact. Separate lossless alpha masks retain jelly click transparency without decompressing the GPU texture into Canvas2D.

The environment atlas is split into near and far layers without moving any UV rectangle. Arch, pillars and arena decoration are deferred; all plants, trees and camp art stay in the critical near layer. The King and rare hero motions are deferred. Audio is synthesized locally and begins only on Start; there are no audio downloads to defer.

Visual comparison raised the near environment atlas and pond water from ETC1S to UASTC / WebP 88: ETC1S softened tent brushwork and water highlights. Water is 512×512 with world mipmaps, sufficient for its repeated in-game footprint. Ground and distant environment remain ETC1S. The separate atelier HD preview sheets keep their original dimensions (up to 6144×2048) as CPU-only WebP frame sources so large previews retain detail; they never enter GPU texture loading or play boot. All GPU textures are at most 2048. Original brand artwork and app icons retain the previously requested formats and dimensions.

King prefetch starts after three kills or within ten world units of the arena. This gives the background queue more time than the approximate 60% unlock suggestion, without changing combat or unlock values. Critical fetches take priority, with three network slots and two background texture jobs. Restart Vite after repacking: this repository excludes public assets from its development watcher, so new content-hashed filenames otherwise require a fresh server.

The pinned Three r185 Basis wrapper, WASM and isolated worker are served from `public/basis/three-r185/`. The worker is generated from that exact Three version by `tools/pack-ktx2-worker.mjs`. Its eval permission is scoped to the worker response; the document keeps its restricted CSP.

Repacking preserves original sources and removes only archived PNG atlases and unversioned encoder outputs from the shipping folders. Application favicon/icon PNGs and the separately authored brand assets remain in their requested formats.

References: [Khronos 4.4.2](https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2), [Three KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html).
