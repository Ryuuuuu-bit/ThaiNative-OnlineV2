import skills from "../../data/skills.json" with { type: "json" };
import type { Action } from "./sim.js";
export const ACTION_SKILLS: Record<Action, string> = {
	attack: "basic",
	spin: "whirlwind",
	meteor: "meteor",
	dash: "dodge",
	potion: "potion",
};
export const CD = Object.fromEntries(
	Object.entries(ACTION_SKILLS).map(([action, id]) => [
		action,
		skills.skills.find((s) => s.id === id)!.cooldown,
	]),
) as Record<Action, number>;
