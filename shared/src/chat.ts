/** Chat text policy shared by the server (authoritative) and the client (preview). */
export const CHAT_MAX = 120;
export type ChatChannel = "map" | "party" | "whisper" | "system";

// Strong insults only. Common casual pronouns (กู/มึง) are left alone on purpose.
const BLOCKED = [
	"ควย", "เหี้ย", "สัส", "สัด", "เย็ด", "หี", "แม่ง", "ระยำ", "จัญไร", "ชาติหมา", "อีดอก", "อีตอแหล", "ไอ้สัตว์", "ส้นตีน", "พ่อมึงตาย", "แม่มึงตาย",
	"fuck", "shit", "bitch", "cunt", "asshole", "dick", "pussy", "nigger", "nigga", "faggot", "retard", "whore", "slut",
];
// Innocent words that contain a blocked spelling.
const ALLOWED = ["หีบ", "สัดส่วน", "แม่งาน", "แม่งู", "เหี้ยม", "scunthorpe", "dickens", "shitake", "shiitake", "cockpit"];
const RESERVED_NAMES = ["admin", "administrator", "gamemaster", "moderator", "system", "staff", "support", "official", "ระบบ", "ทีมงาน", "ผู้ดูแล", "แอดมิน", "แอดมิ่น", "จีเอ็ม", "thainative", "ไทยเนทีฟ"];
const SEP = "[\\s._\\-*~+|'\"`]*";
const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = (word: string) => new RegExp([...word].map(escape).join(SEP), "giu");
const blocked = [...new Set(BLOCKED)].map(pattern);
const allowed = [...new Set(ALLOWED)].map(w => ({ word: w, re: pattern(w) }));
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

/** Removes control/zero-width characters and collapses whitespace. */
export function cleanChat(text: string) {
	return text
		.normalize("NFC")
		.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁤﻿]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, CHAT_MAX);
}

/** Masks blocked words with ✱ while keeping allowed look-alikes intact. */
export function filterChat(text: string) {
	let out = cleanChat(text);
	const kept: string[] = [];
	for (const a of allowed) out = out.replace(a.re, m => { kept.push(m); return `\u0001${kept.length - 1}\u0001`; });
	const leet = out.split("").map(c => LEET[c.toLowerCase()] ?? c).join("");
	const marks = new Array(out.length).fill(false);
	for (const re of blocked)
		for (const source of [out, leet]) {
			re.lastIndex = 0;
			for (const m of source.matchAll(re)) for (let i = m.index!; i < m.index! + m[0].length; i++) marks[i] = true;
		}
	out = out.split("").map((c, i) => (marks[i] && !/\s/.test(c) ? "✱" : c)).join("");
	return out.replace(/\u0001(\d+)\u0001/g, (_, i) => kept[Number(i)]);
}
export const hasBlockedWord = (text: string) => filterChat(text) !== cleanChat(text);

/** Character names: no staff look-alikes and no blocked words. Returns a Thai error or null. */
export function namePolicyError(name: string) {
	// Matching only: keep the player's original spelling for display and uniqueness.
	const key = name.normalize("NFKC").toLowerCase().normalize("NFD")
		.replace(/[\u0300-\u036f\u0e47-\u0e4c]/g, "");
	const plain = [...key].map(c => LEET[c] ?? c).join("").replace(/[^\p{L}\p{M}\p{N}]/gu, "");
	const forms = [key.replace(/[^\p{L}\p{M}\p{N}]/gu, ""), plain, plain.replace(/([a-z])\1+/g, "$1")];
	const reserved = (value: string) => RESERVED_NAMES.some(r => {
		const token = r.normalize("NFD").replace(/[\u0300-\u036f\u0e47-\u0e4c]/g, "");
		const compact = token.replace(/([a-z])\1+/g, "$1");
		return value.includes(token) || (compact !== token && value.startsWith(compact));
	}) || (value.startsWith("gm") && !value.startsWith("gmail")) || value === "mod" || /^mod\d/.test(value);
	if (forms.some(reserved)) return "ชื่อนี้สงวนไว้สำหรับทีมงาน";
	const fold = (text: string) => text.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f\u0e47-\u0e4c]/g, "").replace(/([a-z])\1+/g, "$1");
	const insults = [...BLOCKED, "หำ", "แตด", "สวะ", "อีเวร", "ไอ้เวร"].map(fold);
	const inappropriate = forms.some(value => {
		let candidate = fold(value);
		for (const word of ALLOWED) candidate = candidate.split(fold(word)).join("\u0000");
		return insults.some(word => candidate.includes(word));
	});
	if (hasBlockedWord(name) || inappropriate) return "ชื่อนี้มีคำไม่เหมาะสม";
	return null;
}

export interface ChatLimiter { times: number[]; last?: string; lastAt?: number; strikes: number[]; mutedUntil?: number }
/** Anti-spam: ≥1 s apart, ≤5 per 10 s, no repeat of the same text within 15 s; 3 strikes in a minute = 60 s mute. */
export function chatAllowed(l: ChatLimiter, text: string, now: number): string | null {
	if ((l.mutedUntil ?? 0) > now) return `ถูกปิดแชทชั่วคราว อีก ${Math.ceil(((l.mutedUntil ?? 0) - now) / 1000)} วินาที`;
	l.times = l.times.filter(t => now - t < 10000);
	l.strikes = l.strikes.filter(t => now - t < 60000);
	const strike = (msg: string) => {
		l.strikes.push(now);
		if (l.strikes.length >= 3) { l.mutedUntil = now + 60000; l.strikes = []; return "ส่งข้อความถี่เกินไป ถูกปิดแชท 60 วินาที"; }
		return msg;
	};
	if (l.times.length && now - l.times[l.times.length - 1] < 1000) return strike("พิมพ์ช้าลงหน่อยนะ");
	if (l.times.length >= 5) return strike("ส่งข้อความถี่เกินไป รอสักครู่");
	const norm = text.toLowerCase().replace(/\s/g, "");
	if (l.last === norm && now - (l.lastAt ?? 0) < 15000) return strike("ข้อความซ้ำ");
	l.times.push(now);
	l.last = norm;
	l.lastAt = now;
	return null;
}
