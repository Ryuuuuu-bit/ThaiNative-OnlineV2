import economy from "../data/economy.json" with {type:"json"};
import jobs from "../data/jobs.json" with {type:"json"};
import stats from "../data/stats.json" with { type: "json" };
import elements from "../data/elements.json" with { type: "json" };
import races from "../data/races.json" with { type: "json" };
import classes from "../data/classes.json" with { type: "json" };
import skills from "../data/skills.json" with { type: "json" };
import monsters from "../data/monsters.json" with { type: "json" };
import status from "../data/status.json" with { type: "json" };
import pvp from "../data/pvp.json" with { type: "json" };
import items from "../data/items.json" with { type: "json" };
import cards from "../data/cards.json" with { type: "json" };
import type { GameData } from "./schema.js";
import { validateGameData } from "./validate.js";
export { validateGameData } from "./validate.js";
/** Browser entry: no Node APIs; Vite bundles these static JSON imports. */
export function loadGameData(): GameData {
	return validateGameData({
		economy,jobs,stats,
		elements,
		races,
		classes,
		skills,
		monsters,
		status,
		pvp,
		items,
		cards,
	});
}
