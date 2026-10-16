import * as T from "three";
import type { PaintedLoader } from "./assets";
export function mountSkillArt(
	scene: T.Scene,
	loader: PaintedLoader,
	hero: T.Group,
) {
	const atlas = loader.load("/assets/skills-painted/skills-vfx-v1.png");
	let highQuality=true;
	let currentOwner:string|undefined,currentLight=false;
	const frozenMaps=new WeakSet<T.Texture>();
	function dispose(mesh:T.Object3D){scene.remove(mesh);mesh.traverse((c:any)=>{if(c.isMesh)c.geometry?.dispose();if(c.material){if(c.material.map&&frozenMaps.has(c.material.map))c.material.map.dispose();c.material.dispose();}});}
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
		if(active.length>=(highQuality?32:16))return;
		owner??=currentOwner;
		if(currentLight){size*=.8;life=Math.min(life,.35);}
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
		setQuality(high:boolean){highQuality=high;},
		snapshot:()=>({active:active.length,cap:highQuality?32:16}),
		emit(e: any) {
			currentOwner=e.playerId;currentLight=!!e.lighter;
			if(e.lighter&&active.length>=8)return;
			if (e.type === "dashTrail") {
				const dx = e.toX - e.fromX,
					dz = e.toZ - e.fromZ,
					d = Math.hypot(dx, dz);
				for (let i = 1; i <= (e.lighter?1:highQuality?3:2); i++) {
					if(active.length>=(highQuality?32:16))break;
					const ghost = new T.Group();
					hero.traverse((c:any)=>{if(c.isSprite&&c.visible){const copy=c.clone();copy.material=c.material.clone();if(copy.material.map){const source=copy.material.map;copy.material.map=source.clone();copy.material.map.isCompressedTexture=source.isCompressedTexture;frozenMaps.add(copy.material.map);}ghost.add(copy);}});
					ghost.position.set(e.fromX + (dx * i) / 4, 0, e.fromZ + (dz * i) / 4);
					ghost.traverse((c: any) => {
						if (c.material) {
							c.material.transparent = true;
							c.material.opacity = 0.18;
							c.material.depthWrite = false;
						}
					});
					scene.add(ghost);
					active.push({ mesh: ghost, life: 0.4, max: 0.4, scale: 1,owner:e.playerId });
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
		update(dt: number, players: any[], frozen:(id:string)=>boolean=()=>false) {
			for (let i = active.length - 1; i >= 0; i--) {
				const a = active[i];
				if(a.owner&&frozen(a.owner))continue;
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
					dispose(a.mesh);
					active.splice(i, 1);
				}
			}
		},
	};
}
