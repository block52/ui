import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { executeTransportAction } from "./transportAction";

/**
 * Start a scheduled sit-and-go with the players registered (poker-vm#2680).
 * Any registered player may send it once the engine offers "start" in their
 * legal actions: the start time has passed and at least minPlayers are seated.
 */
export async function startTournament(tableId: string, network: NetworkEndpoints): Promise<PlayerActionResult> {
    return executeTransportAction(tableId, NonPlayerActionType.START, 0n, network);
}
