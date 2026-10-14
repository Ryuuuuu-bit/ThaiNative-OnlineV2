import * as THREE from "three";
import "./ui/style.css";
import { town, npcs, spiritLamps, exits } from "./world/layout.js";
import { createRenderer } from "./core/renderer.js";
import { FollowCamera } from "./core/camera.js";
import { createPostFX } from "./core/postfx.js";
import { Input } from "./core/input.js";
import { startLoop } from "./core/loop.js";
import { CollisionWorld } from "./systems/collision.js";
import { Player } from "./entities/player.js";
import { HUD } from "./ui/hud.js";
import { buildSky } from "./world/builders/sky.js";
import { buildTerrain } from "./world/builders/terrain.js";
import { buildRoads } from "./world/builders/roads.js";
import { buildBuildings } from "./world/builders/buildings.js";
import { buildProps } from "./world/builders/props.js";
import { buildWater } from "./world/builders/water.js";
import { buildVegetation } from "./world/builders/vegetation.js";
import { buildLanterns } from "./world/builders/lanterns.js";
import { buildMist } from "./world/builders/mist.js";
import { buildSign } from "./world/builders/sign.js";

async function boot() {
  // Canvas signs need the Thai font before they are rasterized; offline uses fallback.
  await Promise.race([
    document.fonts.load('600 46px "Noto Sans Thai"'),
    new Promise((resolve) => setTimeout(resolve, 2200)),
  ]);
  const container = document.querySelector("#game"),
    renderer = createRenderer(container),
    scene = new THREE.Scene();
  const camera = new FollowCamera(
    container.clientWidth / container.clientHeight,
    town.spawn,
  );
  camera.camera.layers.enable(1);
  const collision = new CollisionWorld();
  const light = buildSky(scene);
  buildTerrain(scene, collision);
  buildRoads(scene);
  buildBuildings(scene, collision);
  buildProps(scene, collision);
  const water = buildWater(scene);
  buildVegetation(scene, collision);
  buildSign(scene);
  const lanterns = buildLanterns(scene),
    mist = buildMist(scene),
    player = new Player(scene, town.spawn);
  const postfx = createPostFX(renderer, scene, camera.camera, light),
    hud = new HUD(document.querySelector("#hud"), (value) =>
      postfx.setQuality(value),
    );
  const input = new Input(renderer.domElement, camera, (target) =>
    player.setTarget(target, collision),
  );
  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h);
    camera.resize(w, h);
    postfx.resize(w, h);
  }
  window.addEventListener("resize", resize);
  const stop = startLoop(
    (dt, time, elapsed) => {
      input.update(camera, dt);
      player.update(dt, time, input, camera, collision);
      camera.update(player.position, dt);
      water.update(time);
      lanterns.update(time);
      mist.update(time);
      hud.update(player, camera, elapsed);
    },
    (dt) => postfx.render(dt),
  );
  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    stop();
    hud.prompt.hidden = false;
    hud.prompt.querySelector("p").textContent =
      "การเชื่อมต่อกราฟิกขัดข้อง กำลังกู้คืน…";
  });
  renderer.domElement.addEventListener("webglcontextrestored", () =>
    location.reload(),
  );
  // Read-only diagnostics plus the sprite replacement seam for future character work.
  const debug = {
    scene,
    player,
    camera,
    collision,
    renderer,
    postfx,
    hooks: { npcs, spiritLamps, exits },
    lanternCount: lanterns.count,
  };
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug"))
    window.__THAINATIVE__ = debug;
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      stop();
      input.dispose();
      hud.dispose();
      window.removeEventListener("resize", resize);
      postfx.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    });
  document.body.dataset.ready = "true";
}
boot().catch((error) => {
  console.error(error);
  document.querySelector("#hud").innerHTML =
    '<section class="fatal"><h1>เปิดเมืองไม่สำเร็จ</h1><p>กรุณาใช้เบราว์เซอร์ที่รองรับ WebGL 2 แล้วโหลดหน้าใหม่</p><a href="/">ลองอีกครั้ง</a></section>';
  document.body.dataset.error = error.message;
});
