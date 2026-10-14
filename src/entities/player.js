import * as THREE from "three";
import { SpriteSheet, directionRow } from "./sprite-sheet.js";
import { bridges, pier } from "../world/layout.js";
export class Player {
  constructor(scene, spawn) {
    this.position = { ...spawn };
    this.facing = { x: 0, z: 1 };
    this.target = null;
    this.radius = 0.55;
    this.speed = 9;
    this.sheet = SpriteSheet.placeholder();
    this.moving = false;
    this.sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.sheet.texture,
        transparent: true,
        alphaTest: 0.4,
        depthWrite: false,
      }),
    );
    this.sprite.center.set(0.5, 0);
    this.sprite.scale.set(3, 3, 1);
    this.sprite.layers.set(1);
    this.sprite.userData.excludeAO = true;
    scene.add(this.sprite);
    this.destination = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.55, 24),
      new THREE.MeshBasicMaterial({
        color: "#dec393",
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.destination.rotation.x = -Math.PI / 2;
    this.destination.visible = false;
    this.destination.userData.excludeAO = true;
    scene.add(this.destination);
  }
  setTarget(point, collision) {
    if (
      Math.abs(point.x) > 77 ||
      Math.abs(point.z) > 77 ||
      collision.overlaps(point.x, point.z, this.radius)
    )
      return false;
    this.target = { x: point.x, z: point.z };
    this.destination.position.set(point.x, 0.4, point.z);
    this.destination.visible = true;
    return true;
  }
  async setSprite(url, options) {
    const previous = this.sheet;
    this.sheet = await SpriteSheet.load(url, options);
    this.sprite.material.map = this.sheet.texture;
    this.sprite.material.needsUpdate = true;
    previous.texture.dispose();
  }
  update(dt, time, input, camera, collision) {
    let vector = input.movement(camera.yaw);
    if (Math.hypot(vector.x, vector.z) > 0.01) {
      this.target = null;
      this.destination.visible = false;
    } else if (this.target) {
      const x = this.target.x - this.position.x,
        z = this.target.z - this.position.z,
        len = Math.hypot(x, z);
      if (len < 0.18) {
        this.target = null;
        this.destination.visible = false;
      } else {
        const scale = Math.min(1, len / (this.speed * dt || 1));
        vector = { x: (x / len) * scale, z: (z / len) * scale };
      }
    }
    const next = collision.move(
      this.position,
      vector.x * this.speed * dt,
      vector.z * this.speed * dt,
      this.radius,
    );
    this.moving =
      Math.hypot(next.x - this.position.x, next.z - this.position.z) > 0.001;
    if (this.moving) this.facing = { ...vector };
    else if (this.target && Math.hypot(vector.x, vector.z) > 0.01) {
      this.target = null;
      this.destination.visible = false;
    }
    this.position = next;
    this.sheet.update(directionRow(this.facing, camera.yaw), time, this.moving);
    const onDeck = [...bridges, pier].some(
      (p) =>
        Math.abs(next.x - p.x) < p.w / 2 && Math.abs(next.z - p.z) < p.d / 2,
    );
    this.sprite.position.set(next.x, onDeck ? 0.4 : 0.18, next.z);
  }
}
