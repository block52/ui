/**
 * Player-directory types (ui#589), mirroring the indexer's REST shapes exactly
 * (snake_case over the wire — see indexer API.md).
 *
 * Money fields are raw USDC micro-units (6 decimals); convert with microToUsdc.
 * Percentage fields (vpip/pfr/aggression_factor/wtsd/won_at_showdown) are
 * integers scaled x100 (2550 = 25.50%).
 */

export type VipTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type PlayerSortField =
    | "net_profit"
    | "total_hands"
    | "total_rake_contributed"
    | "vip_points"
    | "last_seen_block";

export interface PlayerSearchParams {
    search?: string;
    sort?: PlayerSortField;
    order?: "asc" | "desc";
    limit?: number;
    offset?: number;
}

export interface Pagination {
    limit: number;
    offset: number;
    total: number;
}

/** Lightweight row for the searchable directory (GET /api/v1/players). */
export interface PlayerListItem {
    player_address: string;
    vip_tier: VipTier;
    rakeback_pct: number;
    total_hands: number;
    total_actions: number;
    net_profit: number;
    total_rake_contributed: number;
    last_seen_block?: number;
}

export interface PlayersListResponse {
    data: PlayerListItem[];
    pagination: Pagination;
}

/** Full profile (GET /api/v1/players/:address/stats). */
export interface PlayerProfile {
    player_address: string;

    // Volume & money (live-computed)
    total_hands: number;
    total_actions: number;
    total_buy_ins: number;
    total_cash_outs: number;
    net_profit: number;
    session_count: number;
    avg_session_length: number;

    // VIP (aggregate)
    vip_tier: VipTier;
    rakeback_pct: number;
    vip_points: number;
    total_rake_contributed: number;
    current_month_rake: number;

    // Playing style (aggregate; integers scaled x100)
    vpip: number;
    pfr: number;
    aggression_factor: number;
    wtsd: number;
    won_at_showdown: number;

    // Action counts (aggregate)
    total_bets: number;
    total_raises: number;
    total_calls: number;
    total_folds: number;
    total_checks: number;

    // Records (aggregate)
    biggest_pot_won: number;
    biggest_hand_profit: number;
    longest_session_blocks: number;

    // Timestamps (aggregate)
    first_seen_block?: number;
    last_seen_block?: number;
    stats_updated_at?: string;
}

export interface PlayerSession {
    player_address: string;
    game_id: string;
    join_block: number;
    leave_block?: number;
    buy_in_amount: number;
    cash_out_amount?: number;
    created_at: string;
}

export interface PlayerSessionsResponse {
    data: PlayerSession[];
    pagination: Pagination;
}
