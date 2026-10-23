import { withMoneyMoverRetry } from "../../utils/cosmos/client";
import { getLatestGameState } from "./transportAction";
import { finishingOrderFromState } from "../../utils/cosmos/settlementTx";
import type { NetworkEndpoints } from "../../context/NetworkContext";

export interface ClaimWinningsResult {
    hash: string;
    gameId: string;
}

/**
 * Claim a decided SNG/Tournament prize.
 *
 * Distinct from leaveTable: once a tournament starts the roster is frozen —
 * players do NOT leave. A finisher instead CLAIMS their prize-pool payout with a
 * direct MsgLeaveGame (the chain's leaveGameSNG claim handler: looks up the
 * caller's result, transfers, marks claimed), signed by the claiming player's
 * own funded account.
 *
 * The chain already holds the results: the engine writes them into the stored
 * state on the action that busts each finisher (poker-vm#2566). The claim must
 * NOT push the local state to the chain (MsgRecordHandEnd) — the local state is
 * the masked client view (deck and other players' cards are "X"), and storing it
 * mid-tournament bricks the table for everyone still playing (ui#869,
 * pokerchain#436).
 *
 * @throws if the wallet is not initialized or the chain rejects the settle.
 */
export async function claimWinnings(tableId: string, network: NetworkEndpoints): Promise<ClaimWinningsResult> {
    const state = getLatestGameState();

    // Pass the place-1-first finishingOrder (SDK 1.2.16; empty for a
    // non-finished state). Retry once on a sequence mismatch (ui#530 follow-up).
    const hash = await withMoneyMoverRetry(network, ({ signingClient }) =>
        signingClient.leaveGame(tableId, finishingOrderFromState(state))
    );
    return { hash, gameId: tableId };
}
