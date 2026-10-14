import * as THREE from "three";
import { entranceSign } from "../layout.js";
import { assetOrFallback } from "../assets.js";
import { box, sign } from "./shared.js";
export function buildSign(scene) {
  scene.add(
    assetOrFallback(entranceSign, (p) => {
      const g = new THREE.Group();
      box(g, 0.2, 3.7, 0.2, -2, 1.85, 0, "#54483a");
      box(g, 0.2, 3.2, 0.2, 2, 1.6, 0, "#55483b");
      const board = box(g, 7, 1.5, 0.23, 0, 3, 0, "#5c4c3a");
      board.rotation.z = -0.045;
      const text = sign(g, p.text, 6.7, 0, 3, 0.14, "#514534", "#c5b68f");
      text.rotation.z = -0.045;
      for (let i = 0; i < 5; i++) {
        const split = box(
          g,
          0.03,
          0.35,
          0.02,
          -2.8 + i * 1.3,
          2.5,
          0.13,
          "#302e2a",
        );
        split.rotation.z = i * 0.15;
      }
      return g;
    }),
  );
}
