import {ENDGAME_UNIQUES,ENDGAME_CARD_TEXT} from './game/endgame-loot-data.js';
import { z } from 'zod';
import type { GameData, Modifier } from './schema.js';
import type { OwnedItem } from './inventory.js';

export const ItemRollSchema = z.object({
 version: z.literal(1), itemLevel: z.number().int().min(1).max(100),
 quality: z.enum(['magic','rare','unique']),
 affixes: z.array(z.object({id:z.string(),value:z.number().finite()}).strict()).max(6),
}).strict();
export type ItemRoll = z.infer<typeof ItemRollSchema>;
export interface LootItem { template: string; qty: number; roll?: ItemRoll }
type Affix = {id:string; name:string; side:'prefix'|'suffix'; types:string[]; stat:'atk'|'matk'|'maxHp'|'maxSp'|'hardDef'|'hardMdef'|'hit'|'flee'|'crit'|'moveSpeed'|'aspd'|'castMul'|'spRegen'|'hpRegen'; min:number; max:number; perLevel:number; percent?:boolean; reduction?:boolean};
const all=['weapon','armour','shield','garment','footgear','accessory'];
export const STARTER_AFFIXES: readonly Affix[] = [
 {id:'force',name:'พลังโจมตี',side:'prefix',types:['weapon'],stat:'atk',min:2,max:5,perLevel:.5},
 {id:'arcane',name:'พลังเวท',side:'prefix',types:['weapon'],stat:'matk',min:2,max:5,perLevel:.5},
 {id:'vital',name:'HP สูงสุด',side:'prefix',types:all,stat:'maxHp',min:8,max:20,perLevel:2},
 {id:'spirit',name:'SP สูงสุด',side:'prefix',types:all,stat:'maxSp',min:3,max:8,perLevel:1},
 {id:'guard',name:'เกราะ',side:'prefix',types:all,stat:'hardDef',min:1,max:3,perLevel:.3},
 {id:'precision',name:'ความแม่นยำ',side:'suffix',types:all,stat:'hit',min:2,max:6,perLevel:.5},
 {id:'elusive',name:'หลบหลีก',side:'suffix',types:all,stat:'flee',min:1,max:3,perLevel:.3},
 {id:'keen',name:'คริติคอล (%)',side:'suffix',types:all,stat:'crit',min:1,max:2,perLevel:.1},
 {id:'quick',name:'ความเร็วโจมตี (%)',side:'suffix',types:['weapon','accessory'],stat:'aspd',min:1,max:2,perLevel:.1,percent:true},
 {id:'stride',name:'ความเร็วเดิน (%)',side:'suffix',types:['footgear'],stat:'moveSpeed',min:2,max:4,perLevel:.2,percent:true},
 {id:'might',name:'พลังโจมตี',side:'prefix',types:['armour','garment','footgear','accessory'],stat:'atk',min:1,max:3,perLevel:.15},
 {id:'wisdom',name:'พลังเวท',side:'prefix',types:['armour','shield','garment','footgear','accessory'],stat:'matk',min:1,max:3,perLevel:.15},
 {id:'ward',name:'เกราะเวท',side:'prefix',types:all,stat:'hardMdef',min:1,max:3,perLevel:.2},
 {id:'meditation',name:'ฟื้น SP (%)',side:'suffix',types:all,stat:'spRegen',min:3,max:6,perLevel:.1,percent:true},
 {id:'renewal',name:'ฟื้น HP (%)',side:'suffix',types:['armour','shield','garment','footgear','accessory'],stat:'hpRegen',min:3,max:6,perLevel:.1,percent:true},
 {id:'focus',name:'เวลาร่าย (%)',side:'suffix',types:all,stat:'castMul',min:1,max:2,perLevel:.04,percent:true,reduction:true},
];
export const STARTER_UNIQUES = {
 ...ENDGAME_UNIQUES,
 unique_blade_oath:{name:'ดาบสัตย์พิทักษ์',level:30,rolls:[{id:'force',name:'พลังโจมตี',min:8,max:12,stat:'atk'},{id:'life',name:'HP สูงสุด',min:60,max:90,stat:'maxHp'}],lines:['Swordsman · ดาบมือเดียวสำหรับสายป้องกัน ใช้ร่วมกับโล่ได้','Unique ไม่มีช่องการ์ด']},
 unique_hunters_eye:{name:'ธนูเนตรเหยี่ยว',level:30,rolls:[{id:'accuracy',name:'ความแม่นยำ',min:10,max:16,stat:'hit'},{id:'force',name:'พลังโจมตี',min:8,max:12,stat:'atk'}],lines:['Archer · ธนูสำหรับหมายหัว ยิงประณีต และกับดัก','Unique ไม่มีช่องการ์ด']},
 unique_ember_robe:{name:'อาภรณ์อัคคีสงบ',level:30,rolls:[{id:'arcane',name:'พลังเวท',min:10,max:16,stat:'matk'},{id:'spirit',name:'SP สูงสุด',min:20,max:35,stat:'maxSp'}],lines:['Mage · เกราะเวทสำหรับร่ายธาตุ ลดเวลาร่าย แลกกับเกราะกายภาพที่ต่ำ','Unique ไม่มีช่องการ์ด']},
 unique_lotus_vow:{name:'จี้สัตย์บัวขาว',level:30,rolls:[{id:'arcane',name:'พลังเวท',min:10,max:16,stat:'matk'},{id:'spirit',name:'SP สูงสุด',min:25,max:40,stat:'maxSp'}],lines:['Healer · MATK เสริมพลังรักษาและน้ำยากัดกร่อน ฟื้น SP สำหรับสกิลต่อเนื่อง','Unique ไม่มีช่องการ์ด']},
 unique_spirit_bond:{name:'ผ้าคลุมพันธะวิญญาณ',level:30,rolls:[{id:'arcane',name:'พลังเวท',min:10,max:16,stat:'matk'},{id:'life',name:'HP สูงสุด',min:60,max:90,stat:'maxHp'}],lines:['Summoner · MATK และ Max HP เสริมพลังโจมตีและชีวิตผู้พิทักษ์ตามสูตรอัญเชิญ','Unique ไม่มีช่องการ์ด']},
 unique_shadow_fang:{name:'กริชเขี้ยวเงา',level:30,rolls:[{id:'force',name:'พลังโจมตี',min:8,max:12,stat:'atk'},{id:'evasion',name:'หลบหลีก',min:8,max:12,stat:'flee'}],lines:['Assassin · กริชสำหรับโจมตีด้านหลังและเคลือบพิษ','Unique ไม่มีช่องการ์ด']},
 unique_flowing_fist:{name:'ผ้าพันหมัดธารปราณ',level:30,rolls:[{id:'force',name:'พลังโจมตี',min:8,max:12,stat:'atk'},{id:'spirit',name:'SP สูงสุด',min:20,max:35,stat:'maxSp'}],lines:['Boxer · อาวุธชนิดมือเปล่า ใช้คอมโบหมัด ปัดป้อง และสวนลมปราณได้','Unique ไม่มีช่องการ์ด']},
 unique_yokai_relic:{name:'หน้ากากจันทร์ซ้อน',level:69,rolls:[{id:'evasion',name:'หลบหลีก',min:12,max:18,stat:'flee'},{id:'spirit',name:'SP สูงสุด',min:25,max:40,stat:'maxSp'}],lines:['หลบวงเตือนที่ล็อกเป้าคุณสำเร็จ สร้างเงารับการตีปกติประชิดที่โดน 1 ครั้ง ภายใน 5 วินาที · คูลดาวน์ 15 วินาที','เงาไม่รับท่าพิเศษ กระสุน หรือ DOT · ตีปกติของผู้สวมลด 5% รวมถึงระหว่างเงายังอยู่หลังถอด Unique','Unique ไม่มีช่องการ์ด']},
 unique_frost_relic:{name:'หัวใจฟยอร์ด',level:69,rolls:[{id:'life',name:'HP สูงสุด',min:180,max:240,stat:'maxHp'},{id:'guard',name:'เกราะ',min:8,max:12,stat:'hardDef'}],lines:['รับการโจมตีตรงขณะ Guard ครบ 3 ครั้ง ได้เกราะ 4% Max HP นาน 4 วินาที · คูลดาวน์ 12 วินาที','เคลื่อนที่ช้าลง 4% ระหว่างที่เกราะนี้ยังคงอยู่ แม้ถอด Unique ออก','Unique ไม่มีช่องการ์ด']},
 unique_desert_relic:{name:'ตราสุริยคราส',level:59,rolls:[{id:'spirit',name:'SP สูงสุด',min:35,max:55,stat:'maxSp'},{id:'accuracy',name:'ความแม่นยำ',min:10,max:16,stat:'hit'}],lines:['โจมตีตรงสลับกายภาพ–เวท–กายภาพ หรือ เวท–กายภาพ–เวท สำเร็จภายใน 5 วินาที ตีปกติถัดไปภายใน 5 วินาทีเจาะเกราะกายภาพ 10% · คูลดาวน์ 10 วินาที','ตีชนิดเดิมซ้ำเริ่มลำดับใหม่ · พิษ เลือดไหล และสะท้อนไม่นับและไม่ได้โบนัส','Unique ไม่มีช่องการ์ด']},
 unique_himmapan_relic:{name:'หยดนาคาคราม',level:59,rolls:[{id:'life',name:'HP สูงสุด',min:120,max:180,stat:'maxHp'},{id:'spirit',name:'SP สูงสุด',min:30,max:50,stat:'maxSp'}],lines:['ฮีลสมาชิกปาร์ตี้ด้วยน้ำค้างบัวหรือสกิล สร้างแอ่งฟื้นฟูรัศมี 2 เมตร นาน 3 วินาที ฟื้น 1% Max HP ผู้สวมต่อวินาทีให้สมาชิกปาร์ตี้ในแอ่ง · คูลดาวน์ 12 วินาที','ดาเมจตรงของผู้สวมลด 6%','Unique ไม่มีช่องการ์ด']},
 unique_tide_crown: { name:'มงกุฎแอ่งน้ำ', level:5, rolls:[{id:'life',name:'HP สูงสุด',min:30,max:50,stat:'maxHp'},{id:'medicine',name:'ประสิทธิภาพยา HP (%)',min:8,max:12}],
  lines:['ใช้ยา HP แล้วสร้างแอ่งฟื้นฟูรัศมี 2 เมตร นาน 3 วินาที ฟื้น 6 HP/วินาทีให้ผู้สวมที่อยู่ในแอ่ง · คูลดาวน์ 12 วินาที','ยา HP/SP ของผู้สวมมีคูลดาวน์เพิ่ม 2 วินาที','Unique ไม่มีช่องการ์ด'] },
 unique_mist_weaver: { name:'ถุงมือทอหมอก', level:10, rolls:[{id:'accuracy',name:'ความแม่นยำ',min:8,max:14,stat:'hit'},{id:'venom',name:'พลังพิษของถุงมือ (%)',min:10,max:15}],
  lines:['โจมตีปกติโดนเป้าหมายเดิมครบ 3 ครั้งภายใน 5 วินาที ทำให้ติดพิษ 4 วินาที · คูลดาวน์ 4 วินาที','พิษสร้าง 12% ของ ATK ต่อวินาที (ก่อนโบนัสพิษ) · รีเฟรชแทนการซ้อน · บอสรับครึ่งหนึ่ง','ดาเมจตรงของการโจมตีปกติลด 8%','Unique ไม่มีช่องการ์ด'] },
} as const;
export const STARTER_CARD_TEXT: Record<string,string[]> = {
 ...ENDGAME_CARD_TEXT,
 card_yokai_01:['หลบวงเตือนที่ล็อกเป้าคุณสำเร็จ ฟื้น SP 2 หน่วย · คูลดาวน์ 8 วินาที'],
 card_yokai_rain_umbrella:['ระยะเวลาของ Slow สั้นลง 10% และลดดาเมจลมที่รับ 3%'],
 card_yokai_03:['โจมตีจากด้านข้างของศัตรู เพิ่ม HIT 12'],
 card_yokai_bamboo_kodama:['โจมตีศัตรูที่กำลังตั้งท่าโจมตี เพิ่ม HIT 12'],
 card_yokai_rain_nue:['หลบวงเตือนที่ล็อกเป้าคุณ 2 ครั้งใน 6 วินาที เพิ่มคริติคอล 3% นาน 3 วินาที · คูลดาวน์ 12 วินาที'],
 card_yokai_06:['หลบวงเตือนที่ล็อกเป้าคุณสำเร็จ สกิลโจมตีที่ใช้ SP ถัดไปภายใน 5 วินาทีใช้ SP ลด 5% · คูลดาวน์ 10 วินาที · สกิลสนับสนุนไม่ใช้สิทธิ์'],
 card_yokai_lantern_rokurokubi:['ตัดท่าศัตรูที่อยู่ไกลกว่า 2 เมตรสำเร็จ ฟื้น SP 3 หน่วย · คูลดาวน์ 10 วินาที'],
 card_yokai_08:['ตัดท่าสำเร็จ 2 ครั้ง ฮิตแรกที่โดนของสกิลโจมตีถัดไปที่ใช้ SP อย่างน้อย 15 และพลังพื้นฐาน 120% ขึ้นไปแรงขึ้น 8% ภายใน 5 วินาที · คูลดาวน์ 15 วินาที · สะสมสูงสุด 2 ครั้ง'],
 card_frost_01:['รับการโจมตีตรงขณะ Guard ลดดาเมจกายภาพที่รับ 3% นาน 3 วินาที · คูลดาวน์ 10 วินาที'],
 card_frost_rune_raven:['ใช้สกิล Guard, Endure, Heal หรือ Taunt สำเร็จ สกิลที่ใช้ SP ครั้งถัดไปภายใน 5 วินาทีใช้ SP ลด 5% · คูลดาวน์ 8 วินาที · โจมตีปกติไม่ใช้สิทธิ์'],
 card_frost_03:['หลังสังหารมอนธรรมชาติ ตีปกติโดนเป้าหมายอื่นภายใน 5 วินาที เคลื่อนที่เร็วขึ้น 10% นาน 2 วินาที · คูลดาวน์ 8 วินาที · ไม่นับสิ่งเรียก'],
 card_frost_ice_lindworm:['ลดความเสียหายเลือดไหลที่รับ 10%'],
 card_frost_winter_wavehorse:['รับดาเมจน้ำแล้วเคลื่อนที่เร็วขึ้น 10% นาน 2 วินาที · คูลดาวน์ 10 วินาที'],
 card_frost_06:['พ้นการต่อสู้ 5 วินาที ฟื้น HP 0.2% Max HP ต่อวินาทีขณะหยุดนิ่ง'],
 card_frost_fractured_valkyrie:['รับการโจมตีตรงขณะ Guard ครบ 3 ครั้ง ตีปกติถัดไปภายใน 5 วินาทีฟื้น SP 3 หน่วย · คูลดาวน์ 8 วินาที'],
 card_frost_08:['รับท่าหนักของบอสขณะ Guard ให้เกราะเพื่อนในปาร์ตี้ที่อยู่ในระยะ 6 เมตร สูงสุด 3 คน คนละ 2% Max HP นาน 3 วินาที · คูลดาวน์ 15 วินาที · ไม่รวมตัวเอง'],
 card_desert_01:['ทำลายสิ่งเรียกสำเร็จ ฟื้น HP 1% Max HP · คูลดาวน์ 10 วินาที · ไม่เกิดจากสิ่งเรียกหมดอายุเอง'],
 card_desert_oasis_hawk:['หลบการโจมตีระยะไกลด้วยค่า FLEE หรือช่วงอมตะของ Dash เพิ่ม HIT 10 นาน 3 วินาที · คูลดาวน์ 8 วินาที'],
 card_desert_03:['ตีปกติโดนศัตรูติดช้า มีโอกาส 10% ทำเลือดไหล 3% ATK/วินาที นาน 3 วินาที (บอสรับครึ่งหนึ่ง) · คูลดาวน์ 8 วินาที · รีเฟรชแทนซ้อน'],
 card_desert_sand_ushabti:['โจมตีตรงใส่ศัตรูที่มีเกราะกายภาพ เพิ่มดาเมจ 5% ต่อใบ · ความเร็วโจมตีลด 2% ต่อใบ'],
 card_desert_seal_mummy:['ระยะเวลาที่ถูกตรึงด้วยสถานะ Slow 95% ขึ้นไปสั้นลง 15% · ไม่เพิ่มความเร็วของ Slow ทั่วไป'],
 card_desert_06:['ตัดท่าสำเร็จ ตีปกติถัดไปภายใน 5 วินาทีเจาะเกราะกายภาพ 6% · คูลดาวน์ 10 วินาที'],
 card_desert_glass_scorpion:['ตีปกติเป้าหมายเดิมครบ 4 ครั้ง โดยห่างกันไม่เกิน 5 วินาที ลดเกราะกายภาพ 4% นาน 3 วินาที · คูลดาวน์ 10 วินาที · ไม่ทับเอฟเฟกต์ที่แรงกว่า'],
 card_desert_08:['โจมตีตรงสลับกายภาพ–เวท–กายภาพ หรือ เวท–กายภาพ–เวท สำเร็จภายใน 5 วินาที ดาเมจตรงเพิ่ม 5% นาน 3 วินาที · คูลดาวน์ 15 วินาที · พิษและสะท้อนไม่นับ'],
 card_himmapan_01:['ฮีลเพื่อนในปาร์ตี้แล้วฟื้น SP เพิ่ม 0.2/วินาที นาน 3 วินาที · คูลดาวน์ 8 วินาที'],
 card_himmapan_jade_turtle:['ยืนนิ่งครบ 2 วินาที ลดดาเมจน้ำ 8% จนเริ่มเคลื่อนที่'],
 card_himmapan_03:['รับดาเมจน้ำแล้วได้เกราะ 2% Max HP นาน 3 วินาที · คูลดาวน์ 10 วินาที'],
 card_himmapan_blossom_deer:['ฮีลเพื่อนในปาร์ตี้ที่ HP ต่ำกว่า 40% ได้ผลเพิ่ม 8% · คูลดาวน์ 8 วินาที'],
 card_himmapan_golden_macaque:['ใช้ยา SP แล้วเคลื่อนที่เร็วขึ้น 10% นาน 2 วินาที · คูลดาวน์ 10 วินาที'],
 card_himmapan_06:['หลบวงเตือนบอสหรือหิมพานต์แล้วตีปกติครั้งถัดไปแรงขึ้น 8% ภายใน 5 วินาที · คูลดาวน์ 8 วินาที'],
 card_himmapan_azure_garuda:['ตัดท่าศัตรูสำเร็จแล้วให้เกราะ 2% Max HP นาน 3 วินาทีแก่เพื่อนในปาร์ตี้ใกล้ที่สุดใน 6 เมตร · คูลดาวน์ 10 วินาที'],
 card_himmapan_08:['ล้างสถานะให้เพื่อนในปาร์ตี้แล้วให้เกราะสมาชิกใกล้ตัวสูงสุด 3 คน คนละ 2% Max HP นาน 3 วินาที · คูลดาวน์ 15 วินาที'],
 card_greek_satyr:['ฟื้น SP ตามธรรมชาติเพิ่ม 0.2 หน่วย/วินาที'],
 card_greek_harpy:['ลดดาเมจธาตุลมที่ได้รับ 10%'],
 card_greek_gorgon:['ฟื้นตัวจากสถานะช้าเร็วขึ้น 20%'],
 card_greek_minotaur:['ดาเมจต่อมอนสเตอร์ขนาดใหญ่เพิ่ม 10%'],
 card_lotus_rabbit:['หลังรับดาเมจ เคลื่อนที่เร็วขึ้น 20% นาน 2 วินาที · คูลดาวน์ 8 วินาที'],
 card_dew_beetle:['รับการโจมตีขณะใช้ Guard ฟื้น 5 HP · คูลดาวน์ 6 วินาที'],
 card_dewdrop_moth:['หลังเวทโดนเป้าหมาย ดาเมจเวทเพิ่ม 5% นาน 3 วินาที · ไม่สะสม'],
 card_pine_hedgehog:['รับการตีประชิด สะท้อน 4 ดาเมจ · คูลดาวน์ 3 วินาที'],
 card_tile_sparrow:['HIT +15 เมื่อโจมตีศัตรูที่ HP เต็ม'],
 card_clay_pot_doll:['ยืนนิ่งครบ 2 วินาที ลดดาเมจที่ได้รับ 8% จนเริ่มเคลื่อนที่'],
 card_oretail_lizard:['ฟื้นตัวจากสถานะช้าเร็วขึ้น 25%'],
 card_iron_pincer_crab:['ตัดจังหวะท่าศัตรูด้วย Stun/Knockup แล้วตีปกติแรงขึ้น 15% หนึ่งครั้งใน 5 วินาที · คูลดาวน์ 8 วินาที'],
 card_mist_shroom:['ฟื้นตัวจากพิษเร็วขึ้น 25%'],
 card_root_boar:['ตีปกติทำให้เลือดไหล 2 ดาเมจ/วินาที นาน 4 วินาที หากเป้าหมายเลือดไหลอยู่แล้ว ฟื้น 2 SP · คูลดาวน์ 3 วินาที'],
 card_mist_weaver:['ฟื้นตัวจากใยตรึงเร็วขึ้น 30%'],
 card_thorn_nest_mother:['ฆ่าศัตรูติดพิษ กระจายพิษ 3 ดาเมจ/วินาที นาน 3 วินาที ในรัศมี 3 สูงสุด 5 ตัว · คูลดาวน์ 8 วินาที · ไม่ต่อโซ่'],
 card_jelly_pink:['หลังรับดาเมจและยังมีชีวิต ฟื้น 6 HP · คูลดาวน์ 8 วินาที'],
 card_king_jelly:['ใช้ยา HP ได้เกราะ 20 หน่วยนาน 4 วินาที · คูลดาวน์ 12 วินาที'],
 card_bud_shroom:['ยาฟื้น SP ฟื้นเพิ่ม 15%'],
 card_clay_puff:['พ้นการต่อสู้ 5 วินาที ฟื้นเพิ่ม 2 HP/วินาที'],
 card_pebble_puff:['โจมตีปกติโดนศัตรูที่ HP เต็ม ดาเมจเพิ่ม 10% · คูลดาวน์ 8 วินาที'],
 card_shade_wolf:['โจมตีปกติคริติคอล ฟื้น 3 SP · คูลดาวน์ 6 วินาที'],
};
export const starterUnique = (id:string) => STARTER_UNIQUES[id as keyof typeof STARTER_UNIQUES];
export const isRolledTemplate = (id:string) => id.startsWith('field_') || !!starterUnique(id);
export function affixRange(a:Affix,level:number) {const extra=Math.floor((level-1)*a.perLevel);return {min:a.min+extra,max:a.max+extra};}
export function rollEquipment(template:string, level:number, data:GameData, rng:()=>number, quality?:'magic'|'rare'): ItemRoll | undefined {
 if(!isRolledTemplate(template))return;
 const t=data.items.items.find(t=>t.id===template);if(!t?.slot)throw Error('ไม่พบฐานอุปกรณ์');
 const itemLevel=starterUnique(template)?.level??Math.max(t.level,Math.min(100,Math.floor(level)));
 const pick=(min:number,max:number)=>min+Math.floor(Math.max(0,Math.min(.999999999,rng()))*(max-min+1));
 const unique=starterUnique(template);
 if(unique)return {version:1,itemLevel,quality:'unique',affixes:unique.rolls.map(a=>({id:a.id,value:pick(a.min,a.max)}))};
 const q=quality??(rng()<.7?'magic':'rare'), limit=q==='magic'?1:3;
 const count=q==='magic'?pick(1,2):pick(3,itemLevel<6?4:6);
 const affixes:ItemRoll['affixes']=[],sides={prefix:0,suffix:0};
 // Filter new weapon rolls only; legacy off-build rolls still validate unchanged.
 const excludedDamageAffix=t.type==='weapon'?((t.matk??0)>(t.atk??0)?'force':'arcane'):undefined;
 for(let i=0;i<count;i++){
  const pool=STARTER_AFFIXES.filter(a=>a.types.includes(t.type)&&a.id!==excludedDamageAffix&&sides[a.side]<limit&&!affixes.some(v=>v.id===a.id));
  const a=pool[pick(0,pool.length-1)],range=affixRange(a,itemLevel);sides[a.side]++;
  affixes.push({id:a.id,value:pick(range.min,range.max)});
 }
 return {version:1,itemLevel,quality:q,affixes};
}
/** Validates stored values; pickup never rerolls or accepts client-provided rolls. */
export function validateItemRoll(template:string, value:unknown, data:GameData):ItemRoll {
 const roll=ItemRollSchema.parse(value),t=data.items.items.find(t=>t.id===template),unique=starterUnique(template);
 if(!t?.slot||!isRolledTemplate(template)||roll.itemLevel<t.level)throw Error('ออฟไม่ตรงอุปกรณ์');
 const ids=new Set<string>(),sides={prefix:0,suffix:0};
 if(unique){
  if(roll.quality!=='unique'||roll.affixes.length!==unique.rolls.length)throw Error('ข้อมูล Unique ไม่ครบ');
  for(const a of roll.affixes){const def=unique.rolls.find(d=>d.id===a.id);if(!def||ids.has(a.id)||!Number.isInteger(a.value)||a.value<def.min||a.value>def.max)throw Error('ค่า Unique ไม่ถูกต้อง');ids.add(a.id);}
 }else{
  if(roll.quality==='unique'||roll.affixes.length<(roll.quality==='magic'?1:3)||roll.affixes.length>(roll.quality==='magic'?2:roll.itemLevel<6?4:6))throw Error('จำนวนออฟไม่ถูกต้อง');
  for(const a of roll.affixes){const def=STARTER_AFFIXES.find(d=>d.id===a.id);if(!def||!def.types.includes(t.type)||ids.has(a.id))throw Error('ชนิดออฟไม่ถูกต้อง');const range=affixRange(def,roll.itemLevel);if(!Number.isInteger(a.value)||a.value<range.min||a.value>range.max||++sides[def.side]>(roll.quality==='magic'?1:3))throw Error('ค่าออฟไม่ถูกต้อง');ids.add(a.id);}
 }
 return roll;
}
export function rolledModifiers(item:Pick<OwnedItem,'template'|'roll'>):Modifier[]{
 if(!item.roll)return [];
 const unique=starterUnique(item.template);
 return item.roll.affixes.flatMap(a=>{
  if(unique){const def=unique.rolls.find(d=>d.id===a.id);return def&&'stat' in def?[{kind:'flat' as const,stat:def.stat,value:a.value}]:[];}
  // Stored integers are unchanged: crit adds percentage points; attack speed is relative percent.
  const def=STARTER_AFFIXES.find(d=>d.id===a.id);return def?[{kind:def.percent?'percent' as const:'flat' as const,stat:def.stat,value:(def.percent||def.stat==='crit'?a.value/100:a.value)*(def.reduction?-1:1)}]:[];
 });
}
export function itemRollLines(item:Pick<OwnedItem,'template'|'roll'>):string[]{
 const unique=starterUnique(item.template),r=item.roll;
 return [...(r?[`${r.quality==='unique'?'Unique':r.quality==='rare'?'Rare':'Magic'} · ระดับไอเทม ${r.itemLevel}`,...r.affixes.map(a=>{const def=unique?.rolls.find(d=>d.id===a.id)??STARTER_AFFIXES.find(d=>d.id===a.id);if(!def)return '';const range=unique?def:affixRange(def as Affix,r.itemLevel);return `${'side' in def?(def.side==='prefix'?'Prefix':'Suffix')+' · ':''}${def.name} ${'reduction' in def&&def.reduction?'-':'+'}${a.value} [${range.min}–${range.max}]`;})]:[]),...(unique?.lines??[])];
}
export function ownedRarity(item:Pick<OwnedItem,'roll'>|undefined,fallback:'common'|'fine'|'rare'|'epic'|'legendary'){return item?.roll?(item.roll.quality==='unique'?'legendary':item.roll.quality==='rare'?'rare':'fine'):fallback;}

/** Starter rolls keep their original requirements; new regional rolls require their rolled level. */
export const requiredEquipmentLevel=(templateLevel:number,item?:Pick<OwnedItem,'roll'>)=>Math.max(templateLevel,(item?.roll?.itemLevel??1)>10?item!.roll!.itemLevel:1);
