import { readFileSync } from "node:fs";
import { dataFiles, validateGameData } from "./validate.js";
import type { GameData } from "./schema.js";
/** Reads afresh, so edits and validation failures never hide behind an import cache. */
export function loadGameData(
	directory = new URL("../data/", import.meta.url),
): GameData {
	const raw: Record<string, unknown> = {};
	for (const name of dataFiles) {
		try {
			raw[name] = JSON.parse(
				readFileSync(new URL(`${name}.json`, directory), "utf8"),
			);
		} catch (error) {
			throw new Error(
				`${name}.json: <root>: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	return validateGameData(raw);
}
