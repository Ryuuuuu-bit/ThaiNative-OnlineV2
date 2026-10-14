import * as THREE from "three";
import { assetOrFallback } from "../assets.js";
export function buildSky(scene) {
  scene.background = new THREE.Color("#7b8a96");
  scene.fog = new THREE.FogExp2("#7b8a96", 0.008);
  scene.add(
    assetOrFallback({ id: "overcast-sky", assetId: "sky" }, () => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(450, 24, 16),
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          depthWrite: false,
          uniforms: {
            top: { value: new THREE.Color("#485768") },
            horizon: { value: new THREE.Color("#919b9e") },
          },
          vertexShader:
            "varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
          fragmentShader:
            "uniform vec3 top; uniform vec3 horizon; varying vec3 vDirection; void main(){float h=clamp(normalize(vDirection).y,0.0,1.0); gl_FragColor=vec4(mix(horizon,top,pow(h,0.65)),1.0);}",
        }),
      );
      mesh.userData.excludeAO = true;
      return mesh;
    }),
  );
  scene.add(new THREE.HemisphereLight("#a8bdce", "#45403b", 2));
  const softLight = new THREE.DirectionalLight("#d9d4ca", 1.15);
  softLight.position.set(-28, 65, 30);
  softLight.castShadow = true;
  softLight.shadow.mapSize.set(2048, 2048);
  softLight.shadow.camera.left = -95;
  softLight.shadow.camera.right = 95;
  softLight.shadow.camera.top = 95;
  softLight.shadow.camera.bottom = -95;
  softLight.shadow.camera.near = 1;
  softLight.shadow.camera.far = 180;
  softLight.shadow.normalBias = 0.06;
  softLight.shadow.bias = -0.0003;
  softLight.shadow.radius = 3;
  scene.add(softLight);
  return softLight;
}
