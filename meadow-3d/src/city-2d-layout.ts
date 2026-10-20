import {cityWalkable,DECOR,NEW_BUILDINGS,GARDEN_TREES,FORTIFICATION_SOLIDS,CITY_HOUSES,CITY_ART_SOLIDS,CITY2D_FOUNTAIN,CITY2D_HEALER} from '@the-beginning-online/shared/maps';
export {DECOR,NEW_BUILDINGS,GARDEN_TREES,FORTIFICATION_SOLIDS,CITY_HOUSES,CITY_ART_SOLIDS,CITY2D_FOUNTAIN,CITY2D_HEALER};
export type {Decoration} from '@the-beginning-online/shared/maps';
export const city2dWalkable=(x:number,z:number,r=.38)=>cityWalkable(x,z,r);
export const DISTRICTS = [
  {id:'plaza',name:'ลานดารารุ่ง',subtitle:'หอนาฬิกา · จุดนัดพบของนักผจญภัย',x:0,z:9,color:'#d1b77a'},
  {id:'market',name:'ตลาดผ้าใบสีคราม',subtitle:'แผงผลไม้ · ผ้าและเครื่องเทศ · คาราวาน',x:27,z:5,color:'#6aafad'},
  {id:'craft',name:'ตรอกเตาหลอม',subtitle:'โรงตีเหล็ก · งานไม้ · ลานฝึก',x:-27,z:0,color:'#c99364'},
  {id:'civic',name:'เขตสมาคมแสงอรุณ',subtitle:'สมาคมนักผจญภัย · วิหาร · คลังเมือง',x:0,z:-24,color:'#9b9dc1'},
  {id:'garden',name:'สวนธาราจันทร์',subtitle:'ลานน้ำพุ · ทางเดินวงแหวน · สวนดอกไม้',x:-16,z:27,color:'#9fbb85'},
  {id:'inn',name:'ย่านเตาผิงอุ่น',subtitle:'โรงเตี๊ยม · โต๊ะอาหาร · บ้านชาวเมือง',x:15,z:28,color:'#cd9e85'},
] as const;
export const districtAt=(x:number,z:number)=>DISTRICTS.reduce((a,b)=>Math.hypot(x-a.x,z-a.z)<Math.hypot(x-b.x,z-b.z)?a:b);
export const TOUR_STOPS=DISTRICTS.map(d=>({...d, x:d.id==='civic'?0:d.x,z:d.id==='market'?4:d.id==='garden'?33:d.id==='inn'?21:d.z}));

// Grid navigation is generated from the same collision used by the player.
const SIZE=93,OFFSET=46;
let grid:Uint8Array;
function navGrid(){if(!grid){grid=new Uint8Array(SIZE*SIZE);for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++)grid[z*SIZE+x]=Number(city2dWalkable(x-OFFSET,z-OFFSET,.48));}return grid;}
export function route(from:{x:number;z:number},to:{x:number;z:number}):{x:number;z:number}[]{
  const g=navGrid(),index=(x:number,z:number)=>(z+OFFSET)*SIZE+x+OFFSET;
  function nearest(p:{x:number;z:number}){const x=Math.max(-45,Math.min(45,Math.round(p.x))),z=Math.max(-45,Math.min(45,Math.round(p.z)));for(let r=0;r<8;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const xx=x+dx,zz=z+dz;if(Math.abs(xx)>45||Math.abs(zz)>45)continue;const i=index(xx,zz);if(g[i])return i;}return -1;}
  const start=nearest(from),end=nearest(to);if(start<0||end<0)return [];
  const prev=new Int32Array(g.length).fill(-1),queue=[start];prev[start]=start;
  // Four-way routes make every segment collision-checkable and keep turns readable.
  for(let head=0;head<queue.length&&prev[end]<0;head++){const at=queue[head];for(const n of [at-1,at+1,at-SIZE,at+SIZE]){if(n<0||n>=g.length||!g[n]||prev[n]>=0||Math.abs(n%SIZE-at%SIZE)>1)continue;prev[n]=at;queue.push(n);}}
  if(prev[end]<0)return [];
  const path=[];for(let at=end;at!==start;at=prev[at])path.push({x:at%SIZE-OFFSET,z:Math.floor(at/SIZE)-OFFSET});
  return path.reverse();
}
