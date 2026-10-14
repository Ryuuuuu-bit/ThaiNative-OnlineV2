import * as THREE from "three";
import { roads, canal } from "../layout.js";
import { assetOrFallback } from "../assets.js";
import { box, mat, random } from "./shared.js";
export function buildRoads(scene) {
  const occupied = new Set();
  for (const p of roads)
    scene.add(
      assetOrFallback({ ...p, assetId: `road-${p.kind}` }, (p) => {
        const g = new THREE.Group(),
          rng = random(p.id.length * 71 + p.z + 123);
        box(g, p.w + 0.6, 0.08, p.d + 0.6, 0, 0.02, 0, "#484f53");
        const cells = [];
        const sx = p.kind === "wood" ? p.w : 1.6,
          sz = p.kind === "wood" ? 0.7 : 1.25;
        for (
          let ix = Math.ceil((p.x - p.w / 2) / sx);
          ix * sx < p.x + p.w / 2;
          ix++
        )
          for (
            let iz = Math.ceil((p.z - p.d / 2) / sz);
            iz * sz < p.z + p.d / 2;
            iz++
          ) {
            const x = ix * sx - p.x,
              z = iz * sz - p.z,
              key = `${p.kind}:${ix}:${iz}`;
            if (Math.abs(p.z + z - canal.z) < canal.d / 2 || occupied.has(key))
              continue;
            occupied.add(key);
            cells.push({ x, z });
          }
        const mesh = new THREE.InstancedMesh(
          new THREE.BoxGeometry(sx - 0.07, 0.1, sz - 0.08),
          mat(p.kind === "wood" ? "#6c5c4c" : "#8a8c87"),
          cells.length,
        );
        const dummy = new THREE.Object3D(),
          color = new THREE.Color();
        cells.forEach((c, i) => {
          dummy.position.set(c.x, 0.09, c.z);
          dummy.rotation.y = p.kind === "wood" ? 0 : (rng() - 0.5) * 0.04;
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          color.setScalar(0.7 + rng() * 0.33);
          mesh.setColorAt(i, color);
        });
        mesh.receiveShadow = true;
        g.add(mesh);
        return g;
      }),
    );
}
