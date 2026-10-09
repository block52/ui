/**
 * Pure helpers for the lobby table list (TableList): naming, format tabs,
 * default ordering, seat fill and Sit & Go prize-pool breakdown.
 *
 * Everything here is derived from real chain data (GameWithFormat); nothing
 * fills in a value the chain did not provide (Commandment 7).
 */

import { GameVariant } from "@block52/poker-vm-sdk";
import { GameWithFormat } from "./convertUtils";
import { isCashFormat, isSitAndGoFormat, formatGameFormatDisplay, formatGameVariantDisplay } from "./gameFormatUtils";
import { computeSngEntryBreakdown } from "./buyInUtils";
import { formatMicroAsUsdc } from "../constants/currency";
import { hasContent } from "./guards";
import { truncateMiddle } from "./stringUtils";

/** Lobby format tab. Tournament tables appear under "all" only. */
export type TableFormatFilter = "all" | "cash" | "sng";

type TableIdentity = Pick<GameWithFormat, "gameId" | "name">;
type TableSeats = Pick<GameWithFormat, "currentPlayers" | "maxPlayers">;

const bareHex = (gameId: string): string => gameId.replace(/^0x/i, "");

/** The table's paid on-chain name when it has one, otherwise "Table " + the last 5 characters of the gameId. */
export const tableDisplayName = (gameId: string, name?: string | null): string => {
    const trimmed = name?.trim();
    if (hasContent(trimmed)) return trimmed;
    return `Table ${gameId.slice(-5)}`;
};

/** Short mono id shown under the name, e.g. "0x34…840d". */
export const shortTableId = (gameId: string): string => {
    const hex = bareHex(gameId);
    if (hex.length <= 8) return `0x${hex}`;
    return `0x${truncateMiddle(hex, 2, 4, "…")}`;
};

/** Compact variant tag for the id line: "NLH" for Texas Hold'em. */
export const variantAbbreviation = (variant: GameWithFormat["gameVariant"]): string => {
    if (variant === GameVariant.TEXAS_HOLDEM) return "NLH";
    return formatGameVariantDisplay(variant);
};

/** Human format label: "Cash", "Sit & Go", "Tournament". */
export const formatLabel = (format: GameWithFormat["gameFormat"]): string => {
    if (isSitAndGoFormat(format)) return "Sit & Go";
    return formatGameFormatDisplay(format);
};

export const isTableFull = (game: TableSeats): boolean => game.currentPlayers >= game.maxPlayers;

/** Seat fill as a 0–100 percentage, clamped (a 0-seat table reads as 0%). */
export const seatFillPercent = (game: TableSeats): number => {
    if (game.maxPlayers <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((game.currentPlayers / game.maxPlayers) * 100)));
};

export const matchesFormatFilter = (game: Pick<GameWithFormat, "gameFormat">, filter: TableFormatFilter): boolean => {
    if (filter === "cash") return isCashFormat(game.gameFormat);
    if (filter === "sng") return isSitAndGoFormat(game.gameFormat);
    return true;
};

export const countByFormat = (games: ReadonlyArray<Pick<GameWithFormat, "gameFormat">>): Record<TableFormatFilter, number> => ({
    all: games.length,
    cash: games.filter(g => matchesFormatFilter(g, "cash")).length,
    sng: games.filter(g => matchesFormatFilter(g, "sng")).length
});

/** Case-insensitive match on table name, display name or gameId. Blank query matches all. */
export const matchesTableSearch = (game: TableIdentity, query: string): boolean => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return true;
    return `${game.name ?? ""} ${tableDisplayName(game.gameId, game.name)} ${game.gameId}`.toLowerCase().includes(q);
};

/** 0 = open with seated players, 1 = empty, 2 = full. */
const lobbyRank = (game: TableSeats): number => {
    if (isTableFull(game)) return 2;
    return game.currentPlayers > 0 ? 0 : 1;
};

/**
 * Default lobby order: open tables with seated players first, then empty open
 * tables, then full ones. Within a group, fewer free seats first (closest to
 * starting). Stable for ties.
 */
export const sortLobbyTables = <T extends TableSeats>(tables: ReadonlyArray<T>): T[] =>
    [...tables].sort((a, b) => {
        const rank = lobbyRank(a) - lobbyRank(b);
        if (rank !== 0) return rank;
        return a.maxPlayers - a.currentPlayers - (b.maxPlayers - b.currentPlayers);
    });

/** "$0.01 / $0.02" for cash tables. */
export const formatBlinds = (game: Pick<GameWithFormat, "smallBlind" | "bigBlind">): string =>
    `$${formatMicroAsUsdc(game.smallBlind, 2)} / $${formatMicroAsUsdc(game.bigBlind, 2)}`;

/** Cash: "$0.40 – $2.00"; Sit & Go / tournament: the fixed buy-in "$1.00". */
export const formatTableBuyIn = (game: Pick<GameWithFormat, "gameFormat" | "minBuyIn" | "maxBuyIn">): string => {
    const min = `$${formatMicroAsUsdc(game.minBuyIn, 2)}`;
    if (isCashFormat(game.gameFormat)) return `${min} – $${formatMicroAsUsdc(game.maxBuyIn, 2)}`;
    return min;
};

interface SngPrizeInfo {
    /** Prize pool once every seat is filled: prize-pool portion × maxPlayers, e.g. "$3.60". */
    pool: string;
    /** Per-entry split "$0.90 + $0.10 fee", present only when a protocol fee is configured. */
    split?: string;
}

/** Sit & Go prize-pool figures from the buy-in and the governable protocol fee. */
export const sngPrizeInfo = (game: Pick<GameWithFormat, "minBuyIn" | "entryFee" | "protocolFeeBps" | "maxPlayers">): SngPrizeInfo => {
    const breakdown = computeSngEntryBreakdown(game.minBuyIn, game.entryFee, game.protocolFeeBps);
    const pool = `$${formatMicroAsUsdc(breakdown.prizePoolPortion * BigInt(game.maxPlayers), 2)}`;
    if (!breakdown.hasProtocolFee) return { pool };
    return {
        pool,
        split: `$${formatMicroAsUsdc(breakdown.prizePoolPortion, 2)} + $${formatMicroAsUsdc(breakdown.protocolCut, 2)} fee`
    };
};

/** Mobile "Show more · N left": how many of `total` are still hidden. */
export const remainingCount = (total: number, visible: number): number => Math.max(0, total - visible);
