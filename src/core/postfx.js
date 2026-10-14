import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Pass } from "three/addons/postprocessing/Pass.js";
import { HorizontalTiltShiftShader } from "three/addons/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/addons/shaders/VerticalTiltShiftShader.js";

class WorldAO extends GTAOPass {
  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse((o) => {
      if (
        o.visible &&
        (o.isSprite ||
          o.userData.excludeAO ||
          (o.isMesh &&
            (Array.isArray(o.material)
              ? o.material.some((m) => m.transparent)
              : o.material.transparent)))
      ) {
        o.visible = false;
        this._visibilityCache.push(o);
      }
    });
  }
}
// Rebuild opaque world depth, then composite layer-1 sprites after AO.
// This excludes both sprite contribution to AO and AO darkening on sprites.
class SpriteComposite extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
    this.depth = new THREE.MeshDepthMaterial({ colorWrite: false });
  }
  render(renderer, write, read) {
    const { scene, camera } = this,
      mask = camera.layers.mask,
      bg = scene.background,
      override = scene.overrideMaterial,
      auto = renderer.autoClear,
      hidden = [];
    try {
      renderer.setRenderTarget(read);
      renderer.autoClear = false;
      renderer.clearDepth();
      scene.background = null;
      camera.layers.set(0);
      scene.traverse((o) => {
        if (
          o.visible &&
          (o.isSprite ||
            o.userData.excludeAO ||
            (o.isMesh &&
              (Array.isArray(o.material)
                ? o.material.some((m) => m.transparent)
                : o.material.transparent)))
        ) {
          hidden.push(o);
          o.visible = false;
        }
      });
      scene.overrideMaterial = this.depth;
      renderer.render(scene, camera);
      hidden.forEach((o) => {
        o.visible = true;
      });
      hidden.length = 0;
      scene.overrideMaterial = null;
      camera.layers.set(1);
      renderer.render(scene, camera);
    } finally {
      hidden.forEach((o) => {
        o.visible = true;
      });
      scene.background = bg;
      scene.overrideMaterial = override;
      camera.layers.mask = mask;
      renderer.autoClear = auto;
    }
  }
  dispose() {
    this.depth.dispose();
  }
}
export function createPostFX(renderer, scene, camera, light) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new WorldAO(scene, camera, innerWidth, innerHeight);
  ao.blendIntensity = 0.38;
  ao.updateGtaoMaterial({
    radius: 2,
    thickness: 1,
    distanceFallOff: 1,
    samples: 8,
  });
  composer.addPass(ao);
  const sprites = new SpriteComposite(scene, camera);
  composer.addPass(sprites);
  const horizontal = new ShaderPass(HorizontalTiltShiftShader),
    vertical = new ShaderPass(VerticalTiltShiftShader);
  horizontal.uniforms.r.value = vertical.uniforms.r.value = 0.48;
  composer.addPass(horizontal);
  composer.addPass(vertical);
  composer.addPass(new OutputPass());
  let quality = "high";
  function resize(w, h) {
    composer.setSize(w, h);
    horizontal.uniforms.h.value = 0.75 / w;
    vertical.uniforms.v.value = 0.75 / h;
  }
  resize(innerWidth, innerHeight);
  return {
    composer,
    resize,
    get quality() {
      return quality;
    },
    setQuality(value) {
      quality = value;
      const high = value === "high";
      ao.enabled =
        sprites.enabled =
        horizontal.enabled =
        vertical.enabled =
          high;
      renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.5) : 1);
      composer.setPixelRatio(renderer.getPixelRatio());
      light.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
      if (light.shadow.map) {
        light.shadow.map.dispose();
        light.shadow.map = null;
      }
      light.shadow.needsUpdate = true;
      resize(renderer.domElement.clientWidth, renderer.domElement.clientHeight);
    },
    render(dt) {
      composer.render(dt);
    },
    dispose() {
      composer.passes.forEach((p) => p.dispose?.());
      composer.dispose();
    },
  };
}
