import * as THREE from "three";
import { buildings } from "../layout.js";
import { assetOrFallback } from "../assets.js";
import { box, cylinder, roof, sign, line } from "./shared.js";
export function templeRoof(g, w, d, y) {
  for (let i = 0; i < 3; i++) {
    const tw = w - i * 4,
      td = d - i * 4,
      ty = y + i * 1.8;
    roof(g, tw, td, 3.4, ty, i % 2 ? "#695758" : "#775c55");
    for (const s of [-1, 1]) {
      line(
        g,
        [
          [0, ty + 3.4, (s * td) / 2],
          [0, ty + 4.2, s * (td / 2 + 0.5)],
          [0, ty + 5, s * (td / 2 + 0.9)],
        ],
        "#a58a59",
        0.13,
      );
      for (const x of [-1, 1])
        line(
          g,
          [
            [0, ty + 3.5, (s * td) / 2],
            [(x * tw) / 2, ty, (s * td) / 2],
            [x * (tw / 2 + 0.5), ty + 0.8, (s * td) / 2],
          ],
          "#a58a59",
          0.09,
        );
    }
  }
}
function makeBuilding(p) {
  const g = new THREE.Group(),
    wood = p.color;
  if (p.type === "gym") {
    for (const x of [-p.w / 2 + 1, p.w / 2 - 1])
      for (const z of [-p.d / 2 + 1, p.d / 2 - 1])
        box(g, 0.5, p.h, 0.5, x, p.h / 2, z, "#4c423c");
    box(g, p.w, 0.3, p.d, 0, 0.12, 0, "#736a59");
    roof(g, p.w + 2, p.d + 2, 4, p.h, "#555c59");
    box(g, 12, 0.12, 12, 0, 0.28, 1, "#8b806d");
    for (const x of [-6, 6])
      for (const z of [-5, 7])
        cylinder(g, 0.12, 0.12, 2.5, x, 1.5, z, "#675044");
    for (const y of [1.1, 1.9, 2.6])
      line(
        g,
        [
          [-6, y, -5],
          [6, y, -5],
          [6, y, 7],
          [-6, y, 7],
          [-6, y, -5],
        ],
        "#b6aa8a",
        0.045,
      );
    for (const x of [-11, 11]) {
      cylinder(g, 0.48, 0.55, 2.6, x, 4, 0, "#6a4942");
      line(
        g,
        [
          [x, 5.3, 0],
          [x, p.h, 0],
        ],
        "#afa284",
        0.04,
      );
    }
  } else {
    const floor = p.type === "temple" ? 0.6 : 1.8;
    for (const x of [-p.w / 2 + 1, p.w / 2 - 1])
      for (const z of [-p.d / 2 + 1, p.d / 2 - 1])
        box(g, 0.6, floor, 0.6, x, floor / 2, z, "#413e39");
    box(g, p.w + 0.7, 0.3, p.d + 0.8, 0, floor, 0, "#706052");
    box(g, p.w, p.h, p.d, 0, floor + p.h / 2, 0, wood);
    // Slat seams and shutter panels make raised wooden walls readable.
    for (let y = floor + 0.7; y < floor + p.h; y += 0.85)
      box(g, p.w + 0.04, 0.035, p.d + 0.04, 0, y, 0, "#49443f");
    if (p.type === "temple") {
      templeRoof(g, p.w + 4, p.d + 3, p.h + floor);
      for (const x of [-8, -4, 4, 8])
        box(g, 0.45, p.h, 1, x, p.h / 2 + floor, p.d / 2 + 0.3, "#a29170");
      box(g, 3, 5, 0.15, 0, 3, p.d / 2 + 0.56, "#363b3c");
    } else {
      roof(g, p.w + 2, p.d + 2, 4, p.h + floor, "#55545a");
      for (const x of [-p.w * 0.28, p.w * 0.28]) {
        box(g, 2.5, 2.7, 0.15, x, floor + 3, p.d / 2 + 0.12, "#333f42");
        for (const side of [-1, 1])
          box(
            g,
            0.65,
            2.8,
            0.22,
            x + side * 1.5,
            floor + 3,
            p.d / 2 + 0.18,
            "#7a6b55",
          );
      }
      box(g, 2, 3.4, 0.18, 0, floor + 1.7, p.d / 2 + 0.15, "#343a3a");
      if (p.type === "store") {
        const awning = box(g, p.w + 1, 0.18, 4, 0, 4, p.d / 2 + 1.6, "#766257");
        awning.rotation.x = 0.13;
        for (const x of [-8, 8])
          box(g, 0.2, 4, 0.2, x, 2, p.d / 2 + 3, "#4f443a");
        for (const x of [-7, -2.3, 2.3, 7]) {
          line(
            g,
            [
              [x, 4, p.d / 2 + 2.8],
              [x, 3.3, p.d / 2 + 2.8],
            ],
            "#645640",
            0.025,
          );
          const lantern = cylinder(
            g,
            0.28,
            0.25,
            0.6,
            x,
            3,
            p.d / 2 + 2.8,
            "#b7784b",
            7,
          );
          lantern.material = new THREE.MeshStandardMaterial({
            color: "#ba8b59",
            emissive: "#b86b29",
            emissiveIntensity: 0.8,
          });
        }
      }
    }
    for (let i = 0; i < 3; i++)
      box(
        g,
        4 - i * 0.5,
        0.18,
        1 + i * 0.7,
        0,
        0.1 + i * 0.18,
        p.d / 2 + 1,
        "#6f716c",
      );
  }
  if (p.label)
    sign(
      g,
      p.label,
      p.w * 0.68,
      0,
      p.type === "gym" ? 6 : 4,
      p.d / 2 + 2,
      "#494038",
    );
  // A few faded roof fragments on the ground instead of modern fixtures.
  for (let i = 0; i < 4; i++) {
    const tile = box(
      g,
      0.55,
      0.12,
      0.7,
      -p.w / 2 + i * 0.8,
      0.15,
      p.d / 2 + 2.6,
      "#69514a",
    );
    tile.rotation.y = i * 0.7;
  }
  return g;
}
export function buildBuildings(scene, collision) {
  for (const p of buildings) {
    scene.add(assetOrFallback(p, makeBuilding));
    if (p.type === "gym") {
      // The ring and sala can be entered; only posts collide.
      for (const x of [-p.w / 2 + 1, p.w / 2 - 1])
        for (const z of [-p.d / 2 + 1, p.d / 2 - 1])
          collision.addBox(p.x + x, p.z + z, 0.7, 0.7, p.id);
    } else collision.addBox(p.x, p.z, p.w + 0.8, p.d + 0.8, p.id);
  }
}
