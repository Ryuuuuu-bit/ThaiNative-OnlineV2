import * as THREE from "three";
export class FollowCamera {
  constructor(aspect, spawn) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.15, 600);
    this.yaw = 0;
    this.distance = 34;
    this.pitch = (50 * Math.PI) / 180;
    this.target = new THREE.Vector3(spawn.x, 1, spawn.z);
    this.update(spawn, 0);
  }
  orbit(amount) {
    this.yaw += amount;
  }
  zoom(delta) {
    this.distance = THREE.MathUtils.clamp(
      this.distance * Math.exp(delta * 0.001),
      16,
      72,
    );
  }
  update(position, dt) {
    const alpha = dt === 0 ? 1 : 1 - Math.exp(-dt * 7);
    this.target.lerp(new THREE.Vector3(position.x, 1, position.z), alpha);
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.target);
  }
  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
