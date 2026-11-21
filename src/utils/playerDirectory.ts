import type { PlayerListItem, PlayerSortField } from "../types/players";
import { hasContent, hasValue } from "./guards";

/**
 * Sort the directory in the browser.
 * The indexer sorts net profit without Sit & Go prizes or MTT money, so a
 * corrected net cannot be paged on the server. Ties break on the address so a
 * page is stable.
 */
export function sortPlayers(players: PlayerListItem[], sort: PlayerSortField, order: "asc" | "desc"): PlayerListItem[] {
    const direction = order === "asc" ? 1 : -1;
    return [...players].sort((a, b) => {
        const delta = sortValue(a, sort) - sortValue(b, sort);
        if (delta !== 0) return delta * direction;
        if (a.player_address === b.player_address) return 0;
        return a.player_address < b.player_address ? -1 : 1;
    });
}

/** One page of a sorted directory. Missing sort leaves the input order. */
export function playersPage(
    players: PlayerListItem[],
    sort: PlayerSortField | undefined,
    order: "asc" | "desc" | undefined,
    limit: number | undefined,
    offset: number | undefined
): PlayerListItem[] {
    const sorted = hasContent(sort) && hasContent(order) ? sortPlayers(players, sort, order) : [...players];
    const start = hasValue(offset) && offset > 0 ? offset : 0;
    if (!hasValue(limit)) return sorted.slice(start);
    return sorted.slice(start, start + limit);
}

function sortValue(player: PlayerListItem, sort: PlayerSortField): number {
    if (sort === "last_seen_block") return hasValue(player.last_seen_block) ? player.last_seen_block : 0;
    if (sort === "total_hands") return player.total_hands;
    if (sort === "total_rake_contributed") return player.total_rake_contributed;
    if (sort === "vip_points") return player.vip_points ?? 0;
    return player.net_profit;
}
