import test from "node:test";
import assert from "node:assert/strict";
import { CollisionWorld } from "../src/systems/collision.js";
import { directionRow } from "../src/entities/sprite-sheet.js";
import {
  town,
  roads,
  bridges,
  buildings,
  props,
  npcs,
  spiritLamps,
  zones,
  districtAt,
} from "../src/world/layout.js";

test("circle cannot tunnel through a narrow wall and slides along it", () => {
  const world = new CollisionWorld();
  world.addBox(0, 0, 1, 20);
  const stopped = world.move({ x: -5, z: 0 }, 12, 0, 0.5);
  assert.ok(stopped.x <= -1 + 1e-6);
  const sliding = world.move({ x: -1, z: 0 }, 3, 5, 0.5);
  assert.ok(sliding.x <= -1 + 1e-6);
  assert.ok(sliding.z > 4.9);
});
test("polygon collision expels an interior circle and preserves open movement", () => {
  const world = new CollisionWorld();
  world.addPolygon([
    [0, 0],
    [5, 0],
    [5, 5],
    [0, 5],
  ]);
  const p = world.move({ x: 2, z: 1 }, 0, 0, 0.5);
  assert.ok(p.z <= -0.5 + 1e-6);
  const open = world.move({ x: -5, z: -5 }, 1, 2, 0.5);
  assert.ok(Math.abs(open.x + 4) < 1e-6 && Math.abs(open.z + 3) < 1e-6);
});
test("bounds constrain long movement and near-corner contact", () => {
  const world = new CollisionWorld(10);
  assert.equal(world.move({ x: 0, z: 0 }, 100, 0, 0.5).x, 9.5);
  world.addBox(0, 0, 2, 2);
  const p = world.move({ x: -3, z: -3 }, 3, 3, 0.5);
  assert.ok(!world.overlaps(p.x, p.z, 0.49));
});
test("a circle exactly on a polygon edge is pushed outward for either winding", () => {
  for (const points of [
    [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
    ],
    [
      [0, 5],
      [5, 5],
      [5, 0],
      [0, 0],
    ],
  ]) {
    const world = new CollisionWorld();
    world.addPolygon(points);
    const p = world.move({ x: 2, z: 0 }, 0, 0, 0.5);
    assert.ok(p.z <= -0.5 + 1e-6);
  }
});
test("eight direction rows rotate with camera and wrap at negative angles", () => {
  assert.equal(directionRow({ x: 0, z: 1 }, 0), 0);
  assert.equal(directionRow({ x: 1, z: 0 }, 0), 2);
  assert.equal(directionRow({ x: 0, z: -1 }, 0), 4);
  assert.equal(directionRow({ x: -1, z: 0 }, 0), 6);
  assert.equal(directionRow({ x: 0, z: 1 }, Math.PI / 2), 6);
  for (let i = -16; i < 16; i++)
    assert.equal(
      directionRow(
        { x: Math.sin((i * Math.PI) / 4), z: Math.cos((i * Math.PI) / 4) },
        0,
      ),
      ((i % 8) + 8) % 8,
    );
});
test("layout has unique placement ids, pier spawn and all story hooks", () => {
  const all = [
    ...roads,
    ...bridges,
    ...buildings,
    ...props,
    ...npcs,
    ...spiritLamps,
  ];
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  assert.equal(districtAt(town.spawn.x, town.spawn.z).id, "canal");
  assert.equal(npcs.length, 5);
  assert.equal(spiritLamps.length, 4);
  assert.equal(zones.length, 6);
  for (const p of spiritLamps) assert.ok(p.guardianId);
  assert.equal(bridges.length, 2);
  assert.ok(
    !buildings.some(
      (p) =>
        Math.abs(p.x - town.spawn.x) < p.w / 2 &&
        Math.abs(p.z - town.spawn.z) < p.d / 2,
    ),
  );
});
