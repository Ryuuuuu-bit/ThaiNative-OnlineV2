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
import type { Character, Progress } from './types.js';
export type QuestProgress = Pick<Progress, 'level' | 'xp' | 'jobLevel' | 'jobExp' | 'skillPoints' | 'statPoints' | 'baseStats' | 'autoAllocCursor' | 'quests'>;
export interface EconomyResult {
	inventory: Inventory;
	gold: number;
	effect?: { kind: string; amount: number };
	error?: string;
	duplicate?: boolean;
}
export interface EconomyContext {
	/** Server-staged quest completion, committed with its rewards under the character lock. */
	quest?: { id: string; acceptedAt: number; progress: QuestProgress };
	leaseOwner?:string;bossLoot?:boolean|string;profile: CharacterInput;
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
export function questProgress(character: Character, context: EconomyContext): QuestProgress | undefined {
	const quest = context.quest;
	if (!quest) return;
	if (character.quests?.active[quest.id]?.at !== quest.acceptedAt ||
		!quest.progress.quests?.done[quest.id] || quest.progress.quests.active[quest.id])
		throw Error('Quest turn-in is no longer active');
	return structuredClone(quest.progress);
}
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
