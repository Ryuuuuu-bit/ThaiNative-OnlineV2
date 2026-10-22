import type { GameData, Modifier } from "@the-beginning-online/shared";
import {STARTER_CARD_TEXT} from '@the-beginning-online/shared';

const STAT: Record<string, string> = { str: "STR", agi: "AGI", vit: "VIT", int: "INT", dex: "DEX", luk: "LUK" };
const DERIVED: Record<string, string> = { maxHp: "HP สูงสุด", maxSp: "SP สูงสุด", atk: "พลังโจมตี", matk: "พลังเวท", hardDef: "เกราะ", hardMdef: "เกราะเวท", hit: "ความแม่น", flee: "หลบหลีก", crit: "คริติคอล" };
const RACE: Record<string, string> = { formless: "ไร้รูปร่าง", brute: "สัตว์", plant: "พืช", insect: "แมลง", demon: "ปีศาจ", undead: "อันเดด", fish: "สัตว์น้ำ", dragon: "มังกร", angel: "เทวดา", demihuman: "มนุษย์" };
const ELEMENT: Record<string, string> = { neutral: "ไร้ธาตุ", water: "น้ำ", earth: "ดิน", fire: "ไฟ", wind: "ลม", holy: "ศักดิ์สิทธิ์", dark: "มืด", ghost: "วิญญาณ", poison: "พิษ", undead: "อมตะ" };
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** One short Thai line per card effect, e.g. "VIT +1", "ดาเมจต่อไร้รูปร่าง +20%". */
export function modifierText(m: Modifier): string {
	switch (m.kind) {
		case "stat": return `${STAT[m.stat] ?? m.stat} +${m.value}`;
		case "flat": return `${DERIVED[m.stat] ?? m.stat} +${m.value}`;
		case "percent": return `${DERIVED[m.stat] ?? m.stat} +${pct(m.value)}`;
		case "raceBonus": return `ดาเมจต่อ${RACE[m.target] ?? m.target} +${pct(m.value)}`;
		case "raceResist": return `ต้านทาน${RACE[m.target] ?? m.target} ${pct(m.value)}`;
		case "elementBonus": return `ดาเมจต่อธาตุ${ELEMENT[m.target] ?? m.target} +${pct(m.value)}`;
		case "elementResist": return `ต้านธาตุ${ELEMENT[m.target] ?? m.target} ${pct(m.value)}`;
		case "sizeBonus": return `ดาเมจต่อขนาด ${m.target} +${pct(m.value)}`;
		case "statusResist": return `ต้านทานสถานะ ${m.target} ${pct(m.value)}`;
		default: return "";
	}
}
export function cardEffects(data: GameData, cardId: string) {
	return [...(data.cards.cards.find((c) => c.id === cardId)?.modifiers ?? []).map(modifierText).filter(Boolean),...(STARTER_CARD_TEXT[cardId]??[])].join(" · ");
}
