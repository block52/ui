import type { PlayerListItem, PlayerSortField } from "../types/players";
import { isDirectoryHandsFailure, type DirectoryHandsCount } from "./directoryHandsPlayed";
import { hasContent, hasValue } from "./guards";

/**
 * Sort the directory in the browser.
 * The indexer sorts net profit without Sit & Go prizes or MTT money, so a
 * corrected net cannot be paged on the server. Ties break on the address so a
 * page is stable.
 *
 * When `hands` is passed, Hands sort uses the chain count (the same figure as
 * profile Hands Played). Players still loading or whose read failed sort after
 * the known counts, so an indexer 0 is not treated as a real total.
 */
export function sortPlayers(
    players: PlayerListItem[],
    sort: PlayerSortField,
    order: "asc" | "desc",
    hands?: ReadonlyMap<string, DirectoryHandsCount>
): PlayerListItem[] {
    const direction = order === "asc" ? 1 : -1;
    return [...players].sort((a, b) => {
        if (sort === "total_hands" && hasValue(hands)) {
            const aRank = handsRank(a, hands);
            const bRank = handsRank(b, hands);
            if (aRank.known !== bRank.known) return aRank.known ? -1 : 1;
            if (aRank.known) {
                const delta = aRank.value - bRank.value;
                if (delta !== 0) return delta * direction;
            }
            return compareAddress(a, b);
        }
        const delta = sortValue(a, sort) - sortValue(b, sort);
        if (delta !== 0) return delta * direction;
        return compareAddress(a, b);
    });
}

/** One page of a sorted directory. Missing sort leaves the input order. */
export function playersPage(
    players: PlayerListItem[],
    sort: PlayerSortField | undefined,
    order: "asc" | "desc" | undefined,
    limit: number | undefined,
    offset: number | undefined,
    hands?: ReadonlyMap<string, DirectoryHandsCount>
): PlayerListItem[] {
    const sorted = hasContent(sort) && hasContent(order) ? sortPlayers(players, sort, order, hands) : [...players];
    const start = hasValue(offset) && offset > 0 ? offset : 0;
    if (!hasValue(limit)) return sorted.slice(start);
    return sorted.slice(start, start + limit);
}

function compareAddress(a: PlayerListItem, b: PlayerListItem): number {
    if (a.player_address === b.player_address) return 0;
    return a.player_address < b.player_address ? -1 : 1;
}

function handsRank(player: PlayerListItem, hands: ReadonlyMap<string, DirectoryHandsCount>): { known: boolean; value: number } {
    const result = hands.get(player.player_address.toLowerCase());
    if (!hasValue(result) || isDirectoryHandsFailure(result)) return { known: false, value: 0 };
    return { known: true, value: result.dealt };
}

function sortValue(player: PlayerListItem, sort: PlayerSortField): number {
    if (sort === "last_seen_block") return hasValue(player.last_seen_block) ? player.last_seen_block : 0;
    if (sort === "total_hands") return player.total_hands;
    if (sort === "total_rake_contributed") return player.total_rake_contributed;
    if (sort === "vip_points") return player.vip_points ?? 0;
    return player.net_profit;
}
