import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNetwork } from "./NetworkContext";
import { TexasHoldemStateDTO, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { createAuthPayload } from "../utils/cosmos/signing";
import { validateGameState, extractGameDataFromMessage } from "../utils/gameFormatUtils";
import type { ValidationError } from "../components/playPage/TableErrorPage";
import { CosmosApi } from "../apis/Api";
import { GameDataProvider, useGameData } from "./gameState/GameDataContext";
import { GameMetaProvider, useGameMeta } from "./gameState/GameMetaContext";
import { GameUIProvider, useGameUI } from "./gameState/GameUIContext";
import { ReplayProvider, useReplay } from "./gameState/ReplayContext";
import { GameActionsProvider, useGameActions } from "./gameState/GameActionsContext";

// Feature toggle for REST fallback (debug only - disabled by default per Commandment 7)
const ENABLE_REST_FALLBACK = false;
const AVATAR_SYNC_DEBUG =
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    ["1", "true"].includes((process.env.VITE_DEBUG_AVATAR_SYNC || "").toLowerCase());

/**
 * GameStateProvider — owns the WebSocket and the underlying state.
 *
 * Internally splits its state across five slice contexts (data, meta, UI,
 * replay, actions). Components that need only one slice should consume the
 * dedicated hook (useGameData, useGameMeta, useGameUI, useReplay,
 * useGameActions) to avoid re-rendering on unrelated updates.
 *
 * The legacy useGameStateContext() hook below aggregates all five slices
 * and preserves the original shape, so existing consumers keep working
 * without changes during the gradual migration.
 */

export interface GameStateContextType {
    gameState: TexasHoldemStateDTO | undefined;
    gameFormat: GameFormat | undefined;
    gameVariant: GameVariant | undefined;
    isLoading: boolean;
    error: Error | null;
    validationError: ValidationError | null;
    isReplayMode: boolean;
    replayHandNumber: number | null;
    replayActionIndex: number | null;
    subscribeToTable: (tableId: string) => void;
    unsubscribeFromTable: () => void;
    loadHistoricalState: (tableId: string, handNumber: number, actionIndex: number) => Promise<void>;
}

interface GameStateProviderProps {
    children: React.ReactNode;
}

export const GameStateProvider: React.FC<GameStateProviderProps> = ({ children }) => {
    const [gameState, setGameState] = useState<TexasHoldemStateDTO | undefined>(undefined);
    const [gameFormat, setGameFormat] = useState<GameFormat | undefined>(undefined);
    const [gameVariant, setGameVariant] = useState<GameVariant | undefined>(undefined);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [validationError, setValidationError] = useState<ValidationError | null>(null);
    const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
    const [replayHandNumber, setReplayHandNumber] = useState<number | null>(null);
    const [replayActionIndex, setReplayActionIndex] = useState<number | null>(null);
    const { currentNetwork } = useNetwork();

    // Use ref instead of state for currentTableId to prevent re-renders
    const currentTableIdRef = useRef<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const hasReceivedMessageRef = useRef<boolean>(false);
    const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const subscribeToTable = useCallback(
        (tableId: string) => {
            // Enhanced duplicate check to prevent re-subscription loops
            if (currentTableIdRef.current === tableId && wsRef.current?.readyState === WebSocket.OPEN) {
                return;
            }

            // Prevent rapid re-connection attempts
            if (wsRef.current?.readyState === WebSocket.CONNECTING) {
                return;
            }

            // Clean up existing connection
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            setIsLoading(true);
            setError(null);
            setValidationError(null);
            currentTableIdRef.current = tableId;
            hasReceivedMessageRef.current = false;

            // Clear any existing fallback timeout
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
                fallbackTimeoutRef.current = null;
            }

            // Get Cosmos player address
            const playerAddress = localStorage.getItem("user_cosmos_address");

            if (!playerAddress) {
                setError(new Error("No Block52 wallet address found. Please connect your wallet."));
                setIsLoading(false);
                return;
            }

            // Validate that the network has a ws property
            if (!currentNetwork.ws) {
                console.error("[GameStateContext] Network missing WebSocket endpoint");
                setError(new Error("Network configuration missing WebSocket endpoint"));
                setIsLoading(false);
                return;
            }

            // Create WebSocket connection using network context
            const fullWsUrl = `${currentNetwork.ws}?tableAddress=${tableId}&playerId=${playerAddress}`;
            const ws = new WebSocket(fullWsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                console.log("🔌 WebSocket connected to:", fullWsUrl);
                // Create authenticated subscription message with signature
                const authPayload = await createAuthPayload();

                const subscriptionMessage = {
                    type: "subscribe",
                    gameId: tableId,
                    playerAddress: authPayload?.playerAddress || playerAddress,
                    timestamp: authPayload?.timestamp,
                    signature: authPayload?.signature
                };

                console.log("📤 Sending subscription message:", subscriptionMessage);
                ws.send(JSON.stringify(subscriptionMessage));
                setIsLoading(false);

                // Set timeout to detect if WebSocket server doesn't respond
                fallbackTimeoutRef.current = setTimeout(() => {
                    if (!hasReceivedMessageRef.current && currentTableIdRef.current === tableId) {
                        console.error("[GameStateContext] WebSocket server did not respond within 5 seconds");
                        // Per Commandment 7: Surface errors, don't hide them
                        setError(new Error(
                            "WebSocket server not responding. The game server may be offline or not broadcasting game state. " +
                            "Please try refreshing or contact support if the issue persists."
                        ));
                        setIsLoading(false);
                    }
                }, 5000);
            };

            ws.onmessage = event => {
                try {
                    console.log("📬 Raw WebSocket message received:", event.data);
                    const message = JSON.parse(event.data);
                    hasReceivedMessageRef.current = true;

                    // Handle multiple message formats:
                    // - Old PVM format: type: "gameStateUpdate"
                    // - Cosmos initial state: event: "state"
                    // - Cosmos events: event: "player_joined_game", "action_performed", "game_created"
                    const cosmosEvents = ["state", "player_joined_game", "action_performed", "game_created"];
                    const isStateUpdate =
                        (message.type === "gameStateUpdate" && message.tableAddress === tableId) ||
                        (cosmosEvents.includes(message.event) && message.gameId === tableId);

                    if (isStateUpdate) {
                        console.log("📨 WebSocket message received:", message.event || message.type, "for gameId:", message.gameId || message.tableAddress);
                        // Extract game state, format, and variant from message
                        const { gameState: gameStateData, format: rawFormat, variant: rawVariant } = extractGameDataFromMessage(message);


                        if (!gameStateData) {
                            setValidationError({
                                missingFields: ["gameState"],
                                message: "No game state data received from server",
                                rawData: message
                            });
                            return;
                        }

                        if (AVATAR_SYNC_DEBUG) {
                            const playersWithAvatars = gameStateData.players
                                .filter(player => Boolean(player.avatar))
                                .map(player => ({
                                    seat: player.seat,
                                    address: player.address,
                                    avatar: player.avatar
                                }));

                            if (playersWithAvatars.length > 0) {
                                console.info("[ProfileAvatarDebug] Incoming websocket avatars", {
                                    gameId: message.gameId,
                                    event: message.event,
                                    playersWithAvatars
                                });
                            }
                        }

                        // Validate the game state data
                        const validation = validateGameState(
                            rawFormat as string | undefined,
                            rawVariant as string | undefined,
                            (gameStateData as TexasHoldemStateDTO)?.gameOptions
                        );

                        if (!validation.valid) {
                            // Per Commandment 7: NO defaults. Surface the validation error.
                            setValidationError({
                                missingFields: validation.missingFields,
                                message: validation.message,
                                rawData: message
                            });
                            // Still update gameState so the table renders what it can
                            setGameState(gameStateData as TexasHoldemStateDTO);
                            setGameFormat(rawFormat as GameFormat | undefined);
                            setGameVariant(rawVariant as GameVariant | undefined);
                            return;
                        }

                        // Valid data - update state
                        const playerAddress = localStorage.getItem("user_cosmos_address");
                        const currentPlayer = (gameStateData as TexasHoldemStateDTO)?.players?.find(p => p.address === playerAddress);
                        console.log("🎮 Game state updated. Current player status:", currentPlayer?.status, "| Player:", currentPlayer?.address?.slice(0, 10));
                        setGameState(gameStateData as TexasHoldemStateDTO);
                        setGameFormat(rawFormat as GameFormat);
                        setGameVariant(rawVariant as GameVariant);
                        setError(null);
                        setValidationError(null);
                    } else if (message.type === "error" || message.event === "error") {
                        // Handle error messages from the backend
                        const errorMsg =
                            message.code === "GAME_NOT_FOUND"
                                ? `${message.message}${message.details?.suggestion ? "\n\n" + message.details.suggestion : ""}`
                                : message.message || "An error occurred";

                        setError(new Error(errorMsg));
                        setIsLoading(false);

                        // If it's a game not found error, clear the game state
                        if (message.code === "GAME_NOT_FOUND") {
                            setGameState(undefined);
                        }
                    }
                    // Unhandled message types are silently ignored
                } catch (err) {
                    console.error("[GameStateContext] Failed to parse WebSocket message:", (err as Error).message);
                    setError(new Error("Error parsing WebSocket message"));
                }
            };

            ws.onclose = (event) => {
                console.log("🔌 WebSocket closed. Code:", event.code, "Reason:", event.reason, "Clean:", event.wasClean);
                if (wsRef.current === ws) {
                    wsRef.current = null;
                }
            };

            ws.onerror = (error) => {
                console.error("❌ WebSocket error:", error);
                setError(new Error(`WebSocket connection error for table ${tableId}`));
                setIsLoading(false);
            };
        },
        [currentNetwork]
    );

    const unsubscribeFromTable = useCallback(() => {
        // Clean up fallback timeout
        if (fallbackTimeoutRef.current) {
            clearTimeout(fallbackTimeoutRef.current);
            fallbackTimeoutRef.current = null;
        }

        // Clean up WebSocket connection
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        currentTableIdRef.current = null;
        hasReceivedMessageRef.current = false;
        setGameState(undefined);
        setGameFormat(undefined);
        setGameVariant(undefined);
        setIsLoading(false);
        setError(null);
        setValidationError(null);
    }, []);

    // Load point-in-time snapshot from chain (replay mode for readonly share links).
    // Uses pokerchain#160 GameStateAt RPC: previousActions is truncated to actions at
    // or before actionIndex, hole cards and deck are masked (public view).
    const loadHistoricalState = useCallback(
        async (tableId: string, handNumber: number, actionIndex: number): Promise<void> => {
            // Clean up any existing WebSocket connection — replay mode is a one-shot fetch.
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            setIsLoading(true);
            setError(null);
            setValidationError(null);
            setIsReplayMode(true);
            setReplayHandNumber(handNumber);
            setReplayActionIndex(actionIndex);
            currentTableIdRef.current = tableId;

            try {
                const cosmosApi = new CosmosApi({ baseUrl: currentNetwork.rest!, secure: false, timeout: 10000 });
                const response = await cosmosApi.getGameStateAt(tableId, handNumber, actionIndex) as { game_state?: string };

                if (!response || !response.game_state) {
                    throw new Error(`No game state found for hand ${handNumber} at action ${actionIndex}`);
                }

                const parsed = JSON.parse(response.game_state);

                // Chain may return a GameStateResponseDTO (with gameState nested)
                // or TexasHoldemStateDTO directly.
                const gameStateData = parsed.gameState || parsed;
                const rawFormat = parsed.format;
                const rawVariant = parsed.variant;

                setGameState(gameStateData as TexasHoldemStateDTO);
                setGameFormat(rawFormat as GameFormat | undefined);
                setGameVariant(rawVariant as GameVariant | undefined);
            } catch (err) {
                console.error("[GameStateContext] Failed to load historical state:", err);
                setError(err instanceof Error ? err : new Error("Failed to load historical state"));
            } finally {
                setIsLoading(false);
            }
        },
        [currentNetwork]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    return (
        <GameActionsProvider
            subscribeToTable={subscribeToTable}
            unsubscribeFromTable={unsubscribeFromTable}
            loadHistoricalState={loadHistoricalState}
        >
            <GameMetaProvider gameFormat={gameFormat} gameVariant={gameVariant}>
                <ReplayProvider
                    isReplayMode={isReplayMode}
                    replayHandNumber={replayHandNumber}
                    replayActionIndex={replayActionIndex}
                >
                    <GameUIProvider
                        isLoading={isLoading}
                        error={error}
                        validationError={validationError}
                    >
                        <GameDataProvider gameState={gameState}>{children}</GameDataProvider>
                    </GameUIProvider>
                </ReplayProvider>
            </GameMetaProvider>
        </GameActionsProvider>
    );
};

/**
 * Legacy aggregator hook. Returns the same shape as the old monolithic context.
 *
 * Prefer the granular hooks (useGameData, useGameMeta, useGameUI, useReplay,
 * useGameActions) in new code so consumers only re-render on the slice they
 * actually depend on.
 */
export const useGameStateContext = (): GameStateContextType => {
    const { gameState } = useGameData();
    const { gameFormat, gameVariant } = useGameMeta();
    const { isLoading, error, validationError } = useGameUI();
    const { isReplayMode, replayHandNumber, replayActionIndex } = useReplay();
    const { subscribeToTable, unsubscribeFromTable, loadHistoricalState } = useGameActions();

    return useMemo(
        () => ({
            gameState,
            gameFormat,
            gameVariant,
            isLoading,
            error,
            validationError,
            isReplayMode,
            replayHandNumber,
            replayActionIndex,
            subscribeToTable,
            unsubscribeFromTable,
            loadHistoricalState
        }),
        [
            gameState,
            gameFormat,
            gameVariant,
            isLoading,
            error,
            validationError,
            isReplayMode,
            replayHandNumber,
            replayActionIndex,
            subscribeToTable,
            unsubscribeFromTable,
            loadHistoricalState
        ]
    );
};
