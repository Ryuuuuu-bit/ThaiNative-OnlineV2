import { namePolicyError } from './chat.js';

export const CHARACTER_NAME_MIN = 2;
export const CHARACTER_NAME_MAX = 12;
export const CHARACTER_NAME_RULE = 'ชื่อยาว 2–12 ตัว ใช้อักษรไทย อังกฤษ และตัวเลข โดยไม่มีช่องว่าง';

/** Shared preview + authoritative API validation. Length counts NFC code points. */
export function characterNameError(input: unknown): string | null {
	if (typeof input !== 'string' || !input) return 'กรุณากรอกชื่อตัวละคร';
	const name = input.normalize('NFC');
	if ([...name].length < CHARACTER_NAME_MIN || [...name].length > CHARACTER_NAME_MAX) return CHARACTER_NAME_RULE;
	// Restrict marks to Thai/Latin. Inherited marks from unrelated scripts cannot hide words.
	if (/[\uff00-\uffef]/u.test(name) || !/^[\p{Script=Latin}\p{Script=Thai}0-9\u0300-\u036f]+$/u.test(name)
		|| !/^[\p{L}\p{M}\p{Nd}]+$/u.test(name)
		|| !/^[\p{L}\p{Nd}]/u.test(name)) return CHARACTER_NAME_RULE;
	if (!/\p{L}/u.test(name)) return 'ชื่อต้องมีตัวอักษรอย่างน้อย 1 ตัว';
	return namePolicyError(name);
}
