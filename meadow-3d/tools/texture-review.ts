import * as T from "three";
import { PaintedLoader, assetJSON } from "../src/assets";
const renderer = new T.WebGLRenderer({
	antialias: true,
	preserveDrawingBuffer: true,
});
renderer.setSize(1440, 560);
renderer.setPixelRatio(1);
renderer.outputColorSpace = T.SRGBColorSpace;
document.body.append(renderer.domElement);
const textures = await assetJSON<any>("/texture-manifest.json"),
	env = await assetJSON<any>("/assets/env-painted/manifest.json"),
	monsters = await assetJSON<any>("/assets/monsters-painted/manifest.json");
const name = new URLSearchParams(location.search).get("case") || "hero",
	loader = new PaintedLoader(new T.LoadingManager(), renderer, textures);
loader.startDeferred();
let file = "/assets/hero-painted/hero-idle-v1.png",
	source = file,
	rect = [0, 0, 1 / 6, 1],
	aspect = 1.5;
if (name === "slime" || name === "king") {
	const species = monsters.species[name === "slime" ? "slime" : "king"];
	file = "/assets/monsters-painted/" + species.motions.idle.file;
	rect = [0, 0.75, 1 / species.motions.idle.columns, 0.25];
	aspect = species.cellSize[0] / species.cellSize[1];
	source = file;
}
if (name === "trees" || name === "camp") {
	const a = env.assets.find(
		(a: any) => a.name === (name === "trees" ? "tree-round" : "tent"),
	);
	file = "/assets/env-painted/" + a.atlas;
	source = "/assets/env-painted/env-1-v1.png";
	rect = a.uvRect;
	aspect = a.pixelSize[0] / a.pixelSize[1];
}
if (name === "pond") {
	file = source = "/assets/env-painted/tile-water-v2.png";
	rect = [0, 0, 1, 1];
	aspect = 1;
}
const before = await new T.TextureLoader().loadAsync(
	"/art/texture-sources/" + source.replace("/assets/", ""),
);
before.colorSpace = T.SRGBColorSpace;
before.minFilter = T.LinearFilter;
const after = await new Promise<T.Texture>((resolve, reject) =>
	loader.load(file, resolve, undefined, reject),
);
for (const [i, map] of [before, after].entries()) {
	const scene = new T.Scene();
	scene.background = new T.Color("#9aab90");
	const geo = new T.PlaneGeometry(aspect * 2, 2),
		uv = geo.getAttribute("uv");
	for (let n = 0; n < uv.count; n++)
		uv.setXY(n, rect[0] + uv.getX(n) * rect[2], rect[1] + uv.getY(n) * rect[3]);
	scene.add(
		new T.Mesh(
			geo,
			new T.MeshBasicMaterial({ map, transparent: true, side: T.DoubleSide }),
		),
	);
	const camera = new T.OrthographicCamera(-1.5, 1.5, 1.167, -1.167, 0.1, 10);
	camera.position.z = 3;
	renderer.setViewport(i * 720, 0, 720, 560);
	renderer.setScissor(i * 720, 0, 720, 560);
	renderer.setScissorTest(true);
	renderer.render(scene, camera);
}
document.querySelector("#title")!.textContent =
	name + " · original vs optimized (same UVs / camera / display size)";
document.body.dataset.ready = "true";
