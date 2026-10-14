import * as THREE from "three";
import { canal, bridges, pier, boats } from "../layout.js";
import { assetOrFallback } from "../assets.js";
import { box, line, mat } from "./shared.js";
function boardwalk(p) {
  const g = new THREE.Group();
  for (let z = -p.d / 2 + 0.28; z < p.d / 2; z += 0.58)
    box(
      g,
      p.w,
      0.18,
      0.52,
      0,
      0.29,
      z,
      Math.round(z * 10) % 3 ? "#74634e" : "#665a4d",
    );
  for (const x of [-p.w / 2 + 0.35, p.w / 2 - 0.35])
    for (const z of [-p.d / 2 + 0.4, p.d / 2 - 0.4])
      box(g, 0.35, 2, 0.35, x, -0.2, z, "#4a4640");
  if (p.assetId === "bridge")
    for (const x of [-p.w / 2, p.w / 2]) {
      for (const z of [-6, 0, 6]) box(g, 0.18, 1.5, 0.18, x, 1, z, "#655a4b");
      line(
        g,
        [
          [x, 1.6, -7],
          [x, 1.45, 0],
          [x, 1.6, 7],
        ],
        "#9e8d69",
        0.055,
      );
    }
  return g;
}
export function buildWater(scene) {
  const water = assetOrFallback(canal, () => {
    const g = new THREE.Group();
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(canal.w, canal.d),
      new THREE.MeshStandardMaterial({
        color: "#344d58",
        roughness: 0.36,
        metalness: 0.25,
      }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.18;
    g.add(surface);
    for (let x = -72; x < 75; x += 6)
      box(g, 2, 0.012, 0.035, x, 0.2, (x % 7) * 0.5, "#627a80");
    return g;
  });
  scene.add(water);
  for (const p of [...bridges, pier]) scene.add(assetOrFallback(p, boardwalk));
  // Two long wooden walks frame the canal.
  for (const z of [43.8, 60.2])
    scene.add(
      assetOrFallback(
        {
          id: `canal-walk-${z}`,
          assetId: "boardwalk",
          x: 0,
          z,
          w: 154,
          d: 2.4,
        },
        boardwalk,
      ),
    );
  const boatObjects = [];
  for (const p of boats) {
    const boat = assetOrFallback(p, () => {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 5),
        mat("#51463c"),
      );
      hull.scale.set(1.25, 0.65, 4);
      hull.position.y = 0.35;
      g.add(hull);
      box(g, 1.5, 0.12, 5, 0, 0.65, 0, "#77634b");
      for (const z of [-3.5, 3.5]) box(g, 0.5, 0.65, 0.9, 0, 0.9, z, "#675540");
      const oar = box(g, 0.09, 0.09, 6, 1, 0.9, 0, "#9a8561");
      oar.rotation.y = 0.3;
      return g;
    });
    scene.add(boat);
    boatObjects.push(boat);
  }
  return {
    update(time) {
      boatObjects.forEach((b, i) => {
        b.position.y = Math.sin(time * 0.45 + i) * 0.04;
      });
    },
  };
}
