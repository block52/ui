import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Use the time bank (ui#19): submit the engine's `time-bank` action for the
 * table. The engine records it without advancing the turn and moves this
 * player's deadline out by `gameOptions.timeBankMs`, once per decision, while
 * they have bank left. It rejects the action otherwise. Every client derives
 * the longer countdown from the recorded action (`utils/turnClock.ts`), so there
 * is no local timer to extend.
 *
 * @param tableId - The ID of the table (game ID on Cosmos)
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function timeBank(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.TIME_BANK, 0n, network);
}
