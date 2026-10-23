import type { GameData, Modifier } from "@the-beginning-online/shared";
import {STARTER_CARD_TEXT} from '@the-beginning-online/shared';

const STAT: Record<string, string> = { str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", luk: "LUK" };
const DERIVED: Record<string, string> = { maxHp: "HP สูงสุด", maxSp: "SP สูงสุด", atk: "พลังโจมตี", matk: "พลังเวท", hardDef: "เกราะ", hardMdef: "เกราะเวท", softDef:'ป้องกันกายภาพ',softMdef:'ป้องกันเวท', hit: "ความแม่น", flee: "หลบหลีก", crit: "คริติคอล",critShield:'ต้านคริติคอล',aspd:'ความเร็วโจมตี',moveSpeed:'ความเร็วเดิน',castMul:'เวลาร่าย',weight:'น้ำหนักสูงสุด',hpRegen:'ฟื้น HP',spRegen:'ฟื้น SP' };
const RACE: Record<string, string> = { formless: "ไร้รูปร่าง", brute: "สัตว์", plant: "พืช", insect: "แมลง", demon: "ปีศาจ", undead: "อันเดด", fish: "สัตว์น้ำ", dragon: "มังกร", angel: "เทวดา", demihuman: "มนุษย์" };
const ELEMENT: Record<string, string> = { neutral: "ไร้ธาตุ", water: "น้ำ", earth: "ดิน", fire: "ไฟ", wind: "ลม", holy: "ศักดิ์สิทธิ์", dark: "มืด", ghost: "วิญญาณ", poison: "พิษ", undead: "อมตะ" };
export const modifierPercent = (m: Modifier) => m.kind === 'percent' || ('target' in m) || (m.kind === 'flat' && ['crit','critShield','castMul'].includes(m.stat));
export const modifierNumber = (value: number, percent = false) => `${Number((value * (percent ? 100 : 1)).toFixed(2)).toLocaleString('en-US')}${percent ? '%' : ''}`;
export function modifierLabel(m: Modifier): string {
 switch(m.kind){
  case 'stat': return STAT[m.stat] ?? m.stat;
  case 'flat': case 'percent': return DERIVED[m.stat] ?? m.stat;
  case 'raceBonus': return `ดาเมจต่อ${RACE[m.target] ?? m.target}`;
  case 'raceResist': return `ต้านทาน${RACE[m.target] ?? m.target}`;
  case 'elementBonus': return `ดาเมจต่อธาตุ${ELEMENT[m.target] ?? m.target}`;
  case 'elementResist': return `ต้านธาตุ${ELEMENT[m.target] ?? m.target}`;
  case 'sizeBonus': return `ดาเมจต่อขนาด ${m.target}`;
  case 'statusResist': return `ต้านทานสถานะ ${m.target}`;
  case 'weaponElement': return `ธาตุอาวุธ: ${ELEMENT[m.element] ?? m.element}`;
  case 'armourElement': return `ธาตุเกราะ: ${ELEMENT[m.element] ?? m.element}`;
  case 'ignoreSize': return m.value ? 'ไม่รับโทษจากขนาดเป้าหมาย' : '';
 }
}

/** One short Thai line per card effect, e.g. "VIT +1", "ดาเมจต่อไร้รูปร่าง +20%". */
export function modifierText(m: Modifier): string {
 const label=modifierLabel(m);
 return 'value' in m && typeof m.value === 'number' ? `${label} ${m.value >= 0 ? '+' : ''}${modifierNumber(m.value,modifierPercent(m))}` : label;
}
export function cardEffects(data: GameData, cardId: string) {
	return [...(data.cards.cards.find((c) => c.id === cardId)?.modifiers ?? []).map(modifierText).filter(Boolean),...(STARTER_CARD_TEXT[cardId]??[])].join(" · ");
}
