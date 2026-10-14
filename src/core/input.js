import * as THREE from "three";
export class Input {
  constructor(canvas, camera, onGroundClick) {
    this.keys = new Set();
    this.drag = null;
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.controller = new AbortController();
    const opts = { signal: this.controller.signal };
    const key = (e) =>
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "KeyQ",
        "KeyE",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Space",
      ].includes(e.code);
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.target.closest?.("input,select,textarea")) return;
        if (key(e)) {
          e.preventDefault();
          this.keys.add(e.code);
        }
      },
      opts,
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code), opts);
    window.addEventListener(
      "blur",
      () => {
        this.keys.clear();
        this.drag = null;
      },
      opts,
    );
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opts);
    canvas.addEventListener(
      "pointerdown",
      (e) => {
        canvas.focus();
        if (e.button === 2) {
          this.drag = { x: e.clientX };
          canvas.setPointerCapture(e.pointerId);
        }
      },
      opts,
    );
    canvas.addEventListener(
      "pointermove",
      (e) => {
        if (this.drag) {
          camera.orbit(-(e.clientX - this.drag.x) * 0.006);
          this.drag.x = e.clientX;
        }
      },
      opts,
    );
    const release = () => {
      this.drag = null;
    };
    canvas.addEventListener("pointerup", release, opts);
    canvas.addEventListener("pointercancel", release, opts);
    canvas.addEventListener(
      "click",
      (e) => {
        if (e.button !== 0) return;
        const rect = canvas.getBoundingClientRect();
        this.ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            (-(e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          camera.camera,
        );
        const target = this.ray.ray.intersectPlane(
          this.plane,
          new THREE.Vector3(),
        );
        if (target) onGroundClick(target);
      },
      opts,
    );
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        camera.zoom(e.deltaY);
      },
      { ...opts, passive: false },
    );
  }
  movement(yaw) {
    let x =
      Number(this.keys.has("KeyD") || this.keys.has("ArrowRight")) -
      Number(this.keys.has("KeyA") || this.keys.has("ArrowLeft"));
    let z =
      Number(this.keys.has("KeyS") || this.keys.has("ArrowDown")) -
      Number(this.keys.has("KeyW") || this.keys.has("ArrowUp"));
    const len = Math.hypot(x, z) || 1;
    x /= len;
    z /= len;
    return {
      x: x * Math.cos(yaw) + z * Math.sin(yaw),
      z: -x * Math.sin(yaw) + z * Math.cos(yaw),
    };
  }
  update(camera, dt) {
    camera.orbit(
      (Number(this.keys.has("KeyE")) - Number(this.keys.has("KeyQ"))) *
        dt *
        1.3,
    );
  }
  dispose() {
    this.controller.abort();
  }
}
