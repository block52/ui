import { LegalActionDTO, NonPlayerActionType, PlayerStatus } from "@block52/poker-vm-sdk";
import { SIT_IN_METHOD_POST_NOW } from "../hooks/playerActions";

export type PlayerActionDisplay =
    | { kind: "pending"; waitingMessage: string; showSeatOption?: boolean }
    | { kind: "sit-in-options" }
    | { kind: "sit-in-bootstrap" }
    // Auto-drive: seat-select sits the player in automatically (dealt in next hand).
    // Returned instead of the sit-in panels when sitInOptions is OFF (ui#550 default).
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
    // When false (default), a would-be sit-in panel becomes "auto-sit-in" — the UI
    // sits the player in on seat-select. When true, the sit-in method radios show.
    sitInOptions?: boolean;
}

/**
 * Distinguishes the empty-table first-fill ("bootstrap") from a mid-orbit join.
 *
 * Mirrors PVM's checkBootstrap() logic: bootstrap only applies when NO players
 * are ACTIVE/ALL_IN (game hasn't started yet) and it's the first hand. On
 * bootstrap the next-BB vs post-now choice is meaningless (no orbit yet), so the
 * UI shows a single "Sit In" button; once a hand is running, a new joiner gets
 * the full method selection instead.
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
    const { playerStatus, sitInMethod, legalActions, totalSeatedPlayers, handNumber, hasActivePlayers, sitInOptions = false } = input;

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

    // 3. Sit-in. Default (sitInOptions OFF): auto-drive — the UI sits the player in
    // on seat-select so they're dealt in next hand, no panel. When the toggle is ON,
    // show the method UI: a single explicit "Sit In" on an empty table (no orbit yet)
    // or the next-BB/post-now radios mid-orbit.
    if (hasSitInAction) {
        // A player who DELIBERATELY sat out is SITTING_OUT and still gets a legal
        // SIT_IN (so they can return). Auto-driving that would immediately undo the
        // sit-out — "sat me out, then dealt me in" (ui#51). Auto-sit-in is only for
        // a fresh joiner (SEATED/null); a sat-out player must opt back in explicitly.
        const deliberatelySatOut = playerStatus === PlayerStatus.SITTING_OUT;
        if (!sitInOptions && !deliberatelySatOut) {
            return { kind: "auto-sit-in" };
        }
        if (isBootstrap(hasActivePlayers, handNumber)) {
            return { kind: "sit-in-bootstrap" };
        }
        return { kind: "sit-in-options" };
    }

    // 4. Sit-out button
    if (hasSitOutAction) {
        return { kind: "sit-out-button" };
    }

    // 5. Nothing
    return { kind: "none" };
}
