import * as THREE from "three";
const materials = new Map();
const geometryCache = new Map();
function geometry(key, create) {
  if (!geometryCache.has(key)) geometryCache.set(key, create());
  return geometryCache.get(key);
}
export function random(seed = 1487) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function mat(color, roughness = 0.85) {
  const key = `${color}:${roughness}`;
  if (!materials.has(key))
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return materials.get(key);
}
export function box(parent, w, h, d, x, y, z, color) {
  const mesh = new THREE.Mesh(
    geometry(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
    mat(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function cylinder(
  parent,
  top,
  bottom,
  height,
  x,
  y,
  z,
  color,
  sides = 10,
) {
  const mesh = new THREE.Mesh(
    geometry(
      `cylinder:${top}:${bottom}:${height}:${sides}`,
      () => new THREE.CylinderGeometry(top, bottom, height, sides),
    ),
    mat(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function line(parent, points, color = "#383d39", radius = 0.035) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 16, radius, 4, false),
    mat(color),
  );
  parent.add(mesh);
  return mesh;
}
export function sign(
  parent,
  text,
  width,
  x,
  y,
  z,
  bg = "#3c3933",
  fg = "#d9c59a",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(9, 9, 750, 110);
  ctx.fillStyle = fg;
  ctx.font = '600 46px "Noto Sans Thai", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 384, 65, 720);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 6),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
// Gabled roof section with a ridge along z.
export function roof(parent, w, d, rise, y, color = "#a34835") {
  const vertices = [
    -w / 2,
    0,
    -d / 2,
    w / 2,
    0,
    -d / 2,
    0,
    rise,
    -d / 2,
    -w / 2,
    0,
    d / 2,
    w / 2,
    0,
    d / 2,
    0,
    rise,
    d / 2,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex([
    0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3,
  ]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, mat(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
