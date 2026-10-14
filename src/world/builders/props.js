import * as THREE from "three";
import { props, spiritLamps, npcs, exits } from "../layout.js";
import { assetOrFallback } from "../assets.js";
import { box, cylinder, roof, sign, line, mat } from "./shared.js";
function fallback(p) {
  const g = new THREE.Group();
  switch (p.assetId) {
    case "well": {
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(3.1, 3.4, 1.3, 12, 1, true),
        mat("#8b8a7b"),
      );
      wall.position.y = 0.8;
      g.add(wall);
      cylinder(g, 2.9, 2.9, 0.1, 0, 0.25, 0, "#283c41");
      for (const x of [-3.5, 3.5]) box(g, 0.35, 5, 0.35, x, 2.5, 0, "#574b3e");
      roof(g, 9, 5, 2.8, 5, "#625756");
      line(
        g,
        [
          [0, 5, 0],
          [0, 1, 0],
        ],
        "#a59674",
        0.05,
      );
      break;
    }
    case "spirit-house":
      cylinder(g, 0.35, 0.65, 2.2, 0, 1.1, 0, "#929081");
      box(g, 2, 1.7, 2, 0, 3, 0, "#9e8768");
      roof(g, 3, 3, 1.8, 4, "#75534a");
      box(g, 2.6, 0.15, 1.4, 0, 2.2, 1.5, "#746554");
      for (const x of [-0.7, 0, 0.7])
        cylinder(g, 0.15, 0.12, 0.3, x, 2.45, 1.5, "#c69c64");
      break;
    case "market-stall":
      for (const x of [-3.1, 3.1])
        for (const z of [-1.6, 1.6])
          box(g, 0.16, 3.6, 0.16, x, 1.8, z, "#56483e");
      box(g, 7, 0.3, 4, 0, 1.8, 0, "#80715b");
      roof(g, 8, 5, 1, 3.5, p.color);
      box(g, 6.5, 1, 0.18, 0, 1.2, 1.8, "#63554a");
      break;
    case "bench":
      box(g, 5, 0.25, 1.5, 0, 0.9, 0, "#6a5b4b");
      for (const x of [-1.8, 1.8]) box(g, 0.4, 0.85, 1.2, x, 0.4, 0, "#464842");
      break;
    case "clay-jar":
      cylinder(g, 0.5, 0.7, 1.6, 0, 0.8, 0, "#82705a");
      cylinder(g, 0.47, 0.47, 0.08, 0, 1.62, 0, "#332e2b");
      break;
    case "handcart":
      box(g, 3, 0.3, 2, 0, 1, 0, "#6e5b46");
      box(g, 3, 0.8, 0.15, 0, 1.5, -0.9, "#5f4f41");
      for (const x of [-1.7, 1.7]) {
        const w = cylinder(g, 0.65, 0.65, 0.2, x, 0.65, 0, "#44423d");
        w.rotation.z = Math.PI / 2;
      }
      for (const x of [-1, 1]) box(g, 0.12, 0.12, 3, x, 1, 2, "#6e5b46");
      break;
    case "cloth-banner":
      box(g, 0.13, 5, 0.13, 0, 2.5, 0, "#5a5145");
      box(g, 1.2, 2.6, 0.05, 0.5, 3.3, 0, "#84705e");
      break;
    case "city-gate":
      for (const x of [-7, 7]) box(g, 1.5, 9, 2, x, 4.5, 0, "#6b6459");
      box(g, 14, 6, 0.6, 0, 3, 0, "#4e4942");
      for (let x = -6; x < 7; x += 1.2) box(g, 0.1, 6, 0.7, x, 3, 0, "#373c3c");
      roof(g, 19, 5, 3, 8, "#645658");
      sign(g, exits[0].label, 12, 0, 7, 1.2);
      break;
    case "bell-tower": {
      for (const x of [-2.5, 2.5])
        for (const z of [-2.5, 2.5]) box(g, 0.6, 10, 0.6, x, 5, z, "#655749");
      box(g, 6, 0.35, 6, 0, 6, 0, "#695b4c");
      roof(g, 8, 8, 3, 10, "#735c55");
      cylinder(g, 0.55, 1.3, 2.3, 0, 8, 0, "#8f805b");
      cylinder(g, 0.1, 0.1, 1, 0, 9.6, 0, "#4b4840");
      sign(g, "หอระฆัง", 5.5, 0, 5.3, 3.3);
      break;
    }
  }
  return g;
}
export function buildProps(scene, collision) {
  for (const p of props) {
    scene.add(assetOrFallback(p, fallback));
    collision.addBox(p.x, p.z, p.w, p.d, p.id);
  }
  const orbs = [];
  for (const p of spiritLamps) {
    const g = assetOrFallback(p, () => {
      const g = new THREE.Group();
      cylinder(g, 0.18, 0.35, 0.6, 0, 0.3, 0, "#5f7469");
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 12, 8),
        new THREE.MeshBasicMaterial({
          color: "#a8e9cb",
          transparent: true,
          opacity: 0.7,
        }),
      );
      orb.position.y = 1;
      orb.userData.excludeAO = true;
      g.add(orb);
      return g;
    });
    g.userData.guardianId = p.guardianId;
    g.userData.name = "ดวงประทีปวิญญาณ";
    scene.add(g);
    orbs.push(g);
  }
  const markers = new THREE.Group();
  markers.name = "npc-hooks";
  for (const p of npcs) {
    const marker = assetOrFallback({ ...p, assetId: "npc-hook" }, () => {
      const g = new THREE.Group();
      cylinder(g, 0.32, 0.38, 1.8, 0, 0.9, 0, "#7a7870");
      cylinder(g, 0.28, 0.25, 0.5, 0, 2, 0, "#b2a28b");
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.035, 4, 20),
        new THREE.MeshBasicMaterial({ color: "#d4b979" }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.2;
      g.add(ring);
      return g;
    });
    marker.userData.hook = p;
    markers.add(marker);
  }
  scene.add(markers);
  return { orbs, markers };
}
