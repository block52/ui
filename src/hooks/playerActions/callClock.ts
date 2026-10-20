import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Call the clock on the player to act (ui#819): submit the engine's `timeout`
 * action for the table. The engine re-derives the turn deadline from committed
 * state and plays the stalled player's forced default AS them — or rejects the
 * action while their turn has time left. The caller decides nothing but when
 * to ask; see `utils/turnClock.ts` for when.
 *
 * @param tableId - The ID of the table (game ID on Cosmos)
 * @param network - The current network configuration from NetworkContext
 * @returns Promise with PlayerActionResult containing transaction details
 * @throws Error if Cosmos wallet is not initialized or if the action fails
 */
export async function callClock(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.TIMEOUT, 0n, network);
}
