import {
	applyInventory,
	starterInventory,
	loadGameData,
	type Inventory,
	type InventoryOp,
	type CharacterInput,
	type LedgerEntry,
} from "@thainative/shared";
import { randomUUID } from "node:crypto";
export interface EconomyResult {
	inventory: Inventory;
	gold: number;
	effect?: { kind: string; amount: number };
	error?: string;
	duplicate?: boolean;
}
export interface EconomyContext {
	profile: CharacterInput;
	room?: string;
	tick?: number;
}
export interface IntegrityResult {
	ok: boolean;
	issues: string[];
}
export interface EconomyStore {
	inventory(accountId: string, id: string): Promise<EconomyResult>;
	inventoryOp(
		accountId: string,
		id: string,
		req: string,
		op: InventoryOp,
		context: EconomyContext,
	): Promise<EconomyResult>;
	integrity(): Promise<IntegrityResult>;
}
export const economyData = loadGameData();
export { applyInventory, starterInventory, randomUUID };
export type { Inventory, InventoryOp, LedgerEntry };
export function checkRequest(req: string) {
	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			req,
		)
	)
		throw Error("Invalid request UUID");
}
export function alertIntegrity(issues: string[]): IntegrityResult {
	if (issues.length) console.error("ECONOMY_ALERT", JSON.stringify(issues));
	return { ok: !issues.length, issues };
}
