"""Normalize registered generated art; preserve the common canvas and alpha."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/texture-sources/modular-hero-v1"
OUTPUT = ROOT / "public/assets/hero-modular-v1"
NAMES = ("body", "traveler", "guardian", "iron", "falchion", "shield", "bow")
FITTED = {"traveler": "traveler-fit-v2", "guardian": "guardian-fit-v2"}
OPENINGS = {"traveler": [(630, 307), (448, 548), (820, 600)],
            "guardian": [(630, 313), (452, 574), (812, 622)]}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for name in NAMES:
        stem = FITTED.get(name, name)
        source = SOURCE / f"{'bow-v1' if name == 'bow' else stem}.png"
        image = Image.open(source).convert("RGBA")
        assert image.size == (1254, 1254), (name, image.size)
        alpha = image.getchannel("A")
        assert alpha.getextrema() == (0, 255), name
        openings = [alpha.getpixel(point) for point in OPENINGS.get(name, [])]
        assert all(value < 16 for value in openings), (name, "opaque neck/cuff", openings)
        # Generated files contain near-transparent speckles far outside the silhouette.
        image.putalpha(alpha.point(lambda value: 0 if value < 16 else value))
        image = image.resize((768, 768), Image.Resampling.LANCZOS)
        target = OUTPUT / f"{stem}.webp"
        image.save(target, "WEBP", quality=95, method=6, exact=True)
        restored = Image.open(target)
        assert restored.mode == "RGBA" and restored.size == (768, 768), name
        report[name] = {
            "file": target.name,
            "size": list(restored.size),
            "alpha": list(restored.getchannel("A").getextrema()),
            "bytes": target.stat().st_size,
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "source": source.name,
            "openingAlpha": openings,
        }
    (OUTPUT / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"assets": len(report), "bytes": sum(v["bytes"] for v in report.values())}))


if __name__ == "__main__":
    main()
