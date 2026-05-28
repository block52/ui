import { useState, useCallback } from "react";
import { GameFormat, GameVariant, COSMOS_CONSTANTS } from "@block52/poker-vm-sdk";
import { getSigningClient, getCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import {  convertBlindsForBlockchain } from "../../utils/gameFormatUtils";
import { DEFAULT_TIMEOUT_SECONDS } from "../../utils/timerUtils";
import { usdcToMicroBigInt } from "../../constants/currency";

// Type for rake configuration options
export interface RakeOptions {
    rakeFreeThreshold: number;  // Pot threshold in USDC below which no rake is taken
    rakePercentage: number;     // Percentage of pot taken as rake (0-100)
    rakeCap: number;            // Maximum rake amount in USDC per hand
    owner: string;              // Address that receives the rake
}

// Type for SNG/Tournament specific options
export interface SNGOptions {
    startingStack: number;       // Starting chips for each player (in chips, not dollars)
    blindLevelDuration?: number; // Minutes per blind level (default: 10)
}

// Type for creating new table options
export interface CreateTableOptions {
    format: GameFormat;
    minBuyIn: number;
    maxBuyIn: number;
    minPlayers: number;
    maxPlayers: number;
    smallBlind: number;
    bigBlind: number;
    rake?: RakeOptions;         // Optional rake configuration
    sng?: SNGOptions;           // Optional SNG/Tournament configuration
}

// Type for useNewTable hook return
export interface UseNewTableReturn {
    createTable: (gameOptions: CreateTableOptions) => Promise<{ txHash: string; gameId: string | null } | null>;
    isCreating: boolean;
    error: Error | null;
    newGameId: string | null;
}

/**
 * Custom hook to create a new game on Cosmos blockchain using SigningCosmosClient
 * @returns Object with createTable function, loading state, and error
 */
export const useNewTable = (): UseNewTableReturn => {
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [newGameId, setNewGameId] = useState<string | null>(null);
    const { currentNetwork } = useNetwork();

    const createTable = useCallback(async (
        gameOptions: CreateTableOptions
    ): Promise<{ txHash: string; gameId: string | null } | null> => {
        setIsCreating(true);
        setError(null);
        setNewGameId(null);

        try {
            const { signingClient, userAddress: _userAddress } = await getSigningClient(currentNetwork);

            // Convert buy-in amounts from dollars to USDC micro-units (1 USDC = 1,000,000 micro-units)
            // For both cash games and tournaments, the buy-in is specified in dollars, so we convert to micro-units for blockchain
            const minBuyInB52USDC = usdcToMicroBigInt(gameOptions.minBuyIn);
            const maxBuyInB52USDC = usdcToMicroBigInt(gameOptions.maxBuyIn);

            // Convert blind values based on game format using utility function
            // For cash games: converts from dollars to USDC micro-units
            // For tournaments: uses chip values directly
            const { smallBlind: smallBlindB52USDC, bigBlind: bigBlindB52USDC } = convertBlindsForBlockchain(
                gameOptions.format,
                gameOptions.smallBlind,
                gameOptions.bigBlind
            );

            // Convert rake options if provided
            let rakeConfig = undefined;
            if (gameOptions.rake) {
                const rakeFreeThresholdB52USDC = BigInt(Math.floor(gameOptions.rake.rakeFreeThreshold * Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)));
                const rakeCapB52USDC = BigInt(Math.floor(gameOptions.rake.rakeCap * Math.pow(10, COSMOS_CONSTANTS.USDC_DECIMALS)));

                rakeConfig = {
                    rakeFreeThreshold: rakeFreeThresholdB52USDC,
                    rakePercentage: gameOptions.rake.rakePercentage,
                    rakeCap: rakeCapB52USDC,
                    owner: gameOptions.rake.owner
                };
            }

            // Convert SNG options if provided
            let sngConfig = undefined;
            if (gameOptions.sng) {
                sngConfig = {
                    startingStack: BigInt(gameOptions.sng.startingStack),
                    blindLevelDuration: gameOptions.sng.blindLevelDuration
                };
            }

            // Game format is already in kebab-case from GameFormat enum
            const gameFormat = gameOptions.format;
            // Default to Texas Hold'em for now (only variant currently supported)
            const gameVariant = GameVariant.TEXAS_HOLDEM;

            // Timeout in seconds from centralised timer config
            const timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;

            // Call SigningCosmosClient.createGame()
            const txHash = await signingClient.createGame(
                gameFormat,
                gameVariant,
                gameOptions.minPlayers,
                gameOptions.maxPlayers,
                minBuyInB52USDC,
                maxBuyInB52USDC,
                smallBlindB52USDC,
                bigBlindB52USDC,
                timeoutSeconds,
                rakeConfig,
                sngConfig
            );

            if (txHash) {
                setNewGameId(txHash);

                const cosmosClient = getCosmosClient(currentNetwork);

                if (!cosmosClient) {
                    return null;
                }

                // Wait a moment for the transaction to be indexed
                await new Promise(resolve => setTimeout(resolve, 2000));

                let tx;
                try {
                    tx = await cosmosClient.getTx(txHash);
                } catch (_txError) {
                    // Indexer hiccup — tx is on-chain but we couldn't fetch it.
                    return { txHash, gameId: null };
                }

                // Chain accepted the tx into a block but the message can still
                // have failed (non-zero code). Surface the raw_log so the UI
                // doesn't show a misleading success state.
                const code = tx?.tx_response?.code;
                if (code !== undefined && code !== 0) {
                    throw new Error(tx?.tx_response?.raw_log || `tx failed with code ${code}`);
                }

                // Extract game_id from game_created event
                let gameId: string | null = null;
                if (tx?.tx_response?.events) {
                    const gameCreatedEvent = tx.tx_response.events.find((e: any) => e.type === "game_created");
                    if (gameCreatedEvent) {
                        const gameIdAttr = gameCreatedEvent.attributes?.find((a: any) => a.key === "game_id");
                        if (gameIdAttr) {
                            gameId = gameIdAttr.value;
                        }
                    }
                }

                return { txHash, gameId };
            } else {
                return null;
            }
        } catch (err: any) {
            const errorMessage = err.message || "Failed to create game on blockchain";
            setError(new Error(errorMessage));
            return null;
        } finally {
            setIsCreating(false);
        }
    }, [currentNetwork]);

    return {
        createTable,
        isCreating,
        error,
        newGameId
    };
};
