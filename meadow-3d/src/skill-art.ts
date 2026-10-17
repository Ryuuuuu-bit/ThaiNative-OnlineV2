import * as T from "three";
import {BORROWED_MOTION, type SkillMotion} from './skill-motions';
import type { PaintedLoader } from "./assets";
export function mountSkillArt(
	scene: T.Scene,
	loader: PaintedLoader,
	hero: T.Group,
) {
	const atlas = loader.load("/assets/skills-painted/skills-vfx-v1.png");
	type Atlas={map:T.Texture;cols:number;rows:number;material?:T.MeshBasicMaterial};
 const first:Atlas={map:atlas,cols:3,rows:2};
 let second:Atlas|undefined,stars:T.InstancedMesh|undefined,clock=0;
 const starTransform=new T.Object3D();
 function warmJob2(){
  if(second)return;
  const map=loader.load('/assets/skills-painted/skills-vfx-job2-v1.png');
  second={map,cols:4,rows:3,material:new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,opacity:.85})};
  const geo=new T.PlaneGeometry(1.15,.65),uv=geo.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/4,uv.getY(i)/3);
  stars=new T.InstancedMesh(geo,new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false}),256);stars.count=0;stars.frustumCulled=false;scene.add(stars);
 }
 let highQuality=true;
	let currentOwner:string|undefined,currentLight=false;
	const frozenMaps=new WeakSet<T.Texture>();
	function dispose(mesh:T.Object3D){scene.remove(mesh);mesh.traverse((c:any)=>{if(c.isMesh)c.geometry?.dispose();if(c.material){if(c.material.map&&frozenMaps.has(c.material.map))c.material.map.dispose();if(c.material!==second?.material)c.material.dispose();}});}
	const active: {
		mesh: T.Object3D;
		life: number;
		max: number;
		scale: number;
		aura?: string;
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
    sheet:Atlas=first,
    aura?:string,
	) {
		if(active.length>=(highQuality?32:16))return;
		owner??=currentOwner;
		if(currentLight){size*=.8;life=Math.min(life,.35);}
		const geo = new T.PlaneGeometry(size, upright ? size * 1.3 : size),
			uv = geo.getAttribute("uv");
		for (let i = 0; i < uv.count; i++)
			uv.setXY(
				i,
				((index % sheet.cols) + uv.getX(i)) / sheet.cols,
				(sheet.rows - 1 - Math.floor(index / sheet.cols) + uv.getY(i)) / sheet.rows,
			);
		const mesh = new T.Mesh(
			geo,
			sheet.material ?? new T.MeshBasicMaterial({
				map: sheet.map,
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
		active.push({ mesh, life, max: life, scale: 1, aura, owner });
	}
	return {
		warmJob2,
        starsReady:()=>!!second?.map.userData.ready,
        setQuality(high:boolean){highQuality=high;},
		snapshot:()=>({active:active.length,cap:highQuality?32:16}),
		emit(e: any) {
			currentOwner=e.playerId;currentLight=!!e.lighter;
			if(e.lighter&&active.length>=8)return;
			const realId=e.learnedSkill??e.skillId;
            if(second?.map.userData.ready){
             const draw=(cell:number,x:number,z:number,size:number,life=.6,upright=false,aura?:string)=>painted(cell,x,z,size,life,upright,e.playerId,second!,aura);
             if(e.type==='hit'&&e.reflect){draw(11,e.x,e.z,1.5);return;}
             if(e.type==='hurt'&&e.guarded)draw(9,e.x,e.z,1.3,.3,true);
             if(e.type==='hit'&&realId==='shield_bash'){draw(0,e.x,e.z,2.4);return;}
             if(e.type==='skillImpact'&&realId==='quake_slam'){draw(2,e.x,e.z,6.4,.9);return;}
             if(e.type==='skill'){
              if(realId==='bulwark'){draw(1,e.x,e.z,2.8,10,true,'guard');return;}
              if(realId==='blood_rage'){draw(5,e.x,e.z,2.8,12,true,'rage');draw(10,e.x,e.z,2.5);return;}
              if(realId==='rally_roar'){draw(3,e.x,e.z,16,1);return;}
              if(realId==='blade_cyclone'){draw(6,e.x,e.z,6,.6);return;}
              if(realId==='shield_bash'||realId==='quake_slam')return;
             }
            }
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
			const real=e.learnedSkill??e.skillId;
            const id = BORROWED_MOTION[real as SkillMotion]??e.visual??e.skillId;
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
			if (id === "endure") painted(4, e.x, e.z, 2.8, 8, true, e.playerId,first,"endure");
		},
		update(dt: number, players: any[], frozen:(id:string)=>boolean=()=>false,monsters:any[]=[]) {
            clock+=dt;
            if(second?.map.userData.ready)for(const p of players)for(const [status,cell,duration] of [['guard',1,10],['rage',5,12]] as const){
             const remaining=p.statuses?.find((s:any)=>s.id===status)?.remaining;
             if(!p.dead&&remaining>0&&!active.some(a=>a.owner===p.id&&a.aura===status)){
              currentLight=false;painted(cell,p.x,p.z,2.8,Math.min(duration,remaining),true,p.id,second,status);
             }
            }
            if(stars){stars.count=0;if(second?.map.userData.ready)for(const actor of [...monsters,...players]){
             if(actor.dead||!actor.statuses?.some((s:any)=>s.id==='stun'&&s.remaining>0)||stars.count>=256)continue;
             starTransform.position.set(actor.x,actor.boss?4:2.1,actor.z);starTransform.rotation.set(-.35,Math.atan2(9,13),Math.sin(clock*.7)*.2);starTransform.updateMatrix();stars.setMatrixAt(stars.count++,starTransform.matrix);
            }stars.instanceMatrix.needsUpdate=true;}

			for (let i = active.length - 1; i >= 0; i--) {
				const a = active[i];
				if(!a.aura&&a.owner&&frozen(a.owner))continue;
				a.life -= dt;
				const ratio = Math.max(0, a.life / a.max);
				if (a.aura) {
					const p = players.find((p) => p.id === a.owner);
					if (p) {
						a.mesh.position.x = p.x;
						a.mesh.position.z = p.z;
						if (p.dead||!p.statuses?.some((s: any) => s.id === a.aura&&s.remaining>0)) a.life = 0;
                    }else a.life=0;
                }
				a.mesh.traverse((c: any) => {
					if (c.material && c.material!==second?.material)
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
