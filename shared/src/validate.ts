import { schemas, type GameData } from "./schema.js";
export const dataFiles = Object.keys(schemas) as (keyof GameData)[];
export function validateGameData(raw: Record<string, unknown>): GameData {
	const data = {} as GameData;
	for (const name of dataFiles) {
		const parsed = schemas[name].safeParse(raw[name]);
		if (!parsed.success)
			throw new Error(
				`${name}.json: ${parsed.error.issues.map((e) => `${e.path.join(".") || "<root>"}: ${e.message}`).join("; ")}`,
			);
		Object.assign(data, { [name]: parsed.data });
	}
	for (const name of [
		"classes",
		"items",
		"cards",
		"skills",
		"monsters",
	] as const) {
		const entries = (data[name] as unknown as Record<string, { id: string }[]>)[
			name
		];
		if (new Set(entries.map((e) => e.id)).size !== entries.length)
			throw new Error(`${name}.json: ${name}: duplicate id`);
	}
	const build = data.stats.defaultBuild;
	for (const name of ["races", "status"] as const) {
		const entries =
			name === "races" ? data.races.players : data.status.statuses;
		if (new Set(entries.map((e) => e.id)).size !== entries.length)
			throw new Error(
				`${name}.json: ${name === "races" ? "players" : "statuses"}: duplicate id`,
			);
	}
	for (const [index, band] of data.stats.pointCosts.entries())
		if (
			band.min !== index * 10 + 1 ||
			band.max !== Math.min(99, (index + 1) * 10) ||
			band.cost !== index + 2
		)
			throw new Error(
				`stats.json: pointCosts.${index}: expected contiguous monotonic 1–99 bands`,
			);
	for (const race of data.races.players)
		if (Object.values(race.bonus).reduce((a, b) => a + b, 0) !== 6)
			throw new Error(
				`races.json: players.${data.races.players.indexOf(race)}.bonus: total must be +6`,
			);
	for (const [index, item] of data.items.items.entries())
		if (item.type === "weapon" && (!item.weaponType || !item.interval))
			throw new Error(
				`items.json: items.${index}: weapon requires weaponType and interval`,
			);
	for (const [index, monster] of data.monsters.monsters.entries())
		for (const drop of monster.drops)
			if (
				!data.items.items.some((i) => i.id === drop.itemId) &&
				!data.cards.cards.some((c) => c.id === drop.itemId)
			)
				throw new Error(
					`monsters.json: monsters.${index}.drops: unknown item ${drop.itemId}`,
				);
	for (const [file, ok, path] of [
		[
			"stats",
			data.races.players.some((r) => r.id === build.race),
			"defaultBuild.race",
		],
		[
			"stats",
			data.classes.classes.some((c) => c.id === build.classId),
			"defaultBuild.classId",
		],
		[
			"stats",
			build.equipment.every((id) => data.items.items.some((i) => i.id === id)),
			"defaultBuild.equipment",
		],
	] as const)
		if (!ok) throw new Error(`${file}.json: ${path}: unknown reference`);
	return data;
}
