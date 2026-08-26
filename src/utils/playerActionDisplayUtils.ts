import { LegalActionDTO, NonPlayerActionType, PlayerStatus } from "@block52/poker-vm-sdk";
import { SIT_IN_METHOD_POST_NOW } from "../hooks/playerActions";

export type PlayerActionDisplay =
    | { kind: "pending"; waitingMessage: string; showSeatOption?: boolean }
    | { kind: "sit-in-options" }
    | { kind: "auto-sit-in" }
    | { kind: "sit-out-button" }
    | { kind: "waiting-for-players" }
    | { kind: "none" };

export interface PlayerActionDisplayInput {
    playerStatus: string | null;
    sitInMethod: string | null;
    legalActions: LegalActionDTO[];
    totalSeatedPlayers: number;
    handNumber: number;
    hasActivePlayers: boolean;
}

/**
 * Determines whether a SIT_IN action should be auto-sent (bootstrap)
 * or shown as method selection (mid-orbit join).
 *
 * Mirrors PVM's checkBootstrap() logic: bootstrap only applies when
 * NO players are ACTIVE/ALL_IN (game hasn't started yet) and it's
 * the first hand. Once any player is ACTIVE, new joiners must use
 * sit-in method selection instead.
 */
export function isBootstrap(hasActivePlayers: boolean, handNumber: number): boolean {
    return !hasActivePlayers && handNumber === 1;
}

/**
 * Determines whether to show the PlayerActionButtons panel at all.
 * Returns false when the standard action panel should be visible instead.
 */
export function shouldShowPlayerActionPanel(input: PlayerActionDisplayInput): boolean {
    return getPlayerActionDisplay(input).kind !== "none";
}

export function getPlayerActionDisplay(input: PlayerActionDisplayInput): PlayerActionDisplay {
    const { playerStatus, sitInMethod, legalActions, totalSeatedPlayers, handNumber, hasActivePlayers } = input;

    // Derive sit-in / sit-out from legalActions, filtering out JOIN, LEAVE, DEAL, etc.
    const hasSitInAction = legalActions.some(a => a.action === NonPlayerActionType.SIT_IN);
    const hasSitOutAction = legalActions.some(a => a.action === NonPlayerActionType.SIT_OUT);

    // 1. Pending: player already confirmed sit-in, waiting for action
    if (playerStatus === PlayerStatus.SITTING_IN) {
        // Default to post-now message; next-bb deferred (poker-vm#1895)
        const waitingMessage = sitInMethod === SIT_IN_METHOD_POST_NOW || sitInMethod === null
            ? "Waiting to sit in..."
            : "Waiting For Next Big Blind...";
        return { kind: "pending", waitingMessage };
    }

    // 1b. Waiting for the big blind (#2139/#545): a cash joiner is auto-queued to
    // enter on their next big blind — parked in WAITING_FOR_BIG_BLIND, not dealt
    // into the current hand. The engine allows only TOP_UP/LEAVE from this status
    // (SIT_IN / SIT_IN_AND_WAIT / SIT_OUT all require SEATED/SITTING_OUT), so there
    // is no post-now affordance to offer here — show a passive waiting indicator.
    if (playerStatus === PlayerStatus.WAITING_FOR_BIG_BLIND) {
        // Keep the "Seat me at 6 o'clock" toggle available: a joiner used to reach
        // it via the sit-in-options panel, which they no longer see once parked
        // here, and there is no settings-sidebar equivalent.
        return { kind: "pending", waitingMessage: "Waiting For Next Big Blind...", showSeatOption: true };
    }

    // 2. Solo player — show "Waiting for players to join..." instead of action buttons.
    if (totalSeatedPlayers < 2) {
        return { kind: "waiting-for-players" };
    }

    // 3. Sit-in: bootstrap vs mid-orbit join
    if (hasSitInAction) {
        if (isBootstrap(hasActivePlayers, handNumber)) {
            return { kind: "auto-sit-in" };
        }
        // Mid-orbit join or returning from SITTING_OUT — show method selection
        return { kind: "sit-in-options" };
    }

    // 4. Sit-out button
    if (hasSitOutAction) {
        return { kind: "sit-out-button" };
    }

    // 5. Nothing
    return { kind: "none" };
}
