import { BettingLimit, GameListItem, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { getGameFormat, getGameVariant } from "./gameFormatUtils";

/**
 * Flattened game representation for UI display (e.g., table lists).
 * Converts the nested SDK GameListItem into a flat structure.
 */
export interface GameWithFormat {
    gameId: string;
    /** Optional ENS-style table name (poker-vm#337); root-level, absent for unnamed tables. */
    name?: string;
    minBuyIn: string;
    maxBuyIn: string;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    gameFormat: GameFormat | "unknown";
    gameVariant: GameVariant | "unknown";
    /** Betting limit (ui#824); absent for legacy tables created before the field existed = no-limit. */
    bettingLimit?: BettingLimit;
    smallBlind: string;
    bigBlind: string;
    status: string;
    creator?: string;
    timeout?: number;
    createdAt?: string;
    updatedAt?: string;
    /** Owner/creator fee in micro-USDC (SNG/Tournament); absent/"0" = none (poker-vm#2118). */
    entryFee?: string;
    /** Protocol fee rate in basis points (1000 = 10%); absent/0 = none (poker-vm#2592). */
    protocolFeeBps?: number;
    /** Scheduled start, epoch ms (poker-vm#2680); absent = the sit-and-go starts only when full. */
    scheduledStartTime?: number;
}

/**
 * Converts a single GameListItem (SDK type) to GameWithFormat (UI type).
 * Flattens gameOptions fields to root level for convenient UI consumption.
 *
 * @param game - GameListItem from SDK cosmosClient.findGames()
 * @returns Flattened GameWithFormat for UI display
 * @throws Error if game.gameOptions is missing
 */
export const convertGameListItemToGameWithFormat = (game: GameListItem): GameWithFormat => {
    if (!game.gameOptions) {
        throw new Error(`Game ${game.gameId} is missing gameOptions`);
    }

    const opts = game.gameOptions;
    return {
        gameId: game.gameId,
        name: game.name,
        minBuyIn: opts.minBuyIn,
        maxBuyIn: opts.maxBuyIn,
        minPlayers: opts.minPlayers,
        maxPlayers: opts.maxPlayers,
        currentPlayers: game.currentPlayers ? game.currentPlayers : 0,
        gameFormat: getGameFormat(game.format),
        gameVariant: getGameVariant(game.variant),
        bettingLimit: opts.bettingLimit,
        smallBlind: opts.smallBlind,
        bigBlind: opts.bigBlind,
        status: "waiting",
        creator: game.creator,
        timeout: opts.timeout,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
        scheduledStartTime: opts.scheduledStartTime,
        entryFee: opts.entryFee,
        protocolFeeBps: opts.protocolFeeBps
    };
};

/**
 * Converts an array of GameListItems to GameWithFormat[], filtering out
 * any games missing gameOptions (logs a warning for each).
 *
 * @param games - Array of GameListItems from SDK
 * @returns Array of GameWithFormat for UI display
 */
export const convertGameList = (games: GameListItem[]): GameWithFormat[] => {
    return games
        .filter((game: GameListItem) => {
            if (!game.gameOptions) {
                console.warn("[convertGameList] Game missing gameOptions, skipping:", game.gameId);
                return false;
            }
            return true;
        })
        .map(convertGameListItemToGameWithFormat);
};
