/**
 * WS ingest classifier (WS Action Bus, Phase 0).
 *
 * Pure extraction of the branching logic that used to live inline in
 * `GameStateContext`'s `ws.onmessage` handler. `classifyMessage` takes a
 * single parsed WebSocket message plus the table it belongs to and returns a
 * discriminated {@link ClassifiedMessage} describing exactly what the provider
 * should do with it — no React, no side effects, fully unit-testable.
 *
 * Behaviour is preserved 1:1 with the original handler, including the two
 * distinct validation outcomes (Commandment 7 — surface, never default):
 *   - a message with NO gameState → `validationErrorNoState` (nothing committed)
 *   - a message with an invalid-but-present gameState → `state` with a
 *     non-null `validationError` (the snapshot is still committed so the table
 *     renders what it can, while the error is surfaced).
 */
import { TexasHoldemStateDTO, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { normalizeGatewayMessage } from "../utils/gameTransport";
import { validateGameState, extractGameDataFromMessage, toGameFormat, toGameVariant } from "../utils/gameFormatUtils";
import type { ValidationError } from "../components/playPage/TableErrorPage";
import type { PendingAction } from "../context/gameState/GameUIContext";

/** Cosmos event names that carry a full game-state snapshot. */
const COSMOS_STATE_EVENTS = ["state", "player_joined_game", "action_performed", "game_created"];

/**
 * Loosely-typed inbound WS envelope. There is no SDK type for the transport
 * envelope itself (only for the `gameState` payload it wraps), so this mirrors
 * every field the original handler read. `JSON.parse` output assigns to it
 * without a cast.
 */
export interface RawWsMessage {
    type?: string;
    event?: string;
    gameId?: string;
    tableAddress?: string;
    code?: string;
    message?: string;
    details?: { suggestion?: string };
    data?: {
        gameId?: string;
        actor?: string;
        action?: string;
        amount?: string;
        gameState?: TexasHoldemStateDTO;
        format?: string;
        variant?: string;
    };
    state?: {
        gameId?: string;
        format?: string;
        variant?: string;
        gameState?: unknown;
    };
}

/**
 * Discriminated result of classifying one inbound message.
 *
 * `ignore` covers everything the original handler dropped silently: gateway
 * `subscribed`/ack frames, unknown message types, and frames for a different
 * table.
 */
export type ClassifiedMessage =
    | {
          kind: "state";
          snapshot: TexasHoldemStateDTO;
          format: GameFormat | undefined;
          variant: GameVariant | undefined;
          /** null = valid; non-null = invalid but still committed. */
          validationError: ValidationError | null;
      }
    | {
          kind: "validationErrorNoState";
          validationError: ValidationError;
      }
    | { kind: "pending"; pendingAction: PendingAction }
    | { kind: "actionAccepted" }
    | {
          kind: "error";
          error: Error;
          /** true for GAME_NOT_FOUND — the existing game state is cleared. */
          clearGameState: boolean;
      }
    | { kind: "ignore" };

/**
 * Classify a single parsed WebSocket message for the given table.
 *
 * @param raw - the parsed message (gateway or cosmos/PVM shape)
 * @param tableId - the table the provider is currently subscribed to
 */
export function classifyMessage(raw: RawWsMessage | null | undefined, tableId: string): ClassifiedMessage {
    if (!raw || typeof raw !== "object") {
        return { kind: "ignore" };
    }

    // Gateway transport: state frames carry the canonical GameStateResponseDTO
    // under `state` (poker-vm#2226). Normalize into the cosmos message shape so
    // the branches below need zero gateway-specific parsing. Non-state gateway
    // frames (subscribed/ack) normalize to null and fall through to `ignore`.
    const normalized = normalizeGatewayMessage(raw);
    const message: RawWsMessage = normalized
        ? // normalized.data is `unknown` by contract; it is the canonical
          // cosmos `data` shape, narrowed here at the transport boundary.
          { gameId: normalized.gameId, event: normalized.event, data: normalized.data as RawWsMessage["data"] }
        : raw;

    // A state update is either the old PVM `gameStateUpdate` for this table or
    // any cosmos state-bearing event for this game.
    const isStateUpdate =
        (message.type === "gameStateUpdate" && message.tableAddress === tableId) ||
        (message.event !== undefined && COSMOS_STATE_EVENTS.includes(message.event) && message.gameId === tableId);

    if (isStateUpdate) {
        const { gameState: gameStateData, format: rawFormat, variant: rawVariant } = extractGameDataFromMessage(message);

        if (!gameStateData) {
            return {
                kind: "validationErrorNoState",
                validationError: {
                    missingFields: ["gameState"],
                    message: "No game state data received from server",
                    rawData: message
                }
            };
        }

        const validation = validateGameState(rawFormat, rawVariant, gameStateData.gameOptions);

        if (!validation.valid) {
            // Per Commandment 7: surface the validation error, but still commit
            // the snapshot so the table renders what it can.
            return {
                kind: "state",
                snapshot: gameStateData,
                format: toGameFormat(rawFormat),
                variant: toGameVariant(rawVariant),
                validationError: {
                    missingFields: validation.missingFields,
                    message: validation.message,
                    rawData: message
                }
            };
        }

        return {
            kind: "state",
            snapshot: gameStateData,
            format: toGameFormat(rawFormat),
            variant: toGameVariant(rawVariant),
            validationError: null
        };
    }

    if (message.event === "pending") {
        const pendingData = message.data;
        if (pendingData) {
            return {
                kind: "pending",
                pendingAction: {
                    gameId: pendingData.gameId || message.gameId || "",
                    actor: pendingData.actor ?? "",
                    action: pendingData.action ?? "",
                    amount: pendingData.amount,
                    timestamp: Date.now()
                }
            };
        }
        return { kind: "ignore" };
    }

    if (message.event === "action_accepted") {
        // Acknowledgment that our action was accepted — no state change.
        return { kind: "actionAccepted" };
    }

    if (message.type === "error" || message.event === "error") {
        const errorMsg =
            message.code === "GAME_NOT_FOUND"
                ? `${message.message}${message.details?.suggestion ? "\n\n" + message.details.suggestion : ""}`
                : message.message || "An error occurred";

        return {
            kind: "error",
            error: new Error(errorMsg),
            clearGameState: message.code === "GAME_NOT_FOUND"
        };
    }

    // Gateway subscribed/ack, unknown types, and wrong-table frames.
    return { kind: "ignore" };
}
