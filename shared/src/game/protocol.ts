import { z } from "zod";
const seq = z.number().int().nonnegative().max(2147483647),
	point = z.number().finite().min(-10000).max(10000);
export const IntentSchema = z.discriminatedUnion("t", [
	z.object({t:z.literal('stats'),add:z.object({str:z.number().int().min(0).max(99).optional(),agi:z.number().int().min(0).max(99).optional(),vit:z.number().int().min(0).max(99).optional(),int:z.number().int().min(0).max(99).optional(),dex:z.number().int().min(0).max(99).optional(),luk:z.number().int().min(0).max(99).optional()}).strict(),seq}).strict(),
	z.object({t:z.literal('statsReset')}).strict(),
	z.object({t:z.literal('autoAlloc'),on:z.boolean()}).strict(),
	z.object({ t: z.literal("hello") }).strict(),
	z.object({ t: z.literal("spawnReady") }).strict(),
	z.object({ t: z.literal("move"), x: point, z: point, seq }).strict(),
	z.object({ t: z.literal("steer"), dx: point, dz: point, seq }).strict(),
	z
		.object({
			t: z.literal("act"),
			a: z.enum(["attack", "spin", "meteor", "dash", "potion"]),
			target: z.number().int().positive().optional(),
			seq,
		})
		.strict(),
	z.object({ t: z.literal("auto"), on: z.boolean() }).strict(),
	z
		.object({ t: z.literal("target"), id: z.number().int().positive() })
		.strict(),
	z.object({ t: z.literal("revive") }).strict(),
	z.object({ t: z.literal("ping"), c: z.number().finite() }).strict(),
]);
export type Intent = z.infer<typeof IntentSchema>;
