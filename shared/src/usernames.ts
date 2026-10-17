import { namePolicyError } from './chat.js';

const RESERVED = /^(?:admin|administrator|root|system|sys|gm|gamemaster|mod|moderator|staff|support|help|official|owner|dev|developer|server|thainative|thai_native|guest|google|null|undefined|anonymous|everyone|player)(?:_?\d*)$/i;

/** Registration/linking only. Existing accounts must still be able to log in. */
export function usernamePolicyError(input: unknown): { code: string; message: string } | null {
	if (typeof input !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(input))
		return { code: 'INVALID_USERNAME', message: 'ชื่อผู้ใช้ต้องยาว 3–20 ตัว ใช้ได้เฉพาะ a–z, 0–9 และ _' };
	const policy = namePolicyError(input);
	if (RESERVED.test(input) || /^(?:admin|gm|mod|staff|thainative|system)_/i.test(input) || policy?.includes('สงวน'))
		return { code: 'USERNAME_RESERVED', message: 'ชื่อผู้ใช้นี้สงวนไว้ กรุณาเลือกชื่ออื่น' };
	if (policy) return { code: 'USERNAME_INAPPROPRIATE', message: 'ชื่อผู้ใช้มีคำไม่เหมาะสม กรุณาเลือกชื่ออื่น' };
	return null;
}
