import { z } from "zod";
const seq = z.number().int().nonnegative().max(2147483647),
	point = z.number().finite().min(-10000).max(10000);
export const IntentSchema = z.discriminatedUnion("t", [
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
