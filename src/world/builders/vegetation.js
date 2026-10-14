import * as THREE from "three";
import { vegetation } from "../layout.js";
import { assetOrFallback } from "../assets.js";
import { cylinder, line, mat } from "./shared.js";
export function buildVegetation(scene, collision) {
  for (const p of vegetation) {
    const g = assetOrFallback(p, () => {
      const g = new THREE.Group();
      if (p.assetId === "bare-tree") {
        cylinder(g, 0.18, 0.55, 6, 0, 3, 0, "#514d49", 6);
        for (let i = 0; i < 4; i++) {
          const a = i * 2.4;
          line(
            g,
            [
              [0, 3 + i * 0.5, 0],
              [Math.cos(a) * 1.5, 5 + i * 0.6, Math.sin(a) * 1.5],
              [Math.cos(a) * 2.5, 7 + i * 0.4, Math.sin(a) * 2.5],
            ],
            "#5f5b53",
            0.13,
          );
        }
      } else {
        cylinder(g, 0.18, 0.4, 3.5, 0, 1.75, 0, "#6a7054", 6);
        for (let i = 0; i < 6; i++) {
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(1, 5, 3),
            mat(i % 2 ? "#65725c" : "#748066"),
          );
          leaf.scale.set(0.6, 0.12, 2);
          leaf.rotation.z = 0.3;
          leaf.rotation.y = (i * Math.PI) / 3;
          leaf.position.set(
            Math.sin((i * Math.PI) / 3) * 1.2,
            3.3,
            Math.cos((i * Math.PI) / 3) * 1.2,
          );
          g.add(leaf);
        }
      }
      g.scale.setScalar(p.scale);
      return g;
    });
    scene.add(g);
    collision.addBox(p.x, p.z, 0.8, 0.8, p.id);
  }
}
