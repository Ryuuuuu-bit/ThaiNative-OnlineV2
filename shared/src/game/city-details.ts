export type Decoration={kind:string;x:number;z:number;w:number;d:number;variant?:number;label?:string;solid?:boolean};
export const NEW_BUILDINGS:Decoration[]=[
  {kind:'guild',x:-12,z:-28,w:8,d:7,label:'สมาคมนักผจญภัย',solid:true},
  {kind:'chapel',x:13,z:-30,w:7,d:8,label:'วิหารแสงอรุณ',solid:true},
  {kind:'workshop',x:-24,z:-12,w:6,d:5,label:'โรงงานไม้',solid:true},
  {kind:'inn',x:11,z:29,w:8,d:6,label:'โรงเตี๊ยมเตาผิงอุ่น',solid:true},
  {kind:'gazebo',x:-30,z:32,w:4,d:4,label:'ศาลาริมสวน',solid:true},
];
export const DECOR:Decoration[]=[
  ...NEW_BUILDINGS,
  ...[[29,-13],[21,15],[29,18],[41,-12]].map(([x,z],i)=>({kind:'stall',x,z,w:3,d:2.4,variant:i,solid:true})),
  ...[[-7,-7],[7,7],[-7,7],[7,-7],[5.5,27],[-7,-19],[7,-19],[19,7],[-19,-7],[41,5],[5,41]].map(([x,z],i)=>({kind:'lamp',x,z,w:.45,d:.45,variant:i,solid:true})),
  ...[[-7,-14],[8,-16],[-4,42],[4,42]].map(([x,z],i)=>({kind:'banner',x,z,w:.5,d:.5,variant:i,solid:true})),
  // Three separated garden accents, plus two civic beds; leave the fountain ring open.
  ...[[-23,20],[-26,27],[-7.5,28.5],[-17,-20],[24,-34]].map(([x,z],i)=>({kind:'flowerbed',x,z,w:3,d:1.4,variant:i,solid:true})),
  ...[[19,25],[19,29]].map(([x,z],i)=>({kind:'table',x,z,w:1.8,d:1.8,variant:i,solid:true})),
  ...[[-24,7],[-28,10],[-23,12]].map(([x,z],i)=>({kind:'dummy',x,z,w:.7,d:.7,variant:i,solid:true})),
  {kind:'notice',x:6,z:13,w:2,d:.7,label:'กระดานข่าวเมือง',solid:true},
  {kind:'notice',x:-7,z:-23,w:2,d:.7,solid:true},
  {kind:'wagon',x:10,z:38,w:3.2,d:2,solid:true},
  {kind:'wagon',x:39,z:22,w:3.2,d:2,variant:1,solid:true},
  {kind:'anvil',x:-26,z:-3,w:1.5,d:1,solid:true},
  ...[[34,7],[33,22],[-28.5,-15.5],[15,33],[33,-30]].map(([x,z],i)=>({kind:'barrels',x,z,w:1.4,d:1.4,variant:i,solid:true})),
  {kind:'gate',x:0,z:46,w:7,d:1.2},
  ...[[-21.5,26],[-10.5,26]].map(([x,z])=>({kind:'bench',x,z,w:2.2,d:.7,solid:true})),
  ...[[-22.5,24],[-9.5,30]].map(([x,z])=>({kind:'lamp',x,z,w:.45,d:.45,solid:true})),
];
export const CITY2D_FOUNTAIN={x:-16,z:27,r:2.5};
export const CITY2D_HEALER={x:-16,z:22.5};
export const GARDEN_TREES=[[-29,21],[-33,26],[-22,37],[-7,36],[6,35],[17,37],[26,29],[30,-23],[-33,-25],[-9,-37],[8,-39],[23,-30],[-17,8],[15,11]].map(([x,z],i)=>({x,z,flowering:i%3!==0}));
export const FORTIFICATION_SOLIDS=[
  ...[[-47,-47],[47,-47],[-47,47],[47,47]].map(([x,z])=>({x,z,w:3.4,d:3.4})),
  ...[[-4,-47],[4,-47],[-47,-4],[-47,4],[-4,47],[4,47],[47,-4],[47,4]].map(([x,z])=>({x,z,w:2.8,d:2.8})),
];
