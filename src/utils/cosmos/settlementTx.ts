/**
 * Settlement-tx signing for the optimistic gateway (poker-vm spec §6.10).
 *
 * Gameplay actions are signed as a cosmos MsgPerformAction TxRaw (SDK
 * signPerformAction, no broadcast) and attached to the gateway POST; the
 * gateway relays the bytes to the chain's existing pipeline. This is ADDITIVE
 * — the EIP-191 gateway action still drives gameplay; the tx is best-effort
 * settlement.
 *
 * Money-movers (join / leave / top-up) are signed as their DEDICATED message
 * (MsgJoinGame / MsgLeaveGame / MsgTopUp) instead — a MsgPerformAction does no
 * bank movement, so relaying one would settle the action without moving funds
 * (block52/poker-vm#2325). The player signs; the gateway relays the correct
 * message after PVM-verifying the optimistic apply.
 *
 * Gameplay actions are UNORDERED (pokerchain#247): signPerformAction signs with
 * no account sequence, so optimistic play can never desync the chain sequence
 * (the #2413 cascade). NO client-side sequence tracking for gameplay.
 *
 * Money-movers stay ORDERED (strict monotonic replay protection for money
 * movement). Because unordered gameplay txs never touch the account sequence
 * (the chain's IncrementSequenceDecorator skips them), the account sequence
 * advances ONLY on money-movers — so a fresh per-money-mover sequence query is
 * correct and race-free (money-movers are infrequent).
 *
 * Graceful degradation:
 *   - account not on-chain (unfunded) → no tx (gameplay still works, no settlement)
 */
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { hasElements } from "../guards";
import type { SigningCosmosClient, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

import type { NetworkEndpoints } from "../../context/NetworkContext";
import { getCosmosUrls } from "./client";

const unfundedWarned = new Set<string>();

/**
 * @deprecated No-op since gameplay went unordered (pokerchain#247) — there is no
 * client-tracked gameplay sequence to reset. Retained so the WS `resync` handler
 * and existing callers keep compiling; slated for removal with the resync path.
 */
export function resetSettlementSequence(_address: string): void {
    // intentionally empty
}

/**
 * Derives the place-1-first finishing order (player addresses) from a finished
 * SNG's results[]. Empty when the game isn't finalized (no results), so the
 * chain falls back to its own state for cash/already-finalized leaves. The
 * chain re-validates this ordering and owns the payout amounts (pokerchain#229);
 * we only report who finished where, from the gateway-broadcast results.
 */
export function finishingOrderFromState(gameState: TexasHoldemStateDTO | undefined): string[] {
    const results = gameState?.results;
    if (!hasElements(results)) {
        return [];
    }
    return [...results].sort((a, b) => a.place - b.place).map(r => r.playerId);
}

/** Money-movers need the account's live sequence (they're ordered). */
async function fetchAccount(address: string, restEndpoint: string): Promise<{ accountNumber: number; sequence: number } | null> {
    try {
        const res = await fetch(`${restEndpoint}/cosmos/auth/v1beta1/accounts/${address}`);
        if (!res.ok) {
            // 404 = account doesn't exist on-chain (unfunded). Settle nothing.
            if (!unfundedWarned.has(address)) {
                console.error(`[settlement] account ${address} not on-chain (unfunded) — actions play but won't settle until funded`);
                unfundedWarned.add(address);
            }
            return null;
        }
        const body = await res.json();
        if (!body.account) {
            return null;
        }
        return {
            accountNumber: Number(body.account.account_number),
            sequence: Number(body.account.sequence)
        };
    } catch (err) {
        console.error("[settlement] failed to load account:", err);
        return null;
    }
}

const MONEY_MOVERS: string[] = [NonPlayerActionType.JOIN, NonPlayerActionType.LEAVE, NonPlayerActionType.TOP_UP];

/**
 * Signs the action as a cosmos tx for settlement relay; returns the base64
 * TxRaw, or undefined when settlement isn't possible (unfunded account / sign
 * error) — in which case the caller proceeds with gameplay only.
 *
 * Gameplay → UNORDERED (no sequence, no account query). Money-movers → ORDERED
 * (fresh sequence fetch — gameplay never advances it, so no local tracking).
 */
export async function signSettlementTx(
    signingClient: SigningCosmosClient,
    address: string,
    network: NetworkEndpoints,
    tableId: string,
    action: string,
    amount: bigint,
    data: string,
    finishingOrder: string[] = []
): Promise<string | undefined> {
    try {
        // Gameplay: unordered — no sequence, no account query.
        if (!MONEY_MOVERS.includes(action)) {
            const { base64 } = await signingClient.signPerformAction(tableId, action, amount, data);
            return base64;
        }

        // Money-mover: ordered — fetch the live sequence (only money-movers move
        // it, so this is current and race-free).
        const { restEndpoint } = getCosmosUrls(network);
        const account = await fetchAccount(address, restEndpoint);
        if (!account) {
            return undefined;
        }
        const signerData = { ...account, chainId: COSMOS_CHAIN_ID };
        const result = await signMoneyMover(signingClient, tableId, action, amount, data, signerData, finishingOrder);
        return result?.base64;
    } catch (err) {
        console.error("[settlement] sign failed:", err);
        return undefined;
    }
}

/** Parses `seat=N` out of the join action's data field. */
function seatFromData(data: string): number {
    const match = /seat=(\d+)/.exec(data);
    if (!match) {
        throw new Error(`join settlement tx requires a seat in data, got: "${data}"`);
    }
    return parseInt(match[1], 10);
}

/**
 * Signs the dedicated money-mover message for join/leave/top-up, or returns
 * undefined for any other action (caller falls back to MsgPerformAction).
 * Returns the same {base64,...} shape as signPerformAction. (#2325)
 *
 * For a LEAVE on a finished SNG, `finishingOrder` (place-1-first addresses,
 * derived from the broadcast state's results[]) is attached so the chain can
 * finalize and pay the prize even though it never saw the tournament-ending
 * gameplay action under WS-first (pokerchain#229). Empty for everything else —
 * the chain ignores it for cash leaves and SNGs it already finalized.
 */
function signMoneyMover(
    signingClient: SigningCosmosClient,
    tableId: string,
    action: string,
    amount: bigint,
    data: string,
    signerData: { accountNumber: number; sequence: number; chainId: string },
    finishingOrder: string[]
): Promise<{ base64: string }> | undefined {
    switch (action) {
        case NonPlayerActionType.JOIN:
            return signingClient.signJoinGame(tableId, seatFromData(data), amount, signerData);
        case NonPlayerActionType.LEAVE:
            return signingClient.signLeaveGame(tableId, signerData, finishingOrder);
        case NonPlayerActionType.TOP_UP:
            return signingClient.signTopUp(tableId, amount, signerData);
        default:
            return undefined;
    }
}

// pokerchain chain id (matches COSMOS_CONSTANTS.CHAIN_ID; inlined to avoid a
// values import in this tx-signing util).
const COSMOS_CHAIN_ID = "pokerchain";
