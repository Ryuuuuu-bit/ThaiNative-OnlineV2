import * as THREE from "three";
import { assetOrFallback } from "../assets.js";
import { random } from "./shared.js";
export function buildMist(scene) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d"),
    gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(184,201,208,.25)");
  gradient.addColorStop(1, "rgba(184,201,208,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    opacity: 0.35,
  });
  const root = assetOrFallback(
      { id: "ground-mist", assetId: "mist" },
      () => new THREE.Group(),
    ),
    rng = random(72),
    planes = [];
  for (let i = 0; i < 36; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20 + rng() * 20, 10 + rng() * 12),
      material,
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      (rng() - 0.5) * 150,
      0.45 + rng() * 0.5,
      (rng() - 0.5) * 150,
    );
    mesh.userData.excludeAO = true;
    root.add(mesh);
    planes.push({ mesh, x: mesh.position.x, phase: rng() * 6 });
  }
  scene.add(root);
  return {
    update(t) {
      for (const p of planes)
        p.mesh.position.x = p.x + Math.sin(t * 0.035 + p.phase) * 2;
    },
  };
}
