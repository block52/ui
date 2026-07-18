import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNetwork } from "./NetworkContext";
import { TexasHoldemStateDTO, GameFormat, GameVariant } from "@block52/poker-vm-sdk";
import { createAuthPayload } from "../utils/cosmos/signing";
import { getGameTransport, getGatewayWsUrl } from "../utils/gameTransport";
import { setLatestGameState } from "../hooks/playerActions/transportAction";
import { ClassifiedMessage } from "../bus/ingest";
import { GameMessageBus } from "../bus/GameMessageBus";
import { type GameStreamItem } from "../bus/types";
import { viteEnv } from "../utils/viteEnv";
import { toGameFormat, toGameVariant } from "../utils/gameFormatUtils";
import { hasElements } from "../utils/guards";
import type { ValidationError } from "../components/playPage/TableErrorPage";
import { CosmosApi } from "../apis/Api";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { GameDataProvider, useGameData } from "./gameState/GameDataContext";
import { GameMetaProvider, useGameMeta } from "./gameState/GameMetaContext";
import { GameUIProvider, useGameUI, PendingAction } from "./gameState/GameUIContext";
import { ReplayProvider, useReplay } from "./gameState/ReplayContext";
import { GameActionsProvider, useGameActions } from "./gameState/GameActionsContext";
import { GameEventsProvider } from "./gameState/GameEventsContext";

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
    pendingAction: PendingAction | null;
    isReplayMode: boolean;
    replayHandNumber: number | null;
    replayActionIndex: number | null;
    subscribeToTable: (tableId: string) => void;
    unsubscribeFromTable: () => void;
    sendAction: (action: string, amount?: string) => Promise<void>;
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
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [isReplayMode, setIsReplayMode] = useState<boolean>(false);
    const [replayHandNumber, setReplayHandNumber] = useState<number | null>(null);
    const [replayActionIndex, setReplayActionIndex] = useState<number | null>(null);
    // Latest committed bus item — drives GameEventsContext / useGameEvents.
    const [latestStreamItem, setLatestStreamItem] = useState<GameStreamItem | null>(null);
    const { currentNetwork } = useNetwork();

    // Use ref instead of state for currentTableId to prevent re-renders
    const currentTableIdRef = useRef<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const hasReceivedMessageRef = useRef<boolean>(false);
    const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // WS Action Bus. Created eagerly in render so it exists before any child
    // effect calls subscribeToTable. The logical track (setLatestGameState) is
    // fed by the bus at ingest time; committed items drive the RENDER track via
    // applyRenderTrack below.
    const busRef = useRef<GameMessageBus | null>(null);
    if (busRef.current === null) {
        busRef.current = new GameMessageBus({ setLatestGameState });
    }

    // Stable bridge from the render layer to the bus's animation-ack API (Phase 5).
    // Exposed via GameEventsContext so animating hooks can report choreography
    // completion without reaching into the bus directly.
    const ackAnimation = useCallback((ackId: string) => {
        busRef.current?.ackAnimation(ackId);
    }, []);

    // Apply a classified message to the RENDER track (React state). Contains no
    // setLatestGameState calls — the logical track is updated by the bus at
    // ingest. setState dispatchers are stable, so this callback never changes
    // identity.
    const applyRenderTrack = useCallback((classified: ClassifiedMessage, rawMessage?: { gameId?: string; event?: string }) => {
        switch (classified.kind) {
            case "state": {
                if (AVATAR_SYNC_DEBUG) {
                    const playersWithAvatars = classified.snapshot.players
                        .filter(player => Boolean(player.avatar))
                        .map(player => ({ seat: player.seat, address: player.address, avatar: player.avatar }));

                    if (hasElements(playersWithAvatars)) {
                        console.info("[ProfileAvatarDebug] Incoming websocket avatars", {
                            gameId: rawMessage?.gameId,
                            event: rawMessage?.event,
                            playersWithAvatars
                        });
                    }
                }

                setGameState(classified.snapshot);
                setGameFormat(classified.format);
                setGameVariant(classified.variant);
                setPendingAction(null);

                if (classified.validationError) {
                    // Per Commandment 7: NO defaults. Surface the validation
                    // error but still render what we can.
                    setValidationError(classified.validationError);
                } else {
                    setError(null);
                    setValidationError(null);
                }
                break;
            }
            case "validationErrorNoState": {
                setValidationError(classified.validationError);
                break;
            }
            case "pending": {
                setPendingAction(classified.pendingAction);
                break;
            }
            case "actionAccepted": {
                // Acknowledgment that our action was accepted — no state change.
                break;
            }
            case "error": {
                setError(classified.error);
                setIsLoading(false);
                setPendingAction(null);
                if (classified.clearGameState) {
                    setGameState(undefined);
                }
                break;
            }
            case "ignore":
            default:
                break;
        }
    }, []);

    // Bus lifecycle: subscribe the render track to committed items and expose
    // the dev-only introspection handle (§5.4). Stripped from prod builds.
    useEffect(() => {
        const bus = busRef.current;
        if (!bus) {
            return;
        }
        const unsubscribe = bus.subscribe(item => {
            applyRenderTrack(item.classified, item.raw as { gameId?: string; event?: string });
            // Expose the committed item (with its derived events) to React.
            setLatestStreamItem(item);
        });
        if (!viteEnv.PROD) {
            window.__B52_BUS__ = bus.introspection;
        }
        return () => {
            unsubscribe();
            if (!viteEnv.PROD && window.__B52_BUS__ === bus.introspection) {
                delete window.__B52_BUS__;
            }
        };
    }, [applyRenderTrack]);

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

            // Reset the bus on (re)subscribe: drop any queued frames from a
            // prior subscription. seq continues monotonically (never reused).
            busRef.current?.reset();
            setLatestStreamItem(null);

            // Clear any existing fallback timeout
            if (fallbackTimeoutRef.current) {
                clearTimeout(fallbackTimeoutRef.current);
                fallbackTimeoutRef.current = null;
            }

            // Get Cosmos player address
            const playerAddress = localStorage.getItem(STORAGE_KEYS.cosmosAddress);

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

            // Create WebSocket connection. Gateway transport (ui#440) talks
            // to the optimistic action gateway's socket; chain transport
            // keeps the existing node WS endpoint.
            const transport = getGameTransport();
            const fullWsUrl = transport === "gateway"
                ? getGatewayWsUrl()
                : `${currentNetwork.ws}?tableAddress=${tableId}&playerId=${playerAddress}`;
            const ws = new WebSocket(fullWsUrl);
            wsRef.current = ws;

            ws.onopen = async () => {
                // Create authenticated subscription message with signature
                const authPayload = await createAuthPayload();

                const subscriptionMessage = transport === "gateway"
                    ? {
                          // Gateway contract (poker-vm#2224): `address`, seconds
                          // timestamp, same pokerchain-query signed payload.
                          type: "subscribe",
                          gameId: tableId,
                          address: authPayload?.playerAddress || playerAddress,
                          timestamp: authPayload?.timestamp,
                          signature: authPayload?.signature
                      }
                    : {
                          type: "subscribe",
                          gameId: tableId,
                          playerAddress: authPayload?.playerAddress || playerAddress,
                          timestamp: authPayload?.timestamp,
                          signature: authPayload?.signature
                      };

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
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch (err) {
                    console.error("[GameStateContext] Failed to parse WebSocket message:", (err as Error).message);
                    setError(new Error("Error parsing WebSocket message"));
                    return;
                }

                hasReceivedMessageRef.current = true;

                // WS Action Bus. The bus classifies the message, updates the
                // logical track at ingest, and drives the render track through
                // committed items (applyRenderTrack, wired via subscribe).
                busRef.current?.ingest(message, tableId);
            };

            ws.onclose = () => {
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
        busRef.current?.reset();
        setLatestStreamItem(null);
        setGameState(undefined);
                            setLatestGameState(undefined);
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
            const playerAddress = localStorage.getItem(STORAGE_KEYS.cosmosAddress);

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

            // Replay bypasses the bus entirely; drop any queued live frames and
            // any derived-event state (replay has no pacing/event semantics).
            busRef.current?.reset();
            setLatestStreamItem(null);

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
                setGameFormat(toGameFormat(rawFormat));
                setGameVariant(toGameVariant(rawVariant));
                setPendingAction(null);
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
            sendAction={sendAction}
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
                        pendingAction={pendingAction}
                    >
                        <GameEventsProvider latestItem={latestStreamItem} ackAnimation={ackAnimation}>
                            <GameDataProvider gameState={gameState}>{children}</GameDataProvider>
                        </GameEventsProvider>
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
    const { isLoading, error, validationError, pendingAction } = useGameUI();
    const { isReplayMode, replayHandNumber, replayActionIndex } = useReplay();
    const { subscribeToTable, unsubscribeFromTable, sendAction, loadHistoricalState } = useGameActions();

    return useMemo(
        () => ({
            gameState,
            gameFormat,
            gameVariant,
            isLoading,
            error,
            validationError,
            pendingAction,
            isReplayMode,
            replayHandNumber,
            replayActionIndex,
            subscribeToTable,
            unsubscribeFromTable,
            sendAction,
            loadHistoricalState
        }),
        [
            gameState,
            gameFormat,
            gameVariant,
            isLoading,
            error,
            validationError,
            pendingAction,
            isReplayMode,
            replayHandNumber,
            replayActionIndex,
            subscribeToTable,
            unsubscribeFromTable,
            sendAction,
            loadHistoricalState
        ]
    );
};
