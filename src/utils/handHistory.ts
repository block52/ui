/**
 * Pure helpers for "My Hand History" (ui#721): the hands the connected wallet
 * played, from the indexer's GET /api/v1/players/:address/hands.
 */

import { GameFormat, PlayerStatus, isTournamentFormat } from "@block52/poker-vm-sdk";
import type { PlayerHand } from "../types/players";
import type { IndexerStatus } from "../pages/explorer/types";
import { formatAmount } from "./accountUtils";
import { hasValue } from "./guards";
import { httpErrorMessage, isNetworkError } from "../apis/HTTPClient";

/** A hand's identity across tables: one table can't repeat a hand number. */
export const handKey = (hand: Pick<PlayerHand, "game_id" | "hand_number">): string => `${hand.game_id}#${hand.hand_number}`;

/**
 * Appends a newly fetched page to the list. Rows already shown are dropped: if
 * new hands are indexed between page loads, offsets shift and a page can repeat
 * the end of the previous one.
 */
export function mergeHandPages(existing: PlayerHand[], page: PlayerHand[]): PlayerHand[] {
    const seen = new Set(existing.map(handKey));
    return [...existing, ...page.filter(h => !seen.has(handKey(h)))];
}

export type HandOutcomeTone = "won" | "lost" | "neutral";

export interface HandOutcome {
    label: string;
    tone: HandOutcomeTone;
}

/**
 * What happened to the wallet in a hand, from its end status and winnings.
 * `format` is the table's format; while it's unknown, a win shows without
 * units rather than guessing chips or USDC.
 */
export function describeHandOutcome(hand: Pick<PlayerHand, "status" | "won_amount">, format: GameFormat | undefined): HandOutcome {
    if (hand.won_amount > 0) {
        const amount = hasValue(format) ? formatAmount(String(hand.won_amount), undefined, isTournamentFormat(format)) : hand.won_amount.toLocaleString();
        return { label: `Won ${amount}`, tone: "won" };
    }
    switch (hand.status) {
        case PlayerStatus.FOLDED:
            return { label: "Folded", tone: "neutral" };
        case PlayerStatus.BUSTED:
            return { label: "Busted", tone: "lost" };
        case "":
            return { label: "Left the table", tone: "neutral" };
        default:
            return { label: "Lost", tone: "lost" };
    }
}

/**
 * How far the indexer has got, phrased for the history page. Hands newer than
 * the last indexed block aren't listed yet; hands before the first indexed
 * block never will be.
 */
export function describeIndexing(status: IndexerStatus): string {
    const parts: string[] = [];
    if (status.percent_complete < 99.9) {
        parts.push(
            `Hand history is indexed up to block ${status.last_block_indexed.toLocaleString()} of ${status.total_blocks.toLocaleString()} ` +
                `(${status.percent_complete.toFixed(1)}%). Newer hands appear as indexing catches up.`
        );
    } else {
        parts.push(`Hand history is up to date (block ${status.last_block_indexed.toLocaleString()}). New hands usually appear within a minute.`);
    }
    if (status.first_block_indexed > 1) {
        parts.push(`Hands before block ${status.first_block_indexed.toLocaleString()} aren't indexed.`);
    }
    return parts.join(" ");
}

/** The status code the indexer put in an error body ({ error, message, code }), if any. */
export function indexerErrorCode(err: unknown): number | undefined {
    if (typeof err === "object" && err !== null && "code" in err && typeof err.code === "number") {
        return err.code;
    }
    return undefined;
}

/**
 * Why an explorer hand page couldn't load a hand, precisely (ui#721): the
 * indexer is unreachable, the hand isn't indexed (yet), or another error.
 * `status` is the indexer's progress when known.
 */
export function describeHandLoadError(err: unknown, handNumber: string, status: IndexerStatus | null): string {
    if (isNetworkError(err)) {
        return `The hand history service (indexer) can't be reached, so hand #${handNumber} can't be shown here right now.`;
    }
    if (indexerErrorCode(err) === 404) {
        if (status && status.percent_complete < 99.9) {
            return (
                `Hand #${handNumber} isn't indexed yet. The indexer has reached block ${status.last_block_indexed.toLocaleString()} ` +
                `of ${status.total_blocks.toLocaleString()} (${status.percent_complete.toFixed(1)}%); newer hands appear as it catches up.`
            );
        }
        return `Hand #${handNumber} isn't in the hand history. It may not exist on this table, or it was never indexed.`;
    }
    return `Hand #${handNumber} couldn't be loaded: ${httpErrorMessage(err, "unknown error")}`;
}
