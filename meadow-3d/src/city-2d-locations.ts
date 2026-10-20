import {CITY_BUILDINGS,GATE_CAPTAIN} from '@the-beginning-online/shared/maps';
import {CITY2D_HEALER} from './city-2d-layout.ts';

export const TOWN_NPCS = [
  ...CITY_BUILDINGS.map(b=>({...b.talk,id:b.id,art:b.id==='forge'?'blacksmith':b.id==='market'?'merchant':'clerk',name:b.npc,line:b.id==='forge'?'เตาหลอมพร้อมแล้ว! เดินผ่านลานฝึกไปชมโรงงานไม้ได้เลย':b.id==='market'?'ผลไม้จากทุ่งมาถึงเช้านี้ ทางขวามีร้านขนมปังด้วยนะ':'คลังเมืองอยู่ด้านหลังฉัน ส่วนสมาคมอยู่ถัดไปทางตะวันตก'})),
  {...CITY2D_HEALER,id:'healer',art:'healer',name:'ริน · ผู้รักษา',line:'พักริมธาราจันทร์สักครู่ แล้วค่อยออกเดินทางต่อเถอะ'},
  {...GATE_CAPTAIN,id:'captain',art:'guard',name:'กานต์ · หัวหน้าทหารยาม',line:'ประตูใต้ไปทุ่งวุ้นจิ๋ว ประตูตะวันออกไปป่าหมอก อย่าลืมเตรียมเสบียง'},
  {x:-27,z:29,id:'gardener',art:'gardener',name:'ลุงบุญ · คนสวน',line:'วันนี้ดอกไม้รอบน้ำพุบานเต็มสวนเลยนะ'},
  {x:-12,z:-22,id:'guild-clerk',art:'clerk',name:'ธาม · นายทะเบียน',line:'สมาคมแสงอรุณยินดีต้อนรับนักผจญภัยทุกอาชีพ'},
  {x:23,z:12,id:'baker',art:'baker',name:'ป้ามะลิ · คนอบขนม',line:'ขนมปังเพิ่งออกจากเตา กลิ่นหอมไปถึงลานกลางเลย'},
  {x:7,z:15,id:'courier',art:'courier',name:'นที · คนส่งจดหมาย',line:'จดหมายรอบบ่ายจะออกพร้อมคาราวานที่ประตูใต้'},
  {x:17,z:23,id:'bard',art:'bard',name:'อิง · นักดนตรี',line:'คืนนี้ฉันจะเล่นเพลงที่โรงเตี๊ยม แวะมาฟังกันนะ'},
  {x:11,z:33.5,id:'innkeeper',art:'innkeeper',name:'เฮียภพ · เจ้าของโรงเตี๊ยม',line:'เดินทางมาเหนื่อย ๆ แวะพักที่เตาผิงอุ่นได้เสมอ'},
  {x:-23,z:23,id:'herbalist',art:'herbalist',name:'ยายแสง · คนปรุงสมุนไพร',line:'ใบไม้จากป่าหมอกใช้ปรุงยาได้ แต่ต้องเลือกให้ถูกชนิด'},
  {x:23,z:30,id:'child',art:'child',name:'ข้าวหอม · เด็กในย่าน',line:'ฉันเก็บดอกไม้ไปฝากคนสวน คุณชอบสีไหนเหรอ?'},
  {x:-4.8,z:43,id:'south-guard',art:'guard',name:'เวรยามประตูใต้',line:'ทุ่งวุ้นจิ๋วอยู่พ้นประตูนี้ ระวังตอนฟ้ามืดด้วย'},
  {x:43,z:4.8,id:'east-guard',art:'guard',name:'เวรยามประตูตะวันออก',line:'ทางนี้ไปป่าหมอก เตรียมยารักษาให้พร้อมก่อนเดินทาง'},
];

export const WAYPOINTS = [
  {id:'arrival',name:'ลานต้อนรับ',x:0,z:31,color:'#83dad0'},
  {id:'guild',name:'สมาคมแสงอรุณ',x:0,z:-19,color:'#b5a5ed'},
  {id:'market',name:'ตลาดสีคราม',x:30,z:11,color:'#e7c27f'},
  {id:'garden',name:'สวนธาราจันทร์',x:-9,z:19,color:'#b5d997'},
] as const;
export const CITY_EXITS = [
  {id:'south',name:'ประตูทุ่งวุ้นจิ๋ว',destination:'ทุ่งวุ้นจิ๋ว',x:0,z:44,color:'#c7d98c'},
  {id:'east',name:'ประตูป่าหมอก',destination:'ป่าหมอก',x:44,z:0,color:'#8ecdd5'},
  {id:'north',name:'ประตูเหนือ',destination:'เขตเหนือ (ยังไม่กำหนดแผนที่)',x:0,z:-44,color:'#b6b3d8'},
  {id:'west',name:'ประตูตะวันตก',destination:'เขตตะวันตก (ยังไม่กำหนดแผนที่)',x:-44,z:0,color:'#deb797'},
] as const;
export function nearbyWaypoint(x:number,z:number){return WAYPOINTS.find(p=>Math.hypot(x-p.x,z-p.z)<2.8);}
export function nearbyExit(x:number,z:number){return CITY_EXITS.find(p=>Math.hypot(x-p.x,z-p.z)<2.8);}
export function waypointArrival(id:string){const p=WAYPOINTS.find(p=>p.id===id);return p?{x:p.x,z:p.z+2.2}:undefined;}
