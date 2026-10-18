import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(`shared/data/${name}.json`,'utf8'));
const {items}=read('items'),economy=read('economy'),{monsters}=read('monsters'),stats=read('stats');
const byId=new Map(items.map(i=>[i.id,i])),forge=economy.shops.forge;
const levels=[10,20,30,40,50,60,70,80,90,99],fmt=n=>Math.round(n).toLocaleString('en-US');
const income=m=>(m.gold[0]+m.gold[1])/2+m.drops.reduce((total,d)=>total+d.rate*(d.min+d.max)/2*Math.floor(byId.get(d.item).npcPrice*economy.sellMultiplier)*economy.dropMultiplier,0);
const tiers=levels.map(level=>{
 const sword=items.find(t=>t.level===level&&t.weaponType==='sword1h'&&forge[t.id]);
 const prefix=sword.id.slice(0,-6);
 const fullSet=['sword','armour','shield','cloak','boots','ring','ring','amulet'].reduce((n,k)=>n+forge[`${prefix}_${k}`],0);
 const candidates=monsters.filter(m=>!m.boss&&m.id!=='jelly_summon'&&m.level<=level&&m.level>=level-4);
 const grossPerKill=candidates.length?candidates.reduce((n,m)=>n+income(m),0)/candidates.length:null;
 return {level,prefix,weaponMin:forge[sword.id],weaponMax:forge[`${prefix}_staff`],fullSet,grossPerKill,weaponKills:grossPerKill?Math.ceil(forge[sword.id]/grossPerKill):null};
});
const rows=tiers.map(t=>`| ${t.level===99?'99':`${t.level}–${t.level===90?98:t.level+9}`} | ${fmt(t.weaponMin)}–${fmt(t.weaponMax)} | ${fmt(t.fullSet)} | ${t.grossPerKill?t.grossPerKill.toFixed(1):'ยังไม่มีพื้นที่'} | ${t.weaponKills?fmt(t.weaponKills):'รอข้อมูล'} |`).join('\n');
const exp99=stats.expToNext[97];
const md=`# ร้านค้า Lv.1–99 — รอบปรับ 18 ตุลาคม 2026

เพิ่มอุปกรณ์ 100 รายการ (10 ระดับ × 10 แบบ) และยา 6 รายการ ใช้ภาพไอเทมใน atlas เดิมตามชนิด ยังไม่ได้สร้างงานภาพแยกแต่ละ tier

## ราคาและหลักการ

| ช่วงเลเวล | อาวุธ (ทอง) | ชุดกายภาพครบ 8 ช่อง รวมแหวน 2 วง | รายได้คาดหมาย/ตัว* | จำนวนมอนสเตอร์เพื่อซื้อดาบ* |
|---|---:|---:|---:|---:|
${rows}

*เฉพาะมอนสเตอร์ธรรมดาที่มีจริงในช่วง 4 เลเวลล่าสุด: ทองเฉลี่ยบวกมูลค่าคาดหมายเมื่อขายดรอปทั้งหมด ไม่ใช่รายได้สุทธิ ไม่รวมบอส เควส ค่ายา เวลาเดิน จำนวนคนแย่งมอนสเตอร์ หรือความเร็วฆ่า ไม่ใช้เป็นคำอ้างรายได้ต่อชั่วโมง

- ของเริ่มต้นและราคาของเดิมคงเดิม เพื่อไม่เพิ่มภาระผู้เล่นใหม่
- ของชุดใหม่ขายคืน 25% ของราคาซื้อ ไม่มีช่องการ์ดและไม่มีคุณสมบัติพิเศษ เพื่อเปิดพื้นที่ให้ของดรอป/คราฟต์ในอนาคต
- ดาบผลึกจันทราและเกราะม่วงราชันเดิมไม่ได้เพิ่มเข้าร้าน; ของบอสและการ์ดยังคงอยู่นอกร้าน
- มีอาวุธสำหรับ sword1h, staff, bow ตามอาชีพที่มีในข้อมูล พร้อมแหวนโจมตีและแหวนเวท
- หินตีบวกอาวุธ/เกราะขาย 600 ทอง ราคาขายคืนเดิม 75 ทอง
- ยาขนาดใหญ่ใช้ได้ทุกเลเวล ใช้กฎการกดและ cooldown เดิม; ราคาต่อหน่วยการฟื้นฟูแพงขึ้นเพื่อแลกความสะดวกต่อครั้ง
- เพิ่มตัวกรองช่วงเลเวล ประเภท และอาวุธตรงอาชีพ; แสดงเลเวลและราคาแบบมี comma

## สิ่งที่ยังต้องวัดก่อนสรุปสมดุล endgame

พื้นที่ปัจจุบันถึง Lv.30 เท่านั้น ราคา Lv.40–99 เป็นกรอบเริ่มต้น ยังไม่ผ่านการวัดรายได้จริงในพื้นที่ระดับนั้น การเติบโตของค่าสถานะเป็นอุปกรณ์พื้นฐาน ไม่ใช่การยืนยันสมดุลต่อสู้ระดับสูง

ตาราง EXP เดิมใช้ ${fmt(exp99)} EXP จาก Lv.98 ไป Lv.99 และยังโตเร็วมาก ต้องตรวจ progression ร่วมกับแผนที่ Lv.31–99 แยกต่างหาก; รอบนี้ไม่ได้แก้ EXP หรือรายได้เดิม

ควรเก็บ gold/hour สุทธิหลังค่ายา, gold ต่อเลเวล, เวลาซื้อชิ้นแรก/ชุดเต็ม, อัตราขายของดรอป และจำนวนผู้เล่นในแต่ละช่วง แล้วปรับราคา Lv.40+ ตามข้อมูล โดยระวังอุปกรณ์ร้านกลบคุณค่าของดรอปใหม่
`;
mkdirSync('docs',{recursive:true});writeFileSync('docs/shop-economy.md',md);
console.log(JSON.stringify({newEquipment:100,newPotions:6,tiers},null,2));
