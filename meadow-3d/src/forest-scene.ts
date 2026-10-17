import * as T from 'three';
import type { PaintedLoader } from './assets';
import { FOREST, FOREST_TREES, FOREST_CAMP, FOREST_ARENA, GATES } from '@thainative/shared/maps';
import { label, random } from './scene';

/**
 * ป่าหมอก greybox. Layout and collision come from shared maps.ts; the painted art pass
 * (CODEX_FOREST_ART.md) replaces these placeholder meshes without moving anything.
 */
export function buildForest(scene: T.Scene, loader: PaintedLoader) {
	const r = random(29), root = new T.Group();
	scene.add(root);
	let high = true;
	const grass = loader.load('/assets/meadow-grass.png');
	grass.colorSpace = T.SRGBColorSpace;
	grass.wrapS = grass.wrapT = T.RepeatWrapping;
	grass.repeat.set(18, 18);
	const ground = new T.Mesh(new T.PlaneGeometry(110, 110), new T.MeshStandardMaterial({ map: grass, color: '#7f9a86', roughness: 1 }));
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = -0.025;
	ground.receiveShadow = true;
	root.add(ground);

	// Path from the west gate to the warden's clearing.
	const path = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial({ color: '#8d8466', roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }));
	path.rotation.x = -Math.PI / 2;
	path.scale.set(32, 2.2, 1);
	path.position.set(-3, 0.004, 0);
	root.add(path);
	const branch = path.clone();
	branch.scale.set(10, 1.8, 1);
	branch.rotation.z = -0.5;
	branch.position.set(9, 0.005, 3);
	root.add(branch);

	// Mist pool (blocked in collision).
	const pool = new T.Mesh(new T.CircleGeometry(1, 48), new T.MeshStandardMaterial({ color: '#5f8790', roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.85 }));
	pool.rotation.x = -Math.PI / 2;
	pool.scale.set(4, 2.6, 1);
	pool.position.set(5, 0.01, -8);
	root.add(pool);

	// Trees: trunk + two canopy cones; radius matches collision.
	const trunkMat = new T.MeshStandardMaterial({ color: '#4d3d33', roughness: 1 });
	const leafMats = ['#2f4b3d', '#365645', '#2a4438'].map(c => new T.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true }));
	const casters: T.Mesh[] = [];
	for (const t of FOREST_TREES) {
		const tree = new T.Group();
		const h = 3.2 + r() * 1.6;
		const trunk = new T.Mesh(new T.CylinderGeometry(t.r * 0.32, t.r * 0.42, h * 0.45, 7), trunkMat);
		trunk.position.y = h * 0.22;
		const low = new T.Mesh(new T.ConeGeometry(t.r * 1.5, h * 0.55, 8), leafMats[Math.floor(r() * 3)]);
		low.position.y = h * 0.55;
		const top = new T.Mesh(new T.ConeGeometry(t.r * 1.05, h * 0.45, 8), leafMats[Math.floor(r() * 3)]);
		top.position.y = h * 0.85;
		for (const m of [trunk, low, top]) { m.castShadow = true; casters.push(m); tree.add(m); }
		tree.position.set(t.x, 0, t.z);
		tree.rotation.y = r() * Math.PI;
		root.add(tree);
	}
	// Dense treeline outside the walkable rectangle.
	const edge = new T.InstancedMesh(new T.ConeGeometry(1.4, 4.6, 7), leafMats[2], 72);
	const m4 = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), v = new T.Vector3();
	let n = 0;
	for (let i = 0; i < 72; i++) {
		const side = i % 4, k = Math.floor(i / 4) / 18;
		let x = 0, z = 0;
		if (side === 0) { x = -FOREST.halfX + k * FOREST.halfX * 2; z = -FOREST.halfZ - 1.2; }
		if (side === 1) { x = -FOREST.halfX + k * FOREST.halfX * 2; z = FOREST.halfZ + 1.2; }
		if (side === 2) { x = FOREST.halfX + 1.2; z = -FOREST.halfZ + k * FOREST.halfZ * 2; }
		if (side === 3) { x = -FOREST.halfX - 1.2; z = -FOREST.halfZ + k * FOREST.halfZ * 2; if (Math.abs(z) < 2.4) continue; }
		const sc = 0.8 + r() * 0.6;
		m4.compose(v.set(x + (r() - 0.5), 2.2 * sc, z + (r() - 0.5)), q, s.set(sc, sc, sc));
		edge.setMatrixAt(n++, m4);
	}
	edge.count = n;
	root.add(edge);

	// Warden clearing ring and camp fire.
	const arena = new T.Mesh(new T.RingGeometry(3.2, 3.5, 64), new T.MeshBasicMaterial({ color: '#c9d8c4', transparent: true, opacity: 0.35, depthWrite: false }));
	arena.rotation.x = -Math.PI / 2;
	arena.position.set(FOREST_ARENA.x, 0.02, FOREST_ARENA.z);
	root.add(arena);
	const flame = new T.Group();
	flame.position.set(FOREST_CAMP.x + 1.3, 0.12, FOREST_CAMP.z - 0.7);
	root.add(flame);
	const flames: T.Mesh[] = [];
	for (let i = 0; i < 3; i++) {
		const f = new T.Mesh(new T.ConeGeometry(0.09, 0.38, 6), new T.MeshBasicMaterial({ color: i % 2 ? '#f8dfad' : '#db9b65', transparent: true, opacity: 0.7, depthWrite: false }));
		f.position.set(Math.sin(i * 2) * 0.08, 0.2, Math.cos(i * 2) * 0.08);
		flame.add(f);
		flames.push(f);
	}
	const fireLight = new T.PointLight('#ffb36b', 4, 7, 2);
	fireLight.position.set(flame.position.x, 1, flame.position.z);
	root.add(fireLight);

	// Low drifting mist sheets.
	const puff = document.createElement('canvas');
	puff.width = puff.height = 128;
	const pc = puff.getContext('2d')!, grad = pc.createRadialGradient(64, 64, 4, 64, 64, 64);
	grad.addColorStop(0, 'rgba(255,255,255,1)');
	grad.addColorStop(1, 'rgba(255,255,255,0)');
	pc.fillStyle = grad;
	pc.fillRect(0, 0, 128, 128);
	const mistMat = new T.MeshBasicMaterial({ color: '#dfe8e2', map: new T.CanvasTexture(puff), transparent: true, opacity: 0.22, depthWrite: false });
	const mist = new T.Group();
	for (let i = 0; i < 9; i++) {
		const sheet = new T.Mesh(new T.PlaneGeometry(9, 4), mistMat);
		sheet.rotation.x = -Math.PI / 2;
		sheet.position.set(-16 + i * 4, 0.35 + (i % 3) * 0.12, (r() - 0.5) * 24);
		mist.add(sheet);
	}
	root.add(mist);

	const gate = GATES.forest.west;
	const gateName = label('← นครที่ถูกลืมเลือน');
	gateName.position.set(gate.x + 1.5, 3.2, gate.z);
	root.add(gateName);
	const campName = label('แคมป์ · พักฟื้น', '#e5efd3');
	campName.position.set(FOREST_CAMP.x, 2.1, FOREST_CAMP.z);
	root.add(campName);

	return {
		root,
		setQuality(hq: boolean) { high = hq; mist.visible = hq; casters.forEach(o => (o.castShadow = hq)); },
		snapshot: () => ({ ready: true, greybox: true, trees: FOREST_TREES.length, quality: high ? 'HQ' : 'LOW' }),
		update(time: number) {
			flames.forEach((f, i) => { f.scale.y = 0.85 + Math.sin(time * 11 + i) * 0.13; f.rotation.y = time * 0.6; });
			fireLight.intensity = 3.5 + Math.sin(time * 9) * 0.5;
			mist.children.forEach((o, i) => { o.position.x += Math.sin(time * 0.1 + i) * 0.002; });
		},
	};
}
