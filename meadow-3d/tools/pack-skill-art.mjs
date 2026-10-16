import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const root = resolve("meadow-3d"),
	src = resolve(root, "art/skills"),
	out = resolve(root, "public/assets/skills-painted");
mkdirSync(src, { recursive: true });
mkdirSync(out, { recursive: true });
const generated =
	process.env.SKILL_ART_SOURCE ||
	"C:/Users/panup/.codex/generated_images/01a14294-ead1-7c33-b516-4987233af959";
const assets = [
	[
		"angel-v1",
		"exec-0cdc6e68-e7d7-4537-a408-10642ccf69ab.png",
		512,
		768,
		false,
	],
	[
		"skills-v1",
		"exec-ff05de7d-f1a6-4c95-81f6-dd6c509b4939.png",
		256,
		192,
		true,
	],
	[
		"skills-vfx-v1",
		"exec-17433e50-75b4-4484-8519-4d39ecf6a789.png",
		768,
		512,
		false,
	],
];
const manifest = JSON.parse(
	readFileSync(resolve(root, "public/texture-manifest.json"), "utf8"),
);
for (const [name, generatedName, w, h, cpu] of assets) {
	const source = resolve(src, name + ".png");
	try {
		readFileSync(source);
	} catch {
		copyFileSync(resolve(generated, generatedName), source);
	}
	const input = resolve(".codex-run", name + ".png"),
		webp = resolve(out, name + ".webp");
	const prep = spawnSync(
		"python",
		[
			"-X",
			"utf8",
			"-c",
			"from PIL import Image;import sys;im=Image.open(sys.argv[1]).convert('RGBA');im.resize((int(sys.argv[4]),int(sys.argv[5])),Image.Resampling.LANCZOS).save(sys.argv[2]);im=Image.open(sys.argv[2]);im.save(sys.argv[3],'WEBP',quality=88,method=6,exact=True)",
			source,
			input,
			webp,
			String(w),
			String(h),
		],
		{ encoding: "utf8" },
	);
	if (prep.status) throw Error(prep.stderr);
	const entry = {
		source: "art/skills/" + name + ".png",
		originalSize:
			name === "angel-v1"
				? [1024, 1536]
				: name === "skills-v1"
					? [1448, 1086]
					: [1536, 1024],
		size: [w, h],
		mode: "uastc",
		mips: false,
		cpu,
		hitMask: null,
		ktx2: null,
		webp: null,
	};
	if (!cpu) {
		const ktx = resolve(out, name + ".ktx2");
		const r = spawnSync(
			process.env.TOKTX ||
				resolve(".codex-run/ktx-tools/extracted/bin/toktx.exe"),
			[
				"--t2",
				"--encode",
				"uastc",
				"--assign_oetf",
				"srgb",
				"--lower_left_maps_to_s0t0",
				"--threads",
				"1",
				"--uastc_quality",
				"3",
				"--uastc_rdo_l",
				"0.5",
				"--zcmp",
				"18",
				ktx,
				input,
			],
			{ encoding: "utf8" },
		);
		if (r.status) throw Error(r.stderr);
		entry.ktx2 = ktx;
	}
	entry.webp = webp;
	for (const key of ["ktx2", "webp"])
		if (entry[key]) {
			const b = readFileSync(entry[key]),
				hash = createHash("sha256").update(b).digest("hex").slice(0, 10),
				file = name + "-" + hash + (key === "ktx2" ? ".ktx2" : ".webp");
			writeFileSync(resolve(out, file), b);
			entry[key] = "/assets/skills-painted/" + file;
		}
	manifest["/assets/skills-painted/" + name + ".png"] = entry;
}
writeFileSync(
	resolve(root, "public/texture-manifest.json"),
	JSON.stringify(manifest, null, 2) + "\n",
);
const icon = manifest["/assets/skills-painted/skills-v1.png"].webp;
writeFileSync(
	resolve(root, "src/skill-art.css"),
	`.job-icon{background-image:var(--skill-atlas,url('${icon}'))}\n`,
);
// Unversioned intermediates stay outside the shipping tree.
const { unlinkSync } = await import("node:fs");
for (const [name, , , , cpu] of assets) {
	unlinkSync(resolve(out, name + ".webp"));
	if (!cpu) unlinkSync(resolve(out, name + ".ktx2"));
}
