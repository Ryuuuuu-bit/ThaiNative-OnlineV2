// Ground coordinates: x east, z south. All gameplay footprints live here.
export const town = {
  name: "นครที่ถูกลืมเลือน",
  english: "THE FORGOTTEN CITY",
  size: 160,
  spawn: { x: 42, z: 44 },
  seed: 1487,
};
export const zones = [
  {
    id: "temple",
    name: "วัดร้าง",
    english: "ABANDONED TEMPLE",
    bounds: [-78, -78, -30, -18],
    color: "#62696b",
  },
  {
    id: "soi",
    name: "ตรอกเรือนไม้",
    english: "WOODEN HOUSE QUARTER",
    bounds: [-30, -78, 30, -18],
    color: "#62666b",
  },
  {
    id: "gym",
    name: "ค่ายมวยเก่า",
    english: "OLD MUAY THAI CAMP",
    bounds: [30, -78, 78, -18],
    color: "#626765",
  },
  {
    id: "plaza",
    name: "ลานบ่อน้ำ",
    english: "WELL SQUARE",
    bounds: [-78, -18, 78, 23],
    color: "#687176",
  },
  {
    id: "market",
    name: "ตลาดยามค่ำ",
    english: "LANTERN MARKET",
    bounds: [-78, 23, -8, 78],
    color: "#686a6c",
  },
  {
    id: "canal",
    name: "ท่าเรือเก่า",
    english: "OLD PIER",
    bounds: [-8, 23, 78, 78],
    color: "#5c6a70",
  },
];
export const roads = [
  { id: "avenue", x: 0, z: 0, w: 156, d: 12, kind: "stone" },
  ...[-26, 26].map((x) => ({
    id: `cross-${x}`,
    x,
    z: -9,
    w: 9,
    d: 134,
    kind: "stone",
  })),
  { id: "soi", x: 0, z: -40, w: 145, d: 7, kind: "stone" },
  { id: "market-walk", x: 0, z: 31, w: 150, d: 8, kind: "stone" },
  { id: "south-walk", x: 0, z: 65, w: 150, d: 7, kind: "stone" },
  { id: "exit-path", x: 0, z: -60, w: 9, d: 40, kind: "stone" },
  { id: "pier-path", x: 42, z: 37, w: 5, d: 15, kind: "wood" },
];
export const canal = {
  id: "canal-water",
  assetId: "water",
  x: 0,
  z: 52,
  w: 156,
  d: 12,
};
export const bridges = [-26, 26].map((x) => ({
  id: `bridge-${x}`,
  assetId: "bridge",
  x,
  z: 52,
  w: 10,
  d: 16,
}));
export const pier = { id: "pier", assetId: "pier", x: 42, z: 44, w: 13, d: 7 };
export const buildings = [
  {
    id: "temple",
    assetId: "temple",
    type: "temple",
    x: -51,
    z: -57,
    w: 23,
    d: 22,
    h: 8,
    color: "#817a6b",
    label: "วัดร้าง",
  },
  {
    id: "gym",
    assetId: "gym",
    type: "gym",
    x: 51,
    z: -56,
    w: 30,
    d: 27,
    h: 8,
    color: "#716458",
    label: "ค่ายมวยเก่า",
  },
  ...[-15, 15].flatMap((x, side) =>
    [-65, -52, -27].map((z, i) => ({
      id: `shophouse-${side}-${i}`,
      assetId: "wooden-house",
      type: "house",
      x,
      z,
      w: 12,
      d: 10,
      h: 7 + (i % 2),
      color: ["#625950", "#6b6255", "#555d5b"][i],
      label: "",
    })),
  ),
  {
    id: "store",
    assetId: "general-store",
    type: "store",
    x: 50,
    z: -25,
    w: 21,
    d: 12,
    h: 6,
    color: "#71695c",
    label: "ร้านของชำ",
  },
];
export const bellTower = {
  id: "bell-tower",
  assetId: "bell-tower",
  x: -68,
  z: -31,
  w: 6,
  d: 6,
};
export const entranceSign = {
  id: "entrance-sign",
  assetId: "entrance-sign",
  x: 47,
  z: 36,
  text: town.name,
};
export const props = [
  { id: "well", assetId: "well", x: 0, z: -11, w: 8, d: 8 },
  { id: "shrine", assetId: "spirit-house", x: -60, z: -27, w: 4, d: 4 },
  ...[-64, -51, -38].flatMap((x, i) =>
    [23, 39].map((z, j) => ({
      id: `stall-${i}-${j}`,
      assetId: "market-stall",
      x,
      z,
      w: 7,
      d: 4,
      color: ["#76544d", "#7f7053", "#516662"][i],
    })),
  ),
  ...[-57, -37, 40, 59].map((x, i) => ({
    id: `bench-${i}`,
    assetId: "bench",
    x,
    z: 14,
    w: 5,
    d: 1.5,
  })),
  ...[
    [-48, 17],
    [60, -15],
    [32, 36],
    [-68, -46],
  ].map(([x, z], i) => ({
    id: `jar-${i}`,
    assetId: "clay-jar",
    x,
    z,
    w: 1.8,
    d: 1.8,
  })),
  { id: "cart", assetId: "handcart", x: -56, z: 34, w: 4, d: 2.5 },
  { id: "banner", assetId: "cloth-banner", x: -32, z: 27, w: 1, d: 1 },
  { id: "gate", assetId: "city-gate", x: 0, z: -76, w: 13, d: 2 },
  bellTower,
];
export const vegetation = [
  ...[-69, -53, -36, 36, 53, 69].flatMap((x, i) =>
    [-17, 20, 71].map((z, j) => ({
      id: `tree-${i}-${j}`,
      assetId: "bare-tree",
      x,
      z,
      scale: 0.85 + ((i + j) % 3) * 0.12,
    })),
  ),
  ...[-72, -68, 66, 71].flatMap((x, i) =>
    [-68, -32, 40].map((z, j) => ({
      id: `banana-${i}-${j}`,
      assetId: "banana",
      x,
      z,
      scale: 0.8 + (j % 2) * 0.3,
    })),
  ),
];
export const npcs = [
  {
    id: "waiting-elder",
    x: 38,
    z: 43,
    name: "ชายชราผู้รอคอย",
    line: "ข้ารอใครอยู่… เจ้าพอจะจำได้หรือไม่",
  },
  {
    id: "monk",
    x: -45,
    z: -24,
    name: "พระชรา",
    line: "เมื่อระฆังดังยามเที่ยงคืน… จงกอดความทรงจำไว้",
  },
  {
    id: "trainer",
    x: 48,
    z: -37,
    name: "ครูมวย",
    line: "กายยังจำท่ามวยได้ แม้ใจจะลืมชื่อของตน",
  },
  {
    id: "vendor",
    x: -46,
    z: 32,
    name: "แม่ค้าผู้ลืมชื่อ",
    line: "ร้านนี้เป็นของข้า… แต่ข้าชื่ออะไรนะ",
  },
  {
    id: "child",
    x: 6,
    z: -6,
    name: "เด็กน้อย",
    line: "ข้าจำหน้าแม่ไม่ได้แล้ว… ท่านเห็นแม่ข้าหรือไม่",
  },
];
export const spiritLamps = [
  {
    id: "lamp-temple",
    assetId: "spirit-lamp",
    x: -70,
    z: -69,
    guardianId: "ghost-temple",
  },
  {
    id: "lamp-soi",
    assetId: "spirit-lamp",
    x: 8,
    z: -61,
    guardianId: "ghost-soi",
  },
  {
    id: "lamp-market",
    assetId: "spirit-lamp",
    x: -71,
    z: 42,
    guardianId: "ghost-market",
  },
  {
    id: "lamp-canal",
    assetId: "spirit-lamp",
    x: 67,
    z: 69,
    guardianId: "ghost-canal",
  },
];
export const exits = [
  {
    id: "north-gate",
    x: 0,
    z: -76,
    label: "ทางออก — ยังไม่เปิด",
    locked: true,
    targets: ["pa-takhian", "ghost-market", "abandoned-house", "mist-marsh"],
  },
];
export const boats = [
  { id: "boat-1", assetId: "sampan", x: 52, z: 52 },
  { id: "boat-2", assetId: "sampan", x: 65, z: 54 },
];
export function districtAt(x, z) {
  return zones.find(
    ({ bounds: [a, b, c, d] }) => x >= a && x < c && z >= b && z < d,
  );
}
