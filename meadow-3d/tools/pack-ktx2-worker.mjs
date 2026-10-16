import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, ".."),
	basis = resolve(root, "public/basis/three-r185");
mkdirSync(basis, { recursive: true });
const fn = KTX2Loader.BasisWorker.toString();
const body = [
	"/* Generated from pinned Three r185 KTX2Loader; its Basis glue needs eval only inside this isolated worker. */",
	"let _EngineFormat=" + JSON.stringify(KTX2Loader.EngineFormat) + ";",
	"let _EngineType=" + JSON.stringify(KTX2Loader.EngineType) + ";",
	"let _TranscoderFormat=" + JSON.stringify(KTX2Loader.TranscoderFormat) + ";",
	"let _BasisFormat=" + JSON.stringify(KTX2Loader.BasisFormat) + ";",
	readFileSync(
		resolve(
			root,
			"../node_modules/three/examples/jsm/libs/basis/basis_transcoder.js",
		),
		"utf8",
	),
	fn.substring(fn.indexOf("{") + 1, fn.lastIndexOf("}")),
].join("\n");
writeFileSync(resolve(basis, "ktx2-worker-v1.js"), body);

copyFileSync(
	resolve(root, "art/texture-sources/LICENSE-Basis.txt"),
	resolve(basis, "LICENSE-Basis.txt"),
);
copyFileSync(
	resolve(root, "../node_modules/three/LICENSE"),
	resolve(basis, "LICENSE-Three.txt"),
);
copyFileSync(
	resolve(root, "../node_modules/three/examples/jsm/libs/basis/README.md"),
	resolve(basis, "README.md"),
);
