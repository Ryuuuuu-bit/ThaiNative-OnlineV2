// Monster sprite QC: every forest species, direction and frame of one motion,
// drawn through the shipping painted-monster code and KTX2/WebP textures.
// Usage: /tools/monster-review.html?motion=hop&species=wolf  (idle | hop | attack | death)
import * as T from "three";
import { PaintedLoader } from "../src/assets";
import { makePaintedMonster } from "../src/painted-monster";
import type { Enemy, MonsterMotion } from "../src/sim";

const params = new URLSearchParams(location.search);
const motion = (params.get("motion") || "idle") as MonsterMotion;
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = T.SRGBColorSpace;
document.body.append(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color("#4f6a52");
const loader = new PaintedLoader(new T.LoadingManager(), renderer, await fetch("/texture-manifest.json").then((r) => r.json()));
loader.startDeferred();
const manifest = await fetch("/assets/monsters-painted/manifest.json").then((r) => r.json());

// Facing vectors that resolve to SE, SW, NE, NW under the game camera.
const FACINGS: [string, number, number][] = [["SE", 1, 0], ["SW", 0, 1], ["NE", 0, -1], ["NW", -1, 0]];
const only = params.get("species");
const SPECIES = ([["jelly_pink", "slime", false], ["king_jelly", "king", true], ["mist_shroom", "shroom", false], ["shade_wolf", "wolf", false], ["lantern_wisp", "wisp", false], ["stump_guard", "stump", false], ["mist_warden", "warden", true]] as [string, string, boolean][]).filter(([, sp]) => !only || only.split(",").includes(sp));
if(!SPECIES.length)throw Error('Unknown monster review species: '+only);
const bossMotion: Record<string, string> = { hop: "move", attack: "slam" };
const actors: { update: (e: Enemy, t: number) => void; snapshot: () => { loaded: string[] }; motions: number; enemy: Enemy }[] = [];
const spacing = 6.2, rowGap = 6;
// Screen-right and screen-up directions on the ground for the (9,16,13) camera.
const R = [13 / Math.hypot(13, 9), -9 / Math.hypot(13, 9)], U = [-9 / Math.hypot(13, 9), -13 / Math.hypot(13, 9)];
// One species: a row per direction. Several: a row per species, directions side by side.
const perDirection = SPECIES.length === 1;
const rows = perDirection ? FACINGS.length : SPECIES.length;
SPECIES.forEach(([dataId, species, boss], index) => {
	const name = boss ? bossMotion[motion] || motion : motion;
	const def = manifest.species[species].motions[name];
	FACINGS.forEach(([, fx, fz], facing) => {
		for (let f = 0; f < def.frames; f++) {
			const row = perDirection ? facing : index, col = perDirection ? f : facing * def.frames + f;
			const columns = perDirection ? def.frames : FACINGS.length * def.frames;
			const start = def.frameDurations.slice(0, f).reduce((a: number, b: number) => a + b, 0);
			const actor = makePaintedMonster(loader, boss, { dataId, id: actors.length });
			const along = (col - (columns - 1) / 2) * spacing * (boss ? 1.6 : 1), across = ((rows - 1) / 2 - row) * rowGap * (boss && perDirection ? 1.8 : 1) - (boss && !perDirection ? 6 : 0);
			const enemy = { x: along * R[0] + across * U[0], z: along * R[1] + across * U[1], fx, fz, motion: name, motionTime: start + 0.01, bossPhase: 1, variant: "pink", hurt: 0, dead: false, deathAge: 0, boss } as unknown as Enemy;
			scene.add(actor.root);
			actors.push({ update: actor.update, snapshot: actor.snapshot, motions: Object.keys(manifest.species[species].motions).length, enemy });
		}
	});
});
const ground = new T.Mesh(new T.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: "#5d7a5c" }));
scene.add(ground);
const h = Number(params.get("zoom")) || (perDirection ? (SPECIES[0][2] ? 56 : 26) : 50);
const camera = new T.OrthographicCamera(-h * innerWidth / innerHeight / 2, h * innerWidth / innerHeight / 2, h / 2, -h / 2, 0.1, 400);
camera.position.set(9, 16, 13).multiplyScalar(4);
camera.lookAt(0, 0, 0);
// Ready once every motion texture of every shown species has arrived, plus a few frames.
let settled = 0;
function frame() {
	requestAnimationFrame(frame);
	for (const a of actors) a.update(a.enemy, 0);
	renderer.render(scene, camera);
	if (actors.every((a) => a.snapshot().loaded.length >= a.motions) && ++settled === 10) { document.body.dataset.ready = "true";document.body.dataset.actorCount=String(actors.length); }
}
frame();
document.querySelector("#title")!.textContent = perDirection ? `${SPECIES[0][1]} ${motion} · rows: SE, SW, NE, NW · columns: frames` : `${motion} · rows: ${SPECIES.map((s) => s[1]).join(", ")} · columns: SE, SW, NE, NW × frames`;
