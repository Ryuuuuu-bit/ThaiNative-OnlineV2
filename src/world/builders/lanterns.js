import * as THREE from "three";
import { assetOrFallback, hasAsset } from "../assets.js";
import { random } from "./shared.js";
export function buildLanterns(scene) {
  const rng = random(3415),
    count = 900,
    placements = [];
  for (let i = 0; i < count; i++)
    placements.push({
      id: `lantern-${i}`,
      assetId: "paper-lantern",
      x: (rng() - 0.5) * 154,
      y: 4 + rng() * 21,
      z: (rng() - 0.5) * 154,
      phase: rng() * Math.PI * 2,
      scale: 0.38 + rng() * 0.38,
    });
  if (hasAsset("paper-lantern")) {
    for (const p of placements)
      scene.add(assetOrFallback(p, () => new THREE.Group()));
    return { update() {} };
  }
  const root = assetOrFallback(
    { id: "lantern-field", assetId: "lantern-field" },
    () => new THREE.Group(),
  );
  const paper = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.55, 0.46, 0.95, 7),
    new THREE.MeshStandardMaterial({
      color: "#cba16a",
      emissive: "#c06b29",
      emissiveIntensity: 1.1,
      roughness: 0.9,
    }),
    count,
  );
  const rim = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.08, 7),
    new THREE.MeshStandardMaterial({ color: "#724333", roughness: 1 }),
    count * 2,
  );
  const tail = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.08, 0.45, 0.035),
    new THREE.MeshStandardMaterial({
      color: "#a7553d",
      emissive: "#703722",
      emissiveIntensity: 0.25,
    }),
    count,
  );
  const dummy = new THREE.Object3D(),
    color = new THREE.Color();
  paper.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  placements.forEach((p, i) => {
    color.set(i % 4 === 0 ? "#d88a67" : "#ebc594");
    paper.setColorAt(i, color);
  });
  root.add(paper, rim, tail);
  scene.add(root);
  for (const [x, y, z] of [
    [42, 4, 43],
    [-48, 5, 32],
    [-51, 7, -40],
    [51, 5, -38],
    [0, 5, -11],
  ]) {
    const light = new THREE.PointLight("#edaf70", 20, 15, 2);
    light.position.set(x, y, z);
    scene.add(light);
  }
  function update(time) {
    placements.forEach((p, i) => {
      const y = p.y + Math.sin(time * 0.18 + p.phase) * 0.045;
      dummy.position.set(p.x, y, p.z);
      dummy.rotation.set(0, p.phase, Math.sin(time * 0.12 + p.phase) * 0.012);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      paper.setMatrixAt(i, dummy.matrix);
      for (let k = 0; k < 2; k++) {
        dummy.position.y = y + (k ? -0.48 : 0.48) * p.scale;
        dummy.updateMatrix();
        rim.setMatrixAt(i * 2 + k, dummy.matrix);
      }
      dummy.position.y = y - 0.72 * p.scale;
      dummy.updateMatrix();
      tail.setMatrixAt(i, dummy.matrix);
    });
    paper.instanceMatrix.needsUpdate = true;
    rim.instanceMatrix.needsUpdate = true;
    tail.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { update, count };
}
