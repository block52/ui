import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNetwork } from "./NetworkContext";
import { TexasHoldemStateDTO, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { createAuthPayload } from "../utils/cosmos/signing";
import { validateGameState, extractGameDataFromMessage } from "../utils/gameFormatUtils";
import type { ValidationError } from "../components/playPage/TableErrorPage";

// Feature toggle for REST fallback (debug only - disabled by default per Commandment 7)
const ENABLE_REST_FALLBACK = false;
const AVATAR_SYNC_DEBUG =
    typeof process !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    ["1", "true"].includes((process.env.VITE_DEBUG_AVATAR_SYNC || "").toLowerCase());
/**
 * GameStateContext - Centralized WebSocket state management
 *
 * SIMPLIFIED ARCHITECTURE:
 * Components → useGameState → GameStateContext → WebSocket (direct)
 *
 * BENEFITS:
 * - No more WebSocketSingleton complexity
 * - No more callback system needed
 * - Context manages ONE WebSocket connection per table
 * - All components read from Context state automatically
 * - Stable React lifecycle management
 */

// Pending action for optimistic updates
interface PendingAction {
    gameId: string;
    actor: string;
    action: string;
    amount?: string;
    timestamp: number;
}

interface GameStateContextType {
    gameState: TexasHoldemStateDTO | undefined;
    gameFormat: GameFormat | undefined;
    gameVariant: GameVariant | undefined;
    isLoading: boolean;
    error: Error | null;
    validationError: ValidationError | null;
    pendingAction: PendingAction | null;
    subscribeToTable: (tableId: string) => void;
    unsubscribeFromTable: () => void;
    sendAction: (action: string, amount?: string) => Promise<void>;
}

const GameStateContext = createContext<GameStateContextType | null>(null);

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
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
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
                            setPendingAction(null);
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
                        setPendingAction(null);
                    } else if (message.event === "pending") {
                        // Handle optimistic update - action accepted by mempool but not yet confirmed
                        const pendingData = message.data;
                        if (pendingData) {
                            setPendingAction({
                                gameId: pendingData.gameId || message.gameId,
                                actor: pendingData.actor,
                                action: pendingData.action,
                                amount: pendingData.amount,
                                timestamp: Date.now()
                            });
                        }
                    } else if (message.event === "action_accepted") {
                        // Acknowledgment that our action was accepted - no action needed
                    } else if (message.type === "error" || message.event === "error") {
                        // Handle error messages from the backend
                        const errorMsg =
                            message.code === "GAME_NOT_FOUND"
                                ? `${message.message}${message.details?.suggestion ? "\n\n" + message.details.suggestion : ""}`
                                : message.message || "An error occurred";

                        setError(new Error(errorMsg));
                        setIsLoading(false);
                        setPendingAction(null);

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
        setPendingAction(null);
    }, []);

    // Send action through WebSocket for immediate broadcast
    const sendAction = useCallback(
        async (action: string, amount?: string): Promise<void> => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                throw new Error("WebSocket not connected");
            }

            if (!currentTableIdRef.current) {
                throw new Error("Not subscribed to a table");
            }

            // Get Cosmos player address
            const playerAddress = localStorage.getItem("user_cosmos_address");

            if (!playerAddress) {
                throw new Error("No Block52 wallet address found. Please connect your wallet.");
            }

            const actionMessage = {
                type: "action",
                gameId: currentTableIdRef.current,
                playerAddress: playerAddress,
                action: action,
                amount: amount
            };

            wsRef.current.send(JSON.stringify(actionMessage));
        },
        []
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

    // Memoize context value to prevent unnecessary re-renders
    const contextValue = useMemo(
        (): GameStateContextType => ({
            gameState,
            gameFormat,
            gameVariant,
            isLoading,
            error,
            validationError,
            pendingAction,
            subscribeToTable,
            unsubscribeFromTable,
            sendAction
        }),
        [gameState, gameFormat, gameVariant, isLoading, error, validationError, pendingAction, subscribeToTable, unsubscribeFromTable, sendAction]
    );

    return <GameStateContext.Provider value={contextValue}>{children}</GameStateContext.Provider>;
};

export const useGameStateContext = (): GameStateContextType => {
    const context = useContext(GameStateContext);
    if (!context) {
        throw new Error("useGameStateContext must be used within a GameStateProvider");
    }
    return context;
};
