import * as THREE from "three";
export const DIRECTIONS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"];
export function directionRow(facing, cameraYaw) {
  const worldAngle = Math.atan2(facing.x, facing.z);
  return ((Math.round((worldAngle - cameraYaw) / (Math.PI / 4)) % 8) + 8) % 8;
}
export class SpriteSheet {
  constructor(texture, { columns = 4, rows = 8, fps = 7 } = {}) {
    this.texture = texture;
    this.columns = columns;
    this.rows = rows;
    this.fps = fps;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1 / columns, 1 / rows);
    this.frame(0, 0);
  }
  frame(row, column) {
    this.texture.offset.set(column / this.columns, 1 - (row + 1) / this.rows);
  }
  update(row, time, moving) {
    this.frame(row, moving ? Math.floor(time * this.fps) % this.columns : 0);
  }
  static async load(url, options) {
    return new SpriteSheet(
      await new THREE.TextureLoader().loadAsync(url),
      options,
    );
  }
  static placeholder() {
    const c = document.createElement("canvas");
    c.width = 64 * 4;
    c.height = 64 * 8;
    const ctx = c.getContext("2d");
    for (let row = 0; row < 8; row++)
      for (let frame = 0; frame < 4; frame++) {
        const ox = frame * 64,
          oy = row * 64,
          bob = frame % 2;
        ctx.save();
        ctx.translate(ox + 32, oy + 60);
        ctx.fillStyle = "#202b35";
        ctx.fillRect(-9, -22, 7, 21);
        ctx.fillRect(2, -22, 7, 21);
        ctx.fillStyle = "#bfac88";
        ctx.fillRect(-10, -5, 8, 5);
        ctx.fillRect(2, -5, 8, 5);
        ctx.fillStyle = "#334957";
        ctx.fillRect(-12, -41 + bob, 24, 24);
        ctx.fillStyle = "#9f4e3b";
        ctx.fillRect(-12, -21 + bob, 24, 5);
        ctx.fillStyle = "#bca282";
        ctx.fillRect(-14, -49 + bob, 28, 16);
        ctx.fillStyle = "#262d36";
        ctx.fillRect(-15, -55 + bob, 30, 11);
        ctx.fillStyle = "#a2533d";
        ctx.fillRect(-15, -46 + bob, 30, 3);
        ctx.fillStyle = "#ac997b";
        ctx.fillRect(-16, -36 + bob, 5, 14);
        ctx.fillRect(11, -36 + bob, 5, 14);
        if (row < 3 || row > 5) {
          ctx.fillStyle = "#172731";
          const look = row === 0 ? 0 : row < 3 ? 3 : -3;
          ctx.fillRect(-7 + look, -40 + bob, 3, 3);
          ctx.fillRect(4 + look, -40 + bob, 3, 3);
        }
        ctx.restore();
      }
    return new SpriteSheet(new THREE.CanvasTexture(c));
  }
}
