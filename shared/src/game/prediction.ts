import { predictMovement } from "./movement.js";
import type { Vec } from "./sim.js";
export interface PendingMovement {
	seq: number;
	input: Vec;
	dt: number;
	speed: number;
}
export function reconcileMovement(
	authoritative: Vec,
	predicted: Vec,
	ack: number,
	pending: PendingMovement[],
) {
	const remaining = pending.filter((p) => p.seq > ack);
	let position = { ...authoritative };
	for (const p of remaining)
		position = predictMovement(position, p.input, p.dt, p.speed);
	const error = Math.hypot(predicted.x - position.x, predicted.z - position.z);
	return { position, pending: remaining, error, snap: error > 1.5 };
}
