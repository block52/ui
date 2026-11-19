/**
 * Loading flags for the profile Stats cards that read finished hands.
 *
 * Recovering indexer-omitted MTT hands can walk every session table and every
 * current `<tournamentId>-t*` table, then confirm each candidate on the chain.
 * Hands Played, Playing Style, Biggest Pot Won and Biggest Hand Profit must
 * not stay on an ellipsis until that search finishes. Show the indexer list
 * (and its chain logs) once it is complete, then fold recovered hands in.
 */
export interface ProfileStyleCardsPendingInput {
    onStatsTab: boolean;
    hasAddress: boolean;
    handListFailed: boolean;
    handListComplete: boolean;
    styleLogsPending: boolean;
    /** True once recoverUnlistedHands has finished for this wallet. */
    recoveredSearched: boolean;
    /** Dealt-in hands already read from chain logs. */
    styleDealt: number;
}

export interface ProfileHistoryHandsPendingInput {
    onStatsTab: boolean;
    hasAddress: boolean;
    handListFailed: boolean;
    handListComplete: boolean;
}

/** Ellipsis for Hands Played and Playing Style until the indexer list and its logs are ready. */
export function profileStyleCardsPending(input: ProfileStyleCardsPendingInput): boolean {
    if (!input.onStatsTab || !input.hasAddress || input.handListFailed) return false;
    if (!input.handListComplete) return true;
    if (!input.styleLogsPending) return false;
    // Keep figures already shown from the indexer list while recovered MTT hands append.
    if (input.recoveredSearched && input.styleDealt > 0) return false;
    return true;
}

/** Ellipsis for Biggest Pot Won until the indexer hand list is complete, not until MTT recovery. */
export function profileHistoryHandsPending(input: ProfileHistoryHandsPendingInput): boolean {
    return input.onStatsTab && input.hasAddress && !input.handListComplete && !input.handListFailed;
}
