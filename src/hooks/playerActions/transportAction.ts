/**
 * Transport-aware action executor — the single funnel every per-action
 * helper (callHand, foldHand, ...) routes through (ui#440 PR 2).
 *
 * chain (default): SDK performActionSync, exactly as before.
 * gateway: EIP-191-signed POST to the gateway's /actions (request/response
 * per the #433 lesson); the table's state update arrives on the gateway
 * socket. Hand-boundary actions (deal/new-hand) stay chain-direct even in
 * gateway mode — the chain is the entropy/deck anchor (poker-vm#2221).
 *
 * These helpers are plain async functions (no React context), so the
 * gateway path reads the action index from the latest game state snapshot
 * published by GameStateContext via setLatestGameState().
 */
import { NonPlayerActionType, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { STORAGE_KEYS } from "../../constants/storageKeys";

import type { NetworkEndpoints } from "../../context/NetworkContext";
import type { PlayerActionResult } from "../../types";
import { getSigningClient } from "../../utils/cosmos/client";
import { signActionMessage } from "../../utils/cosmos/signing";
import { finishingOrderFromState, signSettlementTx } from "../../utils/cosmos/settlementTx";
import { getGameTransport, getGatewayApi } from "../../utils/gameTransport";
import { isNullish, hasElements } from "../../utils/guards";

let latestGameState: TexasHoldemStateDTO | undefined;

/** Published by GameStateContext on every state update. */
export function setLatestGameState(gameState: TexasHoldemStateDTO | undefined): void {
    latestGameState = gameState;
}

/**
 * Next action index for a player not yet seated (join).
 *
 * The engine validates `index === actionCount + previousActions.length + 1`
 * (TexasHoldem.getActionIndex), which is the SDK's canonical
 * getNextActionIndex. We must reproduce that formula exactly.
 *
 * The previous approach — reading a seated player's `legalActions[0].index`
 * with a fallback of 1 — only holds while the game is running. A Sit-and-Go
 * waiting to fill has SEATED (not yet ACTIVE) players that carry NO
 * legalActions, so it fell through to the stale `1` fallback: the first join
 * (index 1) landed, but every subsequent join still sent `1` while the engine
 * now expected 2, 3, … → "Invalid action index", join rejected (ui#440).
 * Cash games hid this because you join a running table whose seated players
 * do carry the correct index.
 */
export function nextActionIndex(gameState: TexasHoldemStateDTO | undefined): number {
    const previousActions = gameState?.previousActions;
    if (hasElements(previousActions)) {
        return previousActions[previousActions.length - 1].index + 1;
    }
    // Fresh/empty table: actionCount is 0 here, so this is 1 — matching the
    // prior empty-table default while staying correct for a seeded table whose
    // count is already non-zero.
    return (gameState?.actionCount ?? 0) + 1;
}

/** Latest snapshot, for callers that resolve their own index (join). */
export function getLatestGameState(): TexasHoldemStateDTO | undefined {
    return latestGameState;
}

/**
 * Hand-boundary actions (deal/new-hand) will anchor to the chain for VRF
 * entropy once chain-anchored hand starts land (poker-vm#2221,
 * pokerchain#217). Until then gateway tables are chain-off, so they MUST
 * flow through the gateway like every other action — otherwise a
 * gateway-only table deadlocks at the deal (found live, ui#440).
 * KNOWN LIMITATION meanwhile: no entropy source -> the deck is
 * deterministic (same board every hand). Test mode only.
 */
const CHAIN_ANCHORED_ACTIONS = new Set<string>([]);

export async function executeTransportAction(
    tableId: string,
    action: string,
    amount: bigint,
    network: NetworkEndpoints,
    data?: string
): Promise<PlayerActionResult> {
    if (getGameTransport() === "gateway" && !CHAIN_ANCHORED_ACTIONS.has(action)) {
        const address = localStorage.getItem(STORAGE_KEYS.cosmosAddress);
        const currentPlayer = latestGameState?.players?.find(p => p.address === address);
        const actionIndex = currentPlayer?.legalActions?.[0]?.index;
        if (isNullish(actionIndex)) {
            // Per Commandment 7: surface it — no guessed indices.
            throw new Error(`No legal action index available for ${action} — game state may be stale`);
        }
        return executeGatewayAction(tableId, action, actionIndex, amount, data ?? "", network);
    }

    const { signingClient } = await getSigningClient(network);
    const transactionHash = await signingClient.performActionSync(tableId, action, amount, data);
    return {
        hash: transactionHash,
        gameId: tableId,
        action,
        amount: amount.toString()
    };
}

export async function executeGatewayAction(
    tableId: string,
    action: string,
    actionIndex: number,
    amount: bigint,
    data: string,
    network: NetworkEndpoints
): Promise<PlayerActionResult> {
    const address = localStorage.getItem(STORAGE_KEYS.cosmosAddress);
    if (!address) {
        throw new Error("No Block52 wallet address found. Please connect your wallet.");
    }

    const amountString = amount.toString();
    const timestamp = Date.now();
    const signature = await signActionMessage(tableId, action, actionIndex, amountString, timestamp, data);
    if (!signature) {
        throw new Error("Failed to sign action — wallet mnemonic unavailable");
    }

    // Settlement relay (§6.10): sign the action as a cosmos tx and attach it
    // for the gateway to relay to the chain. Best-effort — undefined for
    // unfunded accounts (gameplay still proceeds on the EIP-191 path).
    //
    // For a LEAVE on a finished SNG, attach the place-1-first finishing order
    // from the broadcast state so the chain can finalize and pay the prize —
    // under WS-first it never saw the tournament-ending action, so its Results
    // are empty until we tell it the order (pokerchain#229). Empty for every
    // other case; the chain ignores it.
    const finishingOrder = action === NonPlayerActionType.LEAVE ? finishingOrderFromState(latestGameState) : [];
    let tx: string | undefined;
    try {
        const { signingClient } = await getSigningClient(network);
        tx = await signSettlementTx(signingClient, address, network, tableId, action, amount, data, finishingOrder);
    } catch (err) {
        console.error("[settlement] tx signing skipped:", err);
    }

    // NOTE (#2433): the unfunded-buy-in gate is a BALANCE check on the join
    // button (VacantPlayer/BuyInModal disable it when buy-in > wallet balance),
    // plus the AUTHORITATIVE server-side guard in the gateway which rejects a
    // money-mover relayed with no settlement tx. We deliberately DON'T block
    // here on `!tx`: a missing tx also means "no on-chain account yet" (dev /
    // stub / fresh-but-funded account), which is a legitimate optimistic join —
    // the balance gate already caught the truly-unfunded case.

    const response = await getGatewayApi().submitAction({
        gameId: tableId,
        action,
        index: actionIndex,
        amount: amountString,
        timestamp,
        address,
        signature,
        data,
        tx,
        clientTs: Date.now()
    });

    if (response.type !== "ack") {
        throw new Error(response.error || "Gateway rejected the action");
    }

    return {
        // No chain tx hash on the optimistic path; the signed payload is the
        // action's identity until chain settlement lands (poker-vm#2221).
        hash: `gateway:${tableId}:${actionIndex}`,
        gameId: tableId,
        action,
        amount: amountString
    };
}
