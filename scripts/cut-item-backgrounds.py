"""Cut the parchment tile out of the painted item atlas.

Reads  meadow-3d/art/painted-items/items-v1-source.png  (5x5 grid, cream background)
Writes meadow-3d/art/painted-items/items-v1-alpha-source.png  (full-res, transparent)
       meadow-3d/public/assets/items/items-v1-alpha.webp      (128px cells, used by the UI)

Each cell is flood-filled from its border with pixels close to the cell's median
border colour, so enclosed cream parts of an item (e.g. the traveler shirt) stay.
Cells whose background is fully enclosed by the item get manual seeds in SEEDS.

Usage: python scripts/cut-item-backgrounds.py   (needs Pillow only)
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parent.parent / "meadow-3d"
SRC = ROOT / "art/painted-items/items-v1-source.png"
OUT_SOURCE = ROOT / "art/painted-items/items-v1-alpha-source.png"
OUT_WEB = ROOT / "public/assets/items/items-v1-alpha.webp"

GRID = 5
INSET = 10  # px trimmed from each source cell to drop the grid lines between tiles
TOLERANCE = 48  # max channel distance from the border colour that counts as background
WEB_CELL = 128
# (row, col) -> extra fill points as fractions of the cell, for background the border fill cannot reach
SEEDS = {(1, 0): [(0.55, 0.5), (0.62, 0.4), (0.45, 0.62)]}  # bamboo_bow: inside the string


def cut_cell(cell, seeds):
	w, h = cell.size
	border = [cell.getpixel((x, 0)) for x in range(w)] + [cell.getpixel((x, h - 1)) for x in range(w)]
	border += [cell.getpixel((0, y)) for y in range(h)] + [cell.getpixel((w - 1, y)) for y in range(h)]
	strip = Image.new("RGB", (len(border), 1))
	strip.putdata(border)
	bg = tuple(int(v) for v in ImageStat.Stat(strip).median)

	diff = ImageChops.difference(cell.filter(ImageFilter.GaussianBlur(1.5)), Image.new("RGB", cell.size, bg))
	r, g, b = diff.split()
	mask = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v < TOLERANCE else 0)

	points = [(x, y) for x in range(0, w, 2) for y in (0, h - 1)] + [(x, y) for y in range(0, h, 2) for x in (0, w - 1)]
	points += [(int(fx * w), int(fy * h)) for fx, fy in seeds]
	for p in points:
		if mask.getpixel(p) == 255:
			ImageDraw.floodfill(mask, p, 128)

	alpha = mask.point(lambda v: 0 if v == 128 else 255)
	alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.0))
	out = cell.convert("RGBA")
	out.putalpha(alpha)
	return out


def main():
	src = Image.open(SRC).convert("RGB")
	size = src.size[0] / GRID
	full = round(size)
	sheet = Image.new("RGBA", (full * GRID, full * GRID), (0, 0, 0, 0))
	for row in range(GRID):
		for col in range(GRID):
			x0, y0 = round(col * size), round(row * size)
			cell = src.crop((x0 + INSET, y0 + INSET, x0 + full - INSET, y0 + full - INSET))
			sheet.paste(cut_cell(cell, SEEDS.get((row, col), [])), (col * full + INSET, row * full + INSET))
	sheet.save(OUT_SOURCE)
	sheet.resize((WEB_CELL * GRID, WEB_CELL * GRID), Image.LANCZOS).save(OUT_WEB, "WEBP", quality=90, method=6)
	print(f"wrote {OUT_SOURCE.name} {sheet.size} and {OUT_WEB.name} {WEB_CELL * GRID}px")


if __name__ == "__main__":
	main()
