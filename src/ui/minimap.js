import {
  town,
  zones,
  roads,
  canal,
  bridges,
  buildings,
  props,
  npcs,
  spiritLamps,
  pier,
  exits,
} from "../world/layout.js";
export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.base = document.createElement("canvas");
    this.base.width = this.base.height = 320;
    this.drawBase();
  }
  point(x, z) {
    return [
      ((x + town.size / 2) / town.size) * 320,
      ((z + town.size / 2) / town.size) * 320,
    ];
  }
  rect(ctx, p, color) {
    const [x, z] = this.point(p.x - p.w / 2, p.z - p.d / 2);
    ctx.fillStyle = color;
    ctx.fillRect(x, z, p.w * 2, p.d * 2);
  }
  drawBase() {
    const ctx = this.base.getContext("2d");
    ctx.fillStyle = "#293a42";
    ctx.fillRect(0, 0, 320, 320);
    for (const zone of zones) {
      const [a, b, c, d] = zone.bounds;
      this.rect(
        ctx,
        { x: (a + c) / 2, z: (b + d) / 2, w: c - a, d: d - b },
        zone.color,
      );
    }
    for (const road of roads) this.rect(ctx, road, "#929288");
    this.rect(ctx, canal, "#344e5c");
    for (const p of [...bridges, pier]) this.rect(ctx, p, "#b09b75");
    for (const p of [...buildings, ...props])
      this.rect(ctx, p, p.type === "temple" ? "#b09e7b" : "#454b4c");
    for (const p of npcs) {
      const [x, y] = this.point(p.x, p.z);
      ctx.fillStyle = "#d9bb79";
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of spiritLamps) {
      const [x, y] = this.point(p.x, p.z);
      ctx.fillStyle = "#9cc3ac";
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    const [gx, gy] = this.point(exits[0].x, exits[0].z);
    ctx.strokeStyle = "#c09d76";
    ctx.strokeRect(gx - 5, gy - 2, 10, 4);
  }
  update(position, yaw) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 320, 320);
    ctx.drawImage(this.base, 0, 0);
    const [x, y] = this.point(position.x, position.z);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw);
    ctx.fillStyle = "#f4dcad";
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#ffe7bd";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
}
