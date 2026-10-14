import { town, districtAt, npcs } from "../world/layout.js";
import { Minimap } from "./minimap.js";
export class HUD {
  constructor(root, onQuality) {
    root.innerHTML = `
      <header class="identity"><span class="sigil" aria-hidden="true">๙</span><div><small>THAINATIVE ONLINE</small><h1>${town.name}</h1><p>ดินแดนระหว่างความทรงจำ</p></div></header>
      <section class="map-panel" aria-label="แผนที่เมือง"><div class="map-heading"><span>แผนที่เมือง</span><span class="north">N ↑</span></div><canvas id="minimap" width="320" height="320" aria-label="แผนที่ย่อแสดงตำแหน่งผู้เล่น"></canvas><div class="map-footer"><span id="map-district">ท่าเรือเก่า</span><span class="map-dot">● ภูผา</span></div></section>
      <section class="objective"><span class="objective-mark">◇</span><div><small>เสียงที่ยังหลงเหลือ</small><p>สำรวจเมือง และพูดคุยกับผู้รอคอย</p></div></section>
      <div id="district-banner" class="district-banner" role="status"><small>นครที่ถูกลืมเลือน</small><strong></strong><i></i></div>
      <section id="npc-prompt" class="npc-prompt" hidden><small></small><p></p></section>
      <footer class="bottom-bar"><div class="player-status"><span class="portrait">ภ</span><div><b>ภูผา <small>ผู้มาเยือน</small></b><span class="vital-line"></span><span>ความทรงจำที่ยังไม่เลือนหาย</span></div></div>
      <div class="tools"><span id="coordinates">X 42 · Z 44</span><span id="fps">— FPS</span><button id="quality" type="button" aria-label="สลับคุณภาพกราฟิก">คุณภาพ: High</button><button id="help-toggle" type="button" aria-expanded="false" aria-controls="controls-help">วิธีเล่น ?</button></div></footer>
      <aside id="controls-help" class="controls" hidden><b>เดินสำรวจเมือง</b><p>W A S D / ปุ่มลูกศร · เดินตามมุมกล้อง<br>คลิกพื้น · เดินสู่จุดหมาย<br>Q / E หรือกดเมาส์ขวาลาก · หมุนกล้อง<br>ล้อเมาส์ · ซูมเข้า–ออก</p><small>เดินข้ามคลองได้ที่สะพานเท่านั้น</small></aside>
      <div id="title-card" class="title-card"><span>THAINATIVE ONLINE</span><h2>${town.name}</h2><p>ฟ้าที่ไม่มีตะวัน… เมืองที่ไม่มีใครจำชื่อของตน</p><i></i><small>THE FORGOTTEN CITY</small></div>`;
    this.map = new Minimap(root.querySelector("#minimap"));
    this.banner = root.querySelector("#district-banner");
    this.coords = root.querySelector("#coordinates");
    this.fps = root.querySelector("#fps");
    this.mapDistrict = root.querySelector("#map-district");
    this.prompt = root.querySelector("#npc-prompt");
    this.lastDistrict = "";
    this.elapsed = 0;
    this.frames = 0;
    this.averageFPS = 0;
    this.quality = "high";
    root.querySelector("#quality").addEventListener("click", (e) => {
      this.quality = this.quality === "high" ? "low" : "high";
      onQuality(this.quality);
      e.currentTarget.textContent = `คุณภาพ: ${this.quality === "high" ? "High" : "Low"}`;
    });
    root.querySelector("#help-toggle").addEventListener("click", (e) => {
      const panel = root.querySelector("#controls-help");
      panel.hidden = !panel.hidden;
      e.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
    });
    this.titleTimer = setTimeout(() => {
      root.querySelector("#title-card").classList.add("leave");
    }, 2400);
    this.titleRemoveTimer = setTimeout(
      () => root.querySelector("#title-card")?.remove(),
      4500,
    );
  }
  update(player, camera, dt) {
    this.elapsed += dt;
    this.frames++;
    if (this.elapsed < 0.3) return;
    const { x, z } = player.position;
    this.map.update(player.position, camera.yaw);
    this.coords.textContent = `X ${x.toFixed(1)} · Z ${z.toFixed(1)}`;
    this.averageFPS = Math.round(this.frames / this.elapsed);
    this.fps.textContent = `${this.averageFPS} FPS`;
    this.elapsed = 0;
    this.frames = 0;
    const district = districtAt(x, z);
    if (district && district.id !== this.lastDistrict) {
      this.lastDistrict = district.id;
      this.mapDistrict.textContent = district.name;
      this.banner.querySelector("strong").textContent = district.name;
      this.banner.querySelector("i").textContent = district.english;
      this.banner.classList.remove("visible");
      void this.banner.offsetWidth;
      this.banner.classList.add("visible");
    }
    const near = npcs.find((p) => Math.hypot(p.x - x, p.z - z) < 5);
    this.prompt.hidden = !near;
    if (near) {
      this.prompt.querySelector("small").textContent = near.name;
      this.prompt.querySelector("p").textContent = `“${near.line}”`;
    }
  }
  dispose() {
    clearTimeout(this.titleTimer);
    clearTimeout(this.titleRemoveTimer);
  }
}
