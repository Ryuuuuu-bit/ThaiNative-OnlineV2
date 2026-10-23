"""Pack reviewed whole-body poses without moving or deforming their contents."""
from pathlib import Path
import hashlib
import json
import math
import shutil
import sys
import tempfile
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
PLAN = REPO / "output/shadow-assassin-prototype-20261023/source-clips.json"
OUTPUT = REPO / "meadow-3d/public/assets/hero-shadow-v1"
LOOKS = {"male-iron", "male-bow", "female-iron", "female-bow"}
MOTIONS = {"walk", "attack", "cast"}
SCALE, CELL = .75, 384


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def edges(alpha):
    w, h = alpha.size
    return [name for name, box in {"top": (0, 0, w, 1), "bottom": (0, h-1, w, h),
            "left": (0, 0, 1, h), "right": (w-1, 0, w, h)}.items()
            if alpha.crop(box).getextrema()[1] > 32]


def pack_clip(meta, repo, motion):
    assert meta.get("reviewed") is True, "Visual review required"
    assert meta["sourceCell"] == [512, 512], "Expected 512px source cells"
    columns, count, picks = meta["sourceColumns"], meta["sourceFrames"], meta["picks"]
    assert type(columns) is int and type(count) is int and 0 < columns <= count
    assert isinstance(picks, list) and len(picks) > 1
    assert all(type(i) is int and 0 <= i < count for i in picks), "Invalid frame selection"
    assert number(meta["seconds"]) and meta["seconds"] > 0
    assert len(meta["anchor"]) == 2 and all(number(v) and 0 <= v <= 512 for v in meta["anchor"])
    assert number(meta["bodyHeight"]) and 0 < meta["bodyHeight"] <= 512
    assert all(isinstance(meta.get(k), str) and meta[k] for k in ("characterId", "spritesheetId"))
    impact = meta.get("impactFrame")
    assert impact is None or type(impact) is int and 0 <= impact < len(picks)
    assert motion == "walk" or impact is not None and impact > 0, "Action requires anticipation before impact"
    relative = Path(meta["source"])
    source = (repo / relative).resolve()
    assert not relative.is_absolute() and source.is_relative_to(repo.resolve()), "Source must stay in repository"
    with Image.open(source) as opened:
        assert opened.size == (columns * 512, math.ceil(count / columns) * 512), "Invalid source grid"
        image = opened.convert("RGBA")
    alpha = image.getchannel("A")
    assert alpha.getextrema()[0] < 255 and alpha.getextrema()[1] > 0, "Transparent background required"
    for i in range(count):
        x, y = i % columns * 512, i // columns * 512
        assert alpha.crop((x, y, x+512, y+512)).getbbox(), f"Empty source frame {i}"
    out_columns = min(5, len(picks))
    sheet = Image.new("RGBA", (out_columns * CELL, math.ceil(len(picks) / out_columns) * CELL))
    edge_frames, bounds = [], [CELL, CELL, 0, 0]
    for output_index, source_index in enumerate(picks):
        x, y = source_index % columns * 512, source_index // columns * 512
        frame = image.crop((x, y, x+512, y+512))
        scaled = frame.resize((CELL, CELL), Image.Resampling.LANCZOS)
        box = scaled.getchannel("A").getbbox()
        bounds = [min(bounds[0], box[0]), min(bounds[1], box[1]), max(bounds[2], box[2]), max(bounds[3], box[3])]
        sheet.paste(scaled, (output_index % out_columns * CELL, output_index // out_columns * CELL))
        source_edges, output_edges = edges(frame.getchannel("A")), edges(scaled.getchannel("A"))
        if source_edges or output_edges:
            edge_frames.append({"frame": output_index, "sourceFrame": source_index,
                                "sourceEdges": source_edges, "outputEdges": output_edges})
    clip = {"cell": [CELL, CELL], "columns": out_columns, "frames": len(picks), "seconds": meta["seconds"],
            "anchor": [v*SCALE for v in meta["anchor"]], "bodyHeight": meta["bodyHeight"]*SCALE, "bounds": bounds}
    if impact is not None:
        clip["impactFrame"] = impact
    return sheet, clip, {"source": meta, "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                         "sourceAlpha": list(alpha.getextrema()), "edgeFrames": edge_frames}


def pack(plan_path=PLAN, output=OUTPUT, repo=REPO):
    plan_bytes = plan_path.read_bytes()
    plan = json.loads(plan_bytes)
    assert set(plan["looks"]) == LOOKS, "All four looks required"
    manifest, reports = {"version": 2, "looks": {}}, {}
    with tempfile.TemporaryDirectory(prefix="fullbody-pack-") as folder:
        staging = Path(folder)
        for look, data in plan["looks"].items():
            assert isinstance(data["label"], str) and data["label"].strip()
            assert set(data["clips"]) == MOTIONS, "Walk, attack and cast required"
            clips = {}
            for motion, meta in data["clips"].items():
                image, clip, report = pack_clip(meta, repo, motion)
                name = f"{look}-{motion}.webp"
                target = staging / name
                image.save(target, "WEBP", quality=95, method=6, exact=True)
                with Image.open(target) as decoded:
                    decoded.load()
                    assert decoded.size == image.size and decoded.mode == "RGBA"
                    alpha = decoded.getchannel("A")
                    assert alpha.getextrema()[0] < 255 and alpha.getextrema()[1] > 0
                    for i in range(clip["frames"]):
                        x, y = i % clip["columns"] * CELL, i // clip["columns"] * CELL
                        assert alpha.crop((x, y, x+CELL, y+CELL)).getbbox(), "Empty packed frame"
                    report.update(size=list(decoded.size), alpha=list(alpha.getextrema()))
                clip["url"] = f"/assets/hero-shadow-v1/{name}"
                clips[motion] = clip
                report.update(file=name, bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest())
                reports[f"{look}-{motion}"] = report
            clips["idle"] = {k: v for k, v in clips["attack"].items() if k != "impactFrame"}
            clips["idle"].update(frames=1, seconds=1)
            clips["heal"] = dict(clips["cast"])
            manifest["looks"][look] = {"label": data["label"], "clips": clips}
        validation = {"scale": SCALE, "planSha256": hashlib.sha256(plan_bytes).hexdigest(), "plan": plan,
                      "note": "Occupied edges require visual review; projectiles may intentionally leave the cell.", "clips": reports}
        for name, data in (("manifest.json", manifest), ("validation.json", validation)):
            (staging / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        output.mkdir(parents=True, exist_ok=True)
        # Validate every look before replacing any runtime files; publish the manifest last.
        for source in sorted(staging.iterdir(), key=lambda p: p.name == "manifest.json"):
            shutil.copyfile(source, output / source.name)
    return {"clips": len(reports), "bytes": sum(r["bytes"] for r in reports.values()),
            "clipsWithOccupiedEdges": [name for name, report in reports.items() if report["edgeFrames"]]}


def self_check():
    with tempfile.TemporaryDirectory(prefix="fullbody-check-") as folder:
        repo = Path(folder)
        image = Image.new("RGBA", (1024, 512))
        image.paste((255, 40, 20, 255), (40, 50, 80, 100))
        image.paste((20, 40, 255, 255), (812, 200, 852, 250))
        image.save(repo / "source.png")
        meta = {"reviewed": True, "source": "source.png", "sourceCell": [512, 512], "sourceColumns": 2,
                "sourceFrames": 2, "picks": [1, 0], "seconds": 1, "anchor": [256, 480], "bodyHeight": 400,
                "impactFrame": 1, "characterId": "fixture", "spritesheetId": "fixture"}
        sheet, clip, _ = pack_clip(meta, repo, "attack")
        assert clip["anchor"] == [192, 360] and clip["bodyHeight"] == 300
        for i, source_index in enumerate(meta["picks"]):
            expected = image.crop((source_index*512, 0, (source_index+1)*512, 512)).resize((384, 384), Image.Resampling.LANCZOS)
            assert sheet.crop((i*384, 0, (i+1)*384, 384)).tobytes() == expected.tobytes(), "Registration changed"
        for invalid in ({"sourceColumns": 1}, {"anchor": [513, 480]}, {"picks": [0, 2]},
                        {"impactFrame": 0}, {"reviewed": False}, {"bodyHeight": 0}):
            try:
                pack_clip({**meta, **invalid}, repo, "attack")
            except AssertionError:
                continue
            raise AssertionError(f"Invalid metadata accepted: {invalid}")
        incomplete = repo / "plan.json"
        incomplete.write_text(json.dumps({"looks": {}}), encoding="utf-8")
        try:
            pack(incomplete, repo / "runtime", repo)
        except AssertionError:
            assert not (repo / "runtime").exists()
        else:
            raise AssertionError("Incomplete plan published")
    print("Full-body packer self-check passed")


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-check"]:
        self_check()
    else:
        assert not sys.argv[1:], "Usage: pack-fullbody-hero.py [--self-check]"
        print(json.dumps(pack()))
