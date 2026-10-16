import { moveSliding, type Vec } from "./collision.js";
/** Shared normalized steering/collision for authoritative movement and client prediction. */
export function predictMovement(
	position: Vec,
	input: Vec,
	dt: number,
	speed = 4.5,
): Vec {
	const result = { ...position },
		length = Math.hypot(input.x, input.z),
		scale = length > 1 ? 1 / length : 1,
		time = Math.max(0, Math.min(dt, 0.1));
	moveSliding(
		result,
		input.x * scale * speed * time,
		input.z * scale * speed * time,
	);
	return result;
}
