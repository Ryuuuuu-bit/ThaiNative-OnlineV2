import { z } from 'zod';
/** Per-character auto-drink rule: drink when the bar falls below `at` percent of its maximum. */
const Rule = z.object({ on: z.boolean(), at: z.number().int().min(5).max(95) }).strict();
export const AutoPotionSchema = z.object({ hp: Rule, mp: Rule }).strict();
export type AutoPotion = z.infer<typeof AutoPotionSchema>;
export const DEFAULT_AUTO_POTION: AutoPotion = { hp: { on: false, at: 40 }, mp: { on: false, at: 30 } };
/** Saved settings from older characters (missing or malformed) fall back to the defaults. */
export function normalizeAutoPotion(value: unknown): AutoPotion {
	const parsed = AutoPotionSchema.safeParse(value);
	return parsed.success ? structuredClone(parsed.data) : structuredClone(DEFAULT_AUTO_POTION);
}
