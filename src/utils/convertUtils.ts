import { GameListItem, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { getGameFormat, getGameVariant } from "./gameFormatUtils";

/**
 * Flattened game representation for UI display (e.g., table lists).
 * Converts the nested SDK GameListItem into a flat structure.
 */
export interface GameWithFormat {
    gameId: string;
    minBuyIn: string;
    maxBuyIn: string;
    minPlayers: number;
    maxPlayers: number;
    currentPlayers: number;
    gameFormat: GameFormat | "unknown";
    gameVariant: GameVariant | "unknown";
    smallBlind: string;
    bigBlind: string;
    status: string;
    creator?: string;
    timeout?: number;
    createdAt?: string;
    updatedAt?: string;
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
        minBuyIn: opts.minBuyIn,
        maxBuyIn: opts.maxBuyIn,
        minPlayers: opts.minPlayers,
        maxPlayers: opts.maxPlayers,
        currentPlayers: game.currentPlayers ? game.currentPlayers : 0,
        gameFormat: getGameFormat(game.format),
        gameVariant: getGameVariant(game.variant),
        smallBlind: opts.smallBlind,
        bigBlind: opts.bigBlind,
        status: "waiting",
        creator: game.creator,
        timeout: opts.timeout,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt
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
