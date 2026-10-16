import * as T from "three";
import type { PaintedLoader } from "./assets";
export function mountSkillArt(
	scene: T.Scene,
	loader: PaintedLoader,
	hero: T.Group,
) {
	const atlas = loader.load("/assets/skills-painted/skills-vfx-v1.png");
	const active: {
		mesh: T.Object3D;
		life: number;
		max: number;
		scale: number;
		aura?: boolean;
		owner?: string;
	}[] = [];
	function painted(
		index: number,
		x: number,
		z: number,
		size: number,
		life = 0.75,
		upright = false,
		owner?: string,
	) {
		const geo = new T.PlaneGeometry(size, upright ? size * 1.3 : size),
			uv = geo.getAttribute("uv");
		for (let i = 0; i < uv.count; i++)
			uv.setXY(
				i,
				((index % 3) + uv.getX(i)) / 3,
				(1 - Math.floor(index / 3) + uv.getY(i)) / 2,
			);
		const mesh = new T.Mesh(
			geo,
			new T.MeshBasicMaterial({
				map: atlas,
				transparent: true,
				depthWrite: false,
				side: T.DoubleSide,
				toneMapped: false,
				opacity: 0.9,
			}),
		);
		if (!upright) mesh.rotation.x = -Math.PI / 2;
		else mesh.rotation.y = Math.atan2(9, 13);
		mesh.position.set(x, upright ? size * 0.55 : 0.09, z);
		scene.add(mesh);
		active.push({ mesh, life, max: life, scale: 1, aura: index === 4, owner });
	}
	return {
		emit(e: any) {
			if (e.type === "dashTrail") {
				const dx = e.toX - e.fromX,
					dz = e.toZ - e.fromZ,
					d = Math.hypot(dx, dz);
				for (let i = 1; i <= 3; i++) {
					const ghost = hero.clone(true);
					ghost.position.set(e.fromX + (dx * i) / 4, 0, e.fromZ + (dz * i) / 4);
					ghost.traverse((c: any) => {
						if (c.material) {
							c.material = c.material.clone();
							c.material.transparent = true;
							c.material.opacity = 0.18;
							c.material.depthWrite = false;
						}
					});
					scene.add(ghost);
					active.push({ mesh: ghost, life: 0.4, max: 0.4, scale: 1 });
				}
				painted(
					1,
					(e.fromX + e.toX) / 2,
					(e.fromZ + e.toZ) / 2,
					Math.max(2, d),
					0.55,
				);
				return;
			}
			const id = e.skillId;
			if (e.type === "skillImpact") {
				painted(2, e.x, e.z, 4.5, 0.9);
				return;
			}
			if (e.type !== "skill") return;
			if (id === "slash")
				painted(0, e.x + (e.dx || 0), e.z + (e.dz || 0), 2.7, 0.55);
			if (id === "whirlwind") painted(5, e.x, e.z, 5.2, 0.75);
			if (id === "dash_strike") painted(1, e.x, e.z, 3, 0.45);
			if (id === "provoke") painted(3, e.x, e.z, 9, 1);
			if (id === "endure") painted(4, e.x, e.z, 2.8, 8, true, e.playerId);
		},
		update(dt: number, players: any[]) {
			for (let i = active.length - 1; i >= 0; i--) {
				const a = active[i];
				a.life -= dt;
				const ratio = Math.max(0, a.life / a.max);
				if (a.aura) {
					const p = players.find((p) => p.id === a.owner);
					if (p) {
						a.mesh.position.x = p.x;
						a.mesh.position.z = p.z;
						if (!p.statuses?.some((s: any) => s.id === "endure")) a.life = 0;
					}
				}
				a.mesh.traverse((c: any) => {
					if (c.material)
						c.material.opacity =
							Math.min(0.85, ratio * 2) *
							(a.mesh instanceof T.Group ? 0.25 : 1);
				});
				if (!a.aura && a.mesh instanceof T.Mesh)
					a.mesh.scale.setScalar(0.8 + (1 - ratio) * 0.4);
				if (a.life <= 0) {
					scene.remove(a.mesh);
					a.mesh.traverse((c: any) => {
						if (a.mesh instanceof T.Mesh) c.geometry?.dispose();
						c.material?.dispose();
					});
					active.splice(i, 1);
				}
			}
		},
	};
}
