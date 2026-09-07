/**
 * Game Format Utilities
 *
 * Re-exported from @block52/poker-vm-sdk for convenience.
 * All utilities now live in the SDK to ensure consistency across clients.
 */

export {
    isTournamentFormat,
    isCashFormat,
    isSitAndGoFormat,
    formatGameFormatDisplay,
    getGameFormatForCosmos,
    getGameFormat,
    getGameFormatFromObject,
    parseGameFormat,
    formatGameVariantDisplay,
    getGameVariant,
    parseGameVariant
} from "@block52/poker-vm-sdk";

import { GameFormat, GameVariant, GameOptionsDTO, TexasHoldemStateDTO, COSMOS_CONSTANTS, isTournamentFormat as isTournamentFormatFn, parseGameFormat as parseGameFormatFn, parseGameVariant as parseGameVariantFn } from "@block52/poker-vm-sdk";
import { isBlank, isNullish, hasElements } from "./guards";

/**
 * Coerce a raw format string into a GameFormat, returning undefined for missing
 * or unrecognized values. The SDK's parseGameFormat returns the sentinel
 * "unknown", but UI state is typed `GameFormat | undefined` — routing through
 * this keeps malformed chain data out of state instead of an inline cast
 * (Commandment 12) that would store a fake value (Commandment 7).
 */
export const toGameFormat = (value: string | undefined): GameFormat | undefined => {
    const parsed = parseGameFormatFn(value);
    return parsed === "unknown" ? undefined : parsed;
};

/**
 * Coerce a raw variant string into a GameVariant, returning undefined for
 * missing or unrecognized values. See {@link toGameFormat}.
 */
export const toGameVariant = (value: string | undefined): GameVariant | undefined => {
    const parsed = parseGameVariantFn(value);
    return parsed === "unknown" ? undefined : parsed;
};

/**
 * Result of extracting game data from a WebSocket message
 */
export interface ExtractedGameData {
    gameState: TexasHoldemStateDTO | undefined;
    format: string | undefined;
    variant: string | undefined;
    // Optional ENS-style table name (poker-vm#337); root-level, absent for unnamed tables.
    name: string | undefined;
}

/**
 * Canonical Cosmos WebSocket message structure.
 * Per Commandment 8: NO backwards compatibility - one shape only.
 *
 * Server sends:
 * {
 *   "gameId": "0x...",
 *   "timestamp": "2026-02-04T12:34:56Z",
 *   "event": "state",
 *   "data": {
 *     "format": "sit-and-go",
 *     "variant": "texas-holdem",
 *     "gameState": { TexasHoldemStateDTO }
 *   }
 * }
 */
interface CosmosGameStateMessage {
    gameId?: string;
    timestamp?: string;
    event?: string;
    data?: {
        gameState?: TexasHoldemStateDTO;
        format?: string;
        variant?: string;
        name?: string;
    };
}

/**
 * Extracts game state, format, and variant from a Cosmos WebSocket message.
 *
 * Per Commandment 8 (NO Backwards Compat): Only reads from the canonical
 * Cosmos message shape (message.data.*). No fallback paths.
 *
 * @param message - The WebSocket message to extract data from
 * @returns Extracted game state, format, and variant
 */
export const extractGameDataFromMessage = (message: CosmosGameStateMessage): ExtractedGameData => {
    const gameState = message.data?.gameState;
    const format = message.data?.format;
    const variant = message.data?.variant;
    const name = message.data?.name;

    return { gameState, format, variant, name };
};

/**
 * Validation result for game state data
 */
export interface GameStateValidationResult {
    valid: boolean;
    missingFields: string[];
    message: string;
}

/**
 * Validates that all required game state fields are present.
 * Does NOT use defaults - returns validation errors instead.
 *
 * @param format - The game format from the chain
 * @param variant - The game variant from the chain
 * @param gameOptions - The game options from the chain
 * @returns Validation result with missing fields if invalid
 */
export const validateGameState = (
    format: GameFormat | string | undefined,
    variant: GameVariant | string | undefined,
    gameOptions: GameOptionsDTO | null | undefined
): GameStateValidationResult => {
    const missingFields: string[] = [];

    // Validate format
    if (isBlank(format)) {
        missingFields.push("format");
    }

    // Validate variant
    if (isBlank(variant)) {
        missingFields.push("variant");
    }

    // Validate gameOptions exists
    if (!gameOptions) {
        missingFields.push("gameOptions");
    } else {
        // Validate required gameOptions fields
        // Use explicit null/undefined checks — NOT falsy checks.
        // Per Commandment 9, these are string fields. A falsy check (!value)
        // would incorrectly reject 0 (number) which JSON.parse may produce.
        if (isBlank(gameOptions.smallBlind)) {
            missingFields.push("gameOptions.smallBlind");
        }
        if (isBlank(gameOptions.bigBlind)) {
            missingFields.push("gameOptions.bigBlind");
        }
        if (isBlank(gameOptions.minBuyIn)) {
            missingFields.push("gameOptions.minBuyIn");
        }
        if (isBlank(gameOptions.maxBuyIn)) {
            missingFields.push("gameOptions.maxBuyIn");
        }
        if (isNullish(gameOptions.minPlayers)) {
            missingFields.push("gameOptions.minPlayers");
        }
        if (isNullish(gameOptions.maxPlayers)) {
            missingFields.push("gameOptions.maxPlayers");
        }
    }

    if (hasElements(missingFields)) {
        return {
            valid: false,
            missingFields,
            message: `Game data is incomplete. Missing required fields: ${missingFields.join(", ")}`
        };
    }

    return {
        valid: true,
        missingFields: [],
        message: ""
    };
};

/**
 * Result of converting blinds for blockchain submission
 */
export interface ConvertedBlinds {
    smallBlind: bigint;
    bigBlind: bigint;
}

/**
 * Converts blind values for blockchain submission based on game format.
 *
 * For tournament-style games (SNG, Tournament): Blinds represent chip counts
 * and are used directly without conversion.
 *
 * For cash games: Blinds represent dollar amounts and are converted to
 * USDC micro-units (6 decimals) for the blockchain.
 *
 * @param format - The game format (cash, sit-and-go, tournament)
 * @param smallBlind - The small blind value (dollars for cash, chips for tournament)
 * @param bigBlind - The big blind value (dollars for cash, chips for tournament)
 * @returns Converted blind values as bigints ready for blockchain
 *
 * @example
 * // Cash game: $0.50/$1.00 blinds
 * convertBlindsForBlockchain("cash", 0.5, 1.0)
 * // Returns { smallBlind: 500000n, bigBlind: 1000000n }
 *
 * @example
 * // SNG: 25/50 chip blinds
 * convertBlindsForBlockchain("sit-and-go", 25, 50)
 * // Returns { smallBlind: 25n, bigBlind: 50n }
 */
export const convertBlindsForBlockchain = (
    format: GameFormat | string,
    smallBlind: number,
    bigBlind: number
): ConvertedBlinds => {
    const isTournament = isTournamentFormatFn(format);

    if (isTournament) {
        // SNG/Tournament: blinds are in chips, use directly
        return {
            smallBlind: BigInt(Math.floor(smallBlind)),
            bigBlind: BigInt(Math.floor(bigBlind))
        };
    } else {
        // Cash game: convert from dollars to USDC micro-units (6 decimals)
        const multiplier = Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS);
        return {
            smallBlind: BigInt(Math.floor(smallBlind * multiplier)),
            bigBlind: BigInt(Math.floor(bigBlind * multiplier))
        };
    }
};

/**
 * Converts a dollar/chip amount to blockchain units based on game format.
 * - Cash: multiplies by 10^6 (USDC microunits)
 * - SNG/Tournament: uses raw chip value (no conversion)
 *
 * @example
 * convertAmountForBlockchain("cash", 10)        // Returns 10000000n
 * convertAmountForBlockchain("sit-and-go", 1000) // Returns 1000n
 */
export const convertAmountForBlockchain = (
    format: GameFormat | string,
    amount: number
): bigint => {
    const isTournament = isTournamentFormatFn(format);

    if (isTournament) {
        return BigInt(Math.floor(amount));
    } else {
        const multiplier = Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS);
        return BigInt(Math.floor(amount * multiplier));
    }
};

/**
 * Result of getting blinds for display
 */
export interface DisplayBlinds {
    smallBlind: number;
    bigBlind: number;
    stakeLabel: string;
}

/**
 * Gets blind values for display based on game format.
 *
 * For tournament-style games (SNG, Tournament): Blinds are stored as chip counts
 * and returned as-is with a chip-formatted stake label.
 *
 * For cash games: Blinds are stored as USDC micro-units (6 decimals) and
 * converted to dollars for display.
 *
 * @param format - The game format (cash, sit-and-go, tournament)
 * @param smallBlindStored - The small blind value as stored (string from chain)
 * @param bigBlindStored - The big blind value as stored (string from chain)
 * @returns Blind values and stake label for display
 *
 * @example
 * // Cash game: stored as micro-units "500000" / "1000000"
 * getBlindsForDisplay("cash", "500000", "1000000")
 * // Returns { smallBlind: 0.5, bigBlind: 1, stakeLabel: "$0.50 / $1.00" }
 *
 * @example
 * // SNG: stored as chip counts "25" / "50"
 * getBlindsForDisplay("sit-and-go", "25", "50")
 * // Returns { smallBlind: 25, bigBlind: 50, stakeLabel: "25 / 50 chips" }
 */
export const getBlindsForDisplay = (
    format: GameFormat | string,
    smallBlindStored: string | undefined,
    bigBlindStored: string | undefined
): DisplayBlinds => {
    // Handle undefined inputs (React lifecycle — gameState not yet loaded)
    if (!smallBlindStored || !bigBlindStored) {
        return { smallBlind: 0, bigBlind: 0, stakeLabel: "" };
    }

    const isTournament = isTournamentFormatFn(format);

    if (isTournament) {
        // SNG/Tournament: blinds are stored as chip counts, use directly
        const smallBlind = Number(smallBlindStored);
        const bigBlind = Number(bigBlindStored);
        return {
            smallBlind,
            bigBlind,
            stakeLabel: `${smallBlind.toLocaleString()} / ${bigBlind.toLocaleString()} chips`
        };
    } else {
        // Cash game: blinds are stored as USDC micro-units, convert to dollars
        const divisor = Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS);
        const smallBlind = Number(smallBlindStored) / divisor;
        const bigBlind = Number(bigBlindStored) / divisor;
        return {
            smallBlind,
            bigBlind,
            stakeLabel: `$${smallBlind.toFixed(2)} / $${bigBlind.toFixed(2)}`
        };
    }
};

/**
 * Returns a mnemonic label for the game type based on player count.
 *
 * @param minPlayers - The minimum (or target) player count for the game
 * @returns A short human-readable label (e.g., "Heads Up", "6-Max", "Full Ring")
 *
 * @example
 * getGameTypeMnemonic(2)  // "Heads Up"
 * getGameTypeMnemonic(6)  // "6-Max"
 * getGameTypeMnemonic(9)  // "Full Ring"
 * getGameTypeMnemonic(4)  // "4 Players"
 * getGameTypeMnemonic(undefined)  // ""
 */
export const getGameTypeMnemonic = (minPlayers: number | undefined): string => {
    if (isNullish(minPlayers)) return "";
    if (minPlayers === 2) return "Heads Up";
    if (minPlayers === 6) return "6-Max";
    if (minPlayers === 9) return "Full Ring";
    return `${minPlayers} Players`;
};
