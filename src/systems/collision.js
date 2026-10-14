// Pure 2D solver. Substeps avoid tunnelling; projection provides wall sliding.
export class CollisionWorld {
  constructor(limit = 78) {
    this.limit = limit;
    this.shapes = [];
  }
  addBox(x, z, w, d, id = "") {
    this.shapes.push({ type: "box", x, z, w, d, id });
  }
  addPolygon(points, id = "") {
    this.shapes.push({ type: "polygon", points, id });
  }
  overlaps(x, z, radius = 0.55) {
    return this.shapes.some((s) =>
      s.type === "box"
        ? boxPush(x, z, radius, s)
        : polygonPush(x, z, radius, s.points),
    );
  }
  move(position, dx, dz, radius = 0.55) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.5)));
    let { x, z } = position;
    for (let i = 0; i < steps; i++) {
      x += dx / steps;
      z += dz / steps;
      for (let pass = 0; pass < 4; pass++)
        for (const s of this.shapes) {
          const push =
            s.type === "box"
              ? boxPush(x, z, radius, s)
              : polygonPush(x, z, radius, s.points);
          if (push) {
            x += push.x;
            z += push.z;
          }
        }
      x = Math.max(-this.limit + radius, Math.min(this.limit - radius, x));
      z = Math.max(-this.limit + radius, Math.min(this.limit - radius, z));
    }
    return { x, z };
  }
}
function boxPush(x, z, r, s) {
  const lx = s.x - s.w / 2,
    hx = s.x + s.w / 2,
    lz = s.z - s.d / 2,
    hz = s.z + s.d / 2;
  const dx = x - Math.max(lx, Math.min(hx, x)),
    dz = z - Math.max(lz, Math.min(hz, z)),
    dist = Math.hypot(dx, dz);
  if (dist >= r) return null;
  if (dist > 1e-8)
    return { x: (dx / dist) * (r - dist), z: (dz / dist) * (r - dist) };
  return [
    { x: lx - x - r, z: 0 },
    { x: hx - x + r, z: 0 },
    { x: 0, z: lz - z - r },
    { x: 0, z: hz - z + r },
  ].sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
}
function polygonPush(x, z, r, points) {
  let inside = false,
    best = null,
    bestNormal = null,
    distance = Infinity;
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[j],
      [bx, bz] = points[i];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax)
      inside = !inside;
    const vx = bx - ax,
      vz = bz - az,
      t = Math.max(
        0,
        Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz || 1)),
      );
    const q = { x: ax + t * vx, z: az + t * vz },
      d = Math.hypot(x - q.x, z - q.z);
    if (d < distance) {
      distance = d;
      best = q;
      const n = Math.hypot(vx, vz) || 1,
        winding = area >= 0 ? 1 : -1;
      bestNormal = { x: (winding * vz) / n, z: (-winding * vx) / n };
    }
  }
  if (!inside && distance >= r) return null;
  const sign = inside ? -1 : 1,
    length = inside ? distance + r : r - distance;
  if (distance < 1e-8) return { x: bestNormal.x * r, z: bestNormal.z * r };
  return {
    x: ((sign * (x - best.x)) / distance) * length,
    z: ((sign * (z - best.z)) / distance) * length,
  };
}
