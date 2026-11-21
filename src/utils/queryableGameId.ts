/**
 * Table ids safe to interpolate into a quoted CometBFT event query.
 *
 * Cash and sit-and-go ids are alphanumeric. A multi-table tournament table
 * is `<tournamentId>-t<n>` (see `tableUrl.ts`). Spaces, quotes and any other
 * punctuation stay rejected so a value cannot break out of the quotes.
 */
const QUERYABLE_GAME_ID = /^[A-Za-z0-9]+(-t\d+)?$/;

/** Throws when `gameId` must not be placed inside a CometBFT query string. */
export function assertQueryableGameId(gameId: string): void {
    if (!QUERYABLE_GAME_ID.test(gameId)) {
        throw new Error(`Invalid table id: ${gameId}`);
    }
}
