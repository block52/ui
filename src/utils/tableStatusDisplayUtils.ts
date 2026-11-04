/**
 * Table Status Display Utilities
 *
 * Pure functions that determine which status messages to show on the table.
 * Unlike PlayerActionDisplay (mutually exclusive), these messages can stack
 * (e.g., seat label + turn indicator shown simultaneously).
 *
 * "Waiting for players to join..." is intentionally NOT here — it is owned
 * by PlayerActionButtons via the "waiting-for-players" kind.
 */

import { hasElements, hasValue } from "./guards";
import { t } from "../i18n";

export type TableStatusMessage =
    | { kind: "seat-label"; seatNumber: number; text: string }
    | { kind: "your-turn"; text: string }
    | { kind: "waiting-for-player"; seatNumber: number; text: string }
    | { kind: "hand-complete"; text: string };

export interface TableStatusDisplayInput {
    currentUserSeat: number;
    nextToActSeat: number | null;
    isGameInProgress: boolean;
    isCurrentUserTurn: boolean;
    hasLegalActions: boolean;
    totalActivePlayers: number;
    isSitAndGoWaitingForPlayers: boolean;
    smallBlindPosition?: number;
    bigBlindPosition?: number;
    dealerPosition?: number;
}

/**
 * Returns an array of status messages to display on the table.
 * Multiple messages can be active simultaneously.
 */
export function getTableStatusMessages(input: TableStatusDisplayInput): TableStatusMessage[] {
    const {
        currentUserSeat,
        nextToActSeat,
        isGameInProgress,
        isCurrentUserTurn,
        hasLegalActions,
        totalActivePlayers,
        isSitAndGoWaitingForPlayers,
        smallBlindPosition,
        bigBlindPosition,
        dealerPosition,
    } = input;

    const messages: TableStatusMessage[] = [];

    // 1. Seat label — shown when seated (currentUserSeat >= 0)
    if (currentUserSeat >= 0) {
        messages.push({
            kind: "seat-label",
            seatNumber: currentUserSeat,
            text: t("status.seatedAt", { seat: currentUserSeat }),
        });
    }

    // 2. Turn indicator — game in progress and someone must act
    //    Uses hasValue instead of truthiness to handle seat 0 correctly
    if (hasValue(nextToActSeat) && isGameInProgress) {
        if (isCurrentUserTurn && hasLegalActions) {
            messages.push({ kind: "your-turn", text: t("status.yourTurn") });
        } else {
            const label = getWaitingForPlayerLabel(nextToActSeat, { smallBlindPosition, bigBlindPosition, dealerPosition });
            messages.push({
                kind: "waiting-for-player",
                seatNumber: nextToActSeat,
                text: t("status.waitingFor", { player: label }),
            });
        }
    }

    // 3. Hand complete — between hands, 2+ players, not sit-and-go waiting
    if (!isGameInProgress && totalActivePlayers > 1 && !isSitAndGoWaitingForPlayers) {
        messages.push({
            kind: "hand-complete",
            text: t("status.handComplete"),
        });
    }

    // NOTE: "Waiting for players to join..." intentionally NOT here.
    // That message is owned by PlayerActionButtons (waiting-for-players kind).

    return messages;
}

/**
 * Returns a human-readable label for the player at a given seat.
 * Uses backend-provided position data when available; falls back to generic labels.
 */
export function getWaitingForPlayerLabel(
    seatNumber: number,
    positions?: { smallBlindPosition?: number; bigBlindPosition?: number; dealerPosition?: number }
): string {
    if (positions?.dealerPosition === seatNumber) return t("status.dealer");
    if (positions?.smallBlindPosition === seatNumber) return t("status.smallBlind");
    if (positions?.bigBlindPosition === seatNumber) return t("status.bigBlind");
    return t("status.playerAtSeat", { seat: seatNumber });
}

/**
 * Convenience check for whether any status messages should be rendered.
 */
export function hasTableStatusMessages(input: TableStatusDisplayInput): boolean {
    return hasElements(getTableStatusMessages(input));
}
