/**
 * Hands Played on the profile Stats tab, from the public logs Playing Style
 * already reads. The indexer profile's total_hands is a stored aggregate and
 * undercounts. This does not fetch anything of its own.
 *
 * A hand counts once, on a cash, Sit & Go, or tournament table, when the log
 * shows this player was dealt in: a real action (blind, fold, bet, call, …)
 * or a pot they won. Sitting out, joining, or leaving does not. The same hand
 * listed twice counts once. A log the node no longer has is left out, never
 * guessed as a played hand.
 */
import type { ContributionSnapshot } from "./handContribution";
import { viewerPlayedHand } from "./handHistoryCards";
import { hasContent, hasValue, isNumber } from "./guards";

const PENDING = "…";
const UNKNOWN = "—";

export interface DealtHandLog {
    /** `gameId#handNumber`. One table cannot repeat a hand number. */
    key: string;
    snapshot: ContributionSnapshot | null | undefined;
}

/** True when this public log shows the player was dealt into the hand. */
export function playerWasDealtIn(snapshot: ContributionSnapshot | null | undefined, playerId: string | undefined): boolean {
    if (!hasContent(playerId) || !hasValue(snapshot)) return false;
    return viewerPlayedHand(snapshot, playerId);
}

/**
 * Distinct hands whose log shows this player was dealt in.
 * A missing log, a blank key, or a repeated key adds nothing.
 */
export function countDealtHands(hands: readonly DealtHandLog[], playerId: string | undefined): number {
    if (!hasContent(playerId)) return 0;
    const seen = new Set<string>();
    let dealt = 0;
    for (const hand of hands) {
        if (!hasContent(hand.key) || seen.has(hand.key)) continue;
        seen.add(hand.key);
        if (playerWasDealtIn(hand.snapshot, playerId)) dealt += 1;
    }
    return dealt;
}

export interface HandsPlayedView {
    /** The hand list or the chain logs are still loading. */
    pending: boolean;
    /** The hand list failed, or every requested log was unreadable. */
    failed: boolean;
    /** Confirmed dealt-in hands. Ignored while pending or after a failed read. */
    dealt: number;
    /** Indexer profile total. Shown only when the chain count cannot be read. */
    indexerHands?: number;
}

function wholeCount(value: number | undefined): value is number {
    return isNumber(value) && Number.isSafeInteger(value) && value >= 0;
}

/**
 * The chain count cannot be shown. A hand-list error, or a finished read where
 * every requested log is gone, falls back to the indexer figure.
 */
export function handsPlayedReadFailed(handListFailed: boolean, requested: number, dealt: number, unavailable: number): boolean {
    if (handListFailed) return true;
    if (!wholeCount(requested) || !wholeCount(dealt) || !wholeCount(unavailable)) return true;
    return requested > 0 && dealt === 0 && unavailable >= requested;
}

/** Ellipsis while the chain count loads. The indexer total only after that read fails. */
export function formatHandsPlayed(view: HandsPlayedView): string {
    if (view.pending) return PENDING;
    if (!view.failed && wholeCount(view.dealt)) return view.dealt.toLocaleString();
    if (wholeCount(view.indexerHands)) return view.indexerHands.toLocaleString();
    return UNKNOWN;
}
