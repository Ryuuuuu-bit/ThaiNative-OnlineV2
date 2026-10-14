import * as THREE from "three";
import { zones, canal, bridges, pier } from "../layout.js";
import { assetOrFallback } from "../assets.js";
import { box } from "./shared.js";
export function buildTerrain(scene, collision) {
  scene.add(
    assetOrFallback({ id: "terrain", assetId: "terrain" }, () => {
      const g = new THREE.Group();
      box(g, 162, 1.4, 162, 0, -0.8, 0, "#4c575b");
      for (const zone of zones) {
        const [a, b, c, d] = zone.bounds;
        box(g, c - a, 0.12, d - b, (a + c) / 2, -0.09, (b + d) / 2, zone.color);
      }
      // A recessed canal bed; water is drawn above it by the water builder.
      box(g, canal.w, 0.12, canal.d, 0, -0.015, canal.z, "#263f48");
      for (const z of [45.8, 58.2])
        box(g, 156, 0.35, 0.45, 0, 0.13, z, "#858782");
      for (const x of [-79, 79]) box(g, 1.2, 2.5, 160, x, 1.1, 0, "#5d6263");
      box(g, 160, 2.5, 1, 0, 1.1, -79, "#5d6263");
      return g;
    }),
  );
  const crossings = [
    ...bridges.map((b) => [b.x - b.w / 2, b.x + b.w / 2]),
    [pier.x - pier.w / 2, pier.x + pier.w / 2],
  ].sort((a, b) => a[0] - b[0]);
  let edge = -78;
  for (const [left, right] of crossings) {
    collision.addBox((edge + left) / 2, 52, left - edge, 12, "water");
    edge = right;
  }
  collision.addBox((edge + 78) / 2, 52, 78 - edge, 12, "water");
  // The short pier is a dead end, not a third crossing.
  collision.addBox(pier.x, 53, pier.w, 10, "water-beyond-pier");
}
