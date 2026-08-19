import { getSigningClient, withMoneyMoverRetry } from "../../utils/cosmos/client";
import { getLatestGameState } from "./transportAction";
import { finishingOrderFromState } from "../../utils/cosmos/settlementTx";
import type { NetworkEndpoints } from "../../context/NetworkContext";

export interface ClaimWinningsResult {
    hash: string;
    gameId: string;
}

/**
 * A RecordHandEnd rejection is BENIGN only when the chain already holds an
 * equal-or-more-complete finished state — i.e. another finisher already recorded
 * the results. The chain signals this with ErrStaleHandEnd ("hand-end push is
 * stale or the game is already finalized", pokerchain codespace `poker`), which
 * surfaces in the broadcast error message. In that case the results are on-chain
 * and the claim can proceed to settle.
 *
 * Every OTHER failure (network, auth/verification, malformed state, an unfunded
 * account) is FATAL: the results are NOT on-chain, so settling anyway would pay
 * nothing while showing no error. We must surface it instead. (block52/ui#503)
 */
function resultsAlreadyOnChain(err: unknown): boolean {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    // Base ErrStaleHandEnd message is appended to all its wrapped variants
    // (already-finalized / older-hand / fewer-results), so either token matches.
    return msg.includes("already finalized") || msg.includes("stale");
}

/**
 * Claim a decided SNG/Tournament prize (pokerchain#239).
 *
 * Distinct from leaveTable: once a tournament starts the roster is frozen —
 * players do NOT leave. A finisher instead CLAIMS their prize-pool payout. This:
 *   1. records the hand-end state on-chain (signingClient.recordHandEnd) so the
 *      chain has the finished results to pay from, then
 *   2. settles the prize with a direct MsgLeaveGame (the chain's leaveGameSNG
 *      claim handler: looks up the caller's result, transfers, marks claimed).
 *
 * Both are direct-to-chain, signed by the claiming player's own funded account —
 * so this works with GATEWAY_CHAIN=off and never routes an SNG cash-out through
 * the gateway (the chain rejects SNG leaves relayed as MsgPerformAction).
 *
 * @throws if the wallet is not initialized, if recording the finished hand fails
 *   for any reason other than "already on-chain", or if the chain rejects the
 *   settle.
 */
export async function claimWinnings(tableId: string, network: NetworkEndpoints): Promise<ClaimWinningsResult> {
    const { signingClient } = await getSigningClient(network);

    // 1. Deliver the finished results to the chain so the settle in step 2 has
    //    Results[] to pay from. A stale/already-finalized rejection is benign —
    //    the results are already on-chain (another finisher recorded them) — so
    //    proceed. Any other failure means the results did NOT land: surface it,
    //    because settling against absent Results silently pays nothing
    //    (block52/ui#503).
    const state = getLatestGameState();
    if (state) {
        try {
            await signingClient.recordHandEnd(tableId, JSON.stringify(state));
        } catch (err) {
            if (!resultsAlreadyOnChain(err)) {
                const detail = err instanceof Error ? err.message : String(err);
                throw new Error(`Could not record the finished hand on-chain — the prize cannot be settled yet. ${detail}`);
            }
            console.warn("[sng] recordHandEnd: results already on-chain, proceeding to settle:", err);
        }
    }

    // 2. Settle the prize (leaveGameSNG reads results + pays + marks claimed).
    //    Pass the place-1-first finishingOrder (SDK 1.2.16): if step 1's record
    //    was lossy and the chain's Results are still empty, the chain recomputes
    //    the payouts from its own prize-pool math using this ordering, rather
    //    than reverting with ErrSNGNotFinalized. Empty for a non-finished state.
    //    Retry once on a sequence mismatch: step 1's recordHandEnd is an ordered
    //    money-mover that may still be pending in the mempool, so this settle's
    //    fresh sequence query can collide with it (ui#530 follow-up).
    const hash = await withMoneyMoverRetry(network, ({ signingClient }) =>
        signingClient.leaveGame(tableId, finishingOrderFromState(state))
    );
    return { hash, gameId: tableId };
}
